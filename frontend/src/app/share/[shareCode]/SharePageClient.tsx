'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { shareAPI } from '@/lib/api';
import TaskHeatmap from '@/components/overview/TaskHeatmap';
import StudyChart from '@/components/overview/StudyChart';
import RecentActivities from '@/components/overview/RecentActivities';
import VisitorCounter from '@/components/VisitorCounter';
import '@/styles/theme.css';

interface SharedOverviewData {
  heatmapData: any[];
  activities: any[];
  chartData: any[];
  stats: {
    totalTasks: number;
    totalStudyTime: number;
    totalPomodoros: number;
    activeDays: number;
    avgTasksPerDay: string;
    currentStreak: number;
  };
  userInfo: {
    userId: string;
    email: string;
    displayName: string;
    shareNote: string;
    shareTitle?: string;
  };
}

/* force light theme for this public page */
function useLightTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.classList.remove('dark');
  }, []);
}

const card: React.CSSProperties = {
  background: 'var(--bg-1)',
  border: '1px solid var(--line)',
  borderRadius: '16px',
};

export default function SharePageClient({ shareCode }: { shareCode: string }) {
  useLightTheme();

  const [data, setData] = useState<SharedOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCode || shareCode === 'example') {
      setLoading(false);
      setError('分享码无效');
      return;
    }
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await shareAPI.getSharedOverviewByCode(shareCode);
        setData(response.data);
        document.title = response.data.userInfo.shareTitle || `${response.data.userInfo.displayName} · 分享`;
      } catch (err: any) {
        setError(err.response?.data?.message || '加载分享数据失败');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, [shareCode]);

  if (loading || error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--bg-0)' }}>
        <div style={{ ...card, width: 'min(480px, 100%)', padding: '24px' }}>
          <h1 style={{ margin: '0 0 10px', fontSize: '16px', fontWeight: 700, color: 'var(--fg)' }}>学习概览分享</h1>
          <p style={{ margin: 0, color: 'var(--fg-3)', fontSize: '13px' }}>
            {loading ? '加载中…' : error || '未找到数据'}
          </p>
        </div>
      </div>
    );
  }

  const statItems = [
    { label: '总完成任务', value: data.stats.totalTasks,          color: 'var(--accent)' },
    { label: '学习时长',   value: `${Math.round(data.stats.totalStudyTime / 60)}h`, color: 'var(--success-color)' },
    { label: '番茄次数',   value: data.stats.totalPomodoros,       color: 'var(--fg-2)' },
    { label: '连续天数',   value: data.stats.currentStreak,        color: 'var(--warn)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent) 8%, transparent 92%) 0%, transparent 38%), var(--bg-0)' }}>
      <div style={{ width: 'min(1180px, 100%)', margin: '0 auto', padding: '1.4rem 1rem 2rem' }}>

        {/* header card */}
        <section style={{ ...card, padding: '18px 20px', marginBottom: '14px' }}>
          <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 800, color: 'var(--fg)', letterSpacing: '-0.03em' }}>
            {data.userInfo.shareTitle || `${data.userInfo.displayName} · 学习概览`}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', color: 'var(--fg-3)', fontSize: '12.5px', alignItems: 'center' }}>
            <span>分享者：{data.userInfo.displayName}</span>
            <span>日期：{new Date().toLocaleDateString('zh-CN')}</span>
            <VisitorCounter userId={data.userInfo.userId} />
          </div>
        </section>

        {/* stat cards */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
          {statItems.map(({ label, value, color }) => (
            <div key={label} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>{label}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em' }}>{value}</div>
            </div>
          ))}
        </section>

        {/* heatmap */}
        <section style={{ marginBottom: '14px' }}>
          <div style={{ ...card, padding: '16px 18px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>任务热力图</h2>
            <TaskHeatmap data={data.heatmapData} theme="light" />
          </div>
        </section>

        {/* chart + activities */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div style={{ ...card, padding: '16px 18px', minWidth: 0 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>学习趋势</h2>
            <StudyChart data={data.chartData} theme="light" />
          </div>
          <div style={{ ...card, padding: '16px 18px', minWidth: 0 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>最近活动</h2>
            <RecentActivities activities={data.activities} theme="light" />
          </div>
        </section>

        <footer style={{ marginTop: '1.2rem', textAlign: 'center', color: 'var(--fg-4)', fontSize: '12px', lineHeight: 1.9 }}>
          <div>
            <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
              粤ICP备2025456526号-1
            </a>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Image src="/beian-icon.png" alt="备案图标" width={13} height={13} />
            <a href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
              粤公网安备44030002007784号
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
