'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Award, Clock, Share2, Copy, Check } from 'lucide-react';
import TaskHeatmap from './TaskHeatmap';
import RecentActivities from './RecentActivities';
import StudyChart from './StudyChart';
import VisitorStats from '../VisitorStats';
import { overviewAPI, shareLinkAPI } from '@/lib/api';

interface StudyOverviewProps {
  userId?: string;
  theme?: 'dark' | 'light';
}

const StudyOverview: React.FC<StudyOverviewProps> = ({ userId, theme = 'light' }) => {
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  useEffect(() => { void loadOverviewData(); }, []);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await overviewAPI.getFullOverview();
      const data = response.data;
      setHeatmapData(data.heatmapData || []);
      setActivities(data.activities || []);
      setChartData(data.chartData || []);
      setStats(data.stats || {});
    } catch {
      setError('加载数据失败，请稍后重试');
      setHeatmapData([]);
      setActivities([]);
      setChartData([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    setShowShareModal(true);
    try {
      setShareLoading(true);
      const response = await shareLinkAPI.getUserShareLink();
      if (response.data.shareCode) {
        setShareLink(response.data.shareUrl);
      } else {
        const createResponse = await shareLinkAPI.createShareLink({});
        setShareLink(createResponse.data.shareUrl);
      }
    } catch {
      setShareLink(null);
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalTasks = stats.totalTasks ?? heatmapData.reduce((s: number, d: any) => s + d.count, 0);
  const activeDays = stats.activeDays ?? heatmapData.filter((d: any) => d.count > 0).length;
  const avgTasksPerDay = stats.avgTasksPerDay ?? (activeDays > 0 ? (totalTasks / activeDays).toFixed(1) : '0');
  const currentStreak = stats.currentStreak ?? (() => {
    let streak = 0;
    for (let i = heatmapData.length - 1; i >= 0; i--) {
      if (heatmapData[i].count > 0) streak++;
      else break;
    }
    return streak;
  })();

  const statCards = [
    { icon: <Calendar size={20} style={{ color: 'var(--accent)' }} />,        value: totalTasks,       label: '总完成任务' },
    { icon: <TrendingUp size={20} style={{ color: 'var(--success-color)' }} />, value: avgTasksPerDay,   label: '日均完成任务' },
    { icon: <Award size={20} style={{ color: 'var(--warn)' }} />,              value: currentStreak,    label: '当前连续天数' },
    { icon: <Clock size={20} style={{ color: 'var(--accent)' }} />,            value: activeDays,       label: '活跃天数' },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', color: 'var(--fg-3)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid var(--line)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
          <p style={{ margin: 0, fontSize: '13px' }}>加载学习数据中…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* header */}
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--fg)', margin: '0 0 6px', letterSpacing: '-0.03em' }}>学习概况</h1>
        <p style={{ fontSize: '14px', color: 'var(--fg-3)', margin: '0 0 14px' }}>追踪你的学习进度和成就</p>
        <button
          onClick={handleShare}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '8px 16px',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px var(--accent-glow)',
            transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Share2 size={14} />
          分享我的学习概况
        </button>
        {error && (
          <div style={{ marginTop: '10px', padding: '8px 14px', background: 'color-mix(in srgb, var(--warn) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warn) 24%, transparent)', borderRadius: '8px', color: 'var(--warn)', fontSize: '12.5px' }}>
            {error}
          </div>
        )}
      </div>

      {/* stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(({ icon, value, label }) => (
          <div key={label} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: '14px', padding: '18px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>{icon}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--fg)', marginBottom: '4px', fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em' }}>{value}</div>
            <div style={{ fontSize: '12px', color: 'var(--fg-3)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* heatmap */}
      <div style={{ marginBottom: '24px' }}>
        <TaskHeatmap data={heatmapData} theme={theme} />
      </div>

      {/* visitor stats */}
      {userId && (
        <div style={{ marginBottom: '24px' }}>
          <VisitorStats userId={userId} isOwner={true} />
        </div>
      )}

      {/* chart + activities */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div style={{ minWidth: 0, background: 'var(--bg-1)', borderRadius: '14px', border: '1px solid var(--line)', padding: '18px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>学习趋势</h3>
          <StudyChart data={chartData} theme={theme} />
        </div>
        <div style={{ minWidth: 0, background: 'var(--bg-1)', borderRadius: '14px', border: '1px solid var(--line)', padding: '18px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>最近活动</h3>
          <RecentActivities activities={activities} theme={theme} />
        </div>
      </div>

      {/* share modal */}
      {showShareModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.44)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            style={{ background: 'var(--bg-1)', borderRadius: '20px', padding: '24px', maxWidth: '480px', width: '90%', border: '1px solid var(--line)', boxShadow: '0 28px 56px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--fg)' }}>分享学习概况</h3>
              <button onClick={() => setShowShareModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--fg-3)', padding: '2px 6px', borderRadius: '6px' }}>×</button>
            </div>
            <p style={{ margin: '0 0 14px', color: 'var(--fg-3)', fontSize: '13px' }}>复制下面的链接，分享给朋友查看你的学习概况</p>
            {shareLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', color: 'var(--fg-3)', fontSize: '13px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid var(--line-2)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                生成分享链接中…
              </div>
            ) : shareLink ? (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--line-2)', borderRadius: '8px', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: '12.5px', outline: 'none' }}
                />
                <button
                  onClick={handleCopyShareLink}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', background: copied ? 'var(--success-color)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', transition: 'background .2s' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--fg-3)', background: 'var(--bg-2)', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>
                生成分享链接失败，请稍后重试
              </div>
            )}
            <div style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: '8px', fontSize: '11.5px', color: 'var(--fg-3)' }}>
              分享链接是公开的，任何人都可以通过此链接查看你的学习概况。
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyOverview;
