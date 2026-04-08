'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getVersionString } from '@/lib/version';

interface NavbarProps {
  userName?: string;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export default function Navbar({ userName = 'User', theme, onThemeToggle }: NavbarProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
    window.location.reload();
  };

  const handleChangePassword = () => {
    router.push('/profile');
    setIsUserMenuOpen(false);
  };

  const navbarStyle: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: `var(--bg-navbar)`,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderBottom: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow)',
  };

  const navbarContentStyle: React.CSSProperties = {
    maxWidth: '1800px',
    margin: '0 auto',
    padding: '0 1.5rem',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const logoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
  };

  const logoTextStyle: React.CSSProperties = {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textDecoration: 'none',
  };

  const logoVersionStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    background: 'var(--accent-primary)',
    color: 'white',
    padding: '0.125rem 0.5rem',
    borderRadius: '4px',
  };

  const rightActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  };

  const themeToggleButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.2s ease',
    color: 'var(--text-primary)',
  };

  const userButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: 'var(--text-primary)',
    transition: 'all 0.2s ease',
    position: 'relative',
  };

  const userMenuStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '0.5rem',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    minWidth: '160px',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 1000,
    overflow: 'hidden',
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.75rem 1rem',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    fontSize: '0.875rem',
    transition: 'background-color 0.2s ease',
    borderBottom: '1px solid var(--border-color)',
  };

  return (
    <nav style={navbarStyle}>
      <div style={navbarContentStyle}>
        {/* Logo */}
        <a href="/" style={logoStyle}>
          <span style={logoTextStyle}>LifeTracker</span>
          <span style={logoVersionStyle}>{getVersionString()}</span>
        </a>

        {/* Right actions */}
        <div style={rightActionsStyle}>
          {/* Theme toggle */}
          <button
            onClick={onThemeToggle}
            title={`切换到${theme === 'dark' ? '浅色' : '深色'}主题`}
            style={themeToggleButtonStyle}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* User menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              style={userButtonStyle}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'transparent';
              }}
            >
              <span>{userName}</span>
              <span style={{ fontSize: '0.75rem' }}>▼</span>
            </button>

            {/* User dropdown menu */}
            {isUserMenuOpen && (
              <div style={userMenuStyle}>
                <button
                  onClick={handleChangePassword}
                  style={menuItemStyle}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  修改密码
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    ...menuItemStyle,
                    borderBottom: 'none',
                    color: 'var(--error-color)',
                  }}
                  onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
