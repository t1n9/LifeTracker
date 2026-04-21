'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, MoonStar, Settings2, SunMedium } from 'lucide-react';
import { getVersionString } from '@/lib/version';
import { useAuthStore } from '@/store/auth';
import styles from './Navbar.module.css';

interface NavbarProps {
  userName?: string;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export default function Navbar({ userName = 'User', theme, onThemeToggle }: NavbarProps) {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const handleOpenProfile = () => {
    setIsUserMenuOpen(false);
    router.push('/profile');
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
    router.push('/');
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <div className={styles.brandText}>
            <span className={styles.brandName}>LifeTracker</span>
            <span className={styles.brandVersion}>{getVersionString()}</span>
          </div>
        </Link>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onThemeToggle}
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {theme === 'dark' ? <SunMedium size={18} /> : <MoonStar size={18} />}
          </button>

          <div ref={menuRef} className={styles.menuWrap}>
            <button
              type="button"
              className={styles.userButton}
              onClick={() => setIsUserMenuOpen((current) => !current)}
              aria-expanded={isUserMenuOpen}
            >
              <span className={styles.userMeta}>
                <span className={styles.userLabel}>Workspace</span>
                <span className={styles.userName}>{userName}</span>
              </span>
              <ChevronDown size={16} className={isUserMenuOpen ? styles.chevronOpen : styles.chevron} />
            </button>

            {isUserMenuOpen && (
              <div className={styles.menu}>
                <button type="button" className={styles.menuItem} onClick={handleOpenProfile}>
                  <Settings2 size={16} />
                  <span>设置</span>
                </button>
                <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>退出登录</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
