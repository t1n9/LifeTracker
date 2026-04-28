'use client';

import React, { useState, useEffect, useRef } from 'react';
import { exerciseAPI } from '@/lib/api';
import { AGENT_DATA_CHANGED_EVENT, eventAffectsDomains } from '@/lib/agent-events';
import styles from './ExerciseStats.module.css';

interface ExerciseLog {
  exerciseName: string;
  emoji: string | null;
  totalValue: number;
  unit: string;
  count: number;
}

interface ExerciseStatsProps {
  theme?: 'light' | 'dark';
}

function fmt(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(1); }

const ExerciseStats: React.FC<ExerciseStatsProps> = () => {
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await exerciseAPI.getTodayLogs();
      const payload = r.data?.data ?? r.data;
      setLogs(Array.isArray(payload) ? payload : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (eventAffectsDomains(e, ['exercise'])) loadData(true);
    };
    window.addEventListener(AGENT_DATA_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler as EventListener);
  }, []);

  const active = logs.filter(l => l.totalValue > 0);

  if (loading) return <div className={styles.loading}>加载中…</div>;

  if (active.length === 0) {
    return (
      <div className={styles.empty}>
        <span>今日暂无运动记录</span>
        <p>告诉 AI 助手你做了什么运动，它会帮你记录</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {active.map(log => (
        <div key={log.exerciseName} className={styles.card}>
          <span className={styles.emoji}>{log.emoji ?? '🏃'}</span>
          <span className={styles.name}>{log.exerciseName}</span>
          <span className={styles.value}>
            {fmt(log.totalValue)}<span className={styles.unit}>{log.unit}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

export default ExerciseStats;
