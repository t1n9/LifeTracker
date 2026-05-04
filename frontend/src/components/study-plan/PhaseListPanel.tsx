'use client';

import { type CSSProperties, useState } from 'react';
import { formatDisplay, toDateOnly } from './dateUtils';
import type { PhasePlan } from './types';

interface Props {
  phases: PhasePlan[];
  today: Date;
  onClickPhase?: (phase: PhasePlan) => void;
  onRegenerate?: () => void;
}

export default function PhaseListPanel({ phases, today, onClickPhase, onRegenerate }: Props) {
  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);

  if (!phases.length) {
    return (
      <section style={styles.container}>
        <div style={styles.header}>
          <span style={styles.title}>备考阶段</span>
          {onRegenerate && (
            <button type="button" style={styles.linkBtn} onClick={onRegenerate}>生成阶段</button>
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
          <button type="button" style={styles.linkBtn} onClick={onRegenerate}>重新生成</button>
        )}
      </div>
      <div style={styles.list}>
        {phases.map((phase) => {
          const start = toDateOnly(phase.startDate);
          const end = toDateOnly(phase.endDate);
          const isPastPhase = end < today;
          const isCurrent = start <= today && end >= today;
          const isExpanded = expandedPhaseId === phase.id;

          return (
            <button
              key={phase.id}
              type="button"
              style={{
                ...styles.item,
                ...(isCurrent ? styles.itemCurrent : {}),
                ...(isPastPhase ? styles.itemPast : {}),
                ...(isExpanded ? styles.itemSelected : {}),
              }}
              onClick={() => {
                setExpandedPhaseId(isExpanded ? null : phase.id);
                onClickPhase?.(phase);
              }}
              aria-expanded={isExpanded}
            >
              <div style={styles.itemHead}>
                <span style={styles.itemName}>{phase.name}</span>
                {isCurrent && <span style={styles.currentBadge}>进行中</span>}
                {isPastPhase && <span style={styles.pastBadge}>已结束</span>}
              </div>
              <div style={styles.itemFooter}>
                <span style={styles.itemMeta}>{formatDisplay(start)} - {formatDisplay(end)}</span>
              </div>
            </button>
          );
        })}
      </div>
      {expandedPhaseId && (
        <div style={styles.detailPanel}>
          {(() => {
            const phase = phases.find((item) => item.id === expandedPhaseId);
            if (!phase) return null;
            return (
              <>
                <div style={styles.detailHead}>
                  <span style={styles.detailName}>{phase.name}</span>
                  <button type="button" style={styles.closeBtn} onClick={() => setExpandedPhaseId(null)}>收起</button>
                </div>
                <div style={styles.detailDesc}>{phase.description || '这个阶段暂时没有描述。'}</div>
              </>
            );
          })()}
        </div>
      )}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  container: { padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 13, fontWeight: 700, color: 'var(--fg-2)' },
  linkBtn: { background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 },
  empty: { fontSize: 12, color: 'var(--fg-3)', padding: '8px 0', lineHeight: 1.6 },
  list: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    border: '1px solid var(--line)',
    borderRadius: 12,
    padding: '9px 10px',
    background: 'var(--bg-2)',
    cursor: 'pointer',
    display: 'flex',
    flex: '1 1 190px',
    minWidth: 0,
    flexDirection: 'column',
    gap: 6,
    textAlign: 'left',
    color: 'inherit',
    transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
  },
  itemCurrent: { borderColor: 'var(--accent)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--accent) 14%, transparent)' },
  itemSelected: { background: 'color-mix(in srgb, var(--accent) 10%, var(--bg-2))' },
  itemPast: { opacity: 0.55 },
  itemHead: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  itemName: { fontSize: 13, fontWeight: 700, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  currentBadge: {
    flexShrink: 0,
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 999,
    background: 'var(--accent)',
    color: 'var(--accent-ink)',
  },
  pastBadge: {
    flexShrink: 0,
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 999,
    background: 'var(--bg-3)',
    color: 'var(--fg-3)',
  },
  itemFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemMeta: { fontSize: 11, color: 'var(--fg-3)' },
  detailPanel: {
    marginTop: 10,
    border: '1px solid color-mix(in srgb, var(--accent) 32%, var(--line))',
    borderRadius: 12,
    padding: '10px 12px',
    background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-2))',
  },
  detailHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  detailName: { fontSize: 13, fontWeight: 800, color: 'var(--fg)' },
  closeBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--fg-3)',
    cursor: 'pointer',
    fontSize: 12,
    padding: 0,
  },
  detailDesc: {
    fontSize: 12,
    color: 'var(--fg-2)',
    lineHeight: 1.55,
  },
};
