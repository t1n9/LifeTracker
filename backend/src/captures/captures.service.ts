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
  sourceGuess: string;
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
5. sourceGuess 只有在原文明确提到来源时才填写，否则返回空字符串。

返回 JSON 结构：
{
  "category": "idea | reflection | method | question | quote | mixed",
  "summary": "一句简洁总结",
  "insight": "这条记录最有价值的洞察",
  "actionSuggestion": "如果能转成行动，给出一个具体建议；否则返回空字符串",
  "tags": ["标签1", "标签2"],
  "sourceGuess": "来源猜测或空字符串"
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

  async create(userId: string, content: string) {
    return this.withTableGuard(async () => {
      const rawContent = content.trim();
      if (!rawContent) {
        throw new BadRequestException('记录内容不能为空');
      }

      if (rawContent.length > 4000) {
        throw new BadRequestException('单条记录请控制在 4000 字以内');
      }

      const capture = await this.prisma.capture.create({
        data: {
          userId,
          rawContent,
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

      const updated = await this.prisma.capture.update({
        where: { id: capture.id },
        data: {
          status: CaptureStatus.ANALYZED,
          analysis: analysis as unknown as Prisma.InputJsonObject,
          analyzedAt: new Date(),
        },
      });

      return this.serializeCapture(updated);
    });
  }

  private serializeCapture(capture: {
    id: string;
    userId: string;
    rawContent: string;
    status: CaptureStatus;
    analysis: Prisma.JsonValue | null;
    analyzedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...capture,
      analysis: this.normalizeStoredAnalysis(capture.analysis),
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
        sourceGuess: '',
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
    const sourceGuess = this.normalizeString(value.sourceGuess, 80);
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
      sourceGuess,
    };
  }

  private normalizeString(value: unknown, maxLength: number) {
    if (typeof value !== 'string') {
      return '';
    }

    return this.truncate(value.trim(), maxLength);
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
  }

  private async withTableGuard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2021'
      ) {
        throw new ServiceUnavailableException('记录功能的数据表尚未同步，请先执行数据库同步');
      }
      throw error;
    }
  }
}
