'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Moon, Pause, Play, RotateCcw, Square, Sun, X } from 'lucide-react';
import styles from './FocusMode.module.css';

interface FocusModeProps {
  timeLeft: number;
  selectedMinutes: number;
  isRunning: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onExit: () => void;
  currentBoundTask?: string;
  tasks?: Array<{ id: string; title: string; isCompleted: boolean }>;
  studyTime?: number;
  pomodoroCount?: number;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  isCountUpMode?: boolean;
  countUpTime?: number;
}

const focusQuotes = [
  '保持专注，节奏会自己出现。',
  '先完成这一段，再考虑下一段。',
  '把注意力留给最重要的事。',
  '稳定输出，比情绪更可靠。',
  '只专注这一件事，已经很强。',
];

const FocusMode: React.FC<FocusModeProps> = ({
  timeLeft,
  selectedMinutes,
  isRunning,
  isPaused,
  onStart,
  onPause,
  onReset,
  onExit,
  currentBoundTask,
  tasks = [],
  studyTime = 0,
  pomodoroCount = 0,
  theme = 'light',
  onToggleTheme,
  isCountUpMode = false,
  countUpTime = 0,
}) => {
  const [focusQuoteIndex, setFocusQuoteIndex] = useState(0);

  const boundTask = useMemo(
    () => (currentBoundTask ? tasks.find((task) => task.id === currentBoundTask) : null),
    [currentBoundTask, tasks]
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const displayTime = isCountUpMode ? countUpTime : timeLeft;

  const { progress, progressLabel } = useMemo(() => {
    if (isCountUpMode) {
      const totalMinutes = Math.floor(countUpTime / 60);
      const maxMinutes = 180;
      const clampedMinutes = Math.min(totalMinutes, maxMinutes);
      const cycle = Math.floor(clampedMinutes / 60);
      const minutesInCycle = clampedMinutes % 60;
      const cycleProgress = (minutesInCycle / 60) * 100;

      if (cycle === 0) return { progress: cycleProgress, progressLabel: `第 1 圈 · ${minutesInCycle}/60 分钟` };
      if (cycle === 1) return { progress: 100 - cycleProgress, progressLabel: `第 2 圈 · ${minutesInCycle}/60 分钟` };
      if (cycle === 2) return { progress: cycleProgress, progressLabel: `第 3 圈 · ${minutesInCycle}/60 分钟` };
      return { progress: 100, progressLabel: '已达 3 小时上限' };
    }

    const total = selectedMinutes * 60;
    const value = total > 0 ? ((total - timeLeft) / total) * 100 : 0;
    return { progress: value, progressLabel: `已完成 ${Math.round(value)}%` };
  }, [countUpTime, isCountUpMode, selectedMinutes, timeLeft]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        if (isRunning) {
          onPause();
        } else {
          onStart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isRunning, onExit, onPause, onStart]);

  useEffect(() => {
    if (!isRunning || isPaused) {
      return;
    }

    const interval = window.setInterval(() => {
      setFocusQuoteIndex((prev) => (prev + 1) % focusQuotes.length);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [isPaused, isRunning]);

  return (
    <div className={styles.overlay}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Focus Session</div>
            <h2 className={styles.title}>专注模式</h2>
            <p className={styles.subtitle}>隐藏杂音，把这一段时间完整留给当前任务。</p>
          </div>
          <div className={styles.headerActions}>
            {onToggleTheme && (
              <button onClick={onToggleTheme} className={styles.iconButton} title="切换主题">
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
            )}
            <button onClick={onExit} className={styles.iconButton} title="退出专注模式">
              <X size={18} />
            </button>
          </div>
        </header>

        <main className={styles.body}>
          <section className={styles.hero}>
            <div className={styles.timeWrap}>
              <div className={styles.modeBadge}>{isCountUpMode ? '正计时模式' : `${selectedMinutes} 分钟专注`}</div>
              <div className={styles.time}>{formatTime(displayTime)}</div>
              <div className={styles.progressMeta}>{progressLabel}</div>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className={styles.taskPanel}>
              <div className={styles.panelLabel}>当前任务</div>
              <div className={styles.taskTitle}>
                {boundTask ? boundTask.title : '还没有绑定任务，先保持这一段专注。'}
              </div>
              <div className={styles.quote}>{focusQuotes[focusQuoteIndex]}</div>
            </div>

            <div className={styles.controls}>
              {!isRunning || isPaused ? (
                <button
                  onClick={isPaused ? onPause : onStart}
                  className={`${styles.primaryButton} ${styles.controlButton}`}
                  disabled={!isCountUpMode && timeLeft === 0}
                >
                  <Play size={18} />
                  <span>{isPaused ? '继续' : '开始'}</span>
                </button>
              ) : (
                <button onClick={onPause} className={`${styles.primaryButton} ${styles.controlButton}`}>
                  <Pause size={18} />
                  <span>暂停</span>
                </button>
              )}

              <button onClick={onReset} className={`${styles.secondaryButton} ${styles.controlButton}`}>
                {isCountUpMode ? <Square size={18} /> : <RotateCcw size={18} />}
                <span>{isCountUpMode ? '结束' : '重置'}</span>
              </button>
            </div>
          </section>

          <aside className={styles.sidebar}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>今日学习</div>
              <div className={styles.statValue}>{formatStudyTime(studyTime)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>累计番茄</div>
              <div className={styles.statValue}>{pomodoroCount}</div>
            </div>
            <div className={styles.shortcutCard}>
              <div className={styles.shortcutTitle}>快捷键</div>
              <div className={styles.shortcutItem}>
                <span>空格</span>
                <span>开始 / 暂停</span>
              </div>
              <div className={styles.shortcutItem}>
                <span>Esc</span>
                <span>退出模式</span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
};

export default FocusMode;
