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
      } catch {
        // ignore
      }
    };
    void loadUser();
  }, []);

  const handleThemeToggle = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      await userAPI.updateTheme(next);
    } catch {
      setTheme(theme);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (user?.theme) setTheme(user.theme === 'dark' ? 'dark' : 'light');
  }, [user?.theme]);

  const floatBtn: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1000,
    top: '1.25rem',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '1px solid var(--line-2)',
    background: 'var(--bg-1)',
    color: 'var(--fg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,.10)',
    transition: 'all .18s',
  };

  return (
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      overflowX: 'hidden',
      background: 'radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--accent) 8%, transparent 92%) 0%, transparent 38%), var(--bg-0)',
      padding: '1.25rem 1rem 2rem',
      WebkitOverflowScrolling: 'touch',
    }}>
      <button onClick={() => router.push('/')} title="Back" style={{ ...floatBtn, left: '1.25rem' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <ArrowLeft size={18} />
      </button>

      <button onClick={handleThemeToggle} title="Theme" style={{ ...floatBtn, right: '1.25rem' }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div style={{ width: 'min(1180px, 100%)', margin: '4rem auto 0' }}>
        {/* tab switcher */}
        <div style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          padding: '4px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '4px',
          marginBottom: '14px',
        }}>
          {(['study', 'goal'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                border: activeTab === tab ? '1px solid color-mix(in srgb, var(--accent) 36%, transparent)' : '1px solid transparent',
                background: activeTab === tab ? 'color-mix(in srgb, var(--accent) 12%, var(--bg-0) 88%)' : 'transparent',
                color: activeTab === tab ? 'var(--fg)' : 'var(--fg-3)',
                borderRadius: '11px',
                padding: '10px 1rem',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all .18s',
              }}
            >
              {tab === 'study' ? '学习概览' : '目标概览'}
            </button>
          ))}
        </div>

        {/* content card */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: '18px', padding: '18px', boxShadow: '0 12px 32px rgba(0,0,0,.06)' }}>
          {activeTab === 'study' && <StudyOverview userId={user?.id} theme={theme} />}
          {activeTab === 'goal' && <GoalOverview userId={user?.id} />}
        </div>
      </div>

      <footer style={{ marginTop: '1.2rem', textAlign: 'center', color: 'var(--fg-4)', fontSize: '12px', lineHeight: 1.9 }}>
        <div>
          <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
            粤ICP备2025456526号-1
          </a>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <Image src="/beian-icon.png" alt="备案图标" width={13} height={13} />
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
            粤公网安备44030002007784号
          </a>
        </div>
      </footer>
    </div>
  );
}
