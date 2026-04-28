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
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    if (userId) void fetchAndRecord();
  }, [userId]);

  if (loading) {
    return (
      <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--fg-4)' }}>
        {showIcon && <Eye size={13} />}
        <div style={{ width: '24px', height: '11px', background: 'var(--bg-3)', borderRadius: '3px' }} />
      </div>
    );
  }

  if (visitorCount === null) return null;

  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--fg-3)' }}>
      {showIcon && <Eye size={13} />}
      <span>
        {showLabel && '访客 '}
        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
          {visitorCount.toLocaleString()}
        </span>
      </span>
    </div>
  );
};

export default VisitorCounter;
