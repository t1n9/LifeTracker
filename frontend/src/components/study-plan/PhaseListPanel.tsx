'use client';

import { type CSSProperties } from 'react';
import { formatDisplay, toDateOnly } from './dateUtils';
import type { PhasePlan } from './types';

interface Props {
  phases: PhasePlan[];
  today: Date;
  onClickPhase?: (phase: PhasePlan) => void;
  onRegenerate?: () => void;
}

export default function PhaseListPanel({ phases, today, onClickPhase, onRegenerate }: Props) {
  if (!phases.length) {
    return (
      <section style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>备考阶段</span>
          {onRegenerate && (
            <button style={styles.linkBtn} onClick={onRegenerate}>生成阶段</button>
          )}
        </div>
        <div style={styles.empty}>
          还没有阶段规划。可以先让 AI 根据考试日期和章节量，拆成基础、强化、冲刺等阶段。
        </div>
      </section>
    );
  }

  return (
    <section style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>备考阶段 · {phases.length} 个阶段</span>
        {onRegenerate && (
          <button style={styles.linkBtn} onClick={onRegenerate}>重新生成</button>
        )}
      </div>
      <div style={styles.list}>
        {phases.map((phase) => {
          const start = toDateOnly(phase.startDate);
          const end = toDateOnly(phase.endDate);
          const isPastPhase = end < today;
          const isCurrent = start <= today && end >= today;

          return (
            <button
              key={phase.id}
              type="button"
              style={{ ...styles.item, ...(isCurrent ? styles.itemCurrent : {}), ...(isPastPhase ? styles.itemPast : {}) }}
              onClick={() => onClickPhase?.(phase)}
            >
              <div style={styles.itemHead}>
                <span style={styles.itemName}>{phase.name}</span>
                {isCurrent && <span style={styles.currentBadge}>进行中</span>}
                {isPastPhase && <span style={styles.pastBadge}>已结束</span>}
              </div>
              <div style={styles.itemMeta}>
                {formatDisplay(start)} - {formatDisplay(end)}
              </div>
              {phase.description && <div style={styles.itemDesc}>{phase.description}</div>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--fg-2)' },
  linkBtn: { background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 },
  empty: { fontSize: 12, color: 'var(--fg-3)', padding: '8px 0', lineHeight: 1.6 },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  item: {
    border: '1px solid var(--line)', borderRadius: 10, padding: '8px 10px', background: 'var(--bg-2)', cursor: 'pointer',
    display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left', color: 'inherit',
  },
  itemCurrent: { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 14%, transparent)' },
  itemPast: { opacity: 0.55 },
  itemHead: { display: 'flex', alignItems: 'center', gap: 8 },
  itemName: { fontSize: 13, fontWeight: 700, color: 'var(--fg)' },
  currentBadge: {
    fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--accent)', color: 'var(--accent-ink)',
  },
  pastBadge: { fontSize: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--fg-3)' },
  itemMeta: { fontSize: 11, color: 'var(--fg-3)' },
  itemDesc: { fontSize: 11, color: 'var(--fg-2)', marginTop: 2, lineHeight: 1.5 },
};
