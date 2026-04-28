'use client';

import React from 'react';
import { CheckCircle, Clock, BookOpen, Target } from 'lucide-react';

interface Activity {
  id: string;
  type: 'task' | 'study' | 'pomodoro' | 'reflection';
  title: string;
  description?: string;
  timestamp: string;
  duration?: number;
}

interface RecentActivitiesProps {
  activities: Activity[];
  theme?: 'dark' | 'light';
}

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  task:       { label: '完成任务', icon: <CheckCircle size={14} />, color: 'var(--success-color)' },
  study:      { label: '学习记录', icon: <BookOpen size={14} />,    color: 'var(--accent)' },
  pomodoro:   { label: '番茄钟',   icon: <Clock size={14} />,       color: 'var(--warn)' },
  reflection: { label: '每日复盘', icon: <Target size={14} />,      color: 'var(--fg-3)' },
};

function formatTime(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}分钟`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}

const RecentActivities: React.FC<RecentActivitiesProps> = ({ activities }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: activities.length > 0 ? 'auto' : 'visible' }}>
      {activities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--fg-4)' }}>
          <Clock size={36} style={{ opacity: 0.4, marginBottom: '10px', display: 'block', margin: '0 auto 10px' }} />
          <p style={{ margin: 0, fontSize: '13px' }}>暂无最近活动</p>
        </div>
      ) : (
        activities.map((activity) => {
          const meta = TYPE_META[activity.type] ?? TYPE_META.task;
          return (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '10px 12px',
                background: 'var(--bg-2)',
                borderRadius: '10px',
                border: '1px solid var(--line)',
              }}
            >
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                background: 'var(--bg-0)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: meta.color,
              }}>
                {meta.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {meta.label}
                  </span>
                  {activity.duration && (
                    <span style={{ fontSize: '10px', color: 'var(--fg-3)', background: 'var(--bg-3)', padding: '1px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                      {formatDuration(activity.duration)}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                  {activity.title}
                </div>
                {activity.description && (
                  <p style={{ margin: '0 0 3px', fontSize: '11.5px', color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activity.description}
                  </p>
                )}
                <time style={{ fontSize: '11px', color: 'var(--fg-4)' }}>{formatTime(activity.timestamp)}</time>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default RecentActivities;
