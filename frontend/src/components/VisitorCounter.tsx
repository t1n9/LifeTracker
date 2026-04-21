'use client';

import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { api } from '@/lib/api';

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
        await api.post('/visitor/record', {
          profileUserId: userId,
          referrer: document.referrer || undefined,
          utmSource: new URLSearchParams(window.location.search).get('utm_source') || undefined,
          utmMedium: new URLSearchParams(window.location.search).get('utm_medium') || undefined,
          utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
        }).catch(() => null);

        const countResponse = await api.get(`/visitor/count/${userId}`);
        setVisitorCount(countResponse.data?.data?.totalVisitors ?? 0);
      } catch (error) {
        console.warn('load visitor counter failed:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      void fetchAndRecord();
    }
  }, [userId]);

  if (loading) {
    return (
      <div
        className={`visitor-counter loading ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        {showIcon && <Eye size={14} />}
        <div
          style={{
            width: '20px',
            height: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '2px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  if (visitorCount === null) return null;

  return (
    <div
      className={`visitor-counter ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
      }}
    >
      {showIcon && <Eye size={14} />}
      <span>
        {showLabel && '访客 '}
        <span style={{ fontWeight: 500, color: 'var(--accent-primary)' }}>
          {visitorCount.toLocaleString()}
        </span>
      </span>
    </div>
  );
};

export default VisitorCounter;
