'use client';

import React, { useEffect, useState } from 'react';
import { Coffee, Moon, SkipForward, Sun, X } from 'lucide-react';
import styles from './BreakMode.module.css';

interface BreakModeProps {
  timeLeft: number;
  selectedMinutes: number;
  onSkip: () => void;
  onExit: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  breakType?: 'short' | 'long';
  pomodoroCount?: number;
}

const breakTips = [
  '喝口水，别继续盯屏幕。',
  '站起来走两步，活动一下肩颈。',
  '看向远处，让眼睛放松一会儿。',
  '做两次深呼吸，节奏会回来。',
  '短暂离开座位，效果比硬撑更好。',
];

const BreakMode: React.FC<BreakModeProps> = ({
  timeLeft,
  selectedMinutes,
  onSkip,
  onExit,
  theme = 'light',
  onToggleTheme,
  breakType = 'short',
  pomodoroCount = 0,
}) => {
  const [tipIndex, setTipIndex] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((selectedMinutes * 60 - timeLeft) / (selectedMinutes * 60)) * 100;
  const pomodorosUntilLongBreak = 4 - (pomodoroCount % 4 || 4);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      } else if (e.key === ' ') {
        e.preventDefault();
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onExit, onSkip]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % breakTips.length);
    }, 15000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className={styles.overlay}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Break Window</div>
            <h2 className={styles.title}>{breakType === 'short' ? '短休息' : '长休息'}</h2>
            <p className={styles.subtitle}>离开任务几分钟，让下一段专注重新变得锋利。</p>
          </div>
          <div className={styles.headerActions}>
            {onToggleTheme && (
              <button onClick={onToggleTheme} className={styles.iconButton} title="切换主题">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            )}
            <button onClick={onExit} className={styles.iconButton} title="结束休息">
              <X size={18} />
            </button>
          </div>
        </header>

        <main className={styles.body}>
          <section className={styles.hero}>
            <div className={styles.badge}>
              <Coffee size={16} />
              <span>{breakType === 'short' ? '恢复节奏' : '完整放松'}</span>
            </div>
            <div className={styles.time}>{formatTime(timeLeft)}</div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <div className={styles.progressLabel}>休息进度 {Math.round(progress)}%</div>

            <div className={styles.tipCard}>
              <div className={styles.tipLabel}>此刻建议</div>
              <div className={styles.tipText}>{breakTips[tipIndex]}</div>
            </div>

            <button onClick={onSkip} className={styles.skipButton}>
              <SkipForward size={18} />
              <span>跳过休息，继续专注</span>
            </button>
          </section>

          <aside className={styles.sidebar}>
            <div className={styles.infoCard}>
              <div className={styles.infoLabel}>已完成番茄</div>
              <div className={styles.infoValue}>{pomodoroCount}</div>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoLabel}>下一个长休息</div>
              <div className={styles.infoText}>
                {breakType === 'long'
                  ? '长休息后会重新进入新一轮循环。'
                  : `再完成 ${pomodorosUntilLongBreak} 个番茄进入长休息。`}
              </div>
            </div>
            <div className={styles.infoCard}>
              <div className={styles.infoLabel}>快捷键</div>
              <div className={styles.shortcutItem}>
                <span>空格</span>
                <span>跳过休息</span>
              </div>
              <div className={styles.shortcutItem}>
                <span>Esc</span>
                <span>结束休息</span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default BreakMode;
