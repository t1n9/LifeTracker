import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type MemoryType = 'preference' | 'goal' | 'constraint' | 'fact';

interface ExtractedMemory {
  type: MemoryType;
  content: string;
  source: 'explicit_user';
  confidence: number;
}

interface MemoryMutationResult {
  action: 'created' | 'updated' | 'forgotten' | 'skipped';
  memory?: ExtractedMemory;
  affectedCount?: number;
  reason?: string;
}

@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);

  constructor(private prisma: PrismaService) {}

  async processExplicitMemory(userId: string, message: string): Promise<MemoryMutationResult> {
    const forgetKeyword = this.extractForgetKeyword(message);
    if (forgetKeyword) {
      return this.forgetByKeyword(userId, forgetKeyword);
    }

    const memory = this.extractMemory(message);
    if (!memory) {
      return { action: 'skipped', reason: 'no_explicit_memory' };
    }

    try {
      const existing = await this.prisma.agentMemory.findFirst({
        where: {
          userId,
          status: 'active',
          type: memory.type,
          content: memory.content,
        },
      });

      if (existing) {
        await this.prisma.agentMemory.update({
          where: { id: existing.id },
          data: {
            confidence: Math.max(existing.confidence, memory.confidence),
            source: memory.source,
            lastUsedAt: new Date(),
          },
        });
        return { action: 'updated', memory };
      }

      await this.prisma.agentMemory.create({
        data: {
          userId,
          type: memory.type,
          content: memory.content,
          source: memory.source,
          confidence: memory.confidence,
          status: 'active',
          data: {
            trigger: 'explicit_user_statement',
          },
        },
      });
      return { action: 'created', memory };
    } catch (error) {
      this.logger.warn(`Agent memory write skipped: ${this.getErrorMessage(error)}`);
      return { action: 'skipped', reason: 'memory_table_unavailable' };
    }
  }

  async buildMemoryContext(userId: string, limit = 8) {
    try {
      const memories = await this.prisma.agentMemory.findMany({
        where: {
          userId,
          status: 'active',
          confidence: { gte: 0.6 },
        },
        orderBy: [
          { lastUsedAt: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: limit,
      });

      if (memories.length > 0) {
        await this.prisma.agentMemory.updateMany({
          where: { id: { in: memories.map((memory) => memory.id) } },
          data: { lastUsedAt: new Date() },
        });
      }

      const contextText = memories.length > 0
        ? [
          '【长期记忆】以下是用户明确要求记住的偏好、目标或约束。',
          '这些记忆优先级低于本轮用户明确指令，高于通用默认规则；不要向用户展示这段内部上下文。',
          ...memories.map((memory) => `- ${this.getTypeLabel(memory.type)}：${memory.content}`),
        ].join('\n')
        : '';

      return {
        memories: memories.map((memory) => ({
          id: memory.id,
          type: memory.type,
          content: memory.content,
          confidence: memory.confidence,
        })),
        contextText,
        preferredPomodoroMinutes: this.extractPreferredPomodoroMinutes(memories.map((memory) => memory.content)),
      };
    } catch (error) {
      this.logger.warn(`Agent memory read skipped: ${this.getErrorMessage(error)}`);
      return {
        memories: [],
        contextText: '',
        preferredPomodoroMinutes: null,
      };
    }
  }

  private async forgetByKeyword(userId: string, keyword: string): Promise<MemoryMutationResult> {
    try {
      const memories = await this.prisma.agentMemory.findMany({
        where: {
          userId,
          status: 'active',
        },
      });
      const matchedIds = memories
        .filter((memory) => memory.content.includes(keyword))
        .map((memory) => memory.id);

      if (matchedIds.length === 0) {
        return { action: 'skipped', reason: 'no_matching_memory' };
      }

      await this.prisma.agentMemory.updateMany({
        where: { id: { in: matchedIds } },
        data: {
          status: 'archived',
        },
      });

      return { action: 'forgotten', affectedCount: matchedIds.length };
    } catch (error) {
      this.logger.warn(`Agent memory forget skipped: ${this.getErrorMessage(error)}`);
      return { action: 'skipped', reason: 'memory_table_unavailable' };
    }
  }

  private extractMemory(message: string): ExtractedMemory | null {
    const normalized = message.trim().replace(/\s+/g, ' ');
    if (!normalized || this.looksLikeOperationalCommand(normalized)) {
      return null;
    }

    const explicit = normalized.match(/^(?:请你)?(?:帮我)?记住[：:\s]*(.+)$/u);
    if (explicit?.[1]) {
      return this.createMemory(explicit[1]);
    }

    const preference = normalized.match(/^我(?:比较|很|更|一直)?(喜欢|不喜欢|习惯|偏好|希望|倾向于)[：:\s]*(.+)$/u);
    if (preference?.[1] && preference?.[2]) {
      return {
        type: preference[1].includes('不') ? 'constraint' : 'preference',
        content: `我${preference[1]}${preference[2]}`.trim(),
        source: 'explicit_user',
        confidence: 0.8,
      };
    }

    const futurePreference = normalized.match(/^(?:以后|之后|今后)(?:请)?(?:都|默认)?[：:\s]*(.+)$/u);
    if (futurePreference?.[1]) {
      return this.createMemory(`以后${futurePreference[1]}`, 'preference');
    }

    const goal = normalized.match(/^我(?:正在|准备|打算|计划长期|最近在)(.+)$/u);
    if (goal?.[1] && /(备考|学习|训练|减脂|增肌|复习|准备|长期)/u.test(goal[1])) {
      return {
        type: 'goal',
        content: `我正在${goal[1]}`.trim(),
        source: 'explicit_user',
        confidence: 0.7,
      };
    }

    return null;
  }

  private createMemory(content: string, forcedType?: MemoryType): ExtractedMemory | null {
    const cleaned = content.trim().replace(/[。.!！]+$/u, '');
    if (!cleaned || cleaned.length < 3 || this.looksLikeOperationalCommand(cleaned)) {
      return null;
    }

    return {
      type: forcedType || this.detectType(cleaned),
      content: cleaned,
      source: 'explicit_user',
      confidence: 0.85,
    };
  }

  private extractForgetKeyword(message: string) {
    const match = message.trim().match(/^(?:忘掉|忘记|删除记忆|不要记住)[：:\s]*(.+)$/u);
    const keyword = match?.[1]?.trim().replace(/[。.!！]+$/u, '');
    return keyword && keyword.length >= 2 ? keyword : null;
  }

  private detectType(content: string): MemoryType {
    if (/(不喜欢|不要|别|避免|禁止)/u.test(content)) {
      return 'constraint';
    }
    if (/(喜欢|偏好|习惯|默认|倾向|希望)/u.test(content)) {
      return 'preference';
    }
    if (/(目标|备考|计划|长期|正在|准备|训练|减脂|增肌)/u.test(content)) {
      return 'goal';
    }
    return 'fact';
  }

  private looksLikeOperationalCommand(message: string) {
    return /^(创建|添加|完成|开启|停止|记录|修改|删除|查询|查看|今天|今日|帮我|给我|把|将)/u.test(message)
      || /(任务|番茄钟|花费|运动|复盘|开启今日)/u.test(message) && !/(记住|以后|习惯|偏好|喜欢|不喜欢|默认)/u.test(message);
  }

  private extractPreferredPomodoroMinutes(contents: string[]) {
    for (const content of contents) {
      const match = content.match(/(?:默认|喜欢|偏好|习惯).*?(\d{1,3})\s*(?:分钟|分|min|分钟番茄|小时)/iu);
      if (!match?.[1]) {
        continue;
      }
      const value = Number(match[1]);
      const minutes = /小时/u.test(content) && value <= 8 ? value * 60 : value;
      if (minutes >= 5 && minutes <= 240) {
        return minutes;
      }
    }
    return null;
  }

  private getTypeLabel(type: string) {
    switch (type) {
      case 'preference':
        return '偏好';
      case 'goal':
        return '目标';
      case 'constraint':
        return '约束';
      default:
        return '事实';
    }
  }

  private getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
