import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaptureStatus, Prisma } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

type CaptureCategory = 'idea' | 'reflection' | 'method' | 'question' | 'quote' | 'mixed';

interface CaptureAnalysis {
  category: CaptureCategory;
  summary: string;
  insight: string;
  actionSuggestion: string;
  tags: string[];
  sourceType: string;
  sourceName: string;
}

interface CreateCaptureInput {
  content: string;
  sourceType?: string;
  sourceName?: string;
}

interface UpdateCaptureInput {
  content?: string;
  sourceType?: string;
  sourceName?: string;
}

const ANALYSIS_CATEGORIES = new Set<CaptureCategory>([
  'idea',
  'reflection',
  'method',
  'question',
  'quote',
  'mixed',
]);

const CAPTURE_ANALYSIS_SYSTEM_PROMPT = `你是 LifeTracker 的知识整理助手。你会基于用户的原始记录，生成一份结构化整理结果。

要求：
1. 绝对保留用户原意，不要杜撰没有出现过的信息。
2. 不要改写或覆盖原文，原文会单独保存。
3. 仅返回 JSON，不要返回 Markdown，不要添加解释文字。
4. tags 给 2 到 5 个短标签；如果不够明确，可以少于 5 个。
5. 只有在原文明确提到来源时才填写来源相关字段，否则返回空字符串。
6. sourceType 表示来源类型，不是内容类型。常见值如：播客、电影、书、文章、视频、访谈、梦境、生活。
7. 如果这条记录本身是在描述做梦、梦见、梦到、梦里发生的内容，sourceType 填写“梦境”。

返回 JSON 结构：
{
  "category": "idea | reflection | method | question | quote | mixed",
  "summary": "一句简洁总结",
  "insight": "这条记录最有价值的洞察",
  "actionSuggestion": "如果能转成行动，给出一个具体建议；否则返回空字符串",
  "tags": ["标签1", "标签2"],
  "sourceType": "来源类型，如播客/电影/书/文章；不明确则空字符串",
  "sourceName": "具体来源名称；不明确则空字符串"
}`;

