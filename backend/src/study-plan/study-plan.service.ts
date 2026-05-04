import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { GoalsService } from '../goals/goals.service';
import {
  AiAssistDto,
  ConfirmOcrDto,
  ConfirmSearchSourceDto,
  CreateStudyChapterDto,
  CreateStudyPlanDto,
  CreateStudySubjectDto,
  SearchExamInfoDto,
  UpdateStudyChapterDto,
  UpdateStudyPlanDto,
  UpdateStudySubjectDto,
  UploadOcrDto,
} from './dto/study-plan.dto';

type ChapterUnit = {
  subjectId: string;
  subjectName: string;
  chapterId: string;
  chapterTitle: string;
  remainingHours: number;
};

@Injectable()
export class StudyPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly goalsService: GoalsService,
  ) {}

  async create(userId: string, dto: CreateStudyPlanDto) {
    await this.assertNoOtherActivePlan(userId);
    // 先确定绑定的目标 ID（传入 goalId 优先，否则自动找/建同名活跃目标）
    const goalId = await this.resolveOrCreateGoal(userId, dto);

    const plan = await this.prisma.$transaction(async (tx) => {
      const newPlan = await tx.studyPlan.create({
        data: {
          userId,
          goalId: goalId ?? undefined,
          title: dto.title,
          examType: dto.examType,
          examName: dto.examName,
          examDate: this.toDateOnly(dto.examDate),
          employmentType: dto.employmentType,
          weekdayHours: dto.weekdayHours,
          weekendHours: dto.weekendHours,
          holidayEnabled: dto.holidayEnabled ?? true,
          promptVersion: dto.promptVersion,
        },
      });

      await this.upsertSubjectsAndChapters(tx, newPlan.id, dto.subjects || []);
      return this.getPlanDetailTx(tx, userId, newPlan.id);
    });

    return plan;
  }

  /** 找到或创建与计划对应的目标，返回 goalId */
  private async resolveOrCreateGoal(userId: string, dto: { goalId?: string; examName?: string; examDate?: string; title?: string }): Promise<string | null> {
    // 前端直接传了 goalId 则直接用
    if (dto.goalId) {
      const goal = await this.prisma.userGoal.findFirst({
        where: { id: dto.goalId, userId },
      });
      if (!goal) throw new BadRequestException('目标不存在或无权绑定');
      return dto.goalId;
    }

    const goalName = dto.examName || dto.title || '学习目标';
    const examDate = dto.examDate;

    // 查找同名活跃目标
    const existing = await this.prisma.userGoal.findFirst({
      where: { userId, goalName, isActive: true, status: 'ACTIVE' },
    });
    if (existing) return existing.id;

    // 自动创建目标并绑定
    const newGoal = await this.goalsService.startNewGoal(userId, {
      goalName,
      targetDate: examDate ? new Date(examDate).toISOString() : undefined,
      description: `备考 ${goalName}`,
    });
    return newGoal.id;
  }

  /** 获取某个目标下的所有学习计划（含暂停、归档） */
  async getPlansForGoal(userId: string, goalId: string) {
    const plans = await this.prisma.studyPlan.findMany({
      where: { userId, goalId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { dailySlots: true } },
        subjects: {
          select: { id: true, name: true, weight: true },
        },
      },
    });

    return Promise.all(plans.map(async (p) => {
      const stats = await this.getStats(userId, p.id).catch(() => null);
      return { ...p, stats };
    }));
  }

  async findAll(userId: string) {
    return this.prisma.studyPlan.findMany({
      where: { userId, status: { not: 'archived' } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        goal: { select: { targetDate: true } },
        _count: {
          select: { subjects: true, weeklyPlans: true, dailySlots: true },
        },
      },
    });
  }

  async findActive(userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { subjects: true, weeklyPlans: true, dailySlots: true },
        },
      },
    });

    if (!plan) {
      return null;
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const todaySlots = await this.prisma.dailyStudySlot.findMany({
      where: { planId: plan.id, userId, date: today, isDraft: false },
      orderBy: { createdAt: 'asc' },
    });
    const currentWeek = await this.prisma.weeklyPlan.findFirst({
      where: {
        planId: plan.id,
        weekStart: { lte: today },
        weekEnd: { gte: today },
      },
      orderBy: { weekNumber: 'asc' },
    });
    const phasePlans = await this.prisma.phasePlan.findMany({
      where: { planId: plan.id },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      ...plan,
      examDate: this.getEffectiveExamDate(plan),
      todaySlots,
      currentWeek,
      phasePlans,
    };
  }

  async findOne(userId: string, id: string) {
    return this.getPlanDetail(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateStudyPlanDto) {
    await this.ensurePlan(userId, id);
    if (dto.goalId) {
      const goal = await this.prisma.userGoal.findFirst({ where: { id: dto.goalId, userId } });
      if (!goal) throw new BadRequestException('目标不存在或无权绑定');
    }
    return this.prisma.studyPlan.update({
      where: { id },
      data: {
        ...(dto.goalId !== undefined ? { goalId: dto.goalId || null } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.examType !== undefined ? { examType: dto.examType } : {}),
        ...(dto.examName !== undefined ? { examName: dto.examName } : {}),
        ...(dto.examDate !== undefined ? { examDate: this.toDateOnly(dto.examDate) } : {}),
        ...(dto.employmentType !== undefined ? { employmentType: dto.employmentType } : {}),
        ...(dto.weekdayHours !== undefined ? { weekdayHours: dto.weekdayHours } : {}),
        ...(dto.weekendHours !== undefined ? { weekendHours: dto.weekendHours } : {}),
        ...(dto.holidayEnabled !== undefined ? { holidayEnabled: dto.holidayEnabled } : {}),
      },
    });
  }

  async archive(userId: string, id: string) {
    await this.ensurePlan(userId, id);
    return this.prisma.studyPlan.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  async pause(userId: string, id: string) {
    await this.ensurePlan(userId, id);
    return this.prisma.studyPlan.update({
      where: { id },
      data: { status: 'paused' },
    });
  }

  async resume(userId: string, id: string) {
    await this.ensurePlan(userId, id);
    await this.assertNoOtherActivePlan(userId, id);
    return this.prisma.studyPlan.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  async deletePermanently(userId: string, id: string) {
    await this.ensurePlan(userId, id);
    return this.prisma.$transaction(async (tx) => {
      const linkedSlots = await tx.dailyStudySlot.findMany({
        where: { planId: id, userId, taskId: { not: null } },
        select: { taskId: true },
      });
      const taskIds = [...new Set(linkedSlots.map(slot => slot.taskId).filter(Boolean) as string[])];

      if (taskIds.length > 0) {
        await tx.dailyStudySlot.updateMany({
          where: { planId: id, userId, taskId: { in: taskIds } },
          data: { taskId: null },
        });
      }

      await tx.dailyStudySlot.deleteMany({ where: { planId: id, userId } });
      await tx.weeklyPlan.deleteMany({ where: { planId: id } });
      await tx.phasePlan.deleteMany({ where: { planId: id } });
      await tx.ocrUpload.deleteMany({ where: { planId: id, userId } });
      await tx.studyChapter.deleteMany({ where: { subject: { planId: id } } });
      await tx.studySubject.deleteMany({ where: { planId: id } });
      await tx.studyPlan.delete({ where: { id } });

      if (taskIds.length > 0) {
        await tx.task.deleteMany({
          where: {
            id: { in: taskIds },
            userId,
            studyRecords: { none: {} },
            pomodoroSessions: { none: {} },
          },
        });
      }

      return { success: true, deletedPlanId: id };
    });
  }

  async regenerate(userId: string, id: string) {
    await this.ensurePlan(userId, id);
    await this.prisma.$transaction(async (tx) => {
      await this.regeneratePlanSchedule(tx, userId, id, false);
      await tx.studyPlan.update({
        where: { id },
        data: { generatedAt: new Date() },
      });
    });
    return this.getPlanDetail(userId, id);
  }

  async createSubject(userId: string, planId: string, dto: CreateStudySubjectDto) {
    await this.ensurePlan(userId, planId);
    const maxSortOrder = await this.prisma.studySubject.findFirst({
      where: { planId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const subject = await this.prisma.studySubject.create({
      data: {
        planId,
        name: dto.name,
        weight: dto.weight ?? 0.5,
        level: dto.level ?? 'beginner',
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1,
      },
    });

    for (let index = 0; index < (dto.chapters || []).length; index += 1) {
      const chapter = dto.chapters![index];
      await this.prisma.studyChapter.create({
        data: {
          subjectId: subject.id,
          title: chapter.title,
          estimatedHours: chapter.estimatedHours,
          source: chapter.source || 'manual',
          sortOrder: index + 1,
        },
      });
    }

    return this.prisma.studySubject.findUnique({
      where: { id: subject.id },
      include: { chapters: true },
    });
  }

  async updateSubject(userId: string, planId: string, subjectId: string, dto: UpdateStudySubjectDto) {
    await this.ensureSubject(userId, planId, subjectId);
    return this.prisma.studySubject.update({
      where: { id: subjectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.level !== undefined ? { level: dto.level } : {}),
      },
    });
  }

  async deleteSubject(userId: string, planId: string, subjectId: string) {
    await this.ensureSubject(userId, planId, subjectId);
    return this.prisma.studySubject.delete({ where: { id: subjectId } });
  }

  async createChapter(userId: string, planId: string, subjectId: string, dto: CreateStudyChapterDto) {
    await this.ensureSubject(userId, planId, subjectId);
    const maxSortOrder = await this.prisma.studyChapter.findFirst({
      where: { subjectId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return this.prisma.studyChapter.create({
      data: {
        subjectId,
        title: dto.title,
        estimatedHours: dto.estimatedHours,
        source: dto.source || 'manual',
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1,
      },
    });
  }

  async updateChapter(userId: string, planId: string, subjectId: string, chapterId: string, dto: UpdateStudyChapterDto) {
    await this.ensureChapter(userId, planId, subjectId, chapterId);
    return this.prisma.studyChapter.update({
      where: { id: chapterId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.estimatedHours !== undefined ? { estimatedHours: dto.estimatedHours } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async deleteChapter(userId: string, planId: string, subjectId: string, chapterId: string) {
    await this.ensureChapter(userId, planId, subjectId, chapterId);
    return this.prisma.studyChapter.delete({ where: { id: chapterId } });
  }

  async completeChapter(userId: string, planId: string, subjectId: string, chapterId: string) {
    await this.ensureChapter(userId, planId, subjectId, chapterId);
    return this.prisma.studyChapter.update({
      where: { id: chapterId },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });
  }

  async getWeekly(userId: string, planId: string) {
    await this.ensurePlan(userId, planId);
    return this.prisma.weeklyPlan.findMany({
      where: { planId },
      orderBy: { weekNumber: 'asc' },
      include: {
        dailySlots: {
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async getWeek(userId: string, planId: string, weekNumber: number) {
    await this.ensurePlan(userId, planId);
    const week = await this.prisma.weeklyPlan.findUnique({
      where: { planId_weekNumber: { planId, weekNumber } },
      include: {
        dailySlots: {
          orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!week) {
      throw new NotFoundException('Weekly plan not found');
    }
    return week;
  }

  async getToday(userId: string, planId: string, date?: string) {
    await this.ensurePlan(userId, planId);
    const targetDate = this.toDateOnly(date || new Date());
    return this.prisma.dailyStudySlot.findMany({
      where: { planId, userId, date: targetDate, isDraft: false },
      orderBy: { createdAt: 'asc' },
      include: {
        chapter: true,
        task: {
          select: { id: true, title: true, isCompleted: true },
        },
      },
    });
  }

  async injectSlot(userId: string, planId: string, slotId: string) {
    const slot = await this.ensureSlot(userId, planId, slotId);
    if (slot.taskId) {
      return {
        slot,
        task: await this.prisma.task.findUnique({ where: { id: slot.taskId } }),
      };
    }

    const maxSortOrder = await this.prisma.task.findFirst({
      where: { userId, isCompleted: false },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const task = await this.prisma.task.create({
      data: {
        userId,
        title: this.formatInjectedTaskTitle(slot),
        subject: slot.subjectName,
        estimatedHours: slot.plannedHours,
        isCompleted: false,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1,
      },
    });

    const updatedSlot = await this.prisma.dailyStudySlot.update({
      where: { id: slotId },
      data: {
        taskId: task.id,
        status: 'injected',
        injectedAt: new Date(),
      },
    });

    return { slot: updatedSlot, task };
  }

  private formatInjectedTaskTitle(slot: { subjectName: string; chapterTitle: string; timeSegment?: string; plannedHours?: number | null }) {
    const timeLabel = slot.timeSegment ? `[${slot.timeSegment}]` : '';
    const hourLabel = slot.plannedHours ? `(${slot.plannedHours}h)` : '';
    const meta = `${timeLabel}${hourLabel}`;
    const title = `${slot.subjectName} - ${slot.chapterTitle}`;
    return meta ? `${meta} ${title}` : title;
  }

  async skipSlot(userId: string, planId: string, slotId: string) {
    const slot = await this.ensureSlot(userId, planId, slotId);
    if (slot.status === 'completed') {
      return { skipped: slot, rescheduled: null };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const skipped = await tx.dailyStudySlot.update({
        where: { id: slotId },
        data: { status: 'skipped' },
      });
      const rescheduled = await this.rescheduleSkippedSlotTx(tx, skipped);

      return {
        skipped,
        rescheduled,
      };
    });

    await this.refreshWeeklyProgress(result.skipped.weeklyPlanId);
    if (result.rescheduled?.weeklyPlanId && result.rescheduled.weeklyPlanId !== result.skipped.weeklyPlanId) {
      await this.refreshWeeklyProgress(result.rescheduled.weeklyPlanId);
    }

    return result;
  }

  async completeSlot(userId: string, planId: string, slotId: string) {
    const slot = await this.ensureSlot(userId, planId, slotId);
    const completedAt = new Date();

    if (slot.taskId) {
      await this.prisma.task.updateMany({
        where: { id: slot.taskId, userId },
        data: { isCompleted: true },
      });
    }

    const updatedSlot = await this.prisma.dailyStudySlot.update({
      where: { id: slotId },
      data: {
        status: 'completed',
        completedAt,
        actualHours: slot.actualHours > 0 ? slot.actualHours : slot.plannedHours,
      },
    });

    if (slot.chapterId) {
      const chapter = await this.prisma.studyChapter.findUnique({ where: { id: slot.chapterId } });
      if (chapter) {
        const nextActual = chapter.actualHours + updatedSlot.actualHours;
        await this.prisma.studyChapter.update({
          where: { id: slot.chapterId },
          data: {
            actualHours: nextActual,
            status: nextActual >= chapter.estimatedHours ? 'completed' : chapter.status,
            completedAt: nextActual >= chapter.estimatedHours ? completedAt : chapter.completedAt,
          },
        });
      }
    }

    await this.refreshWeeklyProgress(slot.weeklyPlanId);
    await this.refreshPlanCompletion(planId);
    return updatedSlot;
  }

  async getStats(userId: string, planId: string) {
    await this.ensurePlan(userId, planId);
    const [totalSlots, completedSlots, totalHoursAgg, actualHoursAgg] = await Promise.all([
      this.prisma.dailyStudySlot.count({ where: { userId, planId } }),
      this.prisma.dailyStudySlot.count({ where: { userId, planId, status: 'completed' } }),
      this.prisma.dailyStudySlot.aggregate({ where: { userId, planId }, _sum: { plannedHours: true } }),
      this.prisma.dailyStudySlot.aggregate({ where: { userId, planId }, _sum: { actualHours: true } }),
    ]);
    return {
      totalSlots,
      completedSlots,
      completionRate: totalSlots > 0 ? completedSlots / totalSlots : 0,
      plannedHours: totalHoursAgg._sum.plannedHours || 0,
      actualHours: actualHoursAgg._sum.actualHours || 0,
    };
  }

  async getTodaySuggestion(userId: string) {
    const active = await this.prisma.studyPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!active) {
      return { plan: null, slots: [], phases: [], currentPhase: null };
    }
    const now = new Date();
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const slots = await this.prisma.dailyStudySlot.findMany({
      where: {
        userId,
        planId: active.id,
        date,
        status: { in: ['pending', 'injected'] },
        isDraft: false,
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });

    // 拿所有阶段，找当前所处阶段
    const phases = await this.prisma.phasePlan.findMany({
      where: { planId: active.id },
      orderBy: { sortOrder: 'asc' },
    });
    const currentPhase = phases.find(
      p => new Date(p.startDate) <= date && new Date(p.endDate) >= date,
    ) ?? null;

    return { plan: active, slots, phases, currentPhase };
  }

  async injectToday(userId: string) {
    const suggestion = await this.getTodaySuggestion(userId);
    const created: Array<{ slotId: string; taskId: string }> = [];
    for (const slot of suggestion.slots) {
      const result = await this.injectSlot(userId, slot.planId, slot.id);
      if (result.task?.id) {
        created.push({ slotId: slot.id, taskId: result.task.id });
      }
    }
    return {
      planId: suggestion.plan?.id || null,
      injectedCount: created.length,
      injected: created,
    };
  }

  async uploadOcr(userId: string, dto: UploadOcrDto) {
    return this.prisma.ocrUpload.create({
      data: {
        userId,
        subjectId: dto.subjectId,
        imageUrl: dto.imageUrl,
        rawText: dto.rawText,
        parsedResult: (dto.parsedResult || {}) as any,
      },
    });
  }

  async confirmOcr(userId: string, uploadId: string, dto: ConfirmOcrDto) {
    const upload = await this.prisma.ocrUpload.findFirst({
      where: { id: uploadId, userId },
    });
    if (!upload) {
      throw new NotFoundException('OCR upload not found');
    }

    const targetSubjectId = dto.subjectId || upload.subjectId;
    if (targetSubjectId && Array.isArray(dto.chapters)) {
      for (let index = 0; index < dto.chapters.length; index += 1) {
        const chapter = dto.chapters[index];
        await this.prisma.studyChapter.create({
          data: {
            subjectId: targetSubjectId,
            title: chapter.title,
            estimatedHours: chapter.estimatedHours || 1,
            source: 'ocr',
            sortOrder: index + 1,
          },
        });
      }
    }

    return this.prisma.ocrUpload.update({
      where: { id: uploadId },
      data: { status: 'confirmed' },
    });
  }

  async discardOcr(userId: string, uploadId: string) {
    const upload = await this.prisma.ocrUpload.findFirst({
      where: { id: uploadId, userId },
    });
    if (!upload) {
      throw new NotFoundException('OCR upload not found');
    }
    return this.prisma.ocrUpload.update({
      where: { id: uploadId },
      data: { status: 'discarded' },
    });
  }

  async searchExamInfo(userId: string, dto: SearchExamInfoDto) {
    const now = new Date();
    const trusted = await this.prisma.trustedSource.findFirst({
      where: {
        query: dto.query,
        status: 'active',
        expiresAt: { gt: now },
      },
      orderBy: [{ useCount: 'desc' }, { lastConfirmedAt: 'desc' }],
    });

    return {
      trusted: trusted || null,
      results: [],
      provider: 'pending_external_integration',
      query: dto.query,
      requestedBy: userId,
    };
  }

  async confirmSearchSource(userId: string, dto: ConfirmSearchSourceDto) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
    const source = await this.prisma.trustedSource.upsert({
      where: {
        query_url: {
          query: dto.query,
          url: dto.url,
        },
      },
      create: {
        query: dto.query,
        url: dto.url,
        title: dto.title,
        summary: dto.summary,
        useCount: 1,
        lastConfirmedAt: now,
        expiresAt,
        status: 'active',
      },
      update: {
        title: dto.title,
        summary: dto.summary,
        useCount: { increment: 1 },
        lastConfirmedAt: now,
        expiresAt,
        status: 'active',
      },
    });

    await this.prisma.trustedSourceConfirmation.upsert({
      where: {
        sourceId_userId: {
          sourceId: source.id,
          userId,
        },
      },
      create: {
        sourceId: source.id,
        userId,
      },
      update: {},
    });

    return source;
  }

  private async getPlanDetail(userId: string, id: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id, userId },
      include: {
        goal: { select: { targetDate: true } },
        subjects: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapters: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        weeklyPlans: {
          orderBy: { weekNumber: 'asc' },
          include: {
            dailySlots: {
              orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException('Study plan not found');
    }
    return { ...plan, examDate: this.getEffectiveExamDate(plan) };
  }

  private async getPlanDetailTx(tx: any, userId: string, id: string) {
    const plan = await tx.studyPlan.findFirst({
      where: { id, userId },
      include: {
        subjects: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapters: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException('Study plan not found');
    }
    return plan;
  }

  private async ensurePlan(userId: string, planId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId, userId },
      select: { id: true },
    });
    if (!plan) {
      throw new NotFoundException('Study plan not found');
    }
    return plan;
  }

  private async assertNoOtherActivePlan(userId: string, excludePlanId?: string) {
    const activePlan = await this.prisma.studyPlan.findFirst({
      where: {
        userId,
        status: 'active',
        ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
      },
      select: { id: true, title: true },
    });
    if (activePlan) {
      throw new BadRequestException(`当前已有进行中的学习计划「${activePlan.title}」。请先在设置里暂停或删除该计划，再开始新的学习计划。`);
    }
  }

  private async ensureSubject(userId: string, planId: string, subjectId: string) {
    const subject = await this.prisma.studySubject.findFirst({
      where: {
        id: subjectId,
        planId,
        plan: { userId },
      },
    });
    if (!subject) {
      throw new NotFoundException('Study subject not found');
    }
    return subject;
  }

  private async ensureChapter(userId: string, planId: string, subjectId: string, chapterId: string) {
    const chapter = await this.prisma.studyChapter.findFirst({
      where: {
        id: chapterId,
        subjectId,
        subject: {
          planId,
          plan: { userId },
        },
      },
    });
    if (!chapter) {
      throw new NotFoundException('Study chapter not found');
    }
    return chapter;
  }

  private async ensureSlot(userId: string, planId: string, slotId: string) {
    const slot = await this.prisma.dailyStudySlot.findFirst({
      where: { id: slotId, planId, userId },
    });
    if (!slot) {
      throw new NotFoundException('Daily slot not found');
    }
    return slot;
  }

  private async upsertSubjectsAndChapters(tx: any, planId: string, subjects: CreateStudySubjectDto[]) {
    for (let subjectIndex = 0; subjectIndex < subjects.length; subjectIndex += 1) {
      const subject = subjects[subjectIndex];
      const createdSubject = await tx.studySubject.create({
        data: {
          planId,
          name: subject.name,
          weight: subject.weight ?? 0.5,
          level: subject.level ?? 'beginner',
          sortOrder: subjectIndex + 1,
        },
      });
      for (let chapterIndex = 0; chapterIndex < (subject.chapters || []).length; chapterIndex += 1) {
        const chapter = subject.chapters![chapterIndex];
        await tx.studyChapter.create({
          data: {
            subjectId: createdSubject.id,
            title: chapter.title,
            estimatedHours: chapter.estimatedHours,
            source: chapter.source || 'manual',
            sortOrder: chapterIndex + 1,
          },
        });
      }
    }
  }

  private async regeneratePlanSchedule(tx: any, userId: string, planId: string, cleanAll: boolean) {
    const plan = await tx.studyPlan.findUnique({
      where: { id: planId },
      include: {
        subjects: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapters: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException('Study plan not found');
    }

    const startDate = this.toDateOnly(new Date());
    const endDate = this.toDateOnly(plan.examDate);
    if (endDate.getTime() < startDate.getTime()) {
      return;
    }

    if (cleanAll) {
      await tx.dailyStudySlot.deleteMany({ where: { planId } });
      await tx.weeklyPlan.deleteMany({ where: { planId } });
    } else {
      await tx.dailyStudySlot.deleteMany({
        where: {
          planId,
          date: { gte: startDate },
          status: { in: ['pending', 'injected', 'skipped', 'rescheduled'] },
        },
      });
    }

    const totalDays = this.dayDiff(startDate, endDate) + 1;
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
    const weeklyPlanMap = new Map<number, string>();

    for (let week = 1; week <= totalWeeks; week += 1) {
      const weekStart = this.addDays(startDate, (week - 1) * 7);
      const weekEnd = this.addDays(weekStart, 6);
      const phase = this.resolvePhase(week, totalWeeks);
      const weekly = await tx.weeklyPlan.upsert({
        where: { planId_weekNumber: { planId, weekNumber: week } },
        create: {
          planId,
          weekNumber: week,
          weekStart,
          weekEnd,
          phase,
          targetHours: 0,
          status: week === 1 ? 'active' : 'upcoming',
        },
        update: {
          weekStart,
          weekEnd,
          phase,
          targetHours: 0,
          status: week === 1 ? 'active' : 'upcoming',
        },
      });
      weeklyPlanMap.set(week, weekly.id);
    }

    const chapterUnits: ChapterUnit[] = [];
    for (const subject of plan.subjects) {
      for (const chapter of subject.chapters) {
        const remaining = Math.max(0, chapter.estimatedHours - chapter.actualHours);
        if (remaining > 0) {
          chapterUnits.push({
            subjectId: subject.id,
            subjectName: subject.name,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            remainingHours: remaining,
          });
        }
      }
    }
    if (chapterUnits.length === 0) {
      return;
    }

    let cursor = 0;
    const weeklyTargetHours = new Map<number, number>();
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 1) {
      if (chapterUnits.length === 0) {
        break;
      }
      const date = this.addDays(startDate, dayOffset);
      const day = date.getDay();
      let availableHours = day === 0 || day === 6 ? plan.weekendHours : plan.weekdayHours;
      if (availableHours <= 0) {
        continue;
      }
      const weekNumber = Math.floor(dayOffset / 7) + 1;
      const weeklyPlanId = weeklyPlanMap.get(weekNumber);
      if (!weeklyPlanId) {
        continue;
      }

      let guard = 0;
      while (availableHours > 0.01 && chapterUnits.length > 0 && guard < 200) {
        guard += 1;
        const unit = chapterUnits[cursor % chapterUnits.length];
        const chunk = Math.min(availableHours, unit.remainingHours, 2);
        if (chunk <= 0) {
          cursor += 1;
          continue;
        }

        await tx.dailyStudySlot.create({
          data: {
            weeklyPlanId,
            planId,
            userId,
            chapterId: unit.chapterId,
            date,
            subjectName: unit.subjectName,
            chapterTitle: unit.chapterTitle,
            plannedHours: Number(chunk.toFixed(2)),
            status: 'pending',
          },
        });

        availableHours -= chunk;
        unit.remainingHours -= chunk;
        weeklyTargetHours.set(weekNumber, (weeklyTargetHours.get(weekNumber) || 0) + chunk);
        if (unit.remainingHours <= 0.01) {
          chapterUnits.splice(cursor % chapterUnits.length, 1);
          if (chapterUnits.length === 0) {
            break;
          }
        } else {
          cursor += 1;
        }
      }
    }

    for (const [weekNumber, targetHours] of weeklyTargetHours.entries()) {
      await tx.weeklyPlan.update({
        where: { planId_weekNumber: { planId, weekNumber } },
        data: { targetHours: Number(targetHours.toFixed(2)) },
      });
    }
  }

  private async rescheduleSkippedSlotTx(tx: any, slot: any) {
    const nextDate = await this.findNextAvailableDateTx(tx, slot.planId, slot.date, slot.plannedHours);
    if (!nextDate) {
      return null;
    }

    const targetWeek = await tx.weeklyPlan.findFirst({
      where: {
        planId: slot.planId,
        weekStart: { lte: nextDate },
        weekEnd: { gte: nextDate },
      },
      orderBy: { weekNumber: 'asc' },
    });
    if (!targetWeek) {
      return null;
    }

    return tx.dailyStudySlot.create({
      data: {
        weeklyPlanId: targetWeek.id,
        planId: slot.planId,
        userId: slot.userId,
        chapterId: slot.chapterId,
        date: nextDate,
        subjectName: slot.subjectName,
        chapterTitle: slot.chapterTitle,
        plannedHours: slot.plannedHours,
        status: 'rescheduled',
      },
    });
  }

  private async findNextAvailableDateTx(tx: any, planId: string, fromDate: Date, requiredHours: number) {
    const plan = await tx.studyPlan.findUnique({
      where: { id: planId },
      select: {
        examDate: true,
        weekdayHours: true,
        weekendHours: true,
      },
    });
    if (!plan) {
      return null;
    }

    let cursor = this.addDays(fromDate, 1);
    const end = this.toDateOnly(plan.examDate);
    let fallbackDate: Date | null = null;

    while (cursor.getTime() <= end.getTime()) {
      const day = cursor.getDay();
      const dailyLimit = day === 0 || day === 6 ? plan.weekendHours : plan.weekdayHours;
      if (dailyLimit <= 0) {
        cursor = this.addDays(cursor, 1);
        continue;
      }

      const agg = await tx.dailyStudySlot.aggregate({
        where: {
          planId,
          date: cursor,
          status: { in: ['pending', 'injected', 'rescheduled'] },
        },
        _sum: { plannedHours: true },
      });
      const occupied = agg._sum.plannedHours || 0;
      fallbackDate = cursor;
      if (occupied + requiredHours <= dailyLimit + 0.01) {
        return cursor;
      }

      cursor = this.addDays(cursor, 1);
    }

    // 如果剩余周期内没有“空闲日”，至少顺延到最后一天，避免任务丢失。
    return fallbackDate;
  }

  private async refreshWeeklyProgress(weeklyPlanId: string) {
    const [sum, total, completed] = await Promise.all([
      this.prisma.dailyStudySlot.aggregate({
        where: { weeklyPlanId },
        _sum: { actualHours: true },
      }),
      this.prisma.dailyStudySlot.count({ where: { weeklyPlanId } }),
      this.prisma.dailyStudySlot.count({ where: { weeklyPlanId, status: 'completed' } }),
    ]);
    await this.prisma.weeklyPlan.update({
      where: { id: weeklyPlanId },
      data: {
        actualHours: sum._sum.actualHours || 0,
        completionRate: total > 0 ? completed / total : 0,
        status: total > 0 && completed === total ? 'completed' : 'active',
      },
    });
  }

  private async refreshPlanCompletion(planId: string) {
    const [total, completed] = await Promise.all([
      this.prisma.dailyStudySlot.count({ where: { planId } }),
      this.prisma.dailyStudySlot.count({ where: { planId, status: 'completed' } }),
    ]);
    if (total > 0 && total === completed) {
      await this.prisma.studyPlan.update({
        where: { id: planId },
        data: { status: 'completed' },
      });
    }
  }

  private resolvePhase(week: number, totalWeeks: number) {
    const ratio = week / totalWeeks;
    if (ratio <= 0.4) return 'foundation';
    if (ratio <= 0.7) return 'specialized';
    if (ratio <= 0.9) return 'intensive';
    return 'sprint';
  }

  private dayDiff(start: Date, end: Date) {
    return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  }

  private addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return this.toDateOnly(d);
  }

  private toDateOnly(value: string | Date) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }
    const date = value instanceof Date ? value : new Date(value);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private getEffectiveExamDate(plan: { examDate: Date; goal?: { targetDate: Date | null } | null }) {
    const planDate = this.toDateOnly(plan.examDate);
    const goalDate = plan.goal?.targetDate ? this.toDateOnlyInTimezone(plan.goal.targetDate, 'Asia/Shanghai') : null;
    return goalDate && goalDate > planDate ? goalDate : planDate;
  }

  private toDateOnlyInTimezone(value: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const year = Number(parts.find(part => part.type === 'year')?.value);
    const month = Number(parts.find(part => part.type === 'month')?.value);
    const day = Number(parts.find(part => part.type === 'day')?.value);
    return new Date(Date.UTC(year, month - 1, day));
  }

  async aiAssist(_userId: string, dto: AiAssistDto) {
    const apiUrl = this.configService.get<string>('AI_API_URL');
    const apiKey = this.configService.get<string>('AI_API_KEY');
    const model = this.configService.get<string>('AI_MODEL', 'GLM-4-Flash');

    if (!apiUrl || !apiKey) {
      return { reply: '当前 AI 服务未配置，请联系管理员。', patch: null };
    }

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `你是一个学习计划助手，帮助用户在填写备考计划向导时提供建议和自动填写信息。
今天日期：${today}。

当前向导步骤：${dto.step}
用户当前已填写的信息：${JSON.stringify(dto.context || {}, null, 2)}

你的任务：
1. 根据用户的消息，给出简短友好的回复（中文，不超过80字）
2. 同时返回一个 JSON patch 对象，用于自动填写或更新表单字段

步骤说明：
- exam_type: 用户在选择考试类型（国考/考研/雅思/自定义）
- exam_info: 用户在填写考试名称和笔试日期
- schedule: 用户在设置每天可学习的小时数和备考状态
- subjects: 用户在调整科目和章节内容

patch 字段说明（只返回需要更新的字段，不需要更新的字段不要包含）：
- examName: string - 考试名称
- examDate: string - 考试日期，格式 YYYY-MM-DD
- employmentType: 'fulltime' | 'employed'
- weekdayHours: number（1-12）
- weekendHours: number（1-16）
- subjects: 完整的科目章节数组，格式 [{name, weight, level, chapters:[{title, estimatedHours}]}]

必须以 JSON 格式回复，格式如下：
{"reply": "回复内容", "patch": {}}

如果不需要更新任何字段，patch 为 null。
如果用户只是在聊天而不是提供信息，patch 为 null。`;

    try {
      const response = await axios.post(
        apiUrl,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: dto.userMessage },
          ],
          temperature: 0.3,
          max_tokens: 600,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 20000,
        },
      );

      const raw = response.data?.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return { reply: parsed.reply || raw, patch: parsed.patch || null };
        }
      } catch {
        // fall through
      }
      return { reply: raw, patch: null };
    } catch {
      return { reply: '暂时无法连接 AI 服务，请稍后再试。', patch: null };
    }
  }
}
