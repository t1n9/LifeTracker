'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, Pause, Play, RotateCcw, X, Square } from 'lucide-react';

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
  tasks?: Array<{id: string, title: string, isCompleted: boolean}>;
  studyTime?: number;
  pomodoroCount?: number;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  isCountUpMode?: boolean; // 是否为正计时模式
  countUpTime?: number; // 正计时已用时间
}

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
  countUpTime = 0
}) => {
  const [focusQuoteIndex, setFocusQuoteIndex] = useState(0);

  // 激励文字库
  const focusQuotes = [
    "💪 保持专注，你正在变得更强！",
    "🎯 每一分钟的专注都在为梦想加分",
    "🔥 专注是通往成功的唯一道路",
    "⭐ 你的努力，时间都看得见",
    "🚀 专注当下，未来可期",
    "💎 专注让平凡变得不凡",
    "🌟 每个专注的瞬间都在塑造更好的你"
  ];

  // 获取当前绑定的任务
  const boundTask = currentBoundTask ? tasks.find(task => task.id === currentBoundTask) : null;

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算进度和显示时间
  const displayTime = isCountUpMode ? countUpTime : timeLeft;

  // 计算进度 - 与主界面保持一致的3小时循环逻辑
  let progress = 0;
  let progressInfo = '';

  if (isCountUpMode) {
    const totalMinutes = Math.floor(countUpTime / 60);
    const maxMinutes = 180; // 最长3小时
    const currentCycle = Math.floor(totalMinutes / 60);
    const minutesInCycle = totalMinutes % 60;

    const clampedMinutes = Math.min(totalMinutes, maxMinutes);
    const clampedCycle = Math.floor(clampedMinutes / 60);
    const clampedMinutesInCycle = clampedMinutes % 60;

    const cycleProgress = (clampedMinutesInCycle / 60) * 100;

    switch (clampedCycle) {
      case 0: // 第一圈：填充
        progress = cycleProgress;
        progressInfo = `第一圈 ${clampedMinutesInCycle}/60分钟`;
        break;
      case 1: // 第二圈：消除
        progress = 100 - cycleProgress;
        progressInfo = `第二圈 ${clampedMinutesInCycle}/60分钟`;
        break;
      case 2: // 第三圈：填充
        progress = cycleProgress;
        progressInfo = `第三圈 ${clampedMinutesInCycle}/60分钟`;
        break;
      default:
        progress = 100;
        progressInfo = '已达3小时';
        break;
    }
  } else {
    progress = ((selectedMinutes * 60 - timeLeft) / (selectedMinutes * 60)) * 100;
    progressInfo = `${Math.round(progress)}%`;
  }

  // 格式化学习时长
  const formatStudyTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // 键盘快捷键
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit();
      } else if (e.key === ' ') {
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
  }, [isRunning, onStart, onPause, onExit]);

  // 定期更新激励文字
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        setFocusQuoteIndex(prev => (prev + 1) % focusQuotes.length);
      }, 30000); // 每30秒更换一次

      return () => clearInterval(interval);
    }
  }, [isRunning, focusQuotes.length]);

  // 时间提醒
  useEffect(() => {
    if (isRunning && !isPaused) {
      // 在剩余5分钟和1分钟时发送提醒
      if (timeLeft === 300) { // 5分钟
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('⏰ 番茄时钟提醒', {
            body: '还剩5分钟，继续保持专注！',
            icon: '/favicon.ico',
            tag: 'pomodoro-reminder'
          });
        }
      } else if (timeLeft === 60) { // 1分钟
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('⏰ 番茄时钟提醒', {
            body: '最后1分钟，马上就要完成了！',
            icon: '/favicon.ico',
            tag: 'pomodoro-reminder'
          });
        }
      }
    }
  }, [timeLeft, isRunning, isPaused]);

  return (
    <div className="focus-mode">
      {/* 顶部栏 */}
      <div className="focus-header">
        <div className="focus-title">
          <span className="focus-icon">🍅</span>
          <span>专注模式</span>
        </div>
        <div className="focus-header-controls">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="focus-theme-toggle"
              title="切换主题"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          )}
          <button
            onClick={onExit}
            className="focus-exit-btn"
            title="退出专注模式"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="focus-content">
        {/* 时间显示 */}
        <div className="focus-timer">
          <div className="focus-time">{formatTime(displayTime)}</div>

          {/* 模式指示 */}
          {isCountUpMode && (
            <div className="focus-mode-indicator">
              ⏱️ 正计时模式
            </div>
          )}

          {/* 当前任务 */}
          {boundTask && (
            <div className="focus-task">
              【{boundTask.title}】专注中！
            </div>
          )}
          
          {/* 进度条 */}
          <div className="focus-progress-container">
            <div className="focus-progress-bar">
              <div 
                className="focus-progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="focus-progress-text">
              {progressInfo}
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="focus-controls">
            {!isRunning || isPaused ? (
              <button
                onClick={isPaused ? onPause : onStart}
                className="focus-btn focus-btn-start"
                disabled={timeLeft === 0}
              >
                <Play size={24} />
                <span>{isPaused ? '继续' : '开始'}</span>
              </button>
            ) : (
              <button
                onClick={onPause}
                className="focus-btn focus-btn-pause"
              >
                <Pause size={24} />
                <span>暂停</span>
              </button>
            )}
            <button
              onClick={onReset}
              className="focus-btn focus-btn-reset"
            >
              {isCountUpMode ? (
                <>
                  <Square size={20} />
                  <span>结束</span>
                </>
              ) : (
                <>
                  <RotateCcw size={20} />
                  <span>重置</span>
                </>
              )}
            </button>
          </div>

          {/* 激励文字 */}
          <div className="focus-quote">
            {focusQuotes[focusQuoteIndex]}
          </div>
        </div>
      </div>

      {/* 底部统计 */}
      <div className="focus-footer">
        <div className="focus-stats">
          <span>今日已专注: {formatStudyTime(studyTime)}</span>
          <span className="focus-divider">|</span>
          <span>完成: {pomodoroCount}🍅</span>
        </div>
      </div>

      {/* 快捷键提示 */}
      <div className="focus-shortcuts">
        <span>ESC 或点击 ✕ 退出专注模式</span>
        <span>空格 暂停/继续</span>
      </div>
    </div>
  );
};

export default FocusMode;
