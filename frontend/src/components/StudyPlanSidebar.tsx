'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, CalendarDays, ChevronRight, X } from 'lucide-react';
import { studyPlanAPI } from '@/lib/api';
import { AGENT_DATA_CHANGED_EVENT, eventAffectsDomains } from '@/lib/agent-events';

export interface StudyPlanSidebarRef {
  open: () => void;
  close: () => void;
}

interface PhasePlan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
}

interface DailySlot {
  id: string;
  date: string;
  subjectName?: string;
  chapterTitle: string;
  plannedHours: number;
  status: string;
}

interface ActivePlan {
  id: string;
  examName: string;
  examDate: string;
  weekdayHours: number;
  weekendHours: number;
  phasePlans: PhasePlan[];
}

function toDateOnly(value: string | Date): Date {
  const s = typeof value === 'string' ? value : value.toISOString();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(value);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function getMonday(d: Date): Date {
  const utc = toDateOnly(d);
  const dow = utc.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(utc, diff);
}

function fmtShort(d: Date | string): string {
  const dt = typeof d === 'string' ? toDateOnly(d) : d;
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}`;
}

function daysLeft(examDate: string): number {
  const today = toDateOnly(new Date());
  const exam = toDateOnly(examDate);
  return Math.max(0, Math.round((exam.getTime() - today.getTime()) / 86400000));
}

const StudyPlanSidebar = forwardRef<StudyPlanSidebarRef, { showFloatingTrigger?: boolean }>(
  ({ showFloatingTrigger = true }, ref) => {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [plan, setPlan] = useState<ActivePlan | null>(null);
    const [thisWeekSlots, setThisWeekSlots] = useState<DailySlot[]>([]);
    const [nextWeekSlots, setNextWeekSlots] = useState<DailySlot[]>([]);
    const [loading, setLoading] = useState(false);

    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }));

    const thisMondayStr = useMemo(() => {
      const today = toDateOnly(new Date());
      return formatDate(getMonday(today));
    }, []);

    const nextMondayStr = useMemo(() => {
      const today = toDateOnly(new Date());
      return formatDate(addDays(getMonday(today), 7));
    }, []);

    const loadData = useCallback(async () => {
      setLoading(true);
      try {
        const res = await studyPlanAPI.getActivePlan();
        const active = res.data as ActivePlan | null;
        if (!active) { setPlan(null); return; }
        setPlan(active);

        const weekDays = (mondayStr: string) =>
          Array.from({ length: 7 }, (_, i) => formatDate(addDays(toDateOnly(mondayStr), i)));

        const fetchSlots = async (days: string[]) => {
          const results = await Promise.all(
            days.map((d) =>
              studyPlanAPI
                .getTodaySlots(active.id, d)
                .then((r) => (r.data || []) as DailySlot[])
                .catch(() => [] as DailySlot[]),
            ),
          );
          return results.flat();
        };

        const [tw, nw] = await Promise.all([
          fetchSlots(weekDays(thisMondayStr)),
          fetchSlots(weekDays(nextMondayStr)),
        ]);
        setThisWeekSlots(tw);
        setNextWeekSlots(nw);
      } catch {
        setPlan(null);
      } finally {
        setLoading(false);
      }
    }, [thisMondayStr, nextMondayStr]);

    useEffect(() => {
      if (open) {
        void loadData();
      }
    }, [open, loadData]);

    useEffect(() => {
      if (!open) return;
      const handler = (event: Event) => {
        if (eventAffectsDomains(event, ['tasks', 'studyPlan'])) {
          void loadData();
        }
      };
      window.addEventListener(AGENT_DATA_CHANGED_EVENT, handler);
      return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler);
    }, [open, loadData]);

    if (!open) {
      if (!showFloatingTrigger) return null;
      return (
        <button style={styles.floatBtn} onClick={() => setOpen(true)} title="学习计划">
          <BookOpen size={18} />
        </button>
      );
    }

    const examLeft = plan ? daysLeft(plan.examDate) : 0;
    const todayDate = toDateOnly(new Date());
    const thisMondayDate = toDateOnly(thisMondayStr);
    const nextMondayDate = toDateOnly(nextMondayStr);
    const thisWeekStart = fmtShort(thisMondayDate);
    const thisWeekEnd = fmtShort(addDays(thisMondayDate, 6));
    const nextWeekStart = fmtShort(nextMondayDate);
    const nextWeekEnd = fmtShort(addDays(nextMondayDate, 6));

    return (
      <div style={styles.overlay} onClick={() => setOpen(false)}>
        <aside style={styles.panel} onClick={(e) => e.stopPropagation()}>
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <BookOpen size={15} style={{ color: 'var(--accent)' }} />
              <span style={styles.headerTitle}>学习计划</span>
            </div>
            <div style={styles.headerRight}>
              <button
                style={styles.linkBtn}
                onClick={() => { setOpen(false); router.push('/study-plan'); }}
              >
                去规划 <ChevronRight size={12} />
              </button>
              <button style={styles.closeBtn} onClick={() => setOpen(false)}>
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={styles.body}>
            {loading && <div style={styles.hint}>加载中...</div>}

            {!loading && !plan && (
              <div style={styles.emptyState}>
                <p style={styles.hint}>还没有进行中的学习计划。</p>
                <button
                  style={styles.primaryBtn}
                  onClick={() => { setOpen(false); router.push('/study-plan'); }}
                >
                  创建学习计划
                </button>
              </div>
            )}

            {!loading && plan && (
              <>
                <section style={styles.section}>
                  <div style={styles.planHead}>
                    <span style={styles.planName}>{plan.examName}</span>
                    <span style={styles.planMeta}>距考试 {examLeft} 天</span>
                  </div>
                  <div style={styles.planSub}>
                    工作日 {plan.weekdayHours}h · 周末 {plan.weekendHours}h
                  </div>
                </section>

                {plan.phasePlans.length > 0 && (
                  <section style={styles.section}>
                    <div style={styles.sectionTitle}>备考阶段</div>
                    <div style={styles.phaseList}>
                      {plan.phasePlans.map((phase) => {
                        const start = toDateOnly(phase.startDate);
                        const end = toDateOnly(phase.endDate);
                        const isCurrent = start <= todayDate && end >= todayDate;
                        const isPast = end < todayDate;
                        return (
                          <div
                            key={phase.id}
                            style={{ ...styles.phaseItem, ...(isCurrent ? styles.phaseItemCurrent : {}), ...(isPast ? styles.phaseItemPast : {}) }}
                          >
                            <div style={styles.phaseRow}>
                              <span style={styles.phaseName}>{phase.name}</span>
                              {isCurrent && <span style={styles.badge}>进行中</span>}
                              {isPast && <span style={styles.badgeMuted}>已结束</span>}
                            </div>
                            <span style={styles.phaseMeta}>
                              {fmtShort(start)} - {fmtShort(end)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section style={styles.section}>
                  <div style={styles.sectionTitle}>
                    <CalendarDays size={12} style={{ marginRight: 4 }} />
                    本周 {thisWeekStart} - {thisWeekEnd}
                  </div>
                  <WeekSlotList slots={thisWeekSlots} weekStart={thisMondayDate} />
                </section>

                <section style={styles.section}>
                  <div style={styles.sectionTitle}>
                    <CalendarDays size={12} style={{ marginRight: 4 }} />
                    下周 {nextWeekStart} - {nextWeekEnd}
                  </div>
                  <WeekSlotList slots={nextWeekSlots} weekStart={nextMondayDate} />
                </section>
              </>
            )}
          </div>
        </aside>
      </div>
    );
  },
);

StudyPlanSidebar.displayName = 'StudyPlanSidebar';
export default StudyPlanSidebar;

function WeekSlotList({ slots, weekStart }: { slots: DailySlot[]; weekStart: Date }) {
  const DOW = ['一', '二', '三', '四', '五', '六', '日'];

  if (slots.length === 0) {
    return <div style={styles.noSlots}>暂无安排 · <span style={{ color: 'var(--accent)' }}>去 AI 生成</span></div>;
  }

  const byDate = new Map<string, DailySlot[]>();
  for (const slot of slots) {
    const key = formatDate(toDateOnly(slot.date));
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(slot);
  }

  return (
    <div style={styles.slotList}>
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        const key = formatDate(day);
        const daySlots = byDate.get(key) || [];
        if (daySlots.length === 0) return null;
        const activeDaySlots = daySlots.filter((slot) => slot.status !== 'skipped');
        const isRestDay = activeDaySlots.length === 0;
        return (
          <div key={key} style={styles.slotDay}>
            <span style={styles.slotDayLabel}>周{DOW[i]} {fmtShort(day)}</span>
            <div style={styles.slotItems}>
              {isRestDay ? (
                <div style={{ ...styles.slotItem, ...styles.slotRest }}>
                  <span style={styles.slotTitle}>休息日 · 不安排学习任务</span>
                </div>
              ) : activeDaySlots.map((slot) => (
                <div key={slot.id} style={{ ...styles.slotItem, ...(slot.status === 'completed' ? styles.slotDone : {}) }}>
                  <span style={styles.slotTitle}>
                    {slot.subjectName ? `${slot.subjectName} · ` : ''}{slot.chapterTitle}
                  </span>
                  <span style={styles.slotHours}>{slot.plannedHours}h</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  floatBtn: {
    position: 'fixed', bottom: 80, right: 16, width: 44, height: 44, borderRadius: '50%',
    background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 200,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300,
    display: 'flex', justifyContent: 'flex-end',
  },
  panel: {
    width: 'min(360px, 100vw)', height: '100%', background: 'var(--bg-1)', display: 'flex', flexDirection: 'column',
    borderLeft: '1px solid var(--line)', overflowY: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
    borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 14, fontWeight: 700, color: 'var(--fg)' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  linkBtn: {
    display: 'flex', alignItems: 'center', gap: 2,
    background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0,
  },
  closeBtn: {
    width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: 'transparent',
    color: 'var(--fg-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 },
  section: { padding: '12px 16px', borderBottom: '1px solid var(--line)' },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 8, display: 'flex', alignItems: 'center',
  },
  planHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  planName: { fontSize: 15, fontWeight: 700, color: 'var(--fg)' },
  planMeta: { fontSize: 12, color: 'var(--accent)', flexShrink: 0 },
  planSub: { fontSize: 12, color: 'var(--fg-3)' },
  phaseList: { display: 'flex', flexDirection: 'column', gap: 6 },
  phaseItem: {
    padding: '7px 10px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--line)',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  phaseItemCurrent: { borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-2))' },
  phaseItemPast: { opacity: 0.5 },
  phaseRow: { display: 'flex', alignItems: 'center', gap: 8 },
  phaseName: { fontSize: 13, fontWeight: 700, color: 'var(--fg)' },
  badge: { fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)' },
  badgeMuted: { fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--fg-3)' },
  phaseMeta: { fontSize: 11, color: 'var(--fg-3)' },
  slotList: { display: 'flex', flexDirection: 'column', gap: 6 },
  slotDay: { display: 'flex', flexDirection: 'column', gap: 3 },
  slotDayLabel: { fontSize: 11, fontWeight: 700, color: 'var(--fg-2)' },
  slotItems: { display: 'flex', flexDirection: 'column', gap: 3 },
  slotItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '5px 8px', borderRadius: 7, background: 'var(--bg-2)',
  },
  slotRest: { border: '1px dashed var(--line)', color: 'var(--fg-3)' },
  slotDone: { opacity: 0.5 },
  slotTitle: { fontSize: 12, color: 'var(--fg)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  slotHours: { fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 },
  noSlots: { fontSize: 12, color: 'var(--fg-3)', padding: '4px 0' },
  hint: { fontSize: 13, color: 'var(--fg-3)', padding: '20px 16px', textAlign: 'center' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: 999, border: 'none',
    background: 'var(--accent)', color: 'var(--accent-ink)', cursor: 'pointer', fontSize: 13, fontWeight: 700,
  },
};
