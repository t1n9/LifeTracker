'use client';

import { useEffect, useState } from 'react';
import Dashboard from '@/components/Dashboard';
import LoginForm from '@/components/auth/LoginForm';
import SharePageClient from '@/app/share/[shareCode]/SharePageClient';
import { useAuthStore } from '@/store/auth';

export default function Home() {
  const { isAuthenticated, isLoading, initializeAuth } = useAuthStore();
  const [shareCode, setShareCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shareMatch = window.location.pathname.match(/^\/share\/([^/]+)\/?$/);
      if (shareMatch) {
        setShareCode(shareMatch[1]);
        return;
      }
    }

    initializeAuth();
  }, [initializeAuth]);

  if (shareCode) {
    return <SharePageClient shareCode={shareCode} />;
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top, rgba(194, 214, 255, 0.45), transparent 38%), #f7f8fc',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: '3px solid rgba(21, 33, 61, 0.08)',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style jsx>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <LoginForm />;
}
