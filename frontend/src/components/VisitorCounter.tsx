'use client';

import React, { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';

interface VisitorCounterProps {
  userId: string;
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
}

const VisitorCounter: React.FC<VisitorCounterProps> = ({ 
  userId, 
  className = '',
  showIcon = true,
  showLabel = true,
}) => {
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAndRecord = async () => {
      try {
        // 同时记录访问和获取计数
        const [recordResponse, countResponse] = await Promise.all([
          // 记录访问
          fetch('/api/visitor/record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profileUserId: userId,
              referrer: document.referrer || undefined,
              utmSource: new URLSearchParams(window.location.search).get('utm_source') || undefined,
              utmMedium: new URLSearchParams(window.location.search).get('utm_medium') || undefined,
              utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
            }),
          }).catch(() => null), // 忽略记录失败

          // 获取访客计数
          fetch(`/api/visitor/count/${userId}`)
        ]);

        if (countResponse.ok) {
          const data = await countResponse.json();
          setVisitorCount(data.data.totalVisitors);
        }
      } catch (error) {
        console.warn('获取访客计数失败:', error);
        // 不显示错误，静默失败
      } finally {
        setLoading(false);
      }
    };

    fetchAndRecord();
  }, [userId]);

  if (loading) {
    return (
      <div className={`visitor-counter loading ${className}`} style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
      }}>
        {showIcon && <Eye size={14} />}
        <div style={{
          width: '20px',
          height: '12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '2px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
    );
  }

  if (visitorCount === null) {
    return null; // 静默失败，不显示任何内容
  }

  return (
    <div className={`visitor-counter ${className}`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      fontSize: '0.75rem',
      color: 'var(--text-muted)',
    }}>
      {showIcon && <Eye size={14} />}
      <span>
        {showLabel && '访客 '}
        <span style={{ 
          fontWeight: '500',
          color: 'var(--accent-primary)',
        }}>
          {visitorCount.toLocaleString()}
        </span>
      </span>
    </div>
  );
};

export default VisitorCounter;
