'use client';

import { useMemo, type CSSProperties } from 'react';
import { Check, Clock, Edit3, SkipForward } from 'lucide-react';
import { addDays, formatDate, formatDisplay, getMonday, toDateOnly } from './dateUtils';
import type { DailySlot, PhasePlan } from './types';

interface Props {
  weekStart: Date;
  slots: DailySlot[];
  phases: PhasePlan[];
  today: Date;
  onSlotComplete?: (slot: DailySlot) => void;
  onSlotSkip?: (slot: DailySlot) => void;
  onSlotEdit?: (slot: DailySlot) => void;
  onWeekChange: (newStart: Date) => void;
  onGenerateWeek?: (weekStart: Date) => void;
  loading?: boolean;
}

export default function WeekCalendarView({
  weekStart,
  slots,
  phases,
  today,
  onSlotComplete,
  onSlotSkip,
  onSlotEdit,
  onWeekChange,
  onGenerateWeek,
  loading,
}: Props) {
  const weekDays = useMemo(() => {
    const monday = getMonday(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [weekStart]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, DailySlot[]>();
    for (const slot of slots) {
      const key = formatDate(toDateOnly(slot.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    }
    return map;
  }, [slots]);

  const activePhase = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    return phases.find((phase) => {
      const phaseStart = toDateOnly(phase.startDate);
      const phaseEnd = toDateOnly(phase.endDate);
      return phaseStart <= end && phaseEnd >= start;
    });
  }, [phases, weekDays]);

  const goPrev = () => onWeekChange(addDays(weekStart, -7));
  const goNext = () => onWeekChange(addDays(weekStart, 7));
  const goThis = () => onWeekChange(getMonday(today));

  const activeSlots = slots.filter((slot) => slot.status !== 'skipped');
  const totalHours = activeSlots.reduce((sum, slot) => sum + (slot.plannedHours || 0), 0);
  const completedHours = slots
    .filter((slot) => slot.status === 'completed')
    .reduce((sum, slot) => sum + (slot.actualHours || slot.plannedHours || 0), 0);

  return (
    <section style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button type="button" style={styles.navBtn} onClick={goPrev}>‹</button>
          <button type="button" style={styles.navBtn} onClick={goNext}>›</button>
          <button type="button" style={styles.todayBtn} onClick={goThis}>本周</button>
        </div>
        <div style={styles.headerCenter}>
          <span style={styles.weekRange}>
            {formatDisplay(weekDays[0])} - {formatDisplay(weekDays[6])}
          </span>
          {activePhase && <span style={styles.phaseTag}>阶段 · {activePhase.name}</span>}
        </div>
        <div style={styles.headerRight}>
          <span style={styles.totalLabel}>{completedHours.toFixed(1)}h / {totalHours.toFixed(1)}h</span>
        </div>
      </div>

      {slots.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>这一周还没有学习安排。</p>
          {onGenerateWeek && (
            <button type="button" style={styles.generateBtn} onClick={() => onGenerateWeek(weekDays[0])} disabled={loading}>
              {loading ? '生成中...' : 'AI 生成本周计划'}
            </button>
          )}
        </div>
      ) : (
        <div style={styles.daysGrid}>
          {weekDays.map((day) => {
            const key = formatDate(day);
            const daySlots = slotsByDate.get(key) || [];
            const activeDaySlots = daySlots.filter((slot) => slot.status !== 'skipped');
            const isRestDay = daySlots.length > 0 && activeDaySlots.length === 0;
            const isBeforeToday = day < today;
            const isToday = formatDate(day) === formatDate(today);
            const canOperateToday = isToday;

            return (
              <div key={key} style={{ ...styles.dayRow, ...(isToday ? styles.dayRowToday : {}), ...(isBeforeToday ? styles.dayRowPast : {}) }}>
                <div style={styles.dayHeader}>
                  <span style={styles.dayLabel}>{formatDisplay(day, true)}</span>
                  {isToday && <span style={styles.todayBadge}>今天</span>}
                </div>
                {daySlots.length === 0 ? (
                  <div style={styles.daySlotEmpty}>暂无安排</div>
                ) : isRestDay ? (
                  <div style={styles.restDay}>休息日 · 不安排学习任务</div>
                ) : (
                  <div style={styles.slotList}>
                    {activeDaySlots.map((slot) => (
                      <SlotItem
                        key={slot.id}
                        slot={slot}
                        canEdit={canOperateToday}
                        onComplete={onSlotComplete}
                        onSkip={onSlotSkip}
                        onEdit={onSlotEdit}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SlotItem({
  slot,
  canEdit,
  onComplete,
  onSkip,
  onEdit,
}: {
  slot: DailySlot;
  canEdit: boolean;
  onComplete?: (slot: DailySlot) => void;
  onSkip?: (slot: DailySlot) => void;
  onEdit?: (slot: DailySlot) => void;
}) {
  const isDone = slot.status === 'completed';
  const isSkipped = slot.status === 'skipped';
  const muted = isDone || isSkipped;

  return (
    <div style={{ ...styles.slot, ...(muted ? styles.slotMuted : {}) }}>
      <div style={styles.slotMain}>
        {slot.timeSegment && <span style={styles.slotTimeSegment}>{slot.timeSegment}</span>}
        <span style={{ ...styles.slotTitle, ...(isDone ? styles.slotTitleDone : {}) }}>
          {slot.subjectName ? `${slot.subjectName} · ` : ''}{slot.chapterTitle}
        </span>
        <span style={styles.slotMeta}>
          <Clock size={11} style={{ marginRight: 3 }} />
          {slot.plannedHours}h
        </span>
      </div>
      {canEdit && !isDone && !isSkipped && (
        <div style={styles.slotActions}>
          <button type="button" style={styles.slotActionBtn} title="完成" onClick={() => onComplete?.(slot)}>
            <Check size={13} />
          </button>
          <button type="button" style={styles.slotActionBtn} title="跳过" onClick={() => onSkip?.(slot)}>
            <SkipForward size={13} />
          </button>
          {onEdit && (
            <button type="button" style={styles.slotActionBtn} title="编辑" onClick={() => onEdit(slot)}>
              <Edit3 size={12} />
            </button>
          )}
        </div>
      )}
      {isDone && <span style={styles.slotStatusTag}>已完成</span>}
      {isSkipped && <span style={styles.slotStatusTag}>已跳过</span>}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', background: 'var(--bg-1)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)', gap: 12,
    position: 'sticky', top: 0, zIndex: 10,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 6 },
  headerCenter: { display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center', minWidth: 0 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  navBtn: {
    width: 28, height: 28, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg)',
    cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  todayBtn: {
    padding: '4px 10px', borderRadius: 7, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-2)',
    cursor: 'pointer', fontSize: 12,
  },
  weekRange: { fontSize: 14, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap' },
  phaseTag: {
    fontSize: 12, padding: '3px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
    color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  totalLabel: { fontSize: 12, color: 'var(--fg-3)', whiteSpace: 'nowrap' },
  daysGrid: { padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  dayRow: {
    border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', background: 'var(--bg-1)',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  dayRowToday: { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent)' },
  dayRowPast: { opacity: 0.62 },
  dayHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  dayLabel: { fontSize: 13, fontWeight: 700, color: 'var(--fg)' },
  todayBadge: { fontSize: 10, padding: '2px 6px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)' },
  daySlotEmpty: { fontSize: 12, color: 'var(--fg-4)', paddingLeft: 4 },
  restDay: {
    fontSize: 13, color: 'var(--fg-2)', padding: '9px 10px', borderRadius: 8,
    background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-2))',
    border: '1px dashed var(--line)',
  },
  slotList: { display: 'flex', flexDirection: 'column', gap: 5 },
  slot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '7px 10px', borderRadius: 8, background: 'var(--bg-2)',
  },
  slotMuted: { opacity: 0.64 },
  slotMain: { display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  slotTimeSegment: {
    fontSize: 10, padding: '2px 6px', borderRadius: 5,
    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
    color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0,
  },
  slotTitle: { fontSize: 13, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  slotTitleDone: { textDecoration: 'line-through', color: 'var(--fg-3)' },
  slotMeta: { fontSize: 11, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', flexShrink: 0 },
  slotActions: { display: 'flex', gap: 4 },
  slotActionBtn: {
    width: 24, height: 24, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)',
    color: 'var(--fg-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, fontSize: 12,
  },
  slotStatusTag: { fontSize: 11, color: 'var(--fg-3)', flexShrink: 0 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyText: { fontSize: 14, color: 'var(--fg-3)', margin: 0 },
  generateBtn: {
    padding: '8px 16px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)',
    cursor: 'pointer', fontSize: 13, fontWeight: 700,
  },
};
