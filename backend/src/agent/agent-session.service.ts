import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type MorningPlanningState =
  | 'greeting_sent'    // proactive 问候已发出，等待用户描述时间/计划
  | 'plan_proposed'    // AI 已列出草稿计划，等待用户确认
  | 'done';            // 任务已创建，流程结束

export interface MorningPlanningData {
  greetingMessageId?: string;
  proposedPlan?: string;   // AI 列出的草稿计划文本，用于注入下一轮上下文
  wakeUpTime?: string;
  activeStudyPlanTitle?: string;
  todayStudySlots?: Array<{
    planId: string;
    slotId: string;
    title: string;
    subjectName?: string;
    chapterTitle?: string;
    plannedHours?: number;
    timeSegment?: string;
  }>;
}

export interface AgentSessionData {
  flow: 'morning_planning';
  state: MorningPlanningState;
  data: MorningPlanningData;
}

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4小时后过期

@Injectable()
export class AgentSessionService {
  constructor(private prisma: PrismaService) {}

  async getSession(userId: string): Promise<AgentSessionData | null> {
    const session = await this.prisma.agentSession.findUnique({
      where: { userId },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await this.clearSession(userId);
      return null;
    }

    return {
      flow: session.flow as 'morning_planning',
      state: session.state as MorningPlanningState,
      data: (session.data as MorningPlanningData) ?? {},
    };
  }

  async startMorningSession(
    userId: string,
    greetingMessageId: string,
    dataPatch: Partial<MorningPlanningData> = {},
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    const data = { greetingMessageId, ...dataPatch } as any;
    await this.prisma.agentSession.upsert({
      where: { userId },
      create: {
        userId,
        flow: 'morning_planning',
        state: 'greeting_sent',
        data,
        expiresAt,
      },
      update: {
        flow: 'morning_planning',
        state: 'greeting_sent',
        data,
        expiresAt,
      },
    });
  }

  async transitionTo(
    userId: string,
    state: MorningPlanningState,
    dataPatch: Partial<MorningPlanningData> = {},
  ): Promise<void> {
    const session = await this.prisma.agentSession.findUnique({ where: { userId } });
    if (!session) return;

    const merged = { ...(session.data as object), ...dataPatch };

    if (state === 'done') {
      await this.clearSession(userId);
      return;
    }

    await this.prisma.agentSession.update({
      where: { userId },
      data: {
        state,
        data: merged as any,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
  }

  async clearSession(userId: string): Promise<void> {
    await this.prisma.agentSession.deleteMany({ where: { userId } });
  }
}
