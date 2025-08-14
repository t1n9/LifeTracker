'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import Dashboard from '@/components/Dashboard';
import LoginForm from '@/components/auth/LoginForm';
import SharePageClient from '@/app/share/[shareCode]/SharePageClient';


export default function Home() {
  const { isAuthenticated, isLoading, setToken } = useAuthStore();
  const [isSharePage, setIsSharePage] = useState(false);
  const [shareCode, setShareCode] = useState<string>('');

  useEffect(() => {
    // 检查是否是分享页面
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const shareMatch = path.match(/^\/share\/([^\/]+)\/?$/);

      if (shareMatch) {
        setIsSharePage(true);
        setShareCode(shareMatch[1]);
        return;
      }
    }

    // 检查本地存储的token
    const token = localStorage.getItem('token');
    if (token && !isAuthenticated) {
      setToken(token);
    }
  }, [isAuthenticated, setToken]);

  // 如果是分享页面，显示分享内容
  if (isSharePage && shareCode) {
    return <SharePageClient shareCode={shareCode} />;
  }

  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #2196f3',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      {!isAuthenticated ? <LoginForm /> : <Dashboard />}
    </>
  );
}
