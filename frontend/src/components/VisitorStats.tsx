'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Eye, TrendingUp, Users } from 'lucide-react';
import { api } from '@/lib/api';

interface VisitorStatsData {
  totalVisitors: number;
  totalVisits: number;
  recentVisitors: Array<{
    id?: string;
    deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
    browser?: string;
    os?: string;
    country?: string;
    city?: string;
    visitCount: number;
    firstVisitAt?: string | Date;
    lastVisitAt?: string | Date;
    visitorUser?: { name?: string; email?: string };
  }>;
  deviceStats: Array<{ deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET'; count: number }>;
  referrerStats: Array<{ referrer: string; count: number }>;
  dailyStats: Array<{ date: string; visits: number }>;
}

interface VisitorStatsProps {
  userId: string;
  isOwner?: boolean;
}

const emptyStats: VisitorStatsData = {
  totalVisitors: 0,
  totalVisits: 0,
  recentVisitors: [],
  deviceStats: [],
  referrerStats: [],
  dailyStats: [],
};

const VisitorStats: React.FC<VisitorStatsProps> = ({ userId, isOwner = false }) => {
  const [stats, setStats] = useState<VisitorStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isOwner) {
          const response = await api.get(`/visitor/stats/${userId}`);
          setStats(response.data?.data ?? emptyStats);
        } else {
          const urlParams = new URLSearchParams(window.location.search);
          await api.post('/visitor/record', {
            profileUserId: userId,
            referrer: document.referrer || undefined,
            utmSource: urlParams.get('utm_source') || undefined,
            utmMedium: urlParams.get('utm_medium') || undefined,
            utmCampaign: urlParams.get('utm_campaign') || undefined,
          }).catch(() => null);

          const response = await api.get(`/visitor/count/${userId}`);
          const data = response.data?.data ?? {};
          setStats({ ...emptyStats, totalVisitors: data.totalVisitors || 0, totalVisits: data.totalVisits || 0 });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载访客统计失败');
      } finally {
        setLoading(false);
      }
    };

    if (userId) void load();
  }, [isOwner, userId]);

  if (loading) {
    return <div style={{ padding: '12px', color: 'var(--fg-4)', fontSize: '12px' }}>加载访客统计中…</div>;
  }

  if (error) {
    return <div style={{ padding: '12px', color: 'var(--danger)', fontSize: '12px' }}>{error}</div>;
  }

  if (!stats) return null;

  const metaCards = [
    { icon: <Users size={13} />,    label: '访客数',  value: stats.totalVisitors },
    { icon: <TrendingUp size={13} />, label: '访问次数', value: stats.totalVisits },
    ...(isOwner
      ? [{ icon: <Calendar size={13} />, label: '近7天', value: stats.dailyStats.reduce((s, d) => s + (d.visits || 0), 0) }]
      : []),
  ];

  return (
    <div style={{ background: 'var(--bg-2)', borderRadius: '14px', padding: '14px 16px', border: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
        <Eye size={15} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>访客统计</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
        {metaCards.map(({ icon, label, value }) => (
          <div key={label} style={{ padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-1)', border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--fg-3)', fontSize: '11px', marginBottom: '5px' }}>
              {icon} {label}
            </div>
            <div style={{ color: 'var(--fg)', fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VisitorStats;
