'use client';

import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, Focus, Square } from 'lucide-react';
import { pomodoroAPI } from '@/lib/api';
import FocusMode from './FocusMode';
import BreakMode from './BreakMode';
import styles from './PomodoroTimer.module.css';

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
  onElapsedTimeChange?: (elapsedTime: number) => void;
  compactMode?: boolean;
  hideHeader?: boolean;
}

export interface PomodoroTimerRef {
  completeCurrentSession: () => void;
  cancelCurrentSession: () => void;
  updateBoundTaskId: (oldId: string, newId: string) => void;
  refreshSession: () => Promise<void>;
}

// interface ActiveSession {
//   id: string;
//   timeLeft: number;
//   isRunning: boolean;
//   isPaused: boolean;
//   duration: number;
//   boundTaskId?: string;
// }

const PomodoroTimer = forwardRef<PomodoroTimerRef, PomodoroTimerProps>(({
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
  startCountUpTrigger,
  onElapsedTimeChange,
  compactMode = false,
  hideHeader = false,
}, ref) => {
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
  const [countUpEndTime, setCountUpEndTime] = useState<number>(0); // 正计时结束时间

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
        const newTimeLeft = prev - 1;
        return newTimeLeft;
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

  // 通知已运行时间变化
  useEffect(() => {
    if (onElapsedTimeChange && (isRunning && !isPaused)) {
      if (isCountUpMode) {
        onElapsedTimeChange(countUpTime);
      } else {
        onElapsedTimeChange(selectedMinutes * 60 - timeLeft);
      }
    }
  }, [timeLeft, countUpTime, isCountUpMode, isRunning, isPaused, selectedMinutes, onElapsedTimeChange]);

  // 监听外部绑定任务变化
  useEffect(() => {
    if (currentBoundTask === null && startBoundTask !== null) {
      console.log('🔄 外部绑定任务已清空，清理内部绑定状态');
      setStartBoundTask(null);
    }
  }, [currentBoundTask, startBoundTask]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    completeCurrentSession: async () => {
      console.log('🍅 外部调用完成当前会话');
      if (isRunning || isPaused) {
        // 计算实际运行时间
        let actualRunTime = 0;
        if (isCountUpMode) {
          actualRunTime = countUpTime; // 正计时模式：直接使用计时时间
        } else {
          actualRunTime = selectedMinutes * 60 - timeLeft; // 倒计时模式：总时间减去剩余时间
        }

        console.log('🍅 实际运行时间:', actualRunTime, '秒');

        // 停止本地定时器
        stopLocalTimer();
        stopSync();

        // 停止服务器端会话
        if (sessionId && serverConnected) {
          try {
            console.log('🔚 停止服务器端番茄钟会话');
            const result = await pomodoroAPI.stopPomodoro(sessionId);

            // 如果运行时间超过5分钟，计入番茄数
            if (actualRunTime >= 300) {
              console.log('🍅 运行时间超过5分钟，计入番茄数');
              onPomodoroComplete?.();
            } else {
              console.log('🍅 运行时间不足5分钟，不计入番茄数');
            }
          } catch (error) {
            console.error('停止服务器端番茄钟失败:', error);
          }
        }

        // 重置所有状态
        resetLocalState();

        console.log('✅ 会话已完成');
      }
    },
    cancelCurrentSession: async () => {
      console.log('🍅 外部调用取消当前会话');
      if (isRunning || isPaused) {
        // 停止本地定时器
        stopLocalTimer();
        stopSync();

        // 停止服务器端会话（不计入番茄数）
        if (sessionId && serverConnected) {
          try {
            console.log('🔚 取消服务器端番茄钟会话');
            await pomodoroAPI.stopPomodoro(sessionId);
          } catch (error) {
            console.error('取消服务器端番茄钟失败:', error);
          }
        }

        // 重置所有状态（不计入番茄数）
        resetLocalState();

        console.log('✅ 会话已取消（不计入番茄数）');
      }
    },
    updateBoundTaskId: (oldId: string, newId: string) => {
      console.log('🔄 更新番茄钟内部绑定任务ID:', oldId, '->', newId);
      if (startBoundTask === oldId) {
        setStartBoundTask(newId);
        console.log('✅ 番茄钟内部绑定任务ID已更新');
      }
    },
    refreshSession: async () => {
      try {
        const response = await pomodoroAPI.getActiveSession();
        const activeSession = response.data;
        if (activeSession) {
          setSessionId(activeSession.id);
          setIsRunning(activeSession.isRunning);
          setIsPaused(activeSession.isPaused);
          setSelectedMinutes(activeSession.duration);
          setStartBoundTask(activeSession.boundTaskId || null);
          if (onTaskBind && activeSession.boundTaskId) {
            onTaskBind(activeSession.boundTaskId);
          }
          if (activeSession.isCountUpMode) {
            setIsCountUpMode(true);
            setCountUpTime(activeSession.countUpTime || 0);
            setTimeLeft(activeSession.duration * 60);
          } else {
            setIsCountUpMode(false);
            setTimeLeft(activeSession.timeLeft);
          }
          if (activeSession.isRunning && !activeSession.isPaused) {
            if (!activeSession.isCountUpMode) startLocalTimer();
            startSync();
          }
        } else {
          // 没有活跃会话，重置状态
          setSessionId(null);
          setIsRunning(false);
          setIsPaused(false);
          setStartBoundTask(null);
          stopLocalTimer();
          stopSync();
        }
      } catch (e) {
        console.error('refreshSession failed', e);
      }
    },
  }), [isRunning, isPaused, isCountUpMode, selectedMinutes, timeLeft, countUpTime, sessionId, serverConnected, onPomodoroComplete, startBoundTask, onTaskBind, startLocalTimer, startSync, stopLocalTimer, stopSync]);

  // 处理番茄时钟完成的副作用
  useEffect(() => {
    const now = Date.now();
    const timeSinceCountUpEnd = now - countUpEndTime;

    // 只有倒计时模式完成时才触发休息模式
    // 确保不是正计时模式，且时间确实为0，且不是刚结束正计时
    if (isCompleted && !isCountUpMode && timeLeft === 0 && selectedMinutes > 0 && timeSinceCountUpEnd > 5000) {
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

        // 自动进入休息模式（再次确认不是正计时模式）
        setTimeout(() => {
          if (!isCountUpMode) {
            startBreakMode();
          }
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
          if (timeDiff > 3 && sessionId) { // 只有在有活跃会话时才同步
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

        // 启动计时器和同步机制
        if (!countUpMode) {
          // 只有倒计时模式才启动本地计时器
          startLocalTimer();
        }
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

      // 如果连接到现有运行中的会话，也启动计时器和同步
      if (result.isExisting && result.session.isRunning && !result.session.isPaused) {
        if (!result.session.isCountUpMode) {
          // 只有倒计时模式才启动本地计时器
          startLocalTimer();
        }
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

      if (!isCountUpMode) {
        // 只有倒计时模式才启动本地计时器
        startLocalTimer();
      }
      startSync();
    } catch (error) {
      console.error('恢复番茄钟失败:', error);
    }
  };

  // 停止服务器端番茄钟
  const stopServerPomodoro = async () => {
    if (!sessionId) return;

    try {
      console.log('🔚 停止服务器端番茄钟会话');
      const result = await pomodoroAPI.stopPomodoro(sessionId);

      // 检查是否完成（时间足够）
      if (result.data.completed) {
        console.log(`✅ 番茄钟提前结束但时间足够：${result.data.duration}分钟，已计入番茄数量和学习记录`);

        // 发送完成通知
        sendNotification(
          '🍅 番茄钟完成！',
          `专注时间：${result.data.duration}分钟，已计入番茄数量和学习记录`,
          '/favicon.ico'
        );

        // 播放完成提示音
        playNotificationSound('complete');

        // 调用完成回调
        if (onPomodoroComplete) {
          onPomodoroComplete();
        }
      } else {
        console.log(`❌ 番茄钟提前结束时间不足：${result.data.duration}分钟，不计入番茄数量`);
      }

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
    setCountUpTime(0);
    setIsCountUpMode(false);

    console.log('🔄 本地状态已重置');
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
        silent: false
      });

      navigator.vibrate?.([200, 100, 200]);

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
        const originalTitle = document.title;
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
    // 正确的番茄钟技术：每完成4个番茄钟后进行长休息，其他时候短休息
    const completedPomodoros = pomodoroCount + 1; // 包括当前完成的番茄钟
    const isLongBreak = completedPomodoros % 4 === 0; // 每4个番茄钟后长休息
    const breakDuration = isLongBreak ? 15 : 5; // 长休息15分钟，短休息5分钟

    console.log(`🍅 已完成番茄钟数量: ${completedPomodoros}, 休息类型: ${isLongBreak ? '长休息' : '短休息'}`);

    setBreakType(isLongBreak ? 'long' : 'short');
    setBreakTimeLeft(breakDuration * 60);
    setShowBreakMode(true);
    setShowFocusMode(false);

    // 发送休息开始通知
    sendNotification(
      isLongBreak ? '🌳 长休息时间！' : '🌸 短休息时间！',
      `${breakDuration}分钟休息开始，放松一下吧！${isLongBreak ? '（第' + completedPomodoros + '个番茄钟完成）' : ''}`,
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

    // 重置状态 - 先重置模式，防止触发倒计时完成逻辑
    // 记录正计时结束时间，防止短时间内触发倒计时完成逻辑
    setCountUpEndTime(Date.now());

    // 停止所有定时器，防止继续计时
    stopLocalTimer();
    stopSync();

    setIsCountUpMode(false);
    setIsCompleted(false);
    setCountUpTime(0);
    setIsRunning(false);
    setIsPaused(false);
    setStartBoundTask(null);
    setSessionId(null);
    setShowFocusMode(false);

    // 确保时间重置为初始值，并且不会被同步覆盖
    const resetTime = selectedMinutes * 60;
    setTimeLeft(resetTime);
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

  const displayTaskId = isRunning ? startBoundTask : currentBoundTask;
  const boundTask = displayTaskId ? tasks.find(task => task.id === displayTaskId) : null;
  // 调试信息
  if (isRunning && !boundTask && displayTaskId) {
    console.log('Pomodoro running without a matched bound task', {
      isRunning,
      displayTaskId,
      startBoundTask,
      currentBoundTask,
      tasksCount: tasks.length,
      taskIds: tasks.map(t => t.id)
    });
  }

  return (
    <div className={`${styles.card} ${compactMode ? styles.cardCompact : ''}`}>
      {!hideHeader && (
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.icon}>
            <span className="text-white text-xs">🍅</span>
          </div>
          <div>
            <h3 className={styles.title}>专注计时</h3>
            <p className={styles.subtitle}>保持界面简单，把展开信息留到专注模式里。</p>
          </div>
        </div>
        <div className={styles.badgeRow}>
          {!serverConnected && (
            <span
              className={styles.badge}
              style={{
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                color: 'var(--warning-color)',
                border: '1px solid rgba(249, 115, 22, 0.2)'
              }}
            >
              本地模式
            </span>
          )}
          {serverConnected && sessionId && (
            <span
              className={styles.badge}
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                color: 'var(--success-color)',
                border: '1px solid rgba(34, 197, 94, 0.2)'
              }}
            >
              全局同步
            </span>
          )}
        </div>
      </div>
      )}

      <div className={styles.body}>
        <div className={styles.hero}>
          <div className={styles.modeTag}>
            <span>{isCountUpMode ? '正计时模式' : '倒计时模式'}</span>
          </div>

          <div className={styles.time}>
            {isCountUpMode ? formatTime(countUpTime) : formatTime(timeLeft)}
          </div>

          <div className={styles.track}>
            <div
              className={styles.fill}
              style={{
                width: `${Math.max(0, Math.min(progress, 100))}%`,
                background: `linear-gradient(90deg, ${progressColor}, color-mix(in srgb, ${progressColor} 62%, white 38%))`,
              }}
            />
          </div>

          <div className={styles.controls}>
            {!isRunning && !isPaused ? (
              <button
                onClick={handleStart}
                className={styles.primaryButton}
                disabled={timeLeft === 0}
              >
                <Play size={18} />
                <span>开始</span>
              </button>
            ) : isPaused ? (
              <button
                onClick={handlePause}
                className={styles.primaryButton}
              >
                <Play size={18} />
                <span>继续</span>
              </button>
            ) : (
              <button
                onClick={handlePause}
                className={styles.secondaryButton}
              >
                <Pause size={18} />
                <span>暂停</span>
              </button>
            )}
            <button
              onClick={handleReset}
              className={styles.ghostButton}
              title={isCountUpMode ? '结束正计时' : '重置计时器'}
            >
              {isCountUpMode ? <Square size={18} /> : <RotateCcw size={18} />}
              <span>{isCountUpMode ? '结束' : '重置'}</span>
            </button>
            <button
              onClick={handleEnterFocusMode}
              className={styles.ghostButton}
              title="进入专注模式"
            >
              <Focus size={18} />
              <span>专注模式</span>
            </button>
          </div>

          {!isRunning && !isPaused && (
            <div className={styles.sliderBlock}>
              <div className={styles.sliderHeader}>
                <span>时长</span>
                <span className={styles.sliderValue}>{selectedMinutes} 分钟</span>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={selectedMinutes}
                onChange={(e) => handleTimeSelect(parseInt(e.target.value))}
                className={`time-slider ${styles.slider}`}
              />
            </div>
          )}

          <div className={styles.taskStrip}>
            <span className={styles.taskStripIcon}>◎</span>
            <span className={styles.taskStripTitle}>
              {boundTask ? boundTask.title : '未绑定任务'}
            </span>
            <div className={styles.taskStripStats}>
              <span>{pomodoroCount} 🍅</span>
            </div>
          </div>
        </div>
      </div>

      {isCompleted && (
        <div className={`${styles.status} ${styles.statusCompleted}`}>
          本轮专注已完成，已计入学习记录。
        </div>
      )}

      {isPaused && (
        <div className={`${styles.status} ${styles.statusPaused}`}>
          {isCountUpMode && countUpTime >= 10800
            ? '已达到 3 小时上限，建议先休息一下。'
            : '计时已暂停，随时可以继续。'}
        </div>
      )}

      {isRunning && !isPaused && (
        <div className={`${styles.status} ${styles.statusRunning}`}>
          {boundTask ? `正在专注：${boundTask.title}` : '专注进行中，先别被别的事情打断。'}
        </div>
      )}

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
});

PomodoroTimer.displayName = 'PomodoroTimer';

export default PomodoroTimer;
