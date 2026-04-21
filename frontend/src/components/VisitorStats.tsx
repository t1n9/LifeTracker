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
    visitorUser?: {
      name?: string;
      email?: string;
    };
  }>;
  deviceStats: Array<{
    deviceType: 'DESKTOP' | 'MOBILE' | 'TABLET';
    count: number;
  }>;
  referrerStats: Array<{
    referrer: string;
    count: number;
  }>;
  dailyStats: Array<{
    date: string;
    visits: number;
  }>;
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
          setStats({
            ...emptyStats,
            totalVisitors: data.totalVisitors || 0,
            totalVisits: data.totalVisits || 0,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载访客统计失败');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      void load();
    }
  }, [isOwner, userId]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        加载访客统计中...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--error-color)' }}>
        {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div
      style={{
        background: 'color-mix(in srgb, var(--bg-tertiary) 84%, white 16%)',
        borderRadius: '16px',
        padding: '1.2rem',
        border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Eye size={18} style={{ color: 'var(--accent-primary)' }} />
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>访客统计</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
        <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <Users size={14} /> 访客数
          </div>
          <div style={{ marginTop: '0.35rem', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
            {stats.totalVisitors}
          </div>
        </div>
        <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <TrendingUp size={14} /> 访问次数
          </div>
          <div style={{ marginTop: '0.35rem', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
            {stats.totalVisits}
          </div>
        </div>
        {isOwner && (
          <div style={{ padding: '0.7rem', borderRadius: '10px', background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              <Calendar size={14} /> 近7天
            </div>
            <div style={{ marginTop: '0.35rem', color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: 700 }}>
              {stats.dailyStats.reduce((sum, d) => sum + (d.visits || 0), 0)}
            </div>
          </div>
        )}
      </div>

      
    </div>
  );
};

export default VisitorStats;
