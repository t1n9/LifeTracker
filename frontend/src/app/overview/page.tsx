'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import StudyOverview from '@/components/overview/StudyOverview';
import GoalOverview from '@/components/GoalOverview';
import { userAPI } from '@/lib/api';
import '@/styles/theme.css';

export default function OverviewPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'goal' | 'study'>('study');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await userAPI.getProfile();
        setUser(response.data);
      } catch (error) {
        console.error('load profile failed:', error);
      }
    };
    void loadUser();
  }, []);

  const handleThemeToggle = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    try {
      await userAPI.updateTheme(newTheme);
    } catch (error) {
      console.error('save theme failed:', error);
      setTheme(theme);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (user?.theme) {
      setTheme(user.theme === 'dark' ? 'dark' : 'light');
    }
  }, [user?.theme]);

  const shellCardStyle: React.CSSProperties = {
    background:
      theme === 'dark'
        ? 'color-mix(in srgb, var(--bg-secondary) 94%, black 6%)'
        : 'color-mix(in srgb, var(--bg-secondary) 88%, white 12%)',
    border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    borderRadius: '18px',
    boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
  };

  return (
    <div
      style={{
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        background:
          'radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent-primary) 10%, transparent 90%) 0%, transparent 38%), var(--bg-primary)',
        padding: '1.25rem 1rem 2rem',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <button
        onClick={() => router.push('/')}
        title="Back"
        style={{
          position: 'fixed',
          top: '1.25rem',
          left: '1.25rem',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
          background:
            theme === 'dark'
              ? 'color-mix(in srgb, var(--bg-secondary) 94%, black 6%)'
              : 'color-mix(in srgb, var(--bg-secondary) 88%, white 12%)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 14px 24px rgba(15, 23, 42, 0.16)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(15, 23, 42, 0.12)';
        }}
      >
        <ArrowLeft size={20} />
      </button>

      <button
        onClick={handleThemeToggle}
        title="Theme"
        style={{
          position: 'fixed',
          top: '1.25rem',
          right: '1.25rem',
          zIndex: 1000,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
          background:
            theme === 'dark'
              ? 'color-mix(in srgb, var(--bg-secondary) 94%, black 6%)'
              : 'color-mix(in srgb, var(--bg-secondary) 88%, white 12%)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 14px 24px rgba(15, 23, 42, 0.16)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 10px 20px rgba(15, 23, 42, 0.12)';
        }}
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div style={{ width: 'min(1180px, 100%)', margin: '4.4rem auto 0' }}>
        <div
          style={{
            ...shellCardStyle,
            padding: '0.4rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '0.45rem',
            marginBottom: '1rem',
          }}
        >
          <button
            onClick={() => setActiveTab('study')}
            style={{
              border:
                activeTab === 'study'
                  ? '1px solid color-mix(in srgb, var(--accent-primary) 48%, transparent 52%)'
                  : '1px solid transparent',
              background:
                activeTab === 'study'
                  ? 'color-mix(in srgb, var(--accent-primary) 16%, var(--bg-primary) 84%)'
                  : 'transparent',
              color: activeTab === 'study' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderRadius: '12px',
              padding: '0.72rem 1rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            学习概览
          </button>
          <button
            onClick={() => setActiveTab('goal')}
            style={{
              border:
                activeTab === 'goal'
                  ? '1px solid color-mix(in srgb, var(--accent-primary) 48%, transparent 52%)'
                  : '1px solid transparent',
              background:
                activeTab === 'goal'
                  ? 'color-mix(in srgb, var(--accent-primary) 16%, var(--bg-primary) 84%)'
                  : 'transparent',
              color: activeTab === 'goal' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderRadius: '12px',
              padding: '0.72rem 1rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            目标概览
          </button>
        </div>

        <div style={{ ...shellCardStyle, padding: '1rem' }}>
          {activeTab === 'study' && <StudyOverview userId={user?.id} theme={theme} />}
          {activeTab === 'goal' && <GoalOverview userId={user?.id} />}
        </div>
      </div>

      <footer
        style={{
          marginTop: '1.2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.82rem',
          lineHeight: 1.9,
        }}
      >
        <div>
          <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
            粤ICP备2025456526号-1
          </a>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Image src="/beian-icon.png" alt="备案图标" width={14} height={14} />
          <a
            href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'inherit' }}
          >
            粤公网安备44030002007784号
          </a>
        </div>
      </footer>
    </div>
  );
}
