'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Users, TrendingUp, Monitor, Smartphone, Tablet, Globe, Calendar } from 'lucide-react';

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
    firstVisitAt?: any;
    lastVisitAt?: any;
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
  isOwner?: boolean; // 是否为页面所有者
}

const VisitorStats: React.FC<VisitorStatsProps> = ({ userId, isOwner = false }) => {
  const [stats, setStats] = useState<VisitorStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOwner) {
      fetchDetailedStats();
    } else {
      fetchBasicStats();
      recordVisit();
    }
  }, [userId, isOwner]);

  // 获取详细统计（仅所有者可见）
  const fetchDetailedStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/visitor/stats/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }

      const data = await response.json();
      setStats(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取基础统计（公开）
  const fetchBasicStats = async () => {
    try {
      const response = await fetch(`/api/visitor/count/${userId}`);
      
      if (!response.ok) {
        throw new Error('获取访客数据失败');
      }

      const data = await response.json();

      // 直接使用后端返回的数据，时间字段应该已经被正确处理
      const processedRecentVisitors = data.data.recentVisitors || [];

      setStats({
        totalVisitors: data.data.totalVisitors || 0,
        totalVisits: data.data.totalVisits || 0,
        recentVisitors: processedRecentVisitors,
        deviceStats: data.data.deviceStats || [],
        referrerStats: data.data.referrerStats || [],
        dailyStats: data.data.dailyStats || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取访客数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 记录访问
  const recordVisit = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      await fetch('/api/visitor/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileUserId: userId,
          referrer: document.referrer || undefined,
          utmSource: urlParams.get('utm_source') || undefined,
          utmMedium: urlParams.get('utm_medium') || undefined,
          utmCampaign: urlParams.get('utm_campaign') || undefined,
        }),
      });
    } catch (err) {
      console.warn('记录访问失败:', err);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'MOBILE':
        return <Smartphone size={16} />;
      case 'TABLET':
        return <Tablet size={16} />;
      default:
        return <Monitor size={16} />;
    }
  };

  const formatDate = (dateInput: any) => {
    try {
      // 检查输入是否有效
      if (!dateInput) {
        return '时间未知';
      }

      let date: Date;

      // 处理不同类型的时间输入
      if (dateInput instanceof Date) {
        date = dateInput;
      } else if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else {
        // 对于其他类型，尝试转换为字符串再解析
        date = new Date(String(dateInput));
      }

      if (isNaN(date.getTime())) {
        return '时间格式错误';
      }

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) {
        return '刚刚';
      } else if (diffMinutes < 60) {
        return `${diffMinutes}分钟前`;
      } else if (diffHours < 24) {
        return `${diffHours}小时前`;
      } else if (diffDays < 7) {
        return `${diffDays}天前`;
      } else {
        return date.toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric',
        });
      }
    } catch (error) {
      return '时间错误';
    }
  };

  if (loading) {
    return (
      <div className="visitor-stats-loading" style={{
        padding: '1rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
      }}>
        <div className="loading-spinner" style={{
          width: '20px',
          height: '20px',
          border: '2px solid var(--border-color)',
          borderTop: '2px solid var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 0.5rem',
        }} />
        加载访客统计...
      </div>
    );
  }

  if (error) {
    return (
      <div className="visitor-stats-error" style={{
        padding: '1rem',
        color: 'var(--error-color)',
        fontSize: '0.875rem',
        textAlign: 'center',
      }}>
        {error}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="visitor-stats" style={{
      background: 'var(--bg-secondary)',
      borderRadius: '12px',
      padding: '1.5rem',
      border: '1px solid var(--border-color)',
      marginTop: '1rem',
    }}>
      {/* 基础统计 */}
      <div className="stats-header" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}>
        <Eye size={20} style={{ color: 'var(--accent-primary)' }} />
        <h3 style={{
          margin: 0,
          fontSize: '1.125rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
        }}>
          访客统计
        </h3>
      </div>

      <div className="stats-overview" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '1rem',
        marginBottom: isOwner ? '1.5rem' : '0',
      }}>
        <div className="stat-item" style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            marginBottom: '0.25rem',
          }}>
            <Users size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              访客数
            </span>
          </div>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
          }}>
            {stats.totalVisitors}
          </div>
        </div>

        <div className="stat-item" style={{
          textAlign: 'center',
          padding: '0.75rem',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            marginBottom: '0.25rem',
          }}>
            <TrendingUp size={16} style={{ color: 'var(--success-color)' }} />
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
            }}>
              访问次数
            </span>
          </div>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
          }}>
            {stats.totalVisits}
          </div>
        </div>
      </div>

      {/* 详细统计（仅所有者可见） */}
      {isOwner && stats.deviceStats.length > 0 && (
        <div className="detailed-stats">
          {/* 设备类型统计 */}
          <div className="device-stats" style={{ marginBottom: '1rem' }}>
            <h4 style={{
              margin: '0 0 0.5rem 0',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: 'var(--text-secondary)',
            }}>
              设备类型分布
            </h4>
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}>
              {stats.deviceStats.map((device, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  background: 'var(--bg-primary)',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}>
                  {getDeviceIcon(device.deviceType)}
                  <span>{device.deviceType}</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: '500' }}>
                    {device.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 最近访客 */}
          {stats.recentVisitors.length > 0 && (
            <div className="recent-visitors">
              <h4 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--text-secondary)',
              }}>
                最近访客
              </h4>
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                fontSize: '0.75rem',
              }}>
                {stats.recentVisitors.slice(0, 5).map((visitor, index) => (
                  <div key={visitor.id || index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                    background: index % 2 === 0 ? 'var(--bg-primary)' : 'transparent',
                    borderRadius: '4px',
                    marginBottom: '0.25rem',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      {getDeviceIcon(visitor.deviceType)}
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {visitor.browser || 'Unknown'} · {visitor.os || 'Unknown'}
                      </span>
                      {visitor.visitorUser?.name && (
                        <span style={{ color: 'var(--accent-primary)', fontWeight: '500' }}>
                          {visitor.visitorUser.name}
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: 'var(--text-muted)',
                    }}>
                      <span>{visitor.visitCount || 0}次</span>
                      <span>{formatDate(visitor.lastVisitAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisitorStats;
