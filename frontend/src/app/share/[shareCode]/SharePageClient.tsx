'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { shareAPI } from '@/lib/api';
import TaskHeatmap from '@/components/overview/TaskHeatmap';
import StudyChart from '@/components/overview/StudyChart';
import RecentActivities from '@/components/overview/RecentActivities';
import VisitorCounter from '@/components/VisitorCounter';

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

const colors = {
  bg: '#060b14',
  panel: '#0f172a',
  panelSoft: '#111c31',
  border: 'rgba(148, 163, 184, 0.24)',
  text: '#e5e7eb',
  muted: '#94a3b8',
};

export default function SharePageClient({ shareCode }: { shareCode: string }) {
  const [data, setData] = useState<SharedOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

    if (!shareCode || shareCode === 'example') {
      setLoading(false);
      setError('分享码无效');
      return;
    }
    void fetchData();
  }, [shareCode]);

  const shellStyle: React.CSSProperties = {
    background: colors.panel,
    border: `1px solid ${colors.border}`,
    borderRadius: '18px',
    boxShadow: '0 18px 36px rgba(2, 6, 23, 0.45)',
  };

  if (loading || error || !data) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          background: `radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.14) 0%, transparent 38%), ${colors.bg}`,
        }}
      >
        <div style={{ ...shellStyle, width: 'min(560px, 100%)', padding: '1.4rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.2rem', color: colors.text }}>学习概览分享</h1>
          <p style={{ margin: '0.8rem 0 0', color: colors.muted }}>
            {loading ? '加载中...' : error || '未找到数据'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `radial-gradient(circle at 12% 0%, rgba(56, 189, 248, 0.14) 0%, transparent 38%), ${colors.bg}`,
      }}
    >
      <div style={{ width: 'min(1180px, 100%)', margin: '0 auto', padding: '1.4rem 1rem 2rem' }}>
        <section style={{ ...shellStyle, padding: '1.15rem 1.2rem', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: colors.text }}>
            {data.userInfo.shareTitle || `${data.userInfo.displayName} · 学习概览`}
          </h1>
          <div
            style={{
              marginTop: '0.55rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.55rem 0.8rem',
              color: colors.muted,
              fontSize: '0.86rem',
            }}
          >
            <span>分享者: {data.userInfo.displayName}</span>
            <span>日期: {new Date().toLocaleDateString()}</span>
            <VisitorCounter userId={data.userInfo.userId} />
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.8rem',
            marginBottom: '1rem',
          }}
        >
          {[
            { label: '总完成任务', value: data.stats.totalTasks, color: '#38bdf8' },
            { label: '学习时长', value: `${Math.round(data.stats.totalStudyTime / 60)}h`, color: '#22c55e' },
            { label: '番茄次数', value: data.stats.totalPomodoros, color: '#a78bfa' },
            { label: '连续天数', value: data.stats.currentStreak, color: '#fb923c' },
          ].map((item) => (
            <div key={item.label} style={{ ...shellStyle, padding: '0.95rem 0.9rem', background: colors.panelSoft }}>
              <div style={{ color: colors.muted, fontSize: '0.8rem' }}>{item.label}</div>
              <div style={{ marginTop: '0.35rem', fontSize: '1.45rem', fontWeight: 800, color: item.color as string }}>
                {item.value}
              </div>
            </div>
          ))}
        </section>

        <section style={{ ...shellStyle, padding: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: '0 0 0.7rem', fontSize: '1rem', color: colors.text }}>任务热力图</h2>
          <TaskHeatmap data={data.heatmapData} theme="dark" />
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ ...shellStyle, padding: '1rem' }}>
            <h2 style={{ margin: '0 0 0.7rem', fontSize: '1rem', color: colors.text }}>学习趋势</h2>
            <StudyChart data={data.chartData} theme="dark" />
          </div>
          <div style={{ ...shellStyle, padding: '1rem' }}>
            <h2 style={{ margin: '0 0 0.7rem', fontSize: '1rem', color: colors.text }}>最近完成任务</h2>
            <RecentActivities activities={data.activities} theme="dark" />
          </div>
        </section>

        <footer
          style={{
            marginTop: '1.2rem',
            textAlign: 'center',
            color: colors.muted,
            fontSize: '0.82rem',
            lineHeight: 1.9,
          }}
        >
          <div>
            <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
              粤ICP备2025456526号-1
            </a>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Image src="/beian-icon.png" alt="备案图标" width={14} height={14} />
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit' }}
            >
              粤公网安备44030002007784号
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
