'use client';

import React from 'react';
import { CheckCircle, Clock, BookOpen, Target } from 'lucide-react';

interface Activity {
  id: string;
  type: 'task' | 'study' | 'pomodoro' | 'reflection';
  title: string;
  description?: string;
  timestamp: string;
  duration?: number; // 分钟
}

interface RecentActivitiesProps {
  activities: Activity[];
}

const RecentActivities: React.FC<RecentActivitiesProps> = ({ activities }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'task':
        return <CheckCircle size={16} style={{ color: '#10b981' }} />;
      case 'study':
        return <BookOpen size={16} style={{ color: '#3b82f6' }} />;
      case 'pomodoro':
        return <Clock size={16} style={{ color: '#f59e0b' }} />;
      case 'reflection':
        return <Target size={16} style={{ color: '#8b5cf6' }} />;
      default:
        return <CheckCircle size={16} style={{ color: '#6b7280' }} />;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'task':
        return '完成任务';
      case 'study':
        return '学习记录';
      case 'pomodoro':
        return '番茄钟';
      case 'reflection':
        return '每日复盘';
      default:
        return '活动';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      padding: '20px',
    }}>
      <h3 style={{
        margin: '0 0 20px 0',
        fontSize: '1.25rem',
        fontWeight: '600',
        color: 'var(--text-primary)',
      }}>
        最近活动
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activities.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-secondary)',
          }}>
            <Clock size={40} style={{ opacity: 0.5, marginBottom: '12px' }} />
            <p>暂无最近活动</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '50%',
                flexShrink: 0,
              }}>
                {getIcon(activity.type)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {getTypeText(activity.type)}
                  </span>
                  {activity.duration && (
                    <span style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}>
                      {formatDuration(activity.duration)}
                    </span>
                  )}
                </div>

                <h4 style={{
                  margin: '0 0 4px 0',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {activity.title}
                </h4>

                {activity.description && (
                  <p style={{
                    margin: '0 0 8px 0',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {activity.description}
                  </p>
                )}

                <time style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}>
                  {formatTime(activity.timestamp)}
                </time>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentActivities;
