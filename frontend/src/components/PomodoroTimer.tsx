'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, Focus, Square } from 'lucide-react';
import { pomodoroAPI } from '@/lib/api';
import FocusMode from './FocusMode';
import BreakMode from './BreakMode';

interface PomodoroTimerProps {
  currentBoundTask?: string | null;
  tasks?: Array<{id: string, title: string, isCompleted: boolean}>;
  onPomodoroComplete?: () => void;
  onEnterFocusMode?: () => void;
  studyTime?: number;
  pomodoroCount?: number;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onTaskBind?: (taskId: string | null) => void;
  onRunningStateChange?: (isRunning: boolean) => void;
  startCountUpTrigger?: {taskId: string, taskTitle: string} | null; // 正计时触发器
}

// interface ActiveSession {
//   id: string;
//   timeLeft: number;
//   isRunning: boolean;
//   isPaused: boolean;
//   duration: number;
//   boundTaskId?: string;
// }

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  currentBoundTask,
  tasks = [],
  onPomodoroComplete,
  onEnterFocusMode,
  studyTime = 0,
  pomodoroCount = 0,
  theme = 'light',
  onToggleTheme,
  onTaskBind,
  onRunningStateChange,
  startCountUpTrigger
}) => {
  const [selectedMinutes, setSelectedMinutes] = useState(25); // 默认25分钟
  const [timeLeft, setTimeLeft] = useState(selectedMinutes * 60); // 秒数
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [serverConnected, setServerConnected] = useState(true);
  const [startBoundTask, setStartBoundTask] = useState<string | null>(null);
  const [showFocusMode, setShowFocusMode] = useState(false);
  const [showBreakMode, setShowBreakMode] = useState(false);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [breakType, setBreakType] = useState<'short' | 'long'>('short');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isCountUpMode, setIsCountUpMode] = useState(false); // 是否为正计时模式
  const [countUpTime, setCountUpTime] = useState(0); // 正计时已用时间（秒）
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [syncDrift, setSyncDrift] = useState(0); // 同步偏差（毫秒）

  const localTimerRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityCheckRef = useRef<NodeJS.Timeout | null>(null);

  // 时长选项：5分钟到120分钟，每5分钟一个刻度
  const timeOptions = [];
  for (let i = 5; i <= 120; i += 5) {
    timeOptions.push(i);
  }

  // 启动本地倒计时
  const startLocalTimer = () => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
    }

    localTimerRef.current = setInterval(() => {
      // 正计时模式不使用本地计时器，有专门的正计时计时器
      if (isCountUpMode) return;

      setTimeLeft(prev => {
        if (prev <= 1) {
          // console.log('⏰ 前端倒计时结束，触发完成');
          stopLocalTimer();
          setIsCompleted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 停止本地倒计时
  const stopLocalTimer = () => {
    if (localTimerRef.current) {
      clearInterval(localTimerRef.current);
      localTimerRef.current = null;
    }
  };

  // 启动定期同步 - 智能轮询
  const startSync = () => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
    }

    // 智能轮询频率
    const getSyncInterval = () => {
      if (!sessionId) return 30000; // 无会话：30秒
      if (isRunning && !isPaused) return 5000; // 运行中：5秒
      if (isPaused) return 15000; // 暂停中：15秒
      return 10000; // 默认：10秒
    };

    const sync = async () => {
      if (sessionId && (isRunning || isPaused)) {
        await syncWithServer();
      }

      // 动态调整下次同步间隔
      if (syncTimerRef.current) {
        clearInterval(syncTimerRef.current);
        syncTimerRef.current = setInterval(sync, getSyncInterval());
      }
    };

    syncTimerRef.current = setInterval(sync, getSyncInterval());
  };

  // 停止定期同步
  const stopSync = () => {
    if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }
  };

  // 移除localStorage同步，改为纯后端同步
  // 多标签页同步现在通过后端API轮询实现

  // 检查服务器连接状态和活跃会话
  useEffect(() => {
    const initializePomodoro = async () => {
      // console.log('🔄 初始化番茄钟组件...');
      const connected = await checkServerConnection();

      if (connected) {
        // 检查是否有活跃的全局会话
        const response = await pomodoroAPI.getActiveSession();
        const activeSession = response.data;

        // console.log('📡 服务器活跃会话:', activeSession);

        if (activeSession) {
          setSessionId(activeSession.id);
          setIsRunning(activeSession.isRunning);
          setIsPaused(activeSession.isPaused);
          setSelectedMinutes(activeSession.duration);
          setStartBoundTask(activeSession.boundTaskId || null);

          // 通知Dashboard更新绑定任务状态
          if (onTaskBind && activeSession.boundTaskId) {
            onTaskBind(activeSession.boundTaskId);
            // console.log('🔗 恢复任务绑定状态:', activeSession.boundTaskId);
          }

          // 检查是否为正计时模式
          if (activeSession.isCountUpMode) {
            setIsCountUpMode(true);
            setCountUpTime(activeSession.countUpTime || 0);
            setTimeLeft(activeSession.duration * 60); // 正计时模式保持原始时长
            // console.log('🔄 恢复正计时会话:', activeSession.countUpTime, '秒');
          } else {
            setIsCountUpMode(false);
            setTimeLeft(activeSession.timeLeft);
            setCountUpTime(0);
            // console.log('🔄 恢复倒计时会话:', activeSession.timeLeft, '秒');
          }

          // 不再需要localStorage广播，后端会处理多标签页同步

          // 检测到现有会话时，如果是运行状态则启动对应的计时器
          if (activeSession.isRunning && !activeSession.isPaused) {
            if (!activeSession.isCountUpMode) {
              // 只有倒计时模式才启动本地计时器
              startLocalTimer();
            }
            startSync();
          }
        } else {
          // console.log('📡 没有活跃会话，保持初始状态');
        }
      } else {
        // console.log('❌ 服务器连接失败，使用本地模式');
      }
    };

    initializePomodoro();

    // 清理函数：组件卸载时停止所有定时器
    return () => {
      stopLocalTimer();
      stopSync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 开始正计时模式
  const startCountUpMode = useCallback(async (taskId: string) => {
    // console.log('🕐 开始正计时模式，任务:', taskId);

    // 设置正计时模式标志
    setIsCountUpMode(true);
    setCountUpTime(0);

    // 确保timeLeft不会触发完成逻辑
    setTimeLeft(selectedMinutes * 60);

    try {
      if (serverConnected) {
        // 使用服务器端正计时
        await startServerPomodoro(taskId, true);
      } else {
        // 本地正计时模式
        setIsRunning(true);
        setIsPaused(false);
        setIsCompleted(false);
        setStartBoundTask(taskId);
      }

      // 播放开始提示音
      playNotificationSound('start');

      // 发送开始通知
      const taskName = tasks?.find(t => t.id === taskId)?.title;
      sendNotification(
        '⏱️ 正计时开始！',
        taskName ? `开始专注：${taskName}` : '开始专注时间！',
        '/favicon.ico'
      );

      // 进入专注模式
      setShowFocusMode(true);
      if (onEnterFocusMode) {
        onEnterFocusMode();
      }
    } catch (error) {
      console.error('启动正计时失败:', error);
      // 回退到本地模式
      setIsRunning(true);
      setIsPaused(false);
      setIsCompleted(false);
      setStartBoundTask(taskId);

      setShowFocusMode(true);
      if (onEnterFocusMode) {
        onEnterFocusMode();
      }
    }
  }, [selectedMinutes, serverConnected, tasks, onEnterFocusMode]);

  // 监听正计时触发器
  useEffect(() => {
    if (startCountUpTrigger && !isRunning) {
      console.log('🚀 触发正计时模式:', startCountUpTrigger);
      startCountUpMode(startCountUpTrigger.taskId);
    }
  }, [startCountUpTrigger, isRunning, startCountUpMode]);

  // 初始化：Page Visibility API 和通知权限
  useEffect(() => {
    // 请求通知权限
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }

    // 监听页面可见性变化
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      const wasHidden = !isPageVisible;
      setIsPageVisible(isVisible);

      if (isVisible && wasHidden) {
        console.log('📱 页面重新激活...');

        // 恢复原始标题
        if (document.title.includes('🍅 番茄钟提醒！')) {
          document.title = document.title.replace('🍅 番茄钟提醒！', '生活记录系统');
        }

        if (isRunning || sessionId) {
          // 页面重新激活时，立即同步服务器状态
          console.log('🔄 同步服务器状态...');
          syncWithServer();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 初始状态
    setIsPageVisible(!document.hidden);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityCheckRef.current) {
        clearInterval(visibilityCheckRef.current);
      }
    };
  }, []);

  // 页面在后台时的定期检查
  useEffect(() => {
    if (!isPageVisible && isRunning && sessionId) {
      // 页面在后台时，每30秒检查一次服务器状态
      visibilityCheckRef.current = setInterval(() => {
        console.log('🔍 后台检查服务器状态...');
        syncWithServer();
      }, 30000);
    } else {
      if (visibilityCheckRef.current) {
        clearInterval(visibilityCheckRef.current);
        visibilityCheckRef.current = null;
      }
    }

    return () => {
      if (visibilityCheckRef.current) {
        clearInterval(visibilityCheckRef.current);
      }
    };
  }, [isPageVisible, isRunning, sessionId]);

  // 正计时模式的计时器
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isCountUpMode && isRunning && !isPaused) {
      interval = setInterval(() => {
        setCountUpTime(prev => {
          const newTime = prev + 1;

          // 检查是否达到3小时（180分钟 = 10800秒）
          if (newTime >= 10800) {
            console.log('⏰ 正计时达到3小时，自动暂停');

            // 强制暂停
            setIsRunning(false);
            setIsPaused(true);

            // 发送通知
            sendNotification(
              '⏰ 专注时间已达3小时！',
              '为了您的健康，建议休息一下再继续专注',
              '/favicon.ico'
            );

            // 播放提示音
            playNotificationSound('complete');

            return 10800; // 锁定在3小时
          }

          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCountUpMode, isRunning, isPaused]);

  // 通知运行状态变化
  useEffect(() => {
    if (onRunningStateChange) {
      onRunningStateChange(isRunning && !isPaused);
    }
  }, [isRunning, isPaused, onRunningStateChange]);

  // 处理番茄时钟完成的副作用
  useEffect(() => {
    // console.log('🔍 完成状态检查:', { isCompleted, isCountUpMode, isRunning, timeLeft });

    // 只有倒计时模式完成时才触发休息模式
    if (isCompleted && !isCountUpMode && timeLeft === 0) {
      // console.log('🎉 触发倒计时完成逻辑，准备进入休息模式');
      const timer = setTimeout(() => {
        // 完成后清理状态
        setIsCompleted(false);
        setIsRunning(false);
        setIsPaused(false);
        setSessionId(null);
        setStartBoundTask(null);
        setTimeLeft(selectedMinutes * 60);

        // 停止所有定时器
        stopLocalTimer();
        stopSync();

        // 调用完成回调
        if (onPomodoroComplete) {
          onPomodoroComplete();
        }

        // 发送完成通知
        sendNotification(
          '🍅 番茄时钟完成！',
          `${selectedMinutes}分钟专注时间完成！点击查看详情`,
          '/favicon.ico'
        );

        // 播放完成提示音
        playNotificationSound('complete');

        // 如果页面不可见，启动强化提醒
        if (!isPageVisible) {
          console.log('📱 页面不可见，启动强化提醒...');
          let reminderCount = 0;
          const reminderInterval = setInterval(() => {
            reminderCount++;
            if (reminderCount <= 3 && !isPageVisible) {
              sendNotification(
                `🔔 提醒 ${reminderCount}/3`,
                '番茄时钟已完成，请查看！',
                '/favicon.ico'
              );
              playNotificationSound('complete');
            } else {
              clearInterval(reminderInterval);
            }
          }, 30000); // 每30秒提醒一次，最多3次
        }

        // 自动进入休息模式
        setTimeout(() => {
          startBreakMode();
        }, 2000); // 2秒后自动进入休息模式
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isCompleted, isCountUpMode, timeLeft]); // 简化依赖数组，避免频繁触发





  // 与服务器同步时间
  const syncWithServer = async () => {
    if (!sessionId) return;

    try {
      const response = await pomodoroAPI.getPomodoroStatus(sessionId);
      const status = response.data;

      if (status) {
        // 同步计时模式状态
        if (status.isCountUpMode !== isCountUpMode) {
          setIsCountUpMode(status.isCountUpMode);
          // console.log(`🔄 计时模式同步: ${isCountUpMode ? '正计时' : '倒计时'} -> ${status.isCountUpMode ? '正计时' : '倒计时'}`);
        }

        // 同步正计时或倒计时状态
        if (status.isCountUpMode) {
          // 正计时模式：同步countUpTime
          if (status.countUpTime !== countUpTime) {
            setCountUpTime(status.countUpTime || 0);
            console.log(`⏰ 正计时同步: ${status.countUpTime}秒`);
          }
        } else {
          // 倒计时模式：同步timeLeft
          const timeDiff = Math.abs(timeLeft - status.timeLeft);
          if (timeDiff > 3) {
            setTimeLeft(status.timeLeft);
            // console.log(`⏰ 倒计时同步: 本地 ${timeLeft}s -> 服务器 ${status.timeLeft}s`);
          }
        }

        // 同步运行状态
        if (status.isRunning !== isRunning || status.isPaused !== isPaused) {
          setIsRunning(status.isRunning);
          setIsPaused(status.isPaused);

          if (status.isRunning && !status.isPaused && !status.isCountUpMode) {
            // 只有倒计时模式才启动本地计时器
            startLocalTimer();
          } else {
            stopLocalTimer();
          }
        }

        // 检查完成状态（只对倒计时模式）
        if (status.isCompleted && !isCompleted && !status.isCountUpMode) {
          console.log('🎉 检测到番茄钟在后台完成！');
          stopLocalTimer();
          stopSync();
          setIsCompleted(true);

          // 如果是在后台完成的，立即发送强化通知
          if (!isPageVisible) {
            console.log('📱 后台完成，发送强化通知...');
            sendNotification(
              '🍅 番茄时钟已完成！',
              `${selectedMinutes}分钟专注时间在后台完成！请查看详情`,
              '/favicon.ico'
            );
            playNotificationSound('complete');

            // 启动重复提醒
            let reminderCount = 0;
            const reminderInterval = setInterval(() => {
              reminderCount++;
              if (reminderCount <= 5 && !isPageVisible) {
                sendNotification(
                  `🔔 重要提醒 ${reminderCount}/5`,
                  '番茄时钟已完成，请尽快查看！',
                  '/favicon.ico'
                );
                playNotificationSound('complete');
              } else {
                clearInterval(reminderInterval);
              }
            }, 20000); // 每20秒提醒一次，最多5次
          }
        }

        setServerConnected(true);
        setReconnectAttempts(0);
      }
    } catch (error) {
      console.error('同步失败:', error);
      setServerConnected(false);
      handleConnectionError();
    }
  };

  // 处理连接错误
  const handleConnectionError = async () => {
    if (reconnectAttempts < 5) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // 指数退避，最大30秒
      console.log(`🔄 ${delay/1000}秒后尝试重连... (${reconnectAttempts + 1}/5)`);

      setTimeout(async () => {
        setReconnectAttempts(prev => prev + 1);
        await checkServerConnection();
      }, delay);
    } else {
      console.log('❌ 达到最大重连次数，切换到本地模式');
      setServerConnected(false);
    }
  };

  // 检查服务器连接
  const checkServerConnection = async () => {
    try {
      await pomodoroAPI.getActiveSession();
      setServerConnected(true);
      setReconnectAttempts(0);
      console.log('✅ 服务器连接恢复');
      return true;
    } catch (error) {
      console.error('服务器连接检查失败:', error);
      setServerConnected(false);
      return false;
    }
  };

  // 启动服务器端番茄钟
  const startServerPomodoro = async (taskId?: string, countUpMode = false) => {
    try {
      const response = await pomodoroAPI.startPomodoro({
        duration: selectedMinutes,
        taskId: taskId,
        isCountUpMode: countUpMode
      });
      const result = response.data;

      if (result.isExisting) {
        // 连接到现有的全局会话
        setSessionId(result.sessionId);
        setTimeLeft(result.session.timeLeft);
        setIsRunning(result.session.isRunning);
        setIsPaused(result.session.isPaused);
        setSelectedMinutes(result.session.duration);
        setStartBoundTask(result.session.boundTaskId || null);
      } else {
        // 创建新的全局会话
        setSessionId(result.sessionId);
        setIsRunning(true);
        setIsCompleted(false);
        setStartBoundTask(taskId || null);

        // 不再需要localStorage广播

        // 启动本地倒计时和同步机制
        startLocalTimer();
        startSync();

        // 播放开始提示音
        playNotificationSound('start');

        // 发送开始通知
        const taskName = taskId ? tasks.find(t => t.id === taskId)?.title : null;
        sendNotification(
          '🍅 番茄时钟开始！',
          taskName ? `开始专注：${taskName}` : '开始专注时间！',
          '/favicon.ico'
        );

        // 进入专注模式
        setShowFocusMode(true);
        if (onEnterFocusMode) {
          onEnterFocusMode();
        }
      }

      // 如果连接到现有运行中的会话，也启动倒计时和同步
      if (result.isExisting && result.session.isRunning && !result.session.isPaused) {
        startLocalTimer();
        startSync();
      }
    } catch (error) {
      console.error('启动服务器端番茄钟失败:', error);
      setServerConnected(false);
      startLocalPomodoro();
    }
  };

  // 启动本地番茄钟（回退模式）
  const startLocalPomodoro = (taskId?: string) => {
    setIsRunning(true);
    setIsCompleted(false);
    setStartBoundTask(taskId || null);
    startLocalTimer();

    // 播放开始提示音
    playNotificationSound('start');

    // 发送开始通知
    const taskName = taskId ? tasks.find(t => t.id === taskId)?.title : null;
    sendNotification(
      '🍅 番茄时钟开始！（本地模式）',
      taskName ? `开始专注：${taskName}` : '开始专注时间！',
      '/favicon.ico'
    );

    setShowFocusMode(true);
    if (onEnterFocusMode) {
      onEnterFocusMode();
    }
  };

  // 暂停服务器端番茄钟
  const pauseServerPomodoro = async () => {
    if (!sessionId) return;

    try {
      stopLocalTimer();
      stopSync();

      await pomodoroAPI.pausePomodoro(sessionId);
      await syncWithServer();

      setIsRunning(false);
      setIsPaused(true);

      // 不再需要localStorage广播
    } catch (error) {
      console.error('暂停番茄钟失败:', error);
    }
  };

  // 恢复服务器端番茄钟
  const resumeServerPomodoro = async () => {
    if (!sessionId) return;

    try {
      await pomodoroAPI.resumePomodoro(sessionId);
      await syncWithServer();

      setIsRunning(true);
      setIsPaused(false);

      // 不再需要localStorage广播

      startLocalTimer();
      startSync();
    } catch (error) {
      console.error('恢复番茄钟失败:', error);
    }
  };

  // 停止服务器端番茄钟
  const stopServerPomodoro = async () => {
    if (!sessionId) return;
    
    try {
      await pomodoroAPI.stopPomodoro(sessionId);
      resetLocalState();
    } catch (error) {
      console.error('停止服务器端番茄钟失败:', error);
      resetLocalState();
    }
  };

  // 重置本地状态
  const resetLocalState = () => {
    stopLocalTimer();
    stopSync();

    setIsRunning(false);
    setTimeLeft(selectedMinutes * 60);
    setIsCompleted(false);
    setStartBoundTask(null);
    setSessionId(null);
    setIsPaused(false);
  };

  // 本地计时逻辑（回退模式）
  useEffect(() => {
    if (!serverConnected && isRunning && timeLeft > 0 && !isCountUpMode) {
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
            return selectedMinutes * 60;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [serverConnected, isRunning, timeLeft, selectedMinutes, isCountUpMode]);



  // 发送通知
  const sendNotification = (title: string, body: string, icon?: string) => {
    if ('Notification' in window && notificationPermission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'pomodoro-timer',
        requireInteraction: !isPageVisible, // 页面不可见时需要用户交互
        silent: false,
        vibrate: [200, 100, 200], // 振动模式（移动设备）
        timestamp: Date.now()
      });

      // 点击通知时聚焦到窗口
      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // 页面不可见时延长显示时间，可见时正常关闭
      const closeDelay = isPageVisible ? 5000 : 15000;
      setTimeout(() => {
        notification.close();
      }, closeDelay);

      // 如果页面不可见，尝试让浏览器标签页闪烁
      if (!isPageVisible) {
        let originalTitle = document.title;
        let flashCount = 0;
        const flashInterval = setInterval(() => {
          document.title = flashCount % 2 === 0 ? '🍅 番茄钟提醒！' : originalTitle;
          flashCount++;
          if (flashCount >= 10 || isPageVisible) {
            clearInterval(flashInterval);
            document.title = originalTitle;
          }
        }, 1000);
      }

      return notification;
    } else if (notificationPermission === 'default') {
      // 如果权限未授予，再次请求
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission);
        if (permission === 'granted') {
          sendNotification(title, body, icon);
        }
      });
    }
    return null;
  };

  // 播放提示音
  const playNotificationSound = (type: 'start' | 'complete' | 'break') => {
    try {
      // 创建音频上下文
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();

      // 不同类型的音频频率
      const frequencies = {
        start: [440, 554.37], // A4, C#5
        complete: [523.25, 659.25, 783.99], // C5, E5, G5
        break: [349.23, 440] // F4, A4
      };

      const freqs = frequencies[type];
      const duration = type === 'complete' ? 0.8 : 0.3;

      freqs.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        const startTime = audioContext.currentTime + index * 0.15;
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      });
    } catch (error) {
      console.warn('播放提示音失败:', error);
    }
  };

  // 页面退出保护和可见性检测
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning && !isPaused) {
        const timeLeftMinutes = Math.ceil(timeLeft / 60);
        const message = `🍅 番茄时钟正在运行中！\n\n剩余时间：${timeLeftMinutes}分钟\n离开页面将中断您的专注时间。\n\n确定要离开吗？`;
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isRunning && !isPaused) {
        // console.log('⚠️ 页面被隐藏，番茄时钟继续运行');
        // 可以在这里添加额外的逻辑，比如显示通知提醒用户
      } else if (!document.hidden && isRunning && !isPaused) {
        // console.log('👀 页面重新可见，番茄时钟运行中');
        // 页面重新可见时可以同步状态
        if (sessionId && serverConnected) {
          syncWithServer();
        }
      }
    };

    if (isRunning) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isRunning, isPaused, timeLeft, sessionId, serverConnected]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopLocalTimer();
      stopSync();
    };
  }, []);

  const handleTimeSelect = (minutes: number) => {
    if (!isRunning) {
      setSelectedMinutes(minutes);
      setTimeLeft(minutes * 60);
      setIsCompleted(false);
    }
  };

  const handleStart = () => {
    // 使用当前绑定的任务
    const taskToUse = currentBoundTask;

    // 如果是正计时模式且已经暂停，则继续而不是重新开始
    if (isCountUpMode && isPaused) {
      setIsRunning(true);
      setIsPaused(false);
      console.log('▶️ 继续正计时');
      return;
    }

    // 如果是正计时模式且未开始，直接启动正计时
    if (isCountUpMode && !isRunning) {
      if (taskToUse) {
        startCountUpMode(taskToUse);
      } else {
        console.warn('⚠️ 正计时模式需要绑定任务');
        // 可以在这里显示提示信息给用户
      }
      return;
    }

    if (serverConnected) {
      startServerPomodoro(taskToUse || undefined);
    } else {
      startLocalPomodoro(taskToUse || undefined);
    }
  };

  const handlePause = () => {
    if (serverConnected && sessionId) {
      if (isPaused) {
        resumeServerPomodoro();
      } else {
        pauseServerPomodoro();
      }
    } else {
      // 本地模式暂停/继续
      if (isPaused) {
        // 继续
        setIsRunning(true);
        setIsPaused(false);
        // console.log('▶️ 继续', isCountUpMode ? '正计时' : '番茄钟');
      } else {
        // 暂停
        setIsRunning(false);
        setIsPaused(true);
        // console.log('⏸️ 暂停', isCountUpMode ? '正计时' : '番茄钟');
      }
    }
  };

  const handleReset = () => {
    // 如果是正计时模式，结束正计时
    if (isCountUpMode) {
      endCountUpMode();
      return;
    }

    if (serverConnected && sessionId) {
      stopServerPomodoro();
    } else {
      resetLocalState();
    }
  };

  const handleEnterFocusMode = () => {
    setShowFocusMode(true);
  };

  const handleExitFocusMode = () => {
    setShowFocusMode(false);
  };



  // 开始休息模式
  const startBreakMode = () => {
    // 根据累计专注时间决定休息类型：1小时内短休息5分钟，1小时以上长休息15分钟
    const totalFocusMinutes = (pomodoroCount + 1) * selectedMinutes; // 包括当前完成的番茄钟
    const isLongBreak = totalFocusMinutes >= 60; // 1小时(60分钟)以上
    const breakDuration = isLongBreak ? 15 : 5; // 长休息15分钟，短休息5分钟

    setBreakType(isLongBreak ? 'long' : 'short');
    setBreakTimeLeft(breakDuration * 60);
    setShowBreakMode(true);
    setShowFocusMode(false);

    // 发送休息开始通知
    sendNotification(
      isLongBreak ? '🌳 长休息时间！' : '🌸 短休息时间！',
      `${breakDuration}分钟休息开始，放松一下吧！`,
      '/favicon.ico'
    );

    // 播放休息提示音
    playNotificationSound('break');

    // 启动休息倒计时
    startBreakTimer();
  };

  // 启动休息倒计时
  const startBreakTimer = () => {
    const timer = setInterval(() => {
      setBreakTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          endBreakMode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 结束休息模式
  const endBreakMode = () => {
    setShowBreakMode(false);
    setBreakTimeLeft(0);

    // 发送休息结束通知
    sendNotification(
      '⏰ 休息结束！',
      '准备开始下一个番茄钟吧！',
      '/favicon.ico'
    );

    // 播放提示音
    playNotificationSound('start');
  };

  // 跳过休息
  const skipBreak = () => {
    endBreakMode();
  };



  // 手动结束正计时
  const endCountUpMode = async () => {
    const elapsedMinutes = Math.floor(countUpTime / 60);
    const elapsedSeconds = countUpTime % 60;

    if (elapsedMinutes < 5) {
      // 时间不足5分钟，询问用户是否继续
      const timeDisplay = elapsedMinutes > 0
        ? `${elapsedMinutes}分钟${elapsedSeconds}秒`
        : `${elapsedSeconds}秒`;

      const shouldContinue = confirm(
        `当前专注时间：${timeDisplay}\n\n` +
        `专注时间不足5分钟，无法计入番茄数量。\n\n` +
        `点击"确定"继续专注，点击"取消"结束并退出。`
      );

      if (shouldContinue) {
        // 用户选择继续，不做任何操作
        console.log('⏰ 用户选择继续专注');
        return;
      } else {
        // 用户选择结束，直接退出不计入番茄数量
        console.log('❌ 用户选择结束，时间不足不计入番茄数量');
      }
    }

    // 结束后端会话
    try {
      if (serverConnected && sessionId) {
        console.log('🔚 结束服务器端正计时会话');
        const result = await pomodoroAPI.stopPomodoro(sessionId);

        // 如果后端确认完成且时间足够，处理完成逻辑
        if (result.data.completed && elapsedMinutes >= 5) {
          console.log(`✅ 正计时完成：${elapsedMinutes}分钟，已计入番茄数量和学习记录`);

          // 发送完成通知
          sendNotification(
            '🍅 正计时完成！',
            `专注时间：${elapsedMinutes}分钟，已计入番茄数量和学习记录`,
            '/favicon.ico'
          );

          // 播放完成提示音
          playNotificationSound('complete');

          // 调用完成回调
          if (onPomodoroComplete) {
            onPomodoroComplete();
          }
        }

        // 停止同步
        stopSync();
      }
    } catch (error) {
      console.error('结束服务器会话失败:', error);
    }

    // 通知Dashboard清除绑定状态
    if (onTaskBind) {
      onTaskBind(null);
    }

    // 重置状态
    setIsCountUpMode(false);
    setCountUpTime(0);
    setIsRunning(false);
    setIsPaused(false);
    setIsCompleted(false);
    setStartBoundTask(null);
    setSessionId(null);
    setShowFocusMode(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算进度 - 正计时模式特殊处理
  let progress = 0;
  let progressColor = '#ef4444'; // 默认红色

  if (isCountUpMode) {
    // 正计时模式：3小时循环，每小时一圈
    const totalMinutes = Math.floor(countUpTime / 60);
    const maxMinutes = 180; // 最长3小时

    // 限制最大时间为3小时
    const clampedMinutes = Math.min(totalMinutes, maxMinutes);
    const clampedCycle = Math.floor(clampedMinutes / 60);
    const clampedMinutesInCycle = clampedMinutes % 60;

    // 计算进度百分比（0-100）
    const cycleProgress = (clampedMinutesInCycle / 60) * 100;

    switch (clampedCycle) {
      case 0: // 第一圈（0-60分钟）：填充
        progress = cycleProgress;
        progressColor = '#22c55e'; // 绿色
        break;
      case 1: // 第二圈（60-120分钟）：消除
        progress = 100 - cycleProgress;
        progressColor = '#f59e0b'; // 橙色
        break;
      case 2: // 第三圈（120-180分钟）：再次填充
        progress = cycleProgress;
        progressColor = '#8b5cf6'; // 紫色
        break;
      default: // 超过3小时，保持满圈
        progress = 100;
        progressColor = '#ef4444'; // 红色警告
        break;
    }
  } else {
    // 倒计时模式：正常进度
    progress = ((selectedMinutes * 60 - timeLeft) / (selectedMinutes * 60)) * 100;
    progressColor = '#ef4444'; // 红色
  }

  const circumference = 2 * Math.PI * 90; // 半径90的圆周长
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // 获取当前绑定的任务信息
  const displayTaskId = isRunning ? startBoundTask : currentBoundTask;
  const boundTask = displayTaskId ? tasks.find(task => task.id === displayTaskId) : null;

  // 调试信息
  if (isRunning && !boundTask && displayTaskId) {
    console.log('🐛 番茄钟运行中但找不到绑定任务:', {
      isRunning,
      displayTaskId,
      startBoundTask,
      currentBoundTask,
      tasksCount: tasks.length,
      taskIds: tasks.map(t => t.id)
    });
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white text-xs">🍅</span>
          </div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>番茄时钟</h3>
          <div className="flex items-center gap-2">
            {!serverConnected && (
              <span className="text-xs px-2 py-1 rounded" style={{
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                color: 'var(--warning-color)',
                border: '1px solid rgba(249, 115, 22, 0.2)'
              }}>
                本地模式
              </span>
            )}
            {serverConnected && sessionId && (
              <span className="text-xs px-2 py-1 rounded" style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                color: 'var(--success-color)',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}>
                全局同步
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 圆环时钟 */}
      <div className="pomodoro-container">
        <div className="pomodoro-circle">
          <svg className="pomodoro-svg" viewBox="0 0 200 200">
            {/* 背景圆环 */}
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="var(--bg-tertiary)"
              strokeWidth="8"
            />
            {/* 进度圆环 */}
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={isCompleted ? "var(--success-color)" : progressColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="pomodoro-progress"
              transform="rotate(-90 100 100)"
            />
          </svg>

          {/* 中心控制区域 */}
          <div className="pomodoro-center">
            <div className="pomodoro-time">
              {isCountUpMode ? formatTime(countUpTime) : formatTime(timeLeft)}
            </div>

            {/* 正计时模式的圈数指示器 */}
            {isCountUpMode && (
              <div className="count-up-cycle-indicator">
                {(() => {
                  const totalMinutes = Math.floor(countUpTime / 60);
                  const currentCycle = Math.floor(totalMinutes / 60);
                  const minutesInCycle = totalMinutes % 60;

                  const cycleNames = ['第一圈', '第二圈', '第三圈'];
                  const cycleEmojis = ['🟢', '🟡', '🟣'];

                  if (totalMinutes >= 180) {
                    return (
                      <div className="cycle-info">
                        <span className="cycle-emoji">🔴</span>
                        <span className="cycle-text">
                          {isPaused ? '已达3小时 - 已暂停' : '已达3小时'}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="cycle-info">
                      <span className="cycle-emoji">{cycleEmojis[currentCycle] || '🟢'}</span>
                      <span className="cycle-text">
                        {cycleNames[currentCycle] || '第一圈'} ({minutesInCycle}/60分钟)
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="pomodoro-controls">
              {!isRunning && !isPaused ? (
                <button
                  onClick={handleStart}
                  className="pomodoro-btn pomodoro-btn-start"
                  disabled={timeLeft === 0}
                >
                  <Play size={20} />
                </button>
              ) : isPaused ? (
                <button
                  onClick={handlePause}
                  className="pomodoro-btn pomodoro-btn-start"
                >
                  <Play size={20} />
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="pomodoro-btn pomodoro-btn-pause"
                >
                  <Pause size={20} />
                </button>
              )}
              <button
                onClick={handleReset}
                className="pomodoro-btn pomodoro-btn-reset"
                title={isCountUpMode ? '结束正计时' : '重置番茄钟'}
              >
                {isCountUpMode ? <Square size={16} /> : <RotateCcw size={16} />}
              </button>
              <button
                onClick={handleEnterFocusMode}
                className="pomodoro-btn pomodoro-btn-focus"
                title="进入专注模式"
              >
                <Focus size={16} />
              </button>
            </div>
          </div>
        </div>



        {/* 时长选择滑块 */}
        {!isRunning && !isPaused && (
          <div className="pomodoro-slider">
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={selectedMinutes}
              onChange={(e) => handleTimeSelect(parseInt(e.target.value))}
              className="time-slider"
            />
            <div className="slider-labels">
              <span>5分钟</span>
              <span>2小时</span>
            </div>
          </div>
        )}



        {/* 状态提示 */}
        {isCompleted && (
          <div className="pomodoro-status completed">
            🎉 专注时间完成！已添加到学习记录
          </div>
        )}

        {isPaused && (
          <div className="pomodoro-status paused">
            {isCountUpMode && countUpTime >= 10800
              ? '⏰ 已达3小时上限，建议休息后继续'
              : '⏸️ 番茄钟已暂停'
            }
          </div>
        )}

        {isRunning && !isPaused && (
          <div className="pomodoro-status running">
            {boundTask ? `🔥 【${boundTask.title}】专注中！` : '🔥 专注中...保持专注！'}
          </div>
        )}
      </div>

      {/* 专注模式覆盖层 - 使用Portal渲染到body */}
      {showFocusMode && typeof window !== 'undefined' && createPortal(
        <FocusMode
          timeLeft={timeLeft}
          selectedMinutes={selectedMinutes}
          isRunning={isRunning}
          isPaused={isPaused}
          onStart={handleStart}
          onPause={handlePause}
          onReset={handleReset}
          onExit={handleExitFocusMode}
          currentBoundTask={displayTaskId || undefined}
          tasks={tasks}
          studyTime={studyTime}
          pomodoroCount={pomodoroCount}
          theme={theme}
          onToggleTheme={onToggleTheme}
          isCountUpMode={isCountUpMode}
          countUpTime={countUpTime}
        />,
        document.body
      )}

      {/* 休息模式覆盖层 - 使用Portal渲染到body */}
      {showBreakMode && typeof window !== 'undefined' && createPortal(
        <BreakMode
          timeLeft={breakTimeLeft}
          selectedMinutes={breakType === 'long' ? 15 : 5}
          onSkip={skipBreak}
          onExit={endBreakMode}
          theme={theme}
          onToggleTheme={onToggleTheme}
          breakType={breakType}
          pomodoroCount={pomodoroCount}
        />,
        document.body
      )}
    </div>
  );
};

export default PomodoroTimer;