@Injectable()
export class CapturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async list(userId: string, limit = 20) {
    return this.withTableGuard(async () => {
      const safeLimit = Math.min(Math.max(limit, 1), 50);
      const items = await this.prisma.capture.findMany({
        where: {
          userId,
          status: {
            not: CaptureStatus.ARCHIVED,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: safeLimit,
      });

      return {
        items: items.map((item) => this.serializeCapture(item)),
      };
    });
  }

  async create(userId: string, input: CreateCaptureInput) {
    return this.withTableGuard(async () => {
      const rawContent = this.normalizeRawContent(input.content);

      const sourceType = this.normalizeSourceType(input.sourceType) || null;
      const sourceName = this.normalizeSourceName(input.sourceName) || null;

      const capture = await this.prisma.capture.create({
        data: {
          userId,
          rawContent,
          sourceType,
          sourceName,
        },
      });

      return this.serializeCapture(capture);
    });
  }

  async analyze(userId: string, captureId: string) {
    return this.withTableGuard(async () => {
      const capture = await this.prisma.capture.findFirst({
        where: {
          id: captureId,
          userId,
        },
      });

      if (!capture) {
        throw new NotFoundException('记录不存在');
      }

      const analysis = await this.requestAnalysis(capture.rawContent);
      const inferredSourceType = this.inferSourceTypeFromRawContent(capture.rawContent);
      const sourceType = this.normalizeSourceType(capture.sourceType) || analysis.sourceType || inferredSourceType || null;
      const sourceName = this.normalizeSourceName(capture.sourceName) || analysis.sourceName || null;
      const storedAnalysis = this.buildStoredAnalysis(analysis, {
        sourceType,
        sourceName,
      });

      const updated = await this.prisma.capture.update({
        where: { id: capture.id },
        data: {
          status: CaptureStatus.ANALYZED,
          analysis: storedAnalysis as unknown as Prisma.InputJsonObject,
          analyzedAt: new Date(),
          sourceType,
          sourceName,
        },
      });

      return this.serializeCapture(updated);
    });
  }

  async update(userId: string, captureId: string, input: UpdateCaptureInput) {
    return this.withTableGuard(async () => {
      const capture = await this.prisma.capture.findFirst({
        where: {
          id: captureId,
          userId,
        },
      });

      if (!capture) {
        throw new NotFoundException('记录不存在');
      }

      const hasContent = Object.prototype.hasOwnProperty.call(input, 'content');
      const hasSourceType = Object.prototype.hasOwnProperty.call(input, 'sourceType');
      const hasSourceName = Object.prototype.hasOwnProperty.call(input, 'sourceName');

      if (!hasContent && !hasSourceType && !hasSourceName) {
        throw new BadRequestException('没有可更新的内容');
      }

      const data: Prisma.CaptureUpdateInput = {};
      let rawContentChanged = false;

      if (hasContent) {
        const rawContent = this.normalizeRawContent(input.content);
        rawContentChanged = rawContent !== capture.rawContent;
        data.rawContent = rawContent;
      }

      if (hasSourceType) {
        data.sourceType = this.normalizeSourceType(input.sourceType) || null;
      }

      if (hasSourceName) {
        data.sourceName = this.normalizeSourceName(input.sourceName) || null;
      }

      if (rawContentChanged) {
        data.status = CaptureStatus.RAW;
        data.analysis = Prisma.DbNull;
        data.analyzedAt = null;
      } else if (capture.analysis && (hasSourceType || hasSourceName)) {
        const analysis = this.normalizeStoredAnalysis(capture.analysis);
        if (analysis) {
          const nextSourceType = hasSourceType
            ? (this.normalizeSourceType(input.sourceType) || null)
            : (capture.sourceType || null);
          const nextSourceName = hasSourceName
            ? (this.normalizeSourceName(input.sourceName) || null)
            : (capture.sourceName || null);

          data.analysis = this.buildStoredAnalysis(analysis, {
            sourceType: nextSourceType,
            sourceName: nextSourceName,
          }) as unknown as Prisma.InputJsonObject;
        }
      }

      const updated = await this.prisma.capture.update({
        where: { id: capture.id },
        data,
      });

      return this.serializeCapture(updated);
    });
  }

  private serializeCapture(capture: {
    id: string;
    userId: string;
    rawContent: string;
    sourceType: string | null;
    sourceName: string | null;
    sourceHint?: string | null;
    status: CaptureStatus;
    analysis: Prisma.JsonValue | null;
    analyzedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const { sourceHint, ...rest } = capture;
    void sourceHint;
    const analysis = this.normalizeStoredAnalysis(capture.analysis);
    const inferredSourceType = this.inferSourceTypeFromRawContent(capture.rawContent);
    const sourceType = this.normalizeSourceType(capture.sourceType) || analysis?.sourceType || inferredSourceType || null;
    const sourceName = this.normalizeSourceName(capture.sourceName)
      || analysis?.sourceName
      || this.normalizeSourceName(capture.sourceHint)
      || null;

    return {
      ...rest,
      sourceType,
      sourceName,
      analysis,
    };
  }

  private normalizeStoredAnalysis(value: Prisma.JsonValue | null): CaptureAnalysis | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return this.normalizeAnalysis(value as Record<string, unknown>);
  }

  private async requestAnalysis(rawContent: string): Promise<CaptureAnalysis> {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'GLM-4-Flash');
    const timeout = this.configService.get<number>('AI_TIMEOUT', 30000);

    if (!apiUrl || !apiKey) {
      throw new ServiceUnavailableException('AI 整理服务未配置');
    }

    const response = await axios.post(
      apiUrl,
      {
        model,
        messages: [
          { role: 'system', content: CAPTURE_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: rawContent },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout,
      },
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ServiceUnavailableException('AI 整理结果为空，请稍后重试');
    }

    const parsed = this.extractJsonObject(content);
    if (!parsed) {
      return {
        category: 'mixed',
        summary: this.truncate(content.trim(), 180),
        insight: '',
        actionSuggestion: '',
        tags: [],
        sourceType: '',
        sourceName: '',
      };
    }

    return this.normalizeAnalysis(parsed);
  }

  private extractJsonObject(content: string): Record<string, unknown> | null {
    const trimmed = content.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = (fenceMatch?.[1] || trimmed).trim();

    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      const objectMatch = candidate.match(/\{[\s\S]*\}/);
      if (!objectMatch) {
        return null;
      }

      try {
        return JSON.parse(objectMatch[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }

  private normalizeAnalysis(value: Record<string, unknown>): CaptureAnalysis {
    const categoryValue = this.normalizeString(value.category, 24).toLowerCase() as CaptureCategory;
    const category = ANALYSIS_CATEGORIES.has(categoryValue) ? categoryValue : 'mixed';

    const summary = this.normalizeString(value.summary, 180);
    if (!summary) {
      throw new ServiceUnavailableException('AI 整理结果缺少摘要，请稍后重试');
    }

    const insight = this.normalizeString(value.insight, 240);
    const actionSuggestion = this.normalizeString(value.actionSuggestion, 240);
    const sourceType = this.normalizeSourceType(value.sourceType);
    const sourceName = this.normalizeSourceName(value.sourceName ?? value.sourceGuess);
    const tags = Array.isArray(value.tags)
      ? Array.from(new Set(
          value.tags
            .map((tag) => this.normalizeString(tag, 20))
            .filter(Boolean),
        )).slice(0, 5)
      : [];

    return {
      category,
      summary,
      insight,
      actionSuggestion,
      tags,
      sourceType,
      sourceName,
    };
  }

  private buildStoredAnalysis(
    analysis: CaptureAnalysis,
    source: { sourceType: string | null; sourceName: string | null },
  ): CaptureAnalysis {
    return {
      ...analysis,
      sourceType: source.sourceType || '',
      sourceName: source.sourceName || '',
    };
  }

  private normalizeString(value: unknown, maxLength: number) {
    if (typeof value !== 'string') {
      return '';
    }

    return this.truncate(value.trim(), maxLength);
  }

  private normalizeRawContent(value: unknown) {
    const rawContent = this.normalizeString(value, 4000);
    if (!rawContent) {
      throw new BadRequestException('记录内容不能为空');
    }

    return rawContent;
  }

  private normalizeSourceType(value: unknown) {
    const normalized = this.normalizeString(value, 40);
    if (!normalized) {
      return '';
    }

    if (/梦境|做梦|梦见|梦到|梦里/.test(normalized)) {
      return '梦境';
    }

    return normalized;
  }

  private normalizeSourceName(value: unknown) {
    return this.normalizeString(value, 120);
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }

  private inferSourceTypeFromRawContent(rawContent: string) {
    const content = rawContent.trim();
    if (!content) {
      return '';
    }

    if (/梦见|做梦|梦到|梦里/.test(content)) {
      return '梦境';
    }

    return '';
  }

  private async withTableGuard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && (error.code === 'P2021' || error.code === 'P2022')
      ) {
        throw new ServiceUnavailableException('记录功能的数据表尚未同步，请先执行数据库同步');
      }
      throw error;
    }
  }
}
