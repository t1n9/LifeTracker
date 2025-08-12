'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon, X, SkipForward, Coffee } from 'lucide-react';

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

const BreakMode: React.FC<BreakModeProps> = ({
  timeLeft,
  selectedMinutes,
  onSkip,
  onExit,
  theme = 'light',
  onToggleTheme,
  breakType = 'short',
  pomodoroCount = 0
}) => {
  const [breakTipIndex, setBreakTipIndex] = useState(0);

  // 休息建议库
  const breakTips = [
    "☕ 喝杯水，补充水分",
    "👀 看看远方，放松眼睛",
    "🧘 深呼吸，放松身心",
    "🚶 起身走动，活动筋骨",
    "🌱 看看绿植，缓解疲劳",
    "💪 做几个伸展运动",
    "🎵 听听轻音乐，放松心情",
    "📱 远离屏幕，让眼睛休息"
  ];

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算进度
  const progress = ((selectedMinutes * 60 - timeLeft) / (selectedMinutes * 60)) * 100;

  // 键盘快捷键
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
  }, [onSkip, onExit]);

  // 定期更新休息建议
  useEffect(() => {
    const interval = setInterval(() => {
      setBreakTipIndex(prev => (prev + 1) % breakTips.length);
    }, 15000); // 每15秒更换一次

    return () => clearInterval(interval);
  }, [breakTips.length]);

  return (
    <div className="break-mode">
      {/* 顶部栏 */}
      <div className="break-header">
        <div className="break-title">
          <Coffee size={24} />
          <span>{breakType === 'short' ? '短休息' : '长休息'}时间</span>
        </div>
        <div className="break-header-actions">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="break-theme-toggle"
              title="切换主题"
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          )}
          <button
            onClick={onExit}
            className="break-close-btn"
            title="结束休息"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 主要内容区 */}
      <div className="break-content">
        <div className="break-timer">
          {/* 休息倒计时 */}
          <div className="break-time">{formatTime(timeLeft)}</div>
          
          {/* 休息类型说明 */}
          <div className="break-type-info">
            {breakType === 'short' ? (
              <span>🌸 短暂休息，放松一下</span>
            ) : (
              <span>🌳 长时间休息，好好放松</span>
            )}
          </div>

          {/* 进度条 */}
          <div className="break-progress-container">
            <div className="break-progress-bar">
              <div 
                className="break-progress-fill" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="break-progress-text">{Math.round(progress)}%</div>
          </div>

          {/* 休息建议 */}
          <div className="break-suggestion">
            <div className="break-suggestion-title">💡 休息建议</div>
            <div className="break-suggestion-text">
              {breakTips[breakTipIndex]}
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="break-controls">
            <button
              onClick={onSkip}
              className="break-btn break-btn-skip"
            >
              <SkipForward size={20} />
              <span>跳过休息</span>
            </button>
          </div>
        </div>
      </div>

      {/* 底部统计 */}
      <div className="break-footer">
        <div className="break-stats">
          <span>已完成: {pomodoroCount}🍅</span>
          <span className="break-divider">|</span>
          <span>
            {breakType === 'short' 
              ? `还需 ${4 - (pomodoroCount % 4)} 个番茄钟进入长休息` 
              : '长休息后重新开始新的循环'
            }
          </span>
        </div>
      </div>

      {/* 快捷键提示 */}
      <div className="break-shortcuts">
        <span>ESC 结束休息</span>
        <span>空格 跳过休息</span>
      </div>
    </div>
  );
};

export default BreakMode;
