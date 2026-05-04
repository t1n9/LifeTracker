import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConfirmPhasePlansDto,
  ConfirmWeekDto,
  ExpandWeekDto,
  GeneratePhasePlansDto,
  PhasePlanItemDto,
  UpdatePhasePlanDto,
  WeekSlotDraftDto,
} from './dto/phase-plan.dto';

export interface DraftPhase {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
}

export interface DraftSlot {
  date: string;
  chapterId: string;
  chapterTitle: string;
  subjectName: string;
  plannedHours: number;
  timeSegment?: string;
  phaseId?: string;
}

interface WeekDayIntent {
  dayOffset: number;
  subjects: string[];
  title?: string;
  resolvedSubjectName?: string;
  timeSlots: Array<{
    label: string;
    hours: number;
    purpose?: 'mock' | 'review';
    subjectName?: string;
    title?: string;
  }>;
}

export interface ParsedWeekIntent {
  type: 'structured' | 'flat';
  dayIntents: WeekDayIntent[];
  dailyHours: number;
  combinedSubject?: string;
}

interface SubjectChapterMap {
  subjectName: string;
  chapters: Array<{ chapterId: string; chapterTitle: string; remainingHours: number }>;
}

@Injectable()
export class PhasePlanService {
  private readonly logger = new Logger(PhasePlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  //  Week-check：detect missing week schedules for badge reminder
  // ─────────────────────────────────────────────────────────────

  async checkWeekStatus(userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) {
      return {
        hasActivePlan: false,
        thisWeekMissing: false,
        nextWeekMissing: false,
        planId: null,
        examDaysLeft: null,
      };
    }

    const today = this.toDateOnly(new Date());
    const examDate = this.toDateOnly(plan.examDate);
    const examDaysLeft = Math.max(0, this.dayDiff(today, examDate));

    const { weekStart: thisWeekStart, weekEnd: thisWeekEnd } = this.getWeekRange(today);
    const nextWeekStart = this.addDays(thisWeekStart, 7);
    const nextWeekEnd = this.addDays(thisWeekEnd, 7);

    const [thisWeekCount, nextWeekCount] = await Promise.all([
      this.prisma.dailyStudySlot.count({
        where: {
          planId: plan.id,
          isDraft: false,
          date: { gte: thisWeekStart, lte: thisWeekEnd },
        },
      }),
      this.prisma.dailyStudySlot.count({
        where: {
          planId: plan.id,
          isDraft: false,
          date: { gte: nextWeekStart, lte: nextWeekEnd },
        },
      }),
    ]);

    const examInThisWeek = examDate >= thisWeekStart && examDate <= thisWeekEnd;
    const examBeforeNextWeek = examDate < nextWeekStart;

    return {
      hasActivePlan: true,
      thisWeekMissing: !examBeforeNextWeek && !examInThisWeek ? thisWeekCount === 0 : thisWeekCount === 0 && !examBeforeNextWeek,
      nextWeekMissing: examBeforeNextWeek ? false : nextWeekCount === 0,
      planId: plan.id,
      examDaysLeft,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  PhasePlan CRUD
  // ─────────────────────────────────────────────────────────────

  async listPhases(userId: string, planId: string) {
    await this.ensurePlan(userId, planId);
    return this.prisma.phasePlan.findMany({
      where: { planId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 根据用户自然语言意图生成阶段划分草稿（不写库，仅返回供前端确认）。
   */
  async generatePhasesDraft(userId: string, planId: string, dto: GeneratePhasePlansDto) {
    const plan = await this.ensurePlan(userId, planId);
    const subjects = await this.prisma.studySubject.findMany({
      where: { planId },
      include: { chapters: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    const today = this.toDateOnly(new Date());
    const examDate = this.toDateOnly(plan.examDate);
    const totalDays = Math.max(1, this.dayDiff(today, examDate));

    const subjectSummary = subjects.map((s) => ({
      name: s.name,
      chapterCount: s.chapters.length,
      totalHours: s.chapters.reduce((sum, c) => sum + (c.estimatedHours || 2), 0),
    }));

    const phases = await this.askLLMForPhases({
      examName: plan.examName,
      examType: plan.examType,
      totalDays,
      todayISO: this.formatDate(today),
      examDateISO: this.formatDate(examDate),
      subjects: subjectSummary,
      userIntent: dto.userIntent,
    });

    return { phases, plan: { id: plan.id, examName: plan.examName, examDate: plan.examDate } };
  }

  async confirmPhases(userId: string, planId: string, dto: ConfirmPhasePlansDto) {
    await this.ensurePlan(userId, planId);

    return this.prisma.$transaction(async (tx) => {
      // 清空旧阶段（草稿/确认都重新生成）
      await tx.phasePlan.deleteMany({ where: { planId } });

      const created = await Promise.all(
        dto.phases.map((p, idx) =>
          tx.phasePlan.create({
            data: {
              planId,
              name: p.name,
              description: p.description,
              startDate: this.toDateOnly(p.startDate),
              endDate: this.toDateOnly(p.endDate),
              sortOrder: p.sortOrder ?? idx,
            },
          }),
        ),
      );
      return created;
    });
  }

  async updatePhase(userId: string, planId: string, phaseId: string, dto: UpdatePhasePlanDto) {
    await this.ensurePlan(userId, planId);
    const phase = await this.prisma.phasePlan.findUnique({ where: { id: phaseId } });
    if (!phase || phase.planId !== planId) {
      throw new NotFoundException('Phase not found');
    }

    return this.prisma.phasePlan.update({
      where: { id: phaseId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.startDate ? { startDate: this.toDateOnly(dto.startDate) } : {}),
        ...(dto.endDate ? { endDate: this.toDateOnly(dto.endDate) } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deletePhase(userId: string, planId: string, phaseId: string) {
    await this.ensurePlan(userId, planId);
    const phase = await this.prisma.phasePlan.findUnique({ where: { id: phaseId } });
    if (!phase || phase.planId !== planId) {
      throw new NotFoundException('Phase not found');
    }
    await this.prisma.phasePlan.delete({ where: { id: phaseId } });
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────
  //  Expand week → AI 生成每日 slot 草稿
  // ─────────────────────────────────────────────────────────────

  async expandWeekDraft(userId: string, planId: string, dto: ExpandWeekDto) {
    const plan = await this.ensurePlan(userId, planId);

    const weekStart = this.toDateOnly(dto.weekStart);
    const weekEnd = this.addDays(weekStart, 6);
    const today = this.toDateOnly(new Date());

    // 拒绝已过去的周
    if (weekEnd < today) {
      throw new NotFoundException('Cannot expand past weeks');
    }

    // 找到本周对应的阶段（如未指定则用日期匹配）
    let phase = dto.phaseId
      ? await this.prisma.phasePlan.findUnique({ where: { id: dto.phaseId } })
      : null;
    if (!phase) {
      phase = await this.prisma.phasePlan.findFirst({
        where: {
          planId,
          startDate: { lte: weekEnd },
          endDate: { gte: weekStart },
        },
        orderBy: { sortOrder: 'asc' },
      });
    }

    // 读取所有未完成章节及剩余时长
    const subjects = await this.prisma.studySubject.findMany({
      where: { planId },
      include: {
        chapters: {
          where: { status: { not: 'completed' } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const chapters = subjects.flatMap((s) =>
      s.chapters.map((c) => ({
        chapterId: c.id,
        chapterTitle: c.title,
        subjectName: s.name,
        estimatedHours: c.estimatedHours || 2,
        actualHours: c.actualHours || 0,
        remainingHours: Math.max(0.5, (c.estimatedHours || 2) - (c.actualHours || 0)),
      })),
    );

    this.logger.log(`[expandWeekDraft] chapters.length=${chapters.length}, weekStart=${this.formatDate(weekStart)}, today=${this.formatDate(today)}`);

    if (chapters.length === 0) {
      return { slots: [], phase, plan: { id: plan.id, examName: plan.examName } };
    }

    // 计算每天可用小时
    const dailyHours = this.buildDailyHourBudget(weekStart, weekEnd, plan, today);
    this.logger.log(`[expandWeekDraft] dailyHours=${JSON.stringify(dailyHours)}`);

    const slots = await this.askLLMForWeekSlots({
      examName: plan.examName,
      weekStartISO: this.formatDate(weekStart),
      weekEndISO: this.formatDate(weekEnd),
      todayISO: this.formatDate(today),
      phaseName: phase?.name,
      phaseDescription: phase?.description,
      dailyHours,
      chapters,
      userIntent: dto.userIntent || '',
      parsedIntent: (dto as ExpandWeekDto & { parsedIntent?: ParsedWeekIntent }).parsedIntent,
    });

    // 标注 phaseId
    const slotsWithPhase = slots.map((s) => ({ ...s, phaseId: phase?.id }));

    return { slots: slotsWithPhase, phase, plan: { id: plan.id, examName: plan.examName } };
  }

  async confirmWeek(userId: string, planId: string, dto: ConfirmWeekDto) {
    const plan = await this.ensurePlan(userId, planId);
    const weekStart = this.toDateOnly(dto.weekStart);
    const weekEnd = this.addDays(weekStart, 6);
    const today = this.toDateOnly(new Date());

    if (weekEnd < today) {
      throw new NotFoundException('Cannot modify past weeks');
    }

    // 找/建对应的 WeeklyPlan（用于关联）
    const weekNumber = this.computeWeekNumber(plan.createdAt, weekStart);

    return this.prisma.$transaction(async (tx) => {
      const weekly = await tx.weeklyPlan.upsert({
        where: { planId_weekNumber: { planId, weekNumber } },
        update: { weekStart, weekEnd },
        create: {
          planId,
          weekNumber,
          weekStart,
          weekEnd,
          phase: 'foundation',
          targetHours: dto.slots.reduce((sum, s) => sum + s.plannedHours, 0),
          status: 'active',
        },
      });

      // 删除该周已有 slot（除已完成的）
      if (dto.replaceExisting !== false) {
        await tx.dailyStudySlot.deleteMany({
          where: {
            planId,
            date: { gte: weekStart, lte: weekEnd },
            status: { in: ['pending', 'rescheduled'] },
            isDraft: false,
          },
        });
      }

      // 写入新 slot
      const userIdFromPlan = (await tx.studyPlan.findUnique({
        where: { id: planId },
        select: { userId: true },
      }))!.userId;

      const created = await Promise.all(
        dto.slots.map(async (slot) => {
          const ch = await tx.studyChapter.findUnique({ where: { id: slot.chapterId }, include: { subject: true } });
          if (!ch) return null;
          const slotData: Record<string, unknown> = {
            planId,
            userId: userIdFromPlan,
            weeklyPlanId: weekly.id,
            phaseId: slot.phaseId,
            chapterId: slot.chapterId,
            subjectName: slot.subjectName || ch.subject.name,
            chapterTitle: slot.chapterTitle || ch.title,
            date: this.toDateOnly(slot.date),
            plannedHours: slot.plannedHours,
            isDraft: false,
            status: 'pending',
            timeSegment: (slot as any).timeSegment || '',
          };
          return tx.dailyStudySlot.create({
            data: slotData as any,
          });
        }),
      );

      return { created: created.filter(Boolean).length, weekStart: this.formatDate(weekStart) };
    });
  }

  async clearWeek(userId: string, planId: string, weekStart: string) {
    await this.ensurePlan(userId, planId);
    const start = this.toDateOnly(weekStart);
    const end = this.addDays(start, 6);
    const today = this.toDateOnly(new Date());

    if (end < today) {
      throw new NotFoundException('Cannot clear past weeks');
    }

    const result = await this.prisma.dailyStudySlot.deleteMany({
      where: {
        planId,
        date: { gte: start, lte: end },
        status: { in: ['pending', 'rescheduled'] },
      },
    });

    return { deleted: result.count };
  }

  // ─────────────────────────────────────────────────────────────
  //  AI chat — intent routing
  // ─────────────────────────────────────────────────────────────

  // Step 1: 快速识别意图，返回给用户确认（不调用排课 LLM）
  async chatIntent(
    userId: string,
    planId: string,
    message: string,
    weekStart?: string,
  ): Promise<{
    action: 'generate_phases' | 'expand_week' | 'reply' | 'onboard_phases' | 'onboard_week';
    reply: string;
    targetWeekStart?: string;
    parsedIntent?: ParsedWeekIntent;
  }> {
    await this.ensurePlan(userId, planId);
    const today = this.toDateOnly(new Date());
    const todayISO = this.formatDate(today);

    const defaultWeek = weekStart || this.getMonday(todayISO);
    const nextWeek = this.formatDate(this.addDays(this.toDateOnly(defaultWeek), 7));

    // ── Onboarding: 如果计划还没有阶段 ──
    const phaseCount = await this.prisma.phasePlan.count({ where: { planId } });
    if (phaseCount === 0) {
      // 如果用户消息明确是在描述阶段划分（含时间区间/百分比/阶段名），转为 generate_phases
      const looksLikePhaseInput = /基础|强化|冲刺|阶段|第[一二三四1-9]阶|(\d+%)|(\d+天.*\d+天)/.test(message);
      if (looksLikePhaseInput) {
        const reply = await this.generateIntentReply(message, 'generate_phases');
        return { action: 'generate_phases', reply };
      }

      // 引导用户定阶段
      const reply = `你好！在开始排每周计划之前，我们先把备考阶段定下来。\n\n你打算把备考分成哪几个阶段？（比如：基础期40% → 强化期35% → 冲刺期25%，或者按天数划分也可以）`;
      return { action: 'onboard_phases', reply };
    }

    // ── 规则分类 ──
    const action = this.classifyIntent(message);
    const targetWeekStart = this.extractTargetWeek(message, defaultWeek, nextWeek);
    this.logger.log(`[chatIntent] rule-classified: action=${action}, targetWeek=${targetWeekStart}`);

    // ── expand_week 时用 AI 解析逐天意图，其他用 LLM 生成一句话 ──
    let reply: string;
    let parsedIntent: ParsedWeekIntent | undefined;
    if (action === 'expand_week') {
      const subjects = await this.prisma.studySubject.findMany({
        where: { planId },
        include: { chapters: { where: { status: { not: 'completed' } }, orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      });
      const subjectMaps: SubjectChapterMap[] = subjects.map(s => ({
        subjectName: s.name,
        chapters: s.chapters.map(c => ({ chapterId: c.id, chapterTitle: c.title, remainingHours: c.estimatedHours || 2 })),
      }));
      parsedIntent = await this.parseWeekIntent(message, targetWeekStart, subjectMaps);
      reply = this.formatIntentAsReply(parsedIntent, targetWeekStart);
    } else {
      reply = await this.generateIntentReply(message, action);
    }

    return { action, reply, targetWeekStart, parsedIntent };
  }

  // Step 2: 用户确认后执行生成（调用排课 LLM，较慢）
  async chatExecute(
    userId: string,
    planId: string,
    action: string,
    message: string,
    weekStart?: string,
    parsedIntent?: unknown,
  ): Promise<{
    action: string;
    reply: string;
    targetWeekStart?: string;
    draftPhases?: DraftPhase[];
    draftSlots?: DraftSlot[];
  }> {
    const plan = await this.ensurePlan(userId, planId);
    const today = this.toDateOnly(new Date());
    const todayISO = this.formatDate(today);
    const targetWeekStart = weekStart || this.getMonday(todayISO);

    if (action === 'generate_phases') {
      const subjects = await this.prisma.studySubject.findMany({
        where: { planId },
        include: { chapters: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { sortOrder: 'asc' },
      });
      const examDate = this.toDateOnly(plan.examDate);
      const totalDays = Math.max(1, this.dayDiff(today, examDate));
      const subjectSummary = subjects.map((s) => ({
        name: s.name,
        chapterCount: s.chapters.length,
        totalHours: s.chapters.reduce((sum, c) => sum + (c.estimatedHours || 2), 0),
      }));
      const draftPhases = await this.askLLMForPhases({
        examName: plan.examName,
        examType: plan.examType,
        totalDays,
        todayISO,
        examDateISO: this.formatDate(examDate),
        subjects: subjectSummary,
        userIntent: message,
      });
      return {
        action: 'generate_phases',
        reply: `生成了 ${draftPhases.length} 个备考阶段，确认后写入计划。`,
        draftPhases,
      };
    }

    if (action === 'expand_week') {
      const result = await this.expandWeekDraft(userId, planId, {
        weekStart: targetWeekStart,
        userIntent: message,
        parsedIntent: this.normalizeParsedWeekIntent(parsedIntent),
      } as ExpandWeekDto & { parsedIntent?: ParsedWeekIntent });
      this.logger.log(`[chatExecute] expand_week got ${result.slots.length} slots, weekStart=${targetWeekStart}`);
      if (result.slots.length === 0) {
        // 返回诊断信息帮助排查
        return {
          action: 'reply',
          reply: `没有生成学习安排。可能原因：章节已全部完成、或AI输出解析失败。请查看后端日志 [expandWeekDraft] 和 [askLLMForWeekSlots]。weekStart=${targetWeekStart}`,
        };
      }
      return {
        action: 'expand_week',
        reply: `生成了 ${result.slots.length} 条学习安排，确认后写入周计划。`,
        targetWeekStart,
        draftSlots: result.slots,
      };
    }

    return { action: 'reply', reply: '无法执行该操作。' };
  }

  private getMonday(dateISO: string): string {
    const d = this.toDateOnly(dateISO);
    const dow = d.getUTCDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d.getTime() + diff * 86400000);
    return this.formatDate(monday);
  }

  // ─────────────────────────────────────────────────────────────
  //  AI estimate hours
  // ─────────────────────────────────────────────────────────────

  async estimateChapterHours(userId: string, planId: string) {
    const plan = await this.ensurePlan(userId, planId);
    const subjects = await this.prisma.studySubject.findMany({
      where: { planId },
      include: { chapters: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });

    const allChapters = subjects.flatMap((s) =>
      s.chapters.map((c) => ({
        subjectName: s.name,
        chapterId: c.id,
        chapterTitle: c.title,
        currentHours: c.estimatedHours || 2,
      })),
    );

    if (allChapters.length === 0) {
      return { estimates: [] };
    }

    const today = this.toDateOnly(new Date());
    const totalDays = Math.max(1, this.dayDiff(today, this.toDateOnly(plan.examDate)));
    const dailyAvg = (plan.weekdayHours * 5 + plan.weekendHours * 2) / 7;
    const totalAvailableHours = Math.round(dailyAvg * totalDays);

    const estimates = await this.askLLMForChapterHours({
      examType: plan.examType,
      examName: plan.examName,
      totalDays,
      totalAvailableHours,
      weekdayHours: plan.weekdayHours,
      weekendHours: plan.weekendHours,
      chapters: allChapters,
    });

    return { estimates };
  }

  // ─────────────────────────────────────────────────────────────
  //  Intent classification (rule-based, no LLM)
  // ─────────────────────────────────────────────────────────────

  private classifyIntent(message: string): 'expand_week' | 'generate_phases' | 'reply' {
    if (/阶段|基础期|强化期|冲刺期|备考期/.test(message)) return 'generate_phases';
    if (
      /\d+[号月.\/]|本周|下周|这周|今天|明天|每天|周[一二三四五六日]|小时|h|模块|套卷|练习|章节|科目|言语|判断|数量|申论|行测/.test(message)
    ) return 'expand_week';
    return 'reply';
  }

  private extractTargetWeek(message: string, thisWeek: string, nextWeek: string): string {
    if (/下周|下一周/.test(message)) return nextWeek;

    // 匹配 "5.4" / "5/4" / "5月4日" / "5月4号" 形式
    const dateMatch = message.match(/(\d{1,2})[月.\/](\d{1,2})[日号]?/);
    if (dateMatch) {
      const now = new Date();
      const month = parseInt(dateMatch[1], 10) - 1;
      const day = parseInt(dateMatch[2], 10);
      const year = now.getUTCFullYear();
      const d = new Date(Date.UTC(year, month, day));
      return this.getMonday(this.formatDate(d));
    }

    return thisWeek;
  }

  private async generateIntentReply(
    message: string,
    action: 'expand_week' | 'generate_phases' | 'reply',
  ): Promise<string> {
    if (action === 'reply') return '我可以帮你安排每周学习或阶段规划，请告诉我你的想法。';

    const suffix = '帮你生成草稿？';
    try {
      const raw = await this.callLLM(
        '你是学习助手。',
        `把下面这句用户的学习安排指令，用一句话（30字以内）总结，结尾加"${suffix}"，只输出这一句话：\n${message}`,
        80,
      );
      const reply = raw.trim().replace(/^["'「【]|["'」】]$/g, '');
      if (reply && reply.length > 4 && reply.length < 120) return reply;
    } catch {
      // ignore
    }

    if (action === 'generate_phases') return `明白，你想划分备考阶段。${suffix}`;
    return `明白，你想安排本周的学习计划。${suffix}`;
  }

  private formatIntentAsReply(intent: ParsedWeekIntent, weekStartISO: string): string {
    const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    const dateAtOffset = (offset: number): string => {
      const d = new Date(weekStartISO + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + offset);
      const mo = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const dow = DAY_NAMES[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
      return `${mo}/${day}（${dow}）`;
    };

    if (intent.type !== 'structured' || intent.dayIntents.length === 0) {
      const hours = intent.dailyHours > 0 ? `每天 ${intent.dailyHours}h` : '';
      return `我理解你想安排本周学习计划${hours ? '，' + hours : ''}，确认后帮你生成草稿？`;
    }

    const lines: string[] = ['我理解你的安排如下，确认后帮你生成草稿：', ''];
    for (const di of intent.dayIntents) {
      const dateStr = dateAtOffset(di.dayOffset);
      const subjectStr = di.subjects
        .map(s => s === '__mock__' ? '综合套卷练习' : s)
        .join('、');
      const dayTitle = di.title || subjectStr;

      if (di.timeSlots.length > 0) {
        const totalHours = di.timeSlots.reduce((s, t) => s + t.hours, 0);
        const slotStr = di.timeSlots.map(t => {
          const title = t.title || dayTitle;
          return `${t.label} ${title} ${t.hours}h`;
        }).join(' / ');
        lines.push(`📅 ${dateStr}  ${dayTitle}  ${totalHours}h（${slotStr}）`);
      } else {
        const hours = intent.dailyHours > 0 ? ` ${intent.dailyHours}h` : '';
        lines.push(`📅 ${dateStr}  ${dayTitle}${hours}`);
      }
    }

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────
  //  LLM helpers (DeepSeek)
  // ─────────────────────────────────────────────────────────────

  private async askLLMForPhases(input: {
    examName: string;
    examType: string;
    totalDays: number;
    todayISO: string;
    examDateISO: string;
    subjects: Array<{ name: string; chapterCount: number; totalHours: number }>;
    userIntent: string;
  }): Promise<DraftPhase[]> {
    const systemPrompt = `你是学习计划阶段规划专家。根据用户描述和考试信息，把备考期划分成若干阶段（一般3-5个）。

考试：${input.examName} (${input.examType})
今天：${input.todayISO}
考试日：${input.examDateISO}（剩 ${input.totalDays} 天）
科目：${input.subjects.map((s) => `${s.name}(${s.chapterCount}章, 约${s.totalHours}h)`).join('、')}

用户意图：${input.userIntent || '（用户没说，请你自动规划）'}

请输出 JSON 数组，每个阶段包含：
- name: 阶段名（≤10字，如"行测基础""申论强化""套卷冲刺"）
- description: 该阶段做什么（≤30字）
- startDate: YYYY-MM-DD
- endDate: YYYY-MM-DD
- sortOrder: 数字，从0开始

约束：
- 阶段必须连续（无间隔无重叠）
- 第一阶段从 ${input.todayISO} 开始
- 最后阶段在 ${input.examDateISO} 结束
- 阶段顺序合理（基础→强化→冲刺）

只输出 JSON 数组，不要其他文字。`;

    const raw = await this.callLLMStrict(systemPrompt, '请生成阶段划分。', 1200);
    return this.parseJSONArray(raw) as DraftPhase[];
  }

  // ─────────────────────────────────────────────────────────────
  //  Intent pre-processor: 把自然语言意图结构化为“第几天→科目→时段”
  // ─────────────────────────────────────────────────────────────

  private async parseWeekIntent(
    message: string,
    weekStartISO: string,
    subjects: SubjectChapterMap[],
  ): Promise<ParsedWeekIntent> {
    const fallback: ParsedWeekIntent = { type: 'flat', dayIntents: [], dailyHours: 0 };

    const subjectList = subjects.map(s => s.subjectName).join('、');
    const weekStart = new Date(weekStartISO + 'T00:00:00Z');
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setUTCDate(d.getUTCDate() + i);
      return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    });
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const systemPrompt = `你是学习计划解析器。将用户的学习安排描述解析为JSON。

返回格式（严格JSON，不含其他文字）：
{
  "days": [
    {
      "date": "MM-DD",
      "subject": "科目名或__mock__",
      "title": "当天学习标题",
      "timeSlots": [
        {
          "label": "上午"|"下午"|"晚上",
          "hours": 数字,
          "subjectName": "该时段科目名，可省略",
          "title": "该时段学习标题，可省略",
          "purpose": "mock"|"review，可省略"
        }
      ]
    }
  ],
  "dailyHours": 每天总学时（数字，无则为0）
}

解析规则：
- 今天是${todayStr}，本周范围：${weekDates[0]}（周日）到${weekDates[6]}（周六）
- 只写日号（如"4号"）时，月份为当前月
- subject 的判断：用户描述的是"做综合练习/模拟测试/套卷/真题模考"等整体性检验行为（而非学习某个具体知识点）时，填 "__mock__"；描述的是学习某科目知识时，填该科目名
- title 是最终要展示和写入计划的学习标题，必须尽量贴近用户原话，例如"言语理解"、"行测套卷练习"、"行测套卷复盘+薄弱练习"
- 如果同一天不同时段学习内容不同，在 timeSlots 内分别写 title；如果相同，可以只写 day.title
- 不要把用户明确给出的一个时段拆成多个子任务，例如"下午3小时复盘+薄弱练习"仍然只返回一个下午时段
- 可用科目列表：${subjectList || '（无限制）'}
- 如果某段时间"前N天分别是A、B、C"，则每天对应一个科目（第1天A，第2天B…）
- timeSlots：用户指定上午/下午/晚上时分别列出；只说总时长则返回空数组
- 只输出本周（${weekDates[0]}～${weekDates[6]}）内的日期，超出范围忽略`;

    const userMsg = `解析以下学习安排：\n${message}`;

    try {
      const raw = await this.callLLMInternal(systemPrompt, userMsg, 1200, 1.0, true);
      const parsed = JSON.parse(raw) as {
        days: Array<{
          date: string;
          subject: string;
          title?: string;
          timeSlots: Array<{
            label: string;
            hours: number;
            purpose?: string;
            subjectName?: string;
            title?: string;
          }>;
        }>;
        dailyHours?: number;
      };

      const intent: ParsedWeekIntent = { type: 'flat', dayIntents: [], dailyHours: parsed.dailyHours ?? 0 };

      for (const day of parsed.days ?? []) {
        const [mm, dd] = day.date.split('-').map(Number);
        const dateISO = `${today.getFullYear()}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        const d = new Date(dateISO + 'T00:00:00Z');
        const offset = Math.round((d.getTime() - weekStart.getTime()) / 86400000);
        if (offset < 0 || offset > 6) continue;

        // 科目匹配：优先从实际科目列表中模糊匹配，__mock__ 直接保留
        let subject = day.subject ?? '';
        if (subject !== '__mock__') {
          const q = subject.replace(/\s+/gu, '').toLowerCase();
          const matched = subjects.find(s => {
            const sn = s.subjectName.replace(/\s+/gu, '').toLowerCase();
            return sn.includes(q) || q.includes(sn);
          });
          if (matched) subject = matched.subjectName;
        }

        intent.type = 'structured';
        intent.dayIntents.push({
          dayOffset: offset,
          subjects: [subject],
          title: typeof day.title === 'string' && day.title.trim() ? day.title.trim() : undefined,
          timeSlots: (day.timeSlots ?? [])
            .filter(t => t.hours > 0 && t.hours <= 12)
            .map(t => ({
              label: t.label,
              hours: t.hours,
              purpose: (t.purpose === 'mock' || t.purpose === 'review') ? t.purpose : undefined,
              subjectName: typeof t.subjectName === 'string' && t.subjectName.trim() ? t.subjectName.trim() : undefined,
              title: typeof t.title === 'string' && t.title.trim() ? t.title.trim() : undefined,
            })),
        });
      }

      this.logger.log(`[parseWeekIntent] AI解析: ${intent.dayIntents.length} 天, type=${intent.type}`);
      return intent;
    } catch (e) {
      this.logger.warn(`[parseWeekIntent] AI解析失败，降级为flat: ${e}`);
      return fallback;
    }
  }

  // ── Build structured prompts from parsed intent ──

  private buildWeekSlotStructuredPrompt(
    input: {
      examName: string;
      weekStartISO: string;
      weekEndISO: string;
      todayISO: string;
      phaseName?: string;
      phaseDescription?: string;
      dailyHours: Array<{ date: string; hours: number }>;
    },
    chapters: Array<{ chapterId: string; chapterTitle: string; subjectName: string; remainingHours: number }>,
    intent: ParsedWeekIntent,
    userIntent: string,
    chapterIndex: Map<string, string>, // shortId -> chapterId
  ): { systemPrompt: string; userMsg: string; chapterList: string[] } {
    // Build inverted index: subjectName -> chapters
    const subjectMap = new Map<string, Array<{ shortId: string; chapterId: string; chapterTitle: string; remainingHours: number }>>();
    const chapterList: string[] = [];
    chapters.slice(0, 30).forEach((c, i) => {
      const shortId = `c${i + 1}`;
      chapterIndex.set(shortId, c.chapterId);
      const line = `${shortId}|${c.subjectName}|${c.chapterTitle}|${c.remainingHours}h`;
      chapterList.push(line);
      if (!subjectMap.has(c.subjectName)) subjectMap.set(c.subjectName, []);
      subjectMap.get(c.subjectName)!.push({ shortId, chapterId: c.chapterId, chapterTitle: c.chapterTitle, remainingHours: c.remainingHours });
    });

    const dateAtIndex = (offset: number): string => {
      const d = new Date(input.weekStartISO + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().split('T')[0];
    };

    // Build per-day structured instructions from parsed intent
    let dayInstructions = '';

    if (intent.type === 'structured' && intent.dayIntents.length > 0) {
      const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const lines: string[] = [];
      for (const di of intent.dayIntents) {
        const date = dateAtIndex(di.dayOffset);
        if (date < input.todayISO) continue;
        const d = new Date(date + 'T00:00:00Z');
        const dowZh = DAY_ZH[d.getUTCDay()];
        const subjectDesc = di.subjects[0] === '__mock__' ? '综合检验练习（用户要做整体性测验，请从章节列表中选名称最靠近"测试/综合/模拟/刷题"的章节，或选最后几个章节）' : di.subjects.join('、');
        if (di.timeSlots.length > 0) {
          const tsDesc = di.timeSlots.map(ts => `${ts.label} ${ts.hours}h`).join('、');
          lines.push(`${date}（${dowZh}）：主题=${subjectDesc}，时段=${tsDesc}`);
        } else {
          const h = intent.dailyHours > 0 ? ` ${intent.dailyHours}h` : '';
          lines.push(`${date}（${dowZh}）：主题=${subjectDesc}${h}`);
        }
      }
      dayInstructions = `【每日安排计划 — 严格按主题和时段执行，章节从列表中自行选取匹配度最高的】\n${lines.join('\n')}`;
    } else {
      const dailyBudget = input.dailyHours.map((d) => `${d.date}:${d.hours}h`).join(', ');
      dayInstructions = `每日可用时长：${dailyBudget}\n按用户意图合理分配章节到每一天。`;
    }

    const systemPrompt = `你是学习计划排课专家。根据下面的每日安排计划，从章节列表中选择最匹配的章节生成学习安排JSON。

考试：${input.examName}${input.phaseName ? `，阶段：${input.phaseName}` : ''}
周范围：${input.weekStartISO}~${input.weekEndISO}，今天=${input.todayISO}

章节列表（短ID|科目|章节名|剩余时长）：
${chapterList.join('\n')}

${dayInstructions}

选章节规则：
- 根据当天主题关键词，在章节列表中找名称最相关的章节
- 同一天不同时段尽量选不同章节（避免重复）
- 只输出 >= 今天且在周范围内的日期

输出规范：
1. chapterId 只使用上面列表中的短ID（c1, c2…）
2. date 格式 YYYY-MM-DD
3. timeSegment 填 "上午"/"下午"/"晚上"（按计划时段）或 ""（无时段区分）

直接输出JSON数组，不含其他文字：[{"date":"YYYY-MM-DD","chapterId":"c1","chapterTitle":"章节名","subjectName":"科目名","plannedHours":2,"timeSegment":"上午"}]`;

    const userMsg = `用户原始需求：${userIntent}\n\n请严格按【每日安排计划】生成本周学习安排。`;

    return { systemPrompt, userMsg, chapterList };
  }

  private buildSlotsFromParsedIntent(
    intent: ParsedWeekIntent,
    input: {
      weekStartISO: string;
      todayISO: string;
      dailyHours: Array<{ date: string; hours: number }>;
      userIntent: string;
    },
    subjectGroup: Map<string, SubjectChapterMap>,
  ): DraftSlot[] {
    const slots: DraftSlot[] = [];
    const chapterPointers = new Map<string, number>();
    const subjects = Array.from(subjectGroup.keys());

    const normalize = (value: string): string => value.replace(/\s+/gu, '').toLowerCase();
    const dateAtOffset = (offset: number): string => {
      const d = new Date(input.weekStartISO + 'T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().split('T')[0];
    };
    const dayHours = (date: string): number =>
      input.dailyHours.find(d => d.date === date)?.hours || intent.dailyHours || 2;

    const resolveSubjectName = (rawSubject?: string, title?: string): string => {
      const raw = rawSubject && rawSubject !== '__mock__' ? rawSubject : '';
      const query = normalize(`${raw}${title || ''}${input.userIntent || ''}`);
      const rawQuery = normalize(raw);

      for (const subjectName of subjects) {
        const normalizedSubject = normalize(subjectName);
        if (
          (rawQuery && (normalizedSubject.includes(rawQuery) || rawQuery.includes(normalizedSubject))) ||
          query.includes(normalizedSubject)
        ) {
          return subjectName;
        }
      }

      for (const [subjectName, group] of subjectGroup.entries()) {
        if (group.chapters.some(chapter => {
          const chapterTitle = normalize(chapter.chapterTitle);
          return query.includes(chapterTitle) || chapterTitle.includes(query);
        })) {
          return subjectName;
        }
      }

      return subjects[0] || raw || '学习';
    };

    const pickChapter = (
      subjectName: string,
      title: string,
    ): { chapterId: string; chapterTitle: string; remainingHours: number } | undefined => {
      const group = subjectGroup.get(subjectName) || Array.from(subjectGroup.values())[0];
      if (!group || group.chapters.length === 0) return undefined;

      const query = normalize(title);
      const matched = group.chapters.find(chapter => {
        const chapterTitle = normalize(chapter.chapterTitle);
        return query.includes(chapterTitle) || chapterTitle.includes(query);
      });
      if (matched) return matched;

      const pointer = chapterPointers.get(subjectName) ?? 0;
      const fallback = group.chapters[pointer % group.chapters.length];
      chapterPointers.set(subjectName, pointer + 1);
      return fallback;
    };

    for (const day of intent.dayIntents) {
      const date = dateAtOffset(day.dayOffset);
      if (date < input.todayISO) continue;

      const rawSubject = day.subjects[0] || '';
      const fallbackTitle = day.title || (rawSubject === '__mock__' ? '综合练习' : rawSubject || '学习安排');
      const timeSlots = day.timeSlots.length > 0
        ? day.timeSlots
        : [{ label: '', hours: dayHours(date), subjectName: rawSubject, title: fallbackTitle }];

      for (const timeSlot of timeSlots) {
        const title = timeSlot.title || day.title || fallbackTitle;
        const subjectName = resolveSubjectName(timeSlot.subjectName || rawSubject, title);
        const chapter = pickChapter(subjectName, title);
        if (!chapter) continue;

        slots.push({
          date,
          chapterId: chapter.chapterId,
          subjectName,
          chapterTitle: title || chapter.chapterTitle,
          plannedHours: timeSlot.hours,
          timeSegment: timeSlot.label || '',
        });
      }
    }

    return slots;
  }

  private async askLLMForWeekSlots(input: {
    examName: string;
    weekStartISO: string;
    weekEndISO: string;
    todayISO: string;
    phaseName?: string;
    phaseDescription?: string;
    dailyHours: Array<{ date: string; hours: number }>;
    chapters: Array<{ chapterId: string; chapterTitle: string; subjectName: string; remainingHours: number }>;
    userIntent: string;
    parsedIntent?: ParsedWeekIntent;
  }): Promise<DraftSlot[]> {
    // Group chapters by subject, preserve order
    const subjectGroup = new Map<string, SubjectChapterMap>();
    for (const c of input.chapters) {
      if (!subjectGroup.has(c.subjectName)) {
        subjectGroup.set(c.subjectName, { subjectName: c.subjectName, chapters: [] });
      }
      subjectGroup.get(c.subjectName)!.chapters.push({ chapterId: c.chapterId, chapterTitle: c.chapterTitle, remainingHours: c.remainingHours });
    }
    const subjects = Array.from(subjectGroup.values());

    const intent = input.parsedIntent
      ?? await this.parseWeekIntent(input.userIntent || '合理分配本周章节', input.weekStartISO, subjects);
    this.logger.log(`[askLLMForWeekSlots] intent type=${intent.type}, dayIntents=${intent.dayIntents.length}, dailyHours=${intent.dailyHours}`);

    if (intent.type === 'structured' && intent.dayIntents.length > 0) {
      const directSlots = this.buildSlotsFromParsedIntent(intent, input, subjectGroup);
      if (directSlots.length > 0) {
        this.logger.log(`[askLLMForWeekSlots] use parsed intent directly, slots=${directSlots.length}`);
        return directSlots;
      }
    }

    // 结构化解析失败时，才让排课 LLM 做兜底分配
    const chapterIndex = new Map<string, string>();
    const { systemPrompt, userMsg, chapterList } = this.buildWeekSlotStructuredPrompt(
      { examName: input.examName, weekStartISO: input.weekStartISO, weekEndISO: input.weekEndISO, todayISO: input.todayISO, phaseName: input.phaseName, phaseDescription: input.phaseDescription, dailyHours: input.dailyHours },
      input.chapters,
      intent,
      input.userIntent || '',
      chapterIndex,
    );

    this.logger.log(`[askLLMForWeekSlots] chapters=${chapterList.length}, prompt_system=\n${systemPrompt}\n---userMsg=${userMsg}`);
    const raw = await this.callLLMStrict(systemPrompt, userMsg, 3000);
    this.logger.log(`[askLLMForWeekSlots] raw (first 800): ${raw.slice(0, 800)}`);
    const parsed = this.parseJSONArray(raw) as Array<DraftSlot & { chapterId: string }>;
    this.logger.log(`[askLLMForWeekSlots] parsed ${parsed.length} slots`);

    return parsed.map((s) => ({ ...s, chapterId: chapterIndex.get(s.chapterId) ?? s.chapterId }));
  }

  private normalizeParsedWeekIntent(value: unknown): ParsedWeekIntent | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const raw = value as Partial<ParsedWeekIntent>;
    const type = raw.type === 'structured' || raw.type === 'flat' ? raw.type : undefined;
    if (!type) return undefined;

    const dayIntents: WeekDayIntent[] = [];
    if (Array.isArray(raw.dayIntents)) {
      for (const day of raw.dayIntents) {
            if (!day || typeof day !== 'object') continue;
            const d = day as Partial<WeekDayIntent>;
            if (typeof d.dayOffset !== 'number' || d.dayOffset < 0 || d.dayOffset > 6) continue;
            const subjects = Array.isArray(d.subjects)
              ? d.subjects.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
              : [];
            if (subjects.length === 0) continue;

            const timeSlots: WeekDayIntent['timeSlots'] = [];
            if (Array.isArray(d.timeSlots)) {
              for (const slot of d.timeSlots) {
                if (!slot || typeof slot !== 'object') continue;
                const s = slot as { label?: unknown; hours?: unknown; purpose?: unknown; subjectName?: unknown; title?: unknown };
                if (typeof s.label !== 'string' || typeof s.hours !== 'number' || s.hours <= 0 || s.hours > 12) continue;
                timeSlots.push({
                  label: s.label,
                  hours: s.hours,
                  purpose: s.purpose === 'mock' || s.purpose === 'review' ? s.purpose : undefined,
                  subjectName: typeof s.subjectName === 'string' && s.subjectName.trim() ? s.subjectName.trim() : undefined,
                  title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : undefined,
                });
              }
            }

            dayIntents.push({
              dayOffset: d.dayOffset,
              subjects,
              title: typeof d.title === 'string' && d.title.trim() ? d.title.trim() : undefined,
              timeSlots,
            });
      }
    }

    return {
      type,
      dayIntents,
      dailyHours: typeof raw.dailyHours === 'number' ? raw.dailyHours : 0,
      combinedSubject: typeof raw.combinedSubject === 'string' ? raw.combinedSubject : undefined,
    };
  }

  private async askLLMForChapterHours(input: {
    examType: string;
    examName: string;
    totalDays: number;
    totalAvailableHours: number;
    weekdayHours: number;
    weekendHours: number;
    chapters: Array<{ subjectName: string; chapterId: string; chapterTitle: string; currentHours: number }>;
  }): Promise<Array<{ chapterId: string; estimatedHours: number; reason?: string }>> {
    const systemPrompt = `你是学习时长估算专家。根据考试类型、章节内容、可用时长，给每个章节估算合理时长。

考试：${input.examName} (${input.examType})
剩余 ${input.totalDays} 天，工作日 ${input.weekdayHours}h，周末 ${input.weekendHours}h，总可用 ≈ ${input.totalAvailableHours}h
章节列表：
${input.chapters.map((c) => `[${c.chapterId}] ${c.subjectName}·${c.chapterTitle}（当前估值 ${c.currentHours}h）`).join('\n')}

要求：
- 默认每章 2h，根据章节难度和重要性微调（1-6h 之间）
- 总时长应不超过 ${input.totalAvailableHours}h，最好留出 20% 缓冲
- 简单章节（如词汇积累、概念入门）<2h；复杂章节（如数学难点、综合应用）3-5h

只输出 JSON 数组：[{"chapterId":"xxx", "estimatedHours": 2.5, "reason": "可选"}]`;

    const raw = await this.callLLM(systemPrompt, '请估算章节时长。', 2000);
    return this.parseJSONArray(raw) as Array<{ chapterId: string; estimatedHours: number; reason?: string }>;
  }

  private async callLLM(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
    return this.callLLMInternal(systemPrompt, userMessage, maxTokens, 1.0);
  }

  private async callLLMStrict(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
    return this.callLLMInternal(systemPrompt, userMessage, maxTokens, 1.0, true);
  }

  private async callLLMInternal(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
    _temperature: number,
    jsonMode = false,
  ): Promise<string> {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'deepseek-v4-flash');

    if (!apiUrl || !apiKey) {
      throw new Error('AI_API_URL and AI_API_KEY must be configured');
    }

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
      max_tokens: maxTokens,
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await axios.post(apiUrl, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    const msg = response.data?.choices?.[0]?.message;
    const content = msg?.content;
    const finishReason = response.data?.choices?.[0]?.finish_reason;
    this.logger.log(`[callLLM] finish=${finishReason} content_len=${content?.length ?? 0}`);
    if (!content) {
      this.logger.warn(`[callLLM] empty content, finish=${finishReason}, usage=${JSON.stringify(response.data?.usage)}`);
    }
    return content || '';
  }

  private parseJSONArray(raw: string): any[] {
    if (!raw) return [];
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      this.logger.warn(`[parseJSONArray] failed: ${(e as Error).message}, raw=${raw.slice(0, 200)}`);
      return [];
    }
  }

  private async ensurePlan(userId: string, planId: string) {
    const plan = await this.prisma.studyPlan.findUnique({ where: { id: planId } });
    if (!plan || plan.userId !== userId) {
      throw new NotFoundException('Study plan not found');
    }
    return plan;
  }

  private buildDailyHourBudget(
    weekStart: Date,
    weekEnd: Date,
    plan: { weekdayHours: number; weekendHours: number },
    today: Date,
  ) {
    const result: Array<{ date: string; hours: number }> = [];
    const current = new Date(weekStart);
    while (current <= weekEnd) {
      if (current >= today) {
        const day = current.getUTCDay();
        const isWeekend = day === 0 || day === 6;
        result.push({
          date: this.formatDate(current),
          hours: isWeekend ? plan.weekendHours : plan.weekdayHours,
        });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return result;
  }

  private getWeekRange(date: Date) {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    const weekStart = new Date(d);
    weekStart.setUTCDate(d.getUTCDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    return { weekStart, weekEnd };
  }

  private computeWeekNumber(planCreatedAt: Date, weekStart: Date) {
    const created = this.toDateOnly(planCreatedAt);
    const diff = this.dayDiff(created, weekStart);
    return Math.max(1, Math.floor(diff / 7) + 1);
  }

  private formatDate(d: Date) {
    return d.toISOString().split('T')[0];
  }

  private toDateOnly(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  private dayDiff(start: Date, end: Date) {
    return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  }
}
