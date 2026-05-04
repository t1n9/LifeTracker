import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { StudyPlanReferenceService } from './study-plan-reference.service';
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
  /** 本阶段结束时需要达到的掌握程度要求（≤40字） */
  mastery?: string;
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

interface WeekSkipAction {
  date: string;
  reason: string;
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
    private readonly refService: StudyPlanReferenceService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  //  Week-check：detect missing week schedules for badge reminder
  // ─────────────────────────────────────────────────────────────

  async checkWeekStatus(userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: { goal: { select: { targetDate: true } } },
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
    const examDate = this.getEffectiveExamDate(plan);
    const examDaysLeft = Math.max(0, this.dayDiff(today, examDate));

    const { weekStart: thisWeekStart, weekEnd: thisWeekEnd } = this.getWeekRange(today);
    const nextWeekStart = this.addDays(thisWeekStart, 7);
    const nextWeekEnd = this.addDays(thisWeekEnd, 7);

    const [thisWeekMissingDates, nextWeekMissingDates] = await Promise.all([
      this.findMissingSchedulableDates(plan.id, userId, today, thisWeekEnd, examDate, plan),
      this.findMissingSchedulableDates(plan.id, userId, nextWeekStart, nextWeekEnd, examDate, plan),
    ]);

    return {
      hasActivePlan: true,
      thisWeekMissing: thisWeekMissingDates.length > 0,
      nextWeekMissing: nextWeekMissingDates.length > 0,
      thisWeekMissingDates,
      nextWeekMissingDates,
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
    const examDate = this.getEffectiveExamDate(plan);
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

  async expandWeekDraft(userId: string, planId: string, dto: ExpandWeekDto & { parsedIntent?: ParsedWeekIntent }) {
    const plan = await this.ensurePlan(userId, planId);

    const weekStart = this.toDateOnly(dto.weekStart);
    const weekEnd = this.addDays(weekStart, 6);
    const today = this.toDateOnly(new Date());

    if (weekEnd < today) {
      throw new NotFoundException('Cannot expand past weeks');
    }

    let phase = dto.phaseId
      ? await this.prisma.phasePlan.findUnique({ where: { id: dto.phaseId } })
      : null;
    if (!phase) {
      phase = await this.prisma.phasePlan.findFirst({
        where: { planId, startDate: { lte: weekEnd }, endDate: { gte: weekStart } },
        orderBy: { sortOrder: 'asc' },
      });
    }

    const subjects = await this.prisma.studySubject.findMany({
      where: { planId },
      include: { chapters: { where: { status: { not: 'completed' } }, orderBy: { sortOrder: 'asc' } } },
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

    if (chapters.length === 0) {
      return { slots: [], phase, plan: { id: plan.id, examName: plan.examName } };
    }

    const examDateLimit = dto.examDateISO ? this.toDateOnly(dto.examDateISO) : null;
    const dailyHours = this.buildDailyHourBudget(weekStart, weekEnd, plan, today)
      .filter(d => {
        if (dto.missingDates && !dto.missingDates.includes(d.date)) return false;
        if (examDateLimit && this.toDateOnly(d.date) >= examDateLimit) return false;
        return true;
      });
    this.logger.log(`[expandWeekDraft] chapters=${chapters.length} weekStart=${this.formatDate(weekStart)} missingDates=${dto.missingDates?.join(',') ?? 'all'} examCutoff=${dto.examDateISO ?? 'none'} dailyHours=${JSON.stringify(dailyHours)}`);

    if (dailyHours.length === 0) {
      return { slots: [], phase, plan: { id: plan.id, examName: plan.examName } };
    }

    // ── Tier 1: deterministic (auto-onboard with per-day phase mapping) ──
    // Used by handleOnboardWeek. Bypasses LLM entirely, but still splits a day into
    // 上午/下午/晚上 slots so initial generation matches later adjustment style.
    let datePhaseMappings = dto.datePhaseMappings;
    if (!datePhaseMappings || datePhaseMappings.length === 0) {
      const allPhases = await this.prisma.phasePlan.findMany({
        where: { planId, startDate: { lte: weekEnd }, endDate: { gte: weekStart } },
        orderBy: { sortOrder: 'asc' },
      });
      if (allPhases.length > 0) {
        const lastPh = allPhases[allPhases.length - 1];
        datePhaseMappings = dailyHours.map(d => {
          const dt = this.toDateOnly(d.date);
          const ph = allPhases.find(p => p.startDate <= dt && p.endDate >= dt) ?? lastPh;
          return { date: d.date, phaseId: ph.id, phaseName: ph.name, phaseDesc: ph.description ?? '' };
        });
      }
    }

    if (datePhaseMappings && datePhaseMappings.length > 0) {
      const slots = this.normalizeTimeSegmentSlots(
        this.buildSlotsFromPhaseMappings(datePhaseMappings, dailyHours, chapters),
      );
      this.logger.log(`[expandWeekDraft] tier=deterministic slots=${slots.length}`);
      return { slots, phase, plan: { id: plan.id, examName: plan.examName } };
    }

    // ── Tier 2 & 3: LLM-based (user-directed chatExecute expand_week) ──
    // askLLMForWeekSlots internally tries structured parsedIntent first (tier 2),
    // then falls back to the scheduling LLM prompt (tier 3).
    const slots = await this.askLLMForWeekSlots({
      examName: plan.examName,
      weekStartISO: this.formatDate(weekStart),
      weekEndISO: this.formatDate(weekEnd),
      todayISO: this.formatDate(today),
      examDateISO: dto.examDateISO,
      phaseName: phase?.name,
      phaseDescription: phase?.description,
      dailyHours,
      chapters,
      userIntent: dto.userIntent || '',
      parsedIntent: dto.parsedIntent,
    });

    return {
      slots: this.normalizeTimeSegmentSlots(slots.map((s) => ({ ...s, phaseId: phase?.id }))),
      phase,
      plan: { id: plan.id, examName: plan.examName },
    };
  }

  // ── Adjustment merge: LLM identifies which dates to regenerate; all other dates are kept from currentDraftSlots ──
  private async applyAdjustmentToCurrentDraft(
    userId: string,
    planId: string,
    currentDraftSlots: Array<{ date: string; chapterId: string; chapterTitle?: string; subjectName?: string; plannedHours: number; timeSegment?: string; phaseId?: string }>,
    adjustText: string,
    allPhasesThisWeek: Array<{ id: string; name: string; description: string | null; startDate: Date; endDate: Date }>,
    examDateISO: string,
  ): Promise<DraftSlot[]> {
    // All distinct dates currently in the draft
    const allDraftDates = [...new Set(currentDraftSlots.map(s => s.date))].sort();

    // 查附近已入库的 slot（不含草稿），供用户引用（如"与5/9一致"）
    // 扩大范围：草稿最早日期前7天 ~ 草稿最晚日期后7天，确保能引用到邻近日期
    const confirmedSlots = allDraftDates.length > 0
      ? await this.prisma.dailyStudySlot.findMany({
          where: {
            planId,
            isDraft: false,
            status: { not: 'skipped' },
            date: {
              gte: (() => { const d = this.toDateOnly(allDraftDates[0]); d.setUTCDate(d.getUTCDate() - 7); return d; })(),
              lte: (() => { const d = this.toDateOnly(allDraftDates[allDraftDates.length - 1]); d.setUTCDate(d.getUTCDate() + 7); return d; })(),
            },
          },
          select: { date: true, chapterTitle: true, subjectName: true, plannedHours: true, timeSegment: true },
          orderBy: [{ date: 'asc' }, { timeSegment: 'asc' }],
        })
      : [];

    const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const formatSlotLine = (date: string, slots: Array<{ timeSegment?: string | null; subjectName: string; chapterTitle: string; plannedHours: number }>) =>
      slots.map(s => `${s.timeSegment ? `[${s.timeSegment}]` : ''}${s.subjectName ? s.subjectName + '·' : ''}${s.chapterTitle} ${s.plannedHours}h`).join(' / ');

    const draftSummary = allDraftDates.map(date => {
      const slots = currentDraftSlots.filter(s => s.date === date);
      const d = new Date(date + 'T00:00:00Z');
      return `${date}（${DAY_ZH[d.getUTCDay()]}）：${formatSlotLine(date, slots.map(s => ({ ...s, subjectName: s.subjectName ?? '', chapterTitle: s.chapterTitle ?? '' })))}`;
    }).join('\n');

    // 已入库但不在草稿里的日期（用户可引用，如"与5/9一致"）
    const confirmedByDate = new Map<string, typeof confirmedSlots>();
    for (const s of confirmedSlots) {
      const iso = this.formatDate(s.date);
      if (!confirmedByDate.has(iso)) confirmedByDate.set(iso, []);
      confirmedByDate.get(iso)!.push(s);
    }
    const confirmedSummaryLines: string[] = [];
    for (const [date, slots] of [...confirmedByDate.entries()].sort()) {
      const d = new Date(date + 'T00:00:00Z');
      confirmedSummaryLines.push(`${date}（${DAY_ZH[d.getUTCDay()]}）：${formatSlotLine(date, slots as any)}`);
    }
    const confirmedSummary = confirmedSummaryLines.length > 0
      ? `\n已确认入库的本周安排（用户可能会引用这些日期的内容）：\n${confirmedSummaryLines.join('\n')}`
      : '';

    let datesToRegenerate: string[] = [];
    let copyFromDate: string | null = null; // if user says "与X天一致", directly copy that date's slots
    try {
      const allKnownDates = [...allDraftDates, ...[...confirmedByDate.keys()]].filter((v, i, a) => a.indexOf(v) === i).sort();
      const raw = await this.callLLMStrict(
        `你是学习计划助手。用户有一份未保存的草稿计划，想对其中某几天做调整。
请根据用户的调整意图分析两件事：
1. 草稿中哪几天需要重新生成（YYYY-MM-DD格式）
2. 用户是否希望某天"与某个已知日期完全一致"（例如"与5/9一致"）

所有已知日期：${allKnownDates.join(', ')}

当前草稿：
${draftSummary}
${confirmedSummary}

用户调整意图：${adjustText}

输出JSON对象，格式：
{
  "datesToRegenerate": ["2026-05-08"],
  "copyFromDate": "2026-05-09"
}
说明：
- datesToRegenerate: 草稿中需要重新生成的日期列表（从草稿日期中选）
- copyFromDate: 如果用户明确说某天要"与X日完全一致"或"照X的安排"，填X的YYYY-MM-DD；否则填null
只输出JSON对象，不含其他文字。`,
        '请识别需要重新生成的日期和复制来源。',
        400,
      );
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { datesToRegenerate?: string[]; copyFromDate?: string | null };
        datesToRegenerate = (parsed.datesToRegenerate ?? []).filter(d => allDraftDates.includes(d));
        copyFromDate = parsed.copyFromDate && allKnownDates.includes(parsed.copyFromDate) ? parsed.copyFromDate : null;
      } else {
        // fallback: try to parse as plain array
        const arrMatch = raw.match(/\[[\s\S]*\]/);
        if (arrMatch) datesToRegenerate = (JSON.parse(arrMatch[0]) as string[]).filter(d => allDraftDates.includes(d));
      }
      this.logger.log(`[applyAdjustment] datesToRegenerate=${datesToRegenerate.join(',')} copyFromDate=${copyFromDate}`);
    } catch (e) {
      this.logger.warn(`[applyAdjustment] LLM识别日期失败，全部重新生成: ${e}`);
      datesToRegenerate = allDraftDates;
    }

    if (datesToRegenerate.length === 0) {
      // LLM无法识别，全部保留原样
      return currentDraftSlots.map(s => ({
        date: s.date, chapterId: s.chapterId, chapterTitle: s.chapterTitle ?? '',
        subjectName: s.subjectName ?? '', plannedHours: s.plannedHours,
        timeSegment: s.timeSegment ?? '', phaseId: s.phaseId,
      }));
    }

    // 对需要重新生成的天，用 parseWeekIntent 解析用户意图后生成
    const plan = await this.prisma.studyPlan.findFirst({ where: { id: planId }, include: { goal: { select: { targetDate: true } } } });
    const subjects = await this.prisma.studySubject.findMany({
      where: { planId },
      include: { chapters: { where: { status: { not: 'completed' } }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    const subjectMaps: SubjectChapterMap[] = subjects.map(s => ({
      subjectName: s.name,
      chapters: s.chapters.map(c => ({ chapterId: c.id, chapterTitle: c.title, remainingHours: Math.max(0.5, (c.estimatedHours || 2) - (c.actualHours || 0)) })),
    }));
    const chapters = subjects.flatMap(s => s.chapters.map(c => ({
      chapterId: c.id, chapterTitle: c.title, subjectName: s.name,
      remainingHours: Math.max(0.5, (c.estimatedHours || 2) - (c.actualHours || 0)),
    })));

    const regen = datesToRegenerate.filter(d => d < examDateISO);

    // Use the earliest regen date as weekStart for parseWeekIntent
    const regenWeekStart = regen[0] ?? allDraftDates[0];
    const subjectGroup = new Map<string, SubjectChapterMap>();
    for (const sm of subjectMaps) subjectGroup.set(sm.subjectName, sm);

    // Parse user's adjustment intent specifically for the dates being regenerated
    let regenSlots: DraftSlot[] = [];
    if (regen.length > 0 && chapters.length > 0) {
      const dailyHoursForRegen = regen.map(d => {
        const slotsForDay = currentDraftSlots.filter(s => s.date === d);
        const totalHours = slotsForDay.reduce((sum, s) => sum + s.plannedHours, 0);
        return { date: d, hours: totalHours || (plan?.weekdayHours ?? 2) };
      });

      // Direct copy path: if user explicitly references another date's schedule
      if (copyFromDate) {
        const sourceSlots = confirmedByDate.get(copyFromDate);
        if (sourceSlots && sourceSlots.length > 0) {
          this.logger.log(`[applyAdjustment] copyFromDate=${copyFromDate} → ${sourceSlots.length} slots`);
          for (const targetDate of regen) {
            for (const src of sourceSlots) {
              // Find a matching chapter by title in the plan, fall back to first chapter
              const matched = chapters.find(c => c.chapterTitle === src.chapterTitle) ?? chapters[0];
              if (matched) {
                regenSlots.push({
                  date: targetDate,
                  chapterId: matched.chapterId,
                  chapterTitle: src.chapterTitle ?? matched.chapterTitle,
                  subjectName: src.subjectName ?? matched.subjectName,
                  plannedHours: src.plannedHours,
                  timeSegment: src.timeSegment ?? undefined,
                  phaseId: (allPhasesThisWeek.find(p => {
                    const dt = this.toDateOnly(targetDate);
                    return p.startDate <= dt && p.endDate >= dt;
                  }) ?? allPhasesThisWeek[allPhasesThisWeek.length - 1])?.id,
                });
              }
            }
          }
        } else {
          // copyFromDate is a draft date
          const sourceDraftSlots = currentDraftSlots.filter(s => s.date === copyFromDate);
          if (sourceDraftSlots.length > 0) {
            this.logger.log(`[applyAdjustment] copyFromDate=${copyFromDate} from draft → ${sourceDraftSlots.length} slots`);
            for (const targetDate of regen) {
              for (const src of sourceDraftSlots) {
                regenSlots.push({
                  date: targetDate,
                  chapterId: src.chapterId,
                  chapterTitle: src.chapterTitle ?? '',
                  subjectName: src.subjectName ?? '',
                  plannedHours: src.plannedHours,
                  timeSegment: src.timeSegment ?? undefined,
                  phaseId: src.phaseId ?? (allPhasesThisWeek.find(p => {
                    const dt = this.toDateOnly(targetDate);
                    return p.startDate <= dt && p.endDate >= dt;
                  }) ?? allPhasesThisWeek[allPhasesThisWeek.length - 1])?.id,
                });
              }
            }
          }
        }
      }

      if (regenSlots.length === 0) {
        const adjustIntent = await this.parseWeekIntent(adjustText, regenWeekStart, subjectMaps);
        this.logger.log(`[applyAdjustment] adjustIntent type=${adjustIntent.type} days=${adjustIntent.dayIntents.length}`);

        if (adjustIntent.type === 'structured' && adjustIntent.dayIntents.length > 0) {
          // Only keep dayIntents that match the dates we need to regenerate
          const filteredIntent: ParsedWeekIntent = {
            ...adjustIntent,
            dayIntents: adjustIntent.dayIntents.filter(di => {
              const d = new Date(regenWeekStart + 'T00:00:00Z');
              d.setUTCDate(d.getUTCDate() + di.dayOffset);
              return regen.includes(this.formatDate(d));
            }),
          };
          if (filteredIntent.dayIntents.length > 0) {
            regenSlots = this.buildSlotsFromParsedIntent(filteredIntent, {
              weekStartISO: regenWeekStart,
              todayISO: this.formatDate(this.toDateOnly(new Date())),
              dailyHours: dailyHoursForRegen,
              userIntent: adjustText,
              examDateISO,
            }, subjectGroup);
          }
        }

        // Fallback to deterministic if parsedIntent didn't produce slots
        if (regenSlots.length === 0) {
          const lastPhase = allPhasesThisWeek[allPhasesThisWeek.length - 1] ?? null;
          const regenMappings = regen.map(d => {
            const dt = this.toDateOnly(d);
            const phase = allPhasesThisWeek.find(p => p.startDate <= dt && p.endDate >= dt) ?? lastPhase;
            return { date: d, phaseId: phase?.id, phaseName: phase?.name ?? '', phaseDesc: phase?.description ?? '' };
          });
          regenSlots = this.buildSlotsFromPhaseMappings(regenMappings, dailyHoursForRegen, chapters);
        }
      }
    }

    // Merge: keep unchanged days from currentDraftSlots, replace regenerated days
    const regenDaySet = new Set(regen);
    const keptSlots: DraftSlot[] = currentDraftSlots
      .filter(s => !regenDaySet.has(s.date))
      .map(s => ({
        date: s.date, chapterId: s.chapterId, chapterTitle: s.chapterTitle ?? '',
        subjectName: s.subjectName ?? '', plannedHours: s.plannedHours,
        timeSegment: s.timeSegment ?? '', phaseId: s.phaseId,
      }));

    return [...keptSlots, ...regenSlots].sort((a, b) => a.date.localeCompare(b.date) || (a.timeSegment ?? '').localeCompare(b.timeSegment ?? ''));
  }

  // Deterministic slot builder: split each day into time segments and cycle chapters by phase-matched subject.
  private buildSlotsFromPhaseMappings(
    datePhaseMappings: Array<{ date: string; phaseId?: string; phaseName?: string; phaseDesc?: string }>,
    dailyHours: Array<{ date: string; hours: number }>,
    chapters: Array<{ chapterId: string; chapterTitle: string; subjectName: string; remainingHours: number }>,
  ): DraftSlot[] {
    const subjectMap = new Map<string, typeof chapters>();
    for (const ch of chapters) {
      if (!subjectMap.has(ch.subjectName)) subjectMap.set(ch.subjectName, []);
      subjectMap.get(ch.subjectName)!.push(ch);
    }
    const chapterPointers = new Map<string, number>();
    const slots: DraftSlot[] = [];

    for (const day of dailyHours) {
      const mapping = datePhaseMappings.find(m => m.date === day.date);
      let subjectChapters = chapters;
      let phaseText = '';

      if (mapping?.phaseName) {
        phaseText = (mapping.phaseName + ' ' + (mapping.phaseDesc ?? '')).toLowerCase();

        // 1) Match subjects mentioned in the phase text, preserving the user's order.
        const matchedSubjects = [...subjectMap.entries()]
          .map(([name, items]) => {
            const match = this.findBestTextMentionIndex(phaseText, [name]);
            return { name, items, ...match };
          })
          .filter(item => item.index >= 0)
          .sort((a, b) => a.index - b.index || b.score - a.score);
        if (matchedSubjects.length > 0) {
          subjectChapters = matchedSubjects.flatMap(item => item.items);
        }

        // 2) Phase text can explicitly define chapter/module order.
        const orderedByPhaseText = this.orderChaptersByPhaseText(subjectChapters, phaseText);
        const scored = orderedByPhaseText.length > 0
          ? orderedByPhaseText.map((ch, index) => ({ ch, score: 1000 - index }))
          : subjectChapters
              .map(ch => ({ ch, score: this.scoreChapterPhaseMatch(ch.chapterTitle, phaseText) }))
              .filter(({ score }) => score > 0)
              .sort((a, b) => b.score - a.score);

        // 3) Daily focus mode: "每天主攻/依次/专项突破" → one chapter per day
        const isDailyFocus = /每天.{0,8}(主攻|专攻|突破|一个模块|一科)/.test(phaseText)
          || /依次|逐一|逐项|顺序专项/.test(phaseText);

        if (scored.length > 0) {
          if (isDailyFocus) {
            const phaseDayIdx = this.getPhaseDayIndex(datePhaseMappings, mapping, day.date);
            subjectChapters = [scored[phaseDayIdx % scored.length].ch];
          } else {
            subjectChapters = scored.map(({ ch }) => ch);
          }
        } else if (matchedSubjects.length === 0) {
          // No subject match + no scored chapters → treat as comprehensive (use all)
          subjectChapters = chapters;
        }
      }

      if (subjectChapters.length === 0) subjectChapters = chapters;
      const subjectName = subjectChapters[0]?.subjectName ?? '学习';
      for (const segment of this.splitDailyHours(day.hours)) {
        const ptr = chapterPointers.get(subjectName) ?? 0;
        const chapter = subjectChapters[ptr % subjectChapters.length];
        chapterPointers.set(subjectName, ptr + 1);
        const phaseSlot = this.buildPhaseSlotOverride(phaseText, segment.label, chapter);
        slots.push({
          date: day.date,
          chapterId: phaseSlot.chapterId,
          subjectName: phaseSlot.subjectName,
          chapterTitle: phaseSlot.chapterTitle,
          plannedHours: segment.hours,
          timeSegment: segment.label,
          phaseId: mapping?.phaseId,
        });
      }
    }
    return slots;
  }

  private getPhaseDayIndex(
    mappings: Array<{ date: string; phaseId?: string; phaseName?: string }>,
    current: { phaseId?: string; phaseName?: string },
    date: string,
  ) {
    const samePhase = mappings
      .filter(item => (current.phaseId ? item.phaseId === current.phaseId : item.phaseName === current.phaseName))
      .sort((a, b) => a.date.localeCompare(b.date));
    return Math.max(0, samePhase.findIndex(item => item.date === date));
  }

  private orderChaptersByPhaseText(
    chapters: Array<{ chapterId: string; chapterTitle: string; subjectName: string; remainingHours: number }>,
    phaseText: string,
  ) {
    return chapters
      .map((chapter, originalIndex) => {
        const match = this.findBestChapterMention(phaseText, chapter);
        return { chapter, originalIndex, ...match };
      })
      .filter(item => item.index >= 0)
      .sort((a, b) => a.index - b.index || b.score - a.score || a.originalIndex - b.originalIndex)
      .map(item => item.chapter);
  }

  private buildPhaseSlotOverride(
    phaseText: string,
    segment: string,
    fallback: { chapterId: string; chapterTitle: string; subjectName: string },
  ) {
    const chapterTitle = this.extractSegmentInstruction(phaseText, segment) || fallback.chapterTitle;
    return {
      chapterId: fallback.chapterId,
      subjectName: fallback.subjectName,
      chapterTitle,
    };
  }

  private extractSegmentInstruction(phaseText: string, segment: string) {
    const labels = segment === '上午'
      ? ['上午', '早上', '早晨']
      : segment === '下午'
        ? ['下午', '午后']
        : ['晚上', '晚间'];
    const boundary = '(上午|早上|早晨|下午|午后|晚上|晚间|；|;|。|\\n|$)';

    for (const label of labels) {
      const match = phaseText.match(new RegExp(`${label}[:：\\s]*(.{2,30}?)(?=${boundary})`, 'u'));
      const text = match?.[1]?.trim().replace(/[，,、；;。]+$/u, '');
      if (text && !/^(安排|学习|练习|复习)$/u.test(text)) return text;
    }
    return '';
  }

  private findBestChapterMention(
    phaseText: string,
    chapter: { chapterTitle: string; subjectName: string },
  ) {
    return this.findBestTextMentionIndex(phaseText, [chapter.chapterTitle, chapter.subjectName]);
  }

  private findBestTextMentionIndex(phaseText: string, sourceTexts: string[]) {
    const phase = this.normalizeMatchText(phaseText);
    const terms = this.buildGenericMatchTerms(sourceTexts);
    let best = { index: -1, score: 0 };

    for (const term of terms) {
      const index = phase.indexOf(term);
      if (index < 0) continue;
      const score = term.length;
      if (best.index < 0 || index < best.index || (index === best.index && score > best.score)) {
        best = { index, score };
      }
    }
    return best;
  }

  private buildGenericMatchTerms(sourceTexts: string[]) {
    const terms = new Set<string>();
    for (const source of sourceTexts) {
      const text = this.normalizeMatchText(source);
      if (text.length < 2) continue;
      terms.add(text);

      const maxLength = Math.min(8, text.length);
      for (let length = maxLength; length >= 2; length--) {
        for (let start = 0; start <= text.length - length; start++) {
          terms.add(text.slice(start, start + length));
        }
      }

      // Generic abbreviation support: "线性代数" can match "线代", "数据结构" can match "数结".
      if (text.length >= 3) {
        for (let i = 0; i < text.length - 1; i++) {
          for (let j = i + 1; j < text.length; j++) {
            terms.add(`${text[i]}${text[j]}`);
          }
        }
      }
    }
    return [...terms].sort((a, b) => b.length - a.length);
  }

  private normalizeMatchText(text: string) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\s"'“”‘’（）()【】\[\]{}<>《》,，.。:：;；、/\\|+_-]+/gu, '');
  }

  /** Score how well a chapter title matches a phase description.
   *  Higher = better. Prefers matches at the START of the title and longer matches. */
  private scoreChapterPhaseMatch(chapterTitle: string, phaseText: string): number {
    const t = this.normalizeMatchText(chapterTitle);
    const p = this.normalizeMatchText(phaseText);
    if (!t || !p) return 0;
    if (p.includes(t)) return 100 + t.length;
    if (t.includes(p)) return 90 + p.length;
    let best = 0;
    for (let i = 0; i <= t.length - 2; i++) {
      for (let len = 2; len <= Math.min(t.length - i, 6); len++) {
        const sub = t.slice(i, i + len);
        if (p.includes(sub)) {
          const score = len * 10 + (t.length - i);
          if (score > best) best = score;
        }
      }
    }
    return best;
  }


  private splitDailyHours(hours: number): Array<{ label: string; hours: number }> {
    if (hours <= 2) return [{ label: '上午', hours }];
    if (hours <= 4) {
      return [
        { label: '上午', hours: this.roundHalf(hours / 2) },
        { label: '下午', hours: this.roundHalf(hours - this.roundHalf(hours / 2)) },
      ].filter(segment => segment.hours > 0);
    }

    const morning = Math.min(2, this.roundHalf(hours / 3));
    const afternoon = Math.min(3, this.roundHalf((hours - morning) / 2));
    const evening = this.roundHalf(hours - morning - afternoon);
    return [
      { label: '上午', hours: morning },
      { label: '下午', hours: afternoon },
      { label: '晚上', hours: evening },
    ].filter(segment => segment.hours > 0);
  }

  private roundHalf(value: number) {
    return Math.round(value * 2) / 2;
  }

  private normalizeTimeSegmentSlots(slots: DraftSlot[]): DraftSlot[] {
    return slots.flatMap((slot) => {
      if (slot.timeSegment) {
        return [slot];
      }

      const plannedHours = Number(slot.plannedHours || 0);
      const segments = this.splitDailyHours(plannedHours);
      if (segments.length <= 1) {
        return [{ ...slot, timeSegment: segments[0]?.label || '上午', plannedHours: segments[0]?.hours || plannedHours }];
      }

      return segments.map((segment) => ({
        ...slot,
        plannedHours: segment.hours,
        timeSegment: segment.label,
      }));
    });
  }

  async confirmWeek(userId: string, planId: string, dto: ConfirmWeekDto) {
    const plan = await this.ensurePlan(userId, planId);
    const weekStart = this.toDateOnly(dto.weekStart);
    const weekEnd = this.addDays(weekStart, 6);
    const today = this.toDateOnly(new Date());
    const restSlotDates = dto.slots
      .filter(slot => this.isRestSlot(slot))
      .map(slot => this.formatDate(this.toDateOnly(slot.date)));
    const normalSlots = dto.slots.filter(slot => !this.isRestSlot(slot));
    const skipDates = [...new Set([
      ...(dto.skipDates ?? []).map(date => this.formatDate(this.toDateOnly(date))),
      ...restSlotDates,
    ])];

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
          targetHours: normalSlots.reduce((sum, s) => sum + s.plannedHours, 0),
          status: 'active',
        },
      });

      // 只删除新 slots 涉及到的日期（而非整周），避免覆盖其他天已有安排。
      // 休息日不删除，改为 skipped，保留“这天已明确不安排”的记录。
      if (dto.replaceExisting !== false && normalSlots.length > 0) {
        const slotDates = [...new Set(normalSlots.map(s => this.formatDate(this.toDateOnly(s.date))))];
        await tx.dailyStudySlot.deleteMany({
          where: {
            planId,
            date: { in: slotDates.map(d => this.toDateOnly(d)) },
            status: { in: ['pending', 'rescheduled', 'injected'] },
            isDraft: false,
          },
        });
      }

      if (skipDates.length > 0) {
        const affectedSlots = await tx.dailyStudySlot.findMany({
          where: {
            planId,
            date: { in: skipDates.map(d => this.toDateOnly(d)) },
            status: { not: 'completed' },
            isDraft: false,
            taskId: { not: null },
          },
          select: { taskId: true },
        });
        const taskIds = [...new Set(affectedSlots.map(slot => slot.taskId).filter(Boolean) as string[])];
        if (taskIds.length > 0) {
          await tx.dailyStudySlot.updateMany({
            where: {
              planId,
              date: { in: skipDates.map(d => this.toDateOnly(d)) },
              taskId: { in: taskIds },
              isDraft: false,
            },
            data: { taskId: null },
          });
        }
        if (taskIds.length > 0) {
          await tx.task.deleteMany({
            where: {
              id: { in: taskIds },
              userId,
              isCompleted: false,
              studyRecords: { none: {} },
              pomodoroSessions: { none: {} },
            },
          });
        }

        await tx.dailyStudySlot.deleteMany({
          where: {
            planId,
            date: { in: skipDates.map(d => this.toDateOnly(d)) },
            status: { not: 'completed' },
            isDraft: false,
          },
        });

        const placeholderChapter = await tx.studyChapter.findFirst({
          where: { subject: { planId } },
          select: { id: true },
          orderBy: { sortOrder: 'asc' },
        });
        if (placeholderChapter) {
          await tx.dailyStudySlot.createMany({
            data: skipDates.map(date => ({
              planId,
              userId,
              weeklyPlanId: weekly.id,
              chapterId: placeholderChapter.id,
              subjectName: '',
              chapterTitle: '休息日',
              date: this.toDateOnly(date),
              plannedHours: 0,
              actualHours: 0,
              isDraft: false,
              status: 'skipped',
              timeSegment: '',
            })),
          });
        }

        if (normalSlots.length === 0) {
          return {
            weeklyPlan: weekly,
            slots: [],
            skippedDates: skipDates,
          };
        }
      }

      if (normalSlots.length === 0) {
        return {
          weeklyPlan: weekly,
          slots: [],
          skippedDates: skipDates,
        };
      }

      // 写入新 slot
      const userIdFromPlan = (await tx.studyPlan.findUnique({
        where: { id: planId },
        select: { userId: true },
      }))!.userId;

      const created = await Promise.all(
        normalSlots.map(async (slot) => {
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

  // Step 1: 识别意图，onboard 场景直接调 AI 生成草稿供用户确认
  async chatIntent(
    userId: string,
    planId: string,
    message: string,
    weekStart?: string,
    currentDraftSlots?: Array<{ date: string; chapterId: string; chapterTitle?: string; subjectName?: string; plannedHours: number; timeSegment?: string; phaseId?: string }>,
  ): Promise<{
    action: 'generate_phases' | 'expand_week' | 'reply' | 'onboard_phases' | 'onboard_week';
    reply: string;
    targetWeekStart?: string;
    parsedIntent?: ParsedWeekIntent;
    draftPhases?: DraftPhase[];
    draftSlots?: DraftSlot[];
    skipDates?: string[];
  }> {
    const plan = await this.ensurePlan(userId, planId);
    const today = this.toDateOnly(new Date());
    const todayISO = this.formatDate(today);

    const defaultWeek = weekStart || this.getMonday(todayISO);
    const nextWeek = this.formatDate(this.addDays(this.toDateOnly(defaultWeek), 7));

    // ── Onboarding: 如果计划还没有阶段 ──
    const phaseCount = await this.prisma.phasePlan.count({ where: { planId } });
    if (phaseCount === 0) {
      return this.handleOnboardPhases(userId, planId, message);
    }

    // ── 有阶段时，检测今天到本周末哪些可编排日期没有安排，有空缺则自动推荐填充 ──
    const targetWeekStart = this.extractTargetWeek(message, defaultWeek, nextWeek);
    if (!message || message === '__auto__') {
      const thisWeekEnd = this.getWeekEnd(today);
      const schedulableEnd = this.getSchedulableEnd(thisWeekEnd, this.getEffectiveExamDate(plan));

      if (schedulableEnd < today) {
        return { action: 'reply', reply: '本周到考试前的学习安排已经排满，不需要再生成本周计划。' };
      }

      // 查今天到本周末已有的 slot（按日期分组）
      const existingSlots = await this.prisma.dailyStudySlot.findMany({
        where: {
          planId,
          isDraft: false,
          date: { gte: today, lte: schedulableEnd },
        },
        select: { date: true, chapterTitle: true, subjectName: true, plannedHours: true, timeSegment: true },
        orderBy: { date: 'asc' },
      });
      // 找出今天到本周末中没有任何 slot 的可学习日期（跳过考试当天、考后和 0 小时日期）
      const coveredDates = new Set(existingSlots.map(s => this.formatDate(s.date)));
      const missingDates = this.buildDailyHourBudget(today, schedulableEnd, plan, today)
        .filter(day => day.hours > 0)
        .map(day => day.date)
        .filter(date => !coveredDates.has(date));
      this.logger.log(`[chatIntent/__auto__] today=${todayISO} schedulableEnd=${this.formatDate(schedulableEnd)} missing=${missingDates.join(',')} existing=${coveredDates.size}天`);
      if (missingDates.length > 0) {
        return this.handleOnboardWeek(userId, planId, todayISO, undefined, {
          missingDates,
          existingSlots: existingSlots.map(s => ({
            date: this.formatDate(s.date),
            subjectName: s.subjectName,
            chapterTitle: s.chapterTitle,
            plannedHours: s.plannedHours,
            timeSegment: s.timeSegment ?? undefined,
          })),
        });
      }
      return { action: 'reply', reply: '当前学习计划已就绪。你可以继续微调阶段，或生成某一周的具体安排。' };
    }

    // ── 如果消息包含草稿上下文（用户在调整已有草稿），做局部修改后 merge 回草稿 ──
    const hasDraftContext = message.includes('【当前未保存草稿');
    const restActions = this.extractRestDateActions(message, targetWeekStart);
    if (restActions.length > 0) {
      return {
        action: 'onboard_week',
        reply: this.formatRestDatesReply(restActions),
        targetWeekStart,
        draftSlots: [],
        skipDates: restActions.map(action => action.date),
      };
    }
    if (hasDraftContext) {
      this.logger.log(`[chatIntent] draft adjustment: currentDraftSlots=${currentDraftSlots?.length ?? 0} slots`);
      return this.handleOnboardWeek(userId, planId, targetWeekStart, message, undefined, currentDraftSlots);
    }

    // ── 规则分类 ──
    const action = this.classifyIntent(message);
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

  // ── Onboarding: 无阶段 → AI 主动生成推荐草稿 ──
  private async handleOnboardPhases(
    userId: string,
    planId: string,
    message: string,
  ): Promise<{
    action: 'onboard_phases';
    reply: string;
    draftPhases: DraftPhase[];
  }> {
    const plan = await this.prisma.studyPlan.findUnique({ where: { id: planId } });
    const subjects = await this.prisma.studySubject.findMany({
      where: { planId },
      include: { chapters: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    const today = this.toDateOnly(new Date());
    const todayISO = this.formatDate(today);
    const examDate = plan ? this.getEffectiveExamDate(plan) : today;
    const totalDays = Math.max(1, this.dayDiff(today, examDate));
    const examDateISO = this.formatDate(examDate);
    const daysLeft = totalDays;

    // 查参考库，取最相关且带链接的 top3；examType 不匹配时回退到全库关键词匹配。
    const refs = await this.listReferenceCandidates(plan?.examType ?? undefined);
    const topRefs = this.pickTopReferences(refs, plan?.examName ?? '', daysLeft);

    const subjectSummary = subjects.map((s) => ({
      name: s.name,
      chapterCount: s.chapters.length,
      totalHours: s.chapters.reduce((sum, c) => sum + (c.estimatedHours || 2), 0),
      level: (s as any).level ?? 'beginner',
    }));

    // 如果用户消息里明确选了方案（"按方案1"），把该方案 description 作为强提示
    let userIntent = message || '';
    const refChoice = message?.match(/[方案选按]([1-9一二三])/);
    if (refChoice && topRefs.length > 0) {
      const idx = ['一', '二', '三'].indexOf(refChoice[1]) !== -1
        ? ['一', '二', '三'].indexOf(refChoice[1])
        : parseInt(refChoice[1], 10) - 1;
      const chosen = topRefs[idx];
      if (chosen?.description) {
        userIntent = `用户选择参考方案"${chosen.name}"。方案描述：${chosen.description}`;
      }
    }

    const draftPhases = await this.askLLMForPhases({
      examName: plan?.examName ?? '',
      examType: plan?.examType ?? '',
      totalDays,
      todayISO,
      examDateISO,
      subjects: subjectSummary,
      userIntent,
      topRefs,
    });

    // 生成回复文字：说明参考来源和推荐理由
    const lines: string[] = [];
    if (topRefs.length > 0) {
      const refNames = topRefs.map((r: any) => r.name).join('、');
      lines.push(`根据你准备的「${plan?.examName}」（距考试还有 ${daysLeft} 天），结合参考资料「${refNames}」，我为你生成了以下阶段规划：`);
    } else {
      lines.push(`根据你的考试信息（${plan?.examName}，还有 ${daysLeft} 天），我为你生成了以下阶段规划：`);
    }
    lines.push('');
    for (const p of draftPhases) {
      const days = this.dayDiff(this.toDateOnly(p.startDate), this.toDateOnly(p.endDate)) + 1;
      lines.push(`📌 **${p.name}**（${p.startDate} ~ ${p.endDate}，共 ${days} 天）`);
      if (p.description) lines.push(`   ${p.description}`);
      if (p.mastery) lines.push(`   🎯 掌握目标：${p.mastery}`);
    }
    lines.push('');
    lines.push('觉得合适可以直接确认；也可以告诉我你有什么想调整的（比如时间分配、某阶段重点）。');

    const referenceLines = this.formatReferenceLines(topRefs);
    if (referenceLines.length > 0) {
      lines.push('');
      lines.push('参考文章：');
      lines.push(...referenceLines);
    }

    return {
      action: 'onboard_phases',
      reply: lines.join('\n'),
      draftPhases,
    };
  }

  // ── Onboarding: 有阶段但本周有空缺天 → AI 只填充空缺天，不动已有安排 ──
  private async handleOnboardWeek(
    userId: string,
    planId: string,
    weekStart: string,
    userAdjustment?: string,
    gapInfo?: {
      missingDates: string[];
      existingSlots: Array<{ date: string; subjectName: string; chapterTitle: string; plannedHours: number; timeSegment?: string }>;
    },
    currentDraftSlots?: Array<{ date: string; chapterId: string; chapterTitle?: string; subjectName?: string; plannedHours: number; timeSegment?: string; phaseId?: string }>,
  ): Promise<{
    action: 'onboard_week';
    reply: string;
    targetWeekStart: string;
    draftSlots: DraftSlot[];
  }> {
    const plan = await this.prisma.studyPlan.findFirst({
      where: { id: planId },
      include: { goal: { select: { targetDate: true } } },
    });
    const today = this.toDateOnly(new Date());
    const examDate = plan ? this.getEffectiveExamDate(plan) : today;
    const daysLeft = Math.max(0, this.dayDiff(today, examDate));

    const examDateISO = this.formatDate(examDate);
    const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    // 查本周内所有涉及的阶段（按日期匹配，本周可能跨多个阶段）
    const thisWeekEnd = this.getWeekEnd(today);
    const allPhasesThisWeek = await this.prisma.phasePlan.findMany({
      where: {
        planId,
        startDate: { lte: thisWeekEnd },
        endDate: { gte: today },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // 找今天所处的阶段（用于 fallback 显示）
    const currentPhase = allPhasesThisWeek.find(
      p => p.startDate <= today && p.endDate >= today
    ) ?? allPhasesThisWeek[0] ?? null;

    // 按天构建"该天所属阶段"映射（只对空缺天）
    // 同时过滤掉考试当天及之后的天
    let missingDatesForAI: string[] = [];
    const datePhaseLine: string[] = [];

    if (gapInfo) {
      for (const d of gapInfo.missingDates) {
        // 过滤：考试当天及之后不排课
        if (d >= examDateISO) continue;
        const dt = this.toDateOnly(d);
        const phase = allPhasesThisWeek.find(p => p.startDate <= dt && p.endDate >= dt);
        missingDatesForAI.push(d);
        const dow = DAY_ZH[new Date(d + 'T00:00:00Z').getUTCDay()];
        const phaseNote = phase ? `（${phase.name}阶段：${phase.description || ''}）` : '';
        datePhaseLine.push(`${d}（${dow}）${phaseNote}`);
      }
    } else {
      // 没有 gapInfo 时（用户主动调整），不限制日期
    }

    if (gapInfo && gapInfo.missingDates.length > 0 && missingDatesForAI.length === 0) {
      return {
        action: 'onboard_week',
        reply: '本周到考试前的学习安排已经排满，不需要再生成本周计划。',
        targetWeekStart: weekStart,
        draftSlots: [],
      };
    }

    // 未完成章节统计
    const pendingChapters = await this.prisma.studyChapter.findMany({
      where: { subject: { planId }, status: { not: 'completed' } },
      include: { subject: true },
      orderBy: { sortOrder: 'asc' },
      take: 20,
    });
    const chapterSummary = pendingChapters.map(c =>
      `${c.subject.name}·${c.title}（剩余约 ${(c.estimatedHours || 2) - (c.actualHours || 0)}h）`
    ).join('、');

    // 参考库 top3；计划类型和参考库类型不一致时，回退到全库关键词匹配。
    const refs = await this.listReferenceCandidates(plan?.examType ?? undefined);
    const topRefs = this.pickTopReferences(refs, plan?.examName ?? '', daysLeft);
    const topRef = topRefs[0];

    const refContext = topRef?.description ? `参考资料「${topRef.name}」建议：${topRef.description}` : '';
    const progressContext = chapterSummary ? `当前未完成章节：${chapterSummary}` : '';

    // 阶段上下文：列出本周涉及的所有阶段
    const phaseContext = allPhasesThisWeek.length > 0
      ? `本周涉及阶段：\n${allPhasesThisWeek.map(p =>
          `• 「${p.name}」${this.formatDate(p.startDate)}~${this.formatDate(p.endDate)}：${p.description || ''}`
        ).join('\n')}`
      : '';

    // 已有安排 + 空缺天（含阶段信息）
    let existingContext = '';
    if (gapInfo) {
      if (gapInfo.existingSlots.length > 0) {
        const existingLines = gapInfo.existingSlots.map(s => {
          const dow = DAY_ZH[new Date(s.date + 'T00:00:00Z').getUTCDay()];
          return `${s.date}（${dow}）已有：${s.subjectName ? s.subjectName + '·' : ''}${s.chapterTitle} ${s.plannedHours}h`;
        });
        existingContext = `本周已有安排（请勿修改）：\n${existingLines.join('\n')}`;
      }
      if (datePhaseLine.length > 0) {
        existingContext += `\n需要填充的空缺天（每天对应阶段已标注，请按该阶段安排内容）：\n${datePhaseLine.join('\n')}`;
      }
    }

    const adjustText = userAdjustment
      ? userAdjustment.replace(/【当前未保存草稿[\s\S]*?】\n?/, '').replace('用户修改意见：', '').trim()
      : '';

    // ── 调整模式：有草稿 slots + 用户修改意见 → 只重新生成用户要改的天，其余天原样保留 ──
    if (userAdjustment && currentDraftSlots && currentDraftSlots.length > 0) {
      const mergedSlots = await this.applyAdjustmentToCurrentDraft(
        userId, planId, currentDraftSlots, adjustText, allPhasesThisWeek, examDateISO,
      );
      const lines: string[] = ['已根据你的调整更新计划：', ''];
      const DAY_ZH2 = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const byDate = new Map<string, DraftSlot[]>();
      for (const s of mergedSlots) {
        if (!byDate.has(s.date)) byDate.set(s.date, []);
        byDate.get(s.date)!.push(s);
      }
      for (const [date, slots] of [...byDate.entries()].sort()) {
        const d = new Date(date + 'T00:00:00Z');
        const items = slots.map(s =>
          `${s.timeSegment ? `[${s.timeSegment}] ` : ''}${s.subjectName ? `${s.subjectName}·` : ''}${s.chapterTitle} ${s.plannedHours}h`
        ).join(' / ');
        lines.push(`📅 ${date.slice(5)}（${DAY_ZH2[d.getUTCDay()]}）${items}`);
      }
      lines.push('');
      lines.push('觉得合适就确认写入；也可以继续告诉我要调整的地方。');
      return {
        action: 'onboard_week',
        reply: lines.join('\n'),
        targetWeekStart: weekStart,
        draftSlots: mergedSlots,
      };
    }

    const userIntent = [
      `考试日期：${examDateISO}（考试当天及之后不排课）`,
      phaseContext,
      refContext,
      progressContext,
      existingContext,
      adjustText ? `用户的调整要求：${adjustText}` : '',
    ].filter(Boolean).join('\n');

    // 把每天对应的阶段直接构造成 structured parsedIntent，跳过 AI parseWeekIntent
    // 避免 AI 解析时漏掉某些天或错误分配阶段
    const effectiveMissingDates = gapInfo ? missingDatesForAI : undefined;
    this.logger.log(`[handleOnboardWeek] missingDatesForAI=${missingDatesForAI.join(',')} examDate=${examDateISO} allPhases=${allPhasesThisWeek.map(p => `${p.name}:${this.formatDate(p.startDate)}~${this.formatDate(p.endDate)}`).join(' | ')}`);

    // 构建每天的阶段映射，传给 expandWeekDraft 做确定性生成
    const lastPhase = allPhasesThisWeek[allPhasesThisWeek.length - 1] ?? null;
    const datePhaseMappings = (effectiveMissingDates ?? []).map(d => {
      const dt = this.toDateOnly(d);
      const phase = allPhasesThisWeek.find(p => p.startDate <= dt && p.endDate >= dt) ?? lastPhase;
      return {
        date: d,
        phaseId: phase?.id,
        phaseName: phase?.name ?? '',
        phaseDesc: phase?.description ?? '',
      };
    });

    const result = await this.expandWeekDraft(userId, planId, {
      weekStart,
      userIntent: userIntent || '根据当前阶段合理安排本周学习。',
      phaseId: currentPhase?.id,
      missingDates: effectiveMissingDates,
      examDateISO,
      datePhaseMappings: datePhaseMappings.length > 0 ? datePhaseMappings : undefined,
    });

    if (result.slots.length === 0) {
      return {
        action: 'onboard_week',
        reply: '当前所有章节已完成，本周暂无需要安排的学习内容。如果要添加练习或复盘，可以直接告诉我。',
        targetWeekStart: weekStart,
        draftSlots: [],
      };
    }

    const isAdjustment = !!userAdjustment;
    const hasExisting = gapInfo && gapInfo.existingSlots.length > 0;
    const weekPhaseSummary = allPhasesThisWeek.length > 1
      ? `本周涉及阶段：${allPhasesThisWeek.map(p => `**${p.name}**（${this.formatDate(p.startDate).slice(5)}-${this.formatDate(p.endDate).slice(5)}）`).join('、')}`
      : currentPhase
        ? `当前阶段：**${currentPhase.name}**${currentPhase.description ? `——${currentPhase.description}` : ''}`
        : '';
    const lines: string[] = [];

    if (isAdjustment) {
      lines.push('已根据你的调整重新生成计划：');
    } else if (hasExisting) {
      lines.push(`本周有 **${missingDatesForAI.length}** 天还没有学习安排（距考试 **${daysLeft}** 天）。`);
      if (weekPhaseSummary) lines.push(weekPhaseSummary);
      lines.push('结合你已有的安排，为空缺天生成推荐：');
    } else {
      lines.push(`本周还没有学习安排（距考试 **${daysLeft}** 天）。`);
      if (weekPhaseSummary) lines.push(weekPhaseSummary);
      if (topRef) {
        lines.push(`结合参考资料「${topRef.name}」，为你生成本周推荐计划：`);
      } else {
        lines.push('为你生成本周推荐计划：');
      }
    }
    lines.push('');

    const byDate = new Map<string, DraftSlot[]>();
    for (const s of result.slots) {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date)!.push(s);
    }
    for (const [date, slots] of [...byDate.entries()].sort()) {
      const d = new Date(date + 'T00:00:00Z');
      const dow = DAY_ZH[d.getUTCDay()];
      const items = slots.map(s =>
        `${s.timeSegment ? `[${s.timeSegment}] ` : ''}${s.subjectName ? `${s.subjectName}·` : ''}${s.chapterTitle} ${s.plannedHours}h`
      ).join(' / ');
      lines.push(`📅 ${date.slice(5)}（${dow}）${items}`);
    }
    lines.push('');
    lines.push('觉得合适就确认写入；也可以直接修改单条，或告诉我哪天有特殊情况，我来重新调整。');
    const referenceLines = this.formatReferenceLines(topRefs);
    if (referenceLines.length > 0) {
      lines.push('');
      lines.push('参考文章：');
      lines.push(...referenceLines);
    }

    return {
      action: 'onboard_week',
      reply: lines.join('\n'),
      targetWeekStart: weekStart,
      draftSlots: result.slots,
    };
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
    skipDates?: string[];
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
      const examDate = this.getEffectiveExamDate(plan);
      const totalDays = Math.max(1, this.dayDiff(today, examDate));
      const subjectSummary = subjects.map((s) => ({
        name: s.name,
        chapterCount: s.chapters.length,
        totalHours: s.chapters.reduce((sum, c) => sum + (c.estimatedHours || 2), 0),
      }));

      // 如果用户选择了推荐方案（"按方案N来"），把该方案的 description 追加进 intent，让 LLM 参考
      let enrichedIntent = message;
      const refChoice = message.match(/[方案选]([1-9一二三])/);
      if (refChoice) {
        const idx = ['一','二','三'].indexOf(refChoice[1]) !== -1
          ? ['一','二','三'].indexOf(refChoice[1])
          : parseInt(refChoice[1], 10) - 1;
        const refs = await this.listReferenceCandidates(plan.examType ?? undefined);
        const scored = this.pickTopReferences(refs, plan.examName ?? '', totalDays);
        const chosen = scored[idx];
        if (chosen?.description) {
          enrichedIntent = `用户选择了"${chosen.name}"方案。该方案描述：${chosen.description}`;
        }
      }

      const refs = await this.listReferenceCandidates(plan.examType ?? undefined);
      const topRefs = this.pickTopReferences(refs, plan.examName ?? '', totalDays);
      const draftPhases = await this.askLLMForPhases({
        examName: plan.examName,
        examType: plan.examType,
        totalDays,
        todayISO,
        examDateISO: this.formatDate(examDate),
        subjects: subjectSummary,
        userIntent: enrichedIntent,
        topRefs,
      });
      const referenceLine = this.buildReferenceBlock(topRefs);
      return {
        action: 'generate_phases',
        reply: `生成了 ${draftPhases.length} 个备考阶段，确认后写入计划。${referenceLine}`,
        draftPhases,
      };
    }

    if (action === 'expand_week') {
      const restActions = this.extractRestDateActions(message, targetWeekStart);
      if (restActions.length > 0) {
        return {
          action: 'expand_week',
          reply: this.formatRestDatesReply(restActions),
          targetWeekStart,
          draftSlots: [],
          skipDates: restActions.map(item => item.date),
        };
      }

      const result = await this.expandWeekDraft(userId, planId, {
        weekStart: targetWeekStart,
        userIntent: message,
        parsedIntent: this.normalizeParsedWeekIntent(parsedIntent),
      });
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
        reply: `生成了 ${result.slots.length} 条学习安排，确认后写入周计划。${await this.buildReferenceBlockForPlan(plan)}`,
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

  private extractRestDateActions(message: string, weekStart: string): WeekSkipAction[] {
    if (!/(休息|不安排|空出来|暂停|跳过|不用学|不学习)/u.test(message)) {
      return [];
    }

    const cleanMessage = message.replace(/【当前未保存草稿[\s\S]*?】/u, ' ');
    const weekStartDate = this.toDateOnly(weekStart);
    const year = weekStartDate.getUTCFullYear();
    const actions = new Map<string, WeekSkipAction>();
    const addAction = (date: Date, reason = '休息') => {
      const weekEnd = this.addDays(weekStartDate, 6);
      if (date < weekStartDate || date > weekEnd) return;
      const iso = this.formatDate(date);
      actions.set(iso, { date: iso, reason });
    };

    const mdRegex = /(?:^|[^\d])(\d{1,2})[.,，、/月-](\d{1,2})(?:日|号)?[^，。；;\n]*(休息|不安排|空出来|暂停|跳过|不用学|不学习)/gu;
    for (const match of cleanMessage.matchAll(mdRegex)) {
      const month = Number(match[1]);
      const day = Number(match[2]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        addAction(new Date(Date.UTC(year, month - 1, day)), match[3]);
      }
    }

    const dayMap: Record<string, number> = {
      周一: 1, 星期一: 1,
      周二: 2, 星期二: 2,
      周三: 3, 星期三: 3,
      周四: 4, 星期四: 4,
      周五: 5, 星期五: 5,
      周六: 6, 星期六: 6,
      周日: 7, 星期日: 7, 周天: 7, 星期天: 7,
    };
    for (const [label, offset] of Object.entries(dayMap)) {
      const pattern = new RegExp(`${label}[^，。；;\\n]*(休息|不安排|空出来|暂停|跳过|不用学|不学习)`, 'u');
      const match = cleanMessage.match(pattern);
      if (match) {
        addAction(this.addDays(weekStartDate, offset - 1), match[1]);
      }
    }

    return [...actions.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  private isRestSlot(slot: Pick<WeekSlotDraftDto, 'chapterTitle' | 'subjectName'>) {
    const text = `${slot.subjectName ?? ''} ${slot.chapterTitle ?? ''}`;
    return /(休息|不安排|不用学|不学习|空出来|暂停|跳过)/u.test(text);
  }

  private async buildReferenceBlockForPlan(plan: { examType: string; examName: string }) {
    const refs = await this.listReferenceCandidates(plan.examType ?? undefined);
    return this.buildReferenceBlock(this.pickTopReferences(refs, plan.examName));
  }

  private buildReferenceBlock(refs: any[]) {
    const lines = this.formatReferenceLines(refs);
    return lines.length > 0 ? `\n\n参考文章：\n${lines.join('\n')}` : '';
  }

  private formatReferenceLines(refs: any[]) {
    return refs
      .filter((ref: any) => typeof ref?.sourceUrl === 'string' && ref.sourceUrl.trim())
      .slice(0, 3)
      .map((ref: any, index: number) => `${index + 1}. [${ref.sourceTitle || ref.name}](${ref.sourceUrl})`);
  }

  private async listReferenceCandidates(examType?: string) {
    const typedRefs = examType ? await this.refService.listActive(examType) as any[] : [];
    const allRefs = await this.refService.listActive(undefined) as any[];
    const typedIds = new Set(typedRefs.map((ref: any) => ref.id));
    return [
      ...typedRefs,
      ...allRefs.filter((ref: any) => !typedIds.has(ref.id)),
    ];
  }

  private pickTopReferences(refs: any[], examName: string, daysLeft?: number) {
    return refs
      .map((ref: any) => {
        const keywords = (ref.matchKeywords || '').split(',').map((keyword: string) => keyword.trim()).filter(Boolean);
        const keywordHit = keywords.some((keyword: string) => keyword && examName.includes(keyword));
        const aliasHit = this.isReferenceAliasMatch(ref, examName);
        const hasUrl = typeof ref?.sourceUrl === 'string' && ref.sourceUrl.trim().length > 0;
        const daysDiff = daysLeft && daysLeft > 0 && ref.durationDays > 0
          ? Math.abs(daysLeft - ref.durationDays)
          : 999;
        return { ref, keywordHit: keywordHit || aliasHit, hasUrl, daysDiff };
      })
      .filter((item: any) => item.hasUrl)
      .sort((a: any, b: any) => {
        if (a.keywordHit !== b.keywordHit) return a.keywordHit ? -1 : 1;
        if (a.daysDiff !== b.daysDiff) return a.daysDiff - b.daysDiff;
        return (a.ref.sortOrder ?? 999) - (b.ref.sortOrder ?? 999);
      })
      .map((item: any) => item.ref)
      .slice(0, 3);
  }

  private isReferenceAliasMatch(ref: any, examName: string) {
    const refText = `${ref?.examType ?? ''} ${ref?.name ?? ''} ${ref?.matchKeywords ?? ''}`;
    const examTerms = this.buildGenericMatchTerms([examName]).filter(term => term.length >= 2);
    const normalizedRef = this.normalizeMatchText(refText);
    return examTerms.some(term => normalizedRef.includes(term));
  }

  private formatRestDatesReply(actions: WeekSkipAction[]) {
    const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const lines = actions.map(action => {
      const date = this.toDateOnly(action.date);
      return `📅 ${action.date.slice(5)}（${DAY_ZH[date.getUTCDay()]}）${action.reason}`;
    });
    return [
      '我理解你的调整是把下面日期设为休息，不再安排学习任务：',
      '',
      ...lines,
      '',
      '确认后会清空这些日期中尚未完成的周计划安排；已完成记录不会被改动。',
    ].join('\n');
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
    const totalDays = Math.max(1, this.dayDiff(today, this.getEffectiveExamDate(plan)));
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
    if (/(阶段|时期|周期|分期|规划期|第[一二三四五六七八九十\d]+阶段|前期|中期|后期|初期|末期)/u.test(message)) {
      return 'generate_phases';
    }
    if (
      /(\d+[号月.\/]|本周|下周|这周|今天|明天|后天|每天|每日|周[一二三四五六日天]|星期[一二三四五六日天]|上午|下午|晚上|早上|晚间|\d+(?:\.\d+)?\s*(?:小时|h|分钟|min)|安排|排课|学习|复习|刷题|训练|练习|任务|章节|科目|课程|专题|专项|单元|模块)/u.test(message)
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
        .map(s => s === '__mock__' ? '综合检验练习' : s)
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
    subjects: Array<{ name: string; chapterCount: number; totalHours: number; level?: string }>;
    userIntent: string;
    topRefs?: any[];
  }): Promise<DraftPhase[]> {
    const subjectLines = input.subjects.map((s) => {
      const levelLabel = s.level === 'advanced' ? '已较熟练' : s.level === 'intermediate' ? '有基础' : '待学';
      return `${s.name}（${s.chapterCount}章 约${s.totalHours}h，掌握程度：${levelLabel}）`;
    }).join('、');

    const refSection = input.topRefs && input.topRefs.length > 0
      ? `\n参考资料（请结合这些资料的备考策略进行规划）：\n${input.topRefs.map((r: any) => `- ${r.name}（${r.durationDays > 0 ? r.durationDays + '天计划' : '通用'}）：${r.description || '无描述'}`).join('\n')}`
      : '';

    // 最后一个备考日 = 考试日前一天（考试当天不排学习）
    const examDate = this.toDateOnly(input.examDateISO);
    examDate.setUTCDate(examDate.getUTCDate() - 1);
    const lastStudyDayISO = this.formatDate(examDate);

    const systemPrompt = `你是备考规划专家。根据考试信息、科目掌握程度和参考资料，把备考期划分成若干阶段（一般3-5个），每个阶段说明核心任务和阶段结束时需要达到的掌握要求。

考试：${input.examName}（${input.examType}）
今天：${input.todayISO}，考试日：${input.examDateISO}（还剩 ${input.totalDays} 天）
科目情况：${subjectLines}
${refSection}

用户意图：${input.userIntent || '请根据上述信息自动规划最优方案'}

请输出 JSON 数组，每个阶段包含：
- name: 阶段名（≤10字，如"基础熟悉期""专项强化期""综合模拟期"）
- description: 本阶段核心任务（≤40字，说明做什么、每科侧重什么）
- mastery: 本阶段结束时的掌握要求（≤40字，具体可量化，如"核心题型正确率提升到80%左右"）
- startDate: YYYY-MM-DD
- endDate: YYYY-MM-DD
- sortOrder: 从0开始的数字

约束：
- 阶段必须连续，无间隔无重叠
- 第一阶段从 ${input.todayISO} 开始，最后阶段结束于 ${lastStudyDayISO}（考试当天不安排学习，最后备考日为考试前一天）
- 时间分配合理（基础期最长，冲刺期最短）
- 针对当前掌握薄弱的科目在前期多分配时间

只输出 JSON 数组，不要其他文字。`;

    const raw = await this.callLLMStrict(systemPrompt, '请生成阶段划分。', 1500);
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
- subject 的判断：用户描述的是"综合练习/模拟测试/整套训练/阶段测验"等整体性检验行为（而非学习某个具体知识点）时，填 "__mock__"；描述的是学习某科目知识时，填该科目名
- title 是最终要展示和写入计划的学习标题，必须尽量贴近用户原话，例如"科目A专项练习"、"综合模拟训练"、"错题复盘+薄弱练习"
- 如果同一天不同时段学习内容不同，在 timeSlots 内分别写 title；如果相同，可以只写 day.title
- 不要把用户明确给出的一个时段拆成多个子任务，例如"下午3小时复盘+薄弱练习"仍然只返回一个下午时段
- 可用科目列表：${subjectList || '（无限制）'}
- 如果某段时间"前N天分别是A、B、C"，则每天对应一个科目（第1天A，第2天B…）
- timeSlots：用户指定上午/下午/晚上时分别列出；只说总时长则返回空数组
- 只输出本周（${weekDates[0]}～${weekDates[6]}）内的日期，超出范围忽略`;

    const userMsg = `解析以下学习安排：\n${message}`;

    try {
      const raw = await this.callLLMInternal(systemPrompt, userMsg, 2000, 0.3, true, true);
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
      examDateISO?: string;
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
      // 明确列出每天日期+时长，要求 LLM 必须为每一天都生成 slot
      const DAY_ZH2 = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      const dailyLines = input.dailyHours.map(d => {
        const dt = new Date(d.date + 'T00:00:00Z');
        return `${d.date}（${DAY_ZH2[dt.getUTCDay()]}）：${d.hours}h`;
      });
      dayInstructions = `【必须为以下每一天生成学习安排，不得遗漏任何一天】\n${dailyLines.join('\n')}\n按用户意图和阶段信息为每天选择合适的章节，每天只生成一条记录。`;
    }

    const examCutoffNote = input.examDateISO
      ? `\n⚠️ 考试日期：${input.examDateISO}，考试当天及之后严禁排课，只排 < ${input.examDateISO} 的日期。`
      : '';

    const systemPrompt = `你是学习计划排课专家。根据下面的每日安排计划，从章节列表中选择最匹配的章节生成学习安排JSON。

考试：${input.examName}${input.phaseName ? `，阶段：${input.phaseName}` : ''}
周范围：${input.weekStartISO}~${input.weekEndISO}，今天=${input.todayISO}${examCutoffNote}

章节列表（短ID|科目|章节名|剩余时长）：
${chapterList.join('\n')}

${dayInstructions}

选章节规则：
- 根据当天主题关键词，在章节列表中找名称最相关的章节
- 同一天不同时段尽量选不同章节（避免重复）
- 只输出 >= 今天且 < 考试日期的日期${input.examDateISO ? `（即严格小于 ${input.examDateISO}）` : ''}

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
      examDateISO?: string;
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
      if (input.examDateISO && date >= input.examDateISO) continue;

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
    examDateISO?: string;
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
      const directSlots = this.buildSlotsFromParsedIntent(intent, { ...input, examDateISO: input.examDateISO }, subjectGroup);
      if (directSlots.length > 0) {
        this.logger.log(`[askLLMForWeekSlots] use parsed intent directly, slots=${directSlots.length}`);
        return directSlots;
      }
    }

    // 结构化解析失败时，才让排课 LLM 做兜底分配
    const chapterIndex = new Map<string, string>();
    const { systemPrompt, userMsg, chapterList } = this.buildWeekSlotStructuredPrompt(
      {
        examName: input.examName,
        weekStartISO: input.weekStartISO,
        weekEndISO: input.weekEndISO,
        todayISO: input.todayISO,
        examDateISO: input.examDateISO,
        phaseName: input.phaseName,
        phaseDescription: input.phaseDescription,
        dailyHours: input.dailyHours,
      },
      input.chapters,
      intent,
      input.userIntent || '',
      chapterIndex,
    );

    this.logger.log(`[askLLMForWeekSlots] chapters=${chapterList.length}, prompt_system=\n${systemPrompt}\n---userMsg=${userMsg}`);
    const raw = await this.callLLMInternal(systemPrompt, userMsg, 3000, 0.3, true, true);
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

    const raw = await this.callLLM(systemPrompt, '请估算章节时长。', 2000, 0.3);
    return this.parseJSONArray(raw) as Array<{ chapterId: string; estimatedHours: number; reason?: string }>;
  }

  private async callLLM(systemPrompt: string, userMessage: string, maxTokens: number, temperature = 0.7): Promise<string> {
    return this.callLLMInternal(systemPrompt, userMessage, maxTokens, temperature);
  }

  private async callLLMStrict(systemPrompt: string, userMessage: string, maxTokens: number, temperature = 0.3): Promise<string> {
    return this.callLLMInternal(systemPrompt, userMessage, maxTokens, temperature, true);
  }

  private async callLLMInternal(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number,
    temperature: number,
    jsonMode = false,
    enableThinking = false,
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
      thinking: { type: enableThinking ? 'enabled' : 'disabled' },
      max_tokens: maxTokens,
      temperature,
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
    this.logger.log(`[callLLM] finish=${finishReason} content_len=${content?.length ?? 0} thinking=${enableThinking}`);
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
    const plan = await this.prisma.studyPlan.findUnique({
      where: { id: planId },
      include: { goal: { select: { targetDate: true } } },
    });
    if (!plan || plan.userId !== userId) {
      throw new NotFoundException('Study plan not found');
    }
    return plan;
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

  private getSchedulableEnd(rangeEnd: Date, examDate: Date) {
    const lastStudyDay = this.addDays(this.toDateOnly(examDate), -1);
    return lastStudyDay < rangeEnd ? lastStudyDay : rangeEnd;
  }

  private async findMissingSchedulableDates(
    planId: string,
    userId: string,
    rangeStart: Date,
    rangeEnd: Date,
    examDate: Date,
    plan: { weekdayHours: number; weekendHours: number },
  ) {
    const start = this.toDateOnly(rangeStart);
    const end = this.getSchedulableEnd(rangeEnd, examDate);
    if (end < start) return [];

    const existingSlots = await this.prisma.dailyStudySlot.findMany({
      where: {
        planId,
        userId,
        isDraft: false,
        date: { gte: start, lte: end },
      },
      select: { date: true },
    });
    const coveredDates = new Set(existingSlots.map(slot => this.formatDate(slot.date)));
    return this.buildDailyHourBudget(start, end, plan, start)
      .filter(day => day.hours > 0)
      .map(day => day.date)
      .filter(date => !coveredDates.has(date));
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

  // 返回 date 所在周的周日（ISO week: 周一到周日）
  private getWeekEnd(date: Date): Date {
    const { weekEnd } = this.getWeekRange(date);
    return weekEnd;
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
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }
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
