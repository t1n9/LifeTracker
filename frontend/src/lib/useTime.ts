/**
 * React Hook for time management
 * 提供统一的时间处理功能
 */

import { useState, useEffect, useCallback } from 'react';
import {
  TimeInput,
  TimeFormatOptions,
  formatLocalTime,
  formatDateString,
  formatTimeString,
  formatDuration,
  getRelativeTime,
  smartTimeDisplay,
  toUTCForSubmit,
  getTodayDateString,
  isToday,
  isYesterday,
  processApiTimeFields,
} from './time';

/**
 * 用户时区配置
 */
interface UserTimeConfig {
  timezone: string;
  locale: string;
}

/**
 * 时间管理Hook
 */
export function useTime(userConfig?: Partial<UserTimeConfig>) {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const config: UserTimeConfig = {
    timezone: 'Asia/Shanghai',
    locale: 'zh-CN',
    ...userConfig,
  };
  
  // 实时更新当前时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // 格式化本地时间
  const formatLocal = useCallback((
    time: TimeInput,
    options?: TimeFormatOptions
  ) => {
    return formatLocalTime(time, {
      timezone: config.timezone,
      locale: config.locale,
      ...options,
    });
  }, [config.timezone, config.locale]);
  
  // 格式化日期字符串
  const formatDate = useCallback((time: TimeInput) => {
    return formatDateString(time, config.timezone);
  }, [config.timezone]);
  
  // 格式化时间字符串
  const formatTime = useCallback((
    time: TimeInput,
    includeSeconds: boolean = false
  ) => {
    return formatTimeString(time, includeSeconds, config.timezone);
  }, [config.timezone]);
  
  // 获取相对时间
  const getRelative = useCallback((time: TimeInput) => {
    return getRelativeTime(time, config.locale);
  }, [config.locale]);
  
  // 智能时间显示
  const smartDisplay = useCallback((time: TimeInput) => {
    return smartTimeDisplay(time, config.timezone, config.locale);
  }, [config.timezone, config.locale]);
  
  // 检查是否为今天
  const checkIsToday = useCallback((time: TimeInput) => {
    return isToday(time, config.timezone);
  }, [config.timezone]);
  
  // 检查是否为昨天
  const checkIsYesterday = useCallback((time: TimeInput) => {
    return isYesterday(time, config.timezone);
  }, [config.timezone]);
  
  // 获取今天的日期字符串
  const getTodayDate = useCallback(() => {
    return getTodayDateString(config.timezone);
  }, [config.timezone]);
  
  // 当前时间的各种格式
  const now = {
    date: currentTime,
    iso: currentTime.toISOString(),
    local: formatLocal(currentTime),
    dateString: formatDate(currentTime),
    timeString: formatTime(currentTime),
    timestamp: currentTime.getTime(),
  };
  
  return {
    // 当前时间
    now,
    currentTime,
    
    // 格式化函数
    formatLocal,
    formatDate,
    formatTime,
    formatDuration,
    getRelative,
    smartDisplay,
    
    // 工具函数
    toUTCForSubmit,
    processApiTimeFields,
    checkIsToday,
    checkIsYesterday,
    getTodayDate,
    
    // 配置
    config,
  };
}

/**
 * 倒计时Hook
 */
export function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const target = targetDate.getTime();
      const difference = target - now;
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft({ days, hours, minutes, seconds, total: difference });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
      }
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, [targetDate]);
  
  const isExpired = timeLeft.total <= 0;
  
  const formatCountdown = (showSeconds: boolean = true) => {
    if (isExpired) return '已到期';
    
    const parts = [];
    if (timeLeft.days > 0) parts.push(`${timeLeft.days}天`);
    if (timeLeft.hours > 0) parts.push(`${timeLeft.hours}小时`);
    if (timeLeft.minutes > 0) parts.push(`${timeLeft.minutes}分钟`);
    if (showSeconds && timeLeft.seconds > 0) parts.push(`${timeLeft.seconds}秒`);
    
    return parts.join('');
  };
  
  return {
    timeLeft,
    isExpired,
    formatCountdown,
  };
}

/**
 * 计时器Hook
 */
export function useTimer(initialSeconds: number = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);
  
  const start = () => setIsRunning(true);
  const pause = () => setIsRunning(false);
  const reset = () => {
    setSeconds(initialSeconds);
    setIsRunning(false);
  };
  
  const formatTimer = () => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return {
    seconds,
    isRunning,
    start,
    pause,
    reset,
    formatTimer,
  };
}

/**
 * 时区检测Hook
 */
export function useTimezone() {
  const [timezone, setTimezone] = useState<string>('Asia/Shanghai');
  
  useEffect(() => {
    // 尝试检测用户的时区
    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(detectedTimezone);
    } catch (error) {
      console.warn('Failed to detect timezone:', error);
      // 保持默认时区
    }
  }, []);
  
  return {
    timezone,
    setTimezone,
  };
}
