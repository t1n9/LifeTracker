'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import Dashboard from '@/components/Dashboard';
import LoginForm from '@/components/auth/LoginForm';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    // 检查本地存储的token
    const token = localStorage.getItem('token');
    if (token && !isAuthenticated) {
      // 这里可以验证token的有效性
      // 暂时直接跳转到仪表板
    }
  }, [isAuthenticated]);

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
