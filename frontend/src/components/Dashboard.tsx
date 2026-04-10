'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { userAPI, studyAPI, taskAPI, api } from '@/lib/api';
import {
  AGENT_DATA_CHANGED_EVENT,
  eventAffectsDomains,
} from '@/lib/agent-events';
import { goalService, UserGoal } from '../services/goalService';
import { getVersionString } from '@/lib/version';
import HistoryViewer from './HistoryViewer';
import PomodoroTimer, { PomodoroTimerRef } from './PomodoroTimer';
import PendingTasks from './PendingTasks';
import ImportantInfo from './ImportantInfo';
import ExerciseStats from './ExerciseStats';
import ExpenseStats from './ExpenseStats';
import ChangePasswordForm from './auth/ChangePasswordForm';
import DayReflection from './daily/DayReflection';
import SystemSuggestion from './SystemSuggestion';
import AgentChatPanel from './AgentChatPanel';
import Navbar from './layout/Navbar';


// 导入统一的主题样式
import '../styles/theme.css';

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState<'dark' | 'light'>('light'); // 默认浅色，等用户数据加载后再设置
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDayReflectionOpen, setIsDayReflectionOpen] = useState(false);
  const [dayReflectionMode, setDayReflectionMode] = useState<'start' | 'reflection'>('start');
  const [dayStartRefreshTrigger, setDayStartRefreshTrigger] = useState(0);
  const [pomodoroCompleteRefreshTrigger, setPomodoroCompleteRefreshTrigger] = useState(0);
  const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0);
  const pomodoroTimerRef = useRef<PomodoroTimerRef>(null);

  const [tasks, setTasks] = useState<Array<{
    id: string,
    title: string,
    isCompleted: boolean,
    pomodoroCount?: number,
    description?: string,
    priority?: number
  }>>([]);
  const [currentBoundTask, setCurrentBoundTask] = useState<string | null>(null);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [startCountUpMode, setStartCountUpMode] = useState<{taskId: string, taskTitle: string} | null>(null);
  const [pomodoroElapsedTime, setPomodoroElapsedTime] = useState(0);

  // 学习时长相关状态
  const [studyTime, setStudyTime] = useState(0); // 总学习时长（分钟）
  const [pomodoroCount, setPomodoroCount] = useState(0); // 番茄钟数量
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showUndo, setShowUndo] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(10);
  const [lastAddedMinutes, setLastAddedMinutes] = useState(0);
  const [lastAddedRecordId, setLastAddedRecordId] = useState<string | null>(null);

  // 加载用户数据
  const loadUserData = async () => {
    try {
      const response = await userAPI.getProfile();
      setUser(response.data);
    } catch (error) {
      console.error('加载用户数据失败:', error);
    }
  };

  // 主题切换处理
  const handleThemeToggle = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    try {
      // 同步到后端
      await userAPI.updateTheme(newTheme);
      // console.log(`🎨 主题已切换为: ${newTheme}`);
    } catch (error) {
      console.error('主题更新失败:', error);
      // 如果失败，回滚主题
      setTheme(theme);
    }
  };

  // 应用主题到document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // 同时为Tailwind深色模式添加class
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // 初始化主题（从用户配置加载）
  useEffect(() => {
    if (user?.theme) {
      const userTheme = user.theme === 'dark' ? 'dark' : 'light';
      // console.log(`🎨 从用户配置加载主题: ${userTheme}`);
      setTheme(userTheme);
    }
  }, [user?.theme]);

  // 加载今日学习数据
  const loadTodayStats = async () => {
    try {
      const response = await studyAPI.getTodayStats();
      const stats = response.data;
      setStudyTime(stats.totalMinutes);
      setPomodoroCount(stats.pomodoroCount);
    } catch (error) {
      console.error('加载今日学习数据失败:', error);
    }
  };

  // 加载当前目标
  const loadCurrentGoal = async () => {
    try {
      const goal = await goalService.getCurrentGoal();
      setCurrentGoal(goal);
    } catch (error) {
      console.error('加载当前目标失败:', error);
      // 不显示错误提示，因为没有目标是正常情况
    }
  };

  // 加载任务列表
  const loadTasks = async () => {
    try {
      const response = await taskAPI.getTasks();
      const tasksData = response.data.map((task: {
        id: string,
        title: string,
        isCompleted: boolean,
        pomodoroCount?: number,
        description?: string,
        priority?: number
      }) => ({
        id: task.id,
        title: task.title,
        isCompleted: task.isCompleted,
        pomodoroCount: task.pomodoroCount || 0,
        description: task.description,
        priority: task.priority
      }));
      setTasks(tasksData);
    } catch (error) {
      console.error('加载任务列表失败:', error);
    }
  };

  // 处理任务点击（切换绑定状态）
  const handleTaskClick = (taskId: string, taskTitle: string) => {
    if (isPomodoroRunning) {
      alert('番茄钟正在运行中，无法更换绑定任务');
      return;
    }

    // 如果当前任务已绑定，则取消绑定；否则绑定该任务
    if (currentBoundTask === taskId) {
      // console.log(`🔓 取消绑定任务: ${taskTitle} (${taskId})`);
      setCurrentBoundTask(null);
    } else {
      // console.log(`🎯 绑定任务到番茄钟: ${taskTitle} (${taskId})`);
      setCurrentBoundTask(taskId);
    }
  };

  // 处理正计时开始
  const handleStartCountUp = (taskId: string, taskTitle: string) => {
    if (isPomodoroRunning) {
      alert('番茄钟正在运行中，请先停止当前番茄钟');
      return;
    }

    // console.log(`⏱️ 开始正计时: ${taskTitle} (${taskId})`);
    setCurrentBoundTask(taskId);
    setStartCountUpMode({taskId, taskTitle});

    // 重置标志
    setTimeout(() => {
      setStartCountUpMode(null);
    }, 100);
  };

  // 完成任务并结束番茄钟（计入番茄数）
  const handleCompleteTaskWithPomodoro = async (taskId: string) => {
    try {
      console.log('🍅 开始完成任务并结束番茄钟（计入番茄数）:', taskId);

      // 先完成任务
      await taskAPI.updateTask(taskId, { isCompleted: true });
      console.log('✅ 任务状态已更新为完成');

      // 通知番茄钟组件完成当前会话（计入番茄数）
      if (pomodoroTimerRef.current) {
        pomodoroTimerRef.current.completeCurrentSession();
      }

      // 更新状态
      setIsPomodoroRunning(false);
      setCurrentBoundTask(null);
      setPomodoroElapsedTime(0);

      // 刷新任务列表和统计数据
      setTaskRefreshTrigger(prev => prev + 1);
      loadTodayStats();

      console.log('✅ 任务已完成，番茄钟已结束并计入番茄数');
    } catch (error) {
      console.error('完成任务失败:', error);
      alert('完成任务失败，请重试');
    }
  };

  // 更新番茄钟绑定任务ID（用于任务ID从临时ID变为真实ID时）
  const handleUpdatePomodoroTaskId = (oldId: string, newId: string) => {
    if (pomodoroTimerRef.current) {
      pomodoroTimerRef.current.updateBoundTaskId(oldId, newId);
    }
    // 同时更新Dashboard的绑定状态
    if (currentBoundTask === oldId) {
      setCurrentBoundTask(newId);
    }
  };

  // 任务添加成功后的回调
  const handleTaskAdded = (newTask: any) => {
    console.log('📝 Dashboard收到新任务添加通知:', newTask);
    // 重新加载任务列表以确保同步
    loadTasks();
  };

  // 完成任务并取消番茄钟（不计入番茄数）
  const handleCompleteTaskCancelPomodoro = async (taskId: string) => {
    try {
      console.log('🍅 开始完成任务并取消番茄钟（不计入番茄数）:', taskId);

      // 先完成任务
      await taskAPI.updateTask(taskId, { isCompleted: true });
      console.log('✅ 任务状态已更新为完成');

      // 通知番茄钟组件取消当前会话（不计入番茄数）
      if (pomodoroTimerRef.current) {
        pomodoroTimerRef.current.cancelCurrentSession();
      }

      // 更新状态
      setIsPomodoroRunning(false);
      setCurrentBoundTask(null);
      setPomodoroElapsedTime(0);

      // 刷新任务列表和统计数据（不触发番茄钟完成逻辑）
      setTaskRefreshTrigger(prev => prev + 1);
      loadTodayStats();

      console.log('✅ 任务已完成，番茄钟已取消（不计入番茄数）');
    } catch (error) {
      console.error('完成任务失败:', error);
      alert('完成任务失败，请重试');
    }
  };

  useEffect(() => {
    loadUserData();
    loadCurrentGoal();
    loadTodayStats();
    loadTasks();
  }, []);

  // 监听 Agent 数据变更，刷新所有相关面板
  useEffect(() => {
    const handleAgentDataChanged = (event: Event) => {
      if (eventAffectsDomains(event, ['tasks'])) {
        loadTasks();
        setTaskRefreshTrigger(prev => prev + 1);
      }

      if (eventAffectsDomains(event, ['dayStart'])) {
        setDayStartRefreshTrigger(prev => prev + 1);
      }

      if (eventAffectsDomains(event, ['study'])) {
        loadTodayStats();
      }

      if (eventAffectsDomains(event, ['pomodoro'])) {
        pomodoroTimerRef.current?.refreshSession();
      }
    };
    window.addEventListener(AGENT_DATA_CHANGED_EVENT, handleAgentDataChanged);
    return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handleAgentDataChanged);
  }, []);

  // 实时时间更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 学习时长相关函数
  const formatStudyTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}分钟`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
    }
  };

  const addStudyTime = async (minutes: number) => {
    try {
      // 保存到数据库
      const response = await studyAPI.createStudyRecord({
        duration: minutes,
        subject: '手动添加',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      // 重新加载今日数据，而不是简单累加
      await loadTodayStats();
      setLastAddedMinutes(minutes);
      setLastAddedRecordId(response.data.id);
      showUndoButton();
    } catch (error) {
      console.error('保存学习记录失败:', error);
      alert('保存学习记录失败，请重试');
    }
  };

  const handleCustomTimeAdd = () => {
    const minutes = parseInt(customMinutes);
    if (minutes > 0 && minutes <= 600) { // 限制最大10小时
      addStudyTime(minutes);
      setCustomMinutes('');
      setShowTimeInput(false);
    } else if (minutes > 600) {
      alert('单次学习时长不能超过10小时，请分次记录');
    }
  };

  const showUndoButton = () => {
    // 清除之前的定时器（如果存在）
    if ((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer) {
      clearInterval((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer);
    }

    setShowUndo(true);
    setUndoCountdown(10);

    // 开始倒计时
    (window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) {
          clearInterval((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer!);
          setShowUndo(false);
          setLastAddedMinutes(0);
          setLastAddedRecordId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleUndo = async () => {
    if (lastAddedMinutes > 0 && lastAddedRecordId) {
      try {
        // 从数据库中删除记录
        await studyAPI.deleteStudyRecord(lastAddedRecordId);

        // 重新加载今日数据
        await loadTodayStats();

        // 清除定时器和状态
        if ((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer) {
          clearInterval((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer);
        }
        setShowUndo(false);
        setLastAddedMinutes(0);
        setLastAddedRecordId(null);
      } catch (error) {
        console.error('撤销学习记录失败:', error);
        alert('撤销失败，请重试');
      }
    }
  };



  // 清理定时器
  useEffect(() => {
    return () => {
      if ((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer) {
        clearInterval((window as typeof window & { undoTimer?: NodeJS.Timeout }).undoTimer);
      }
    };
  }, []);



  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深了';
    if (hour < 9) return 'Good morning';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 17) return '下午好';
    if (hour < 19) return '傍晚好';
    return 'Good evening';
  };

  // 时间格式化函数
  const formatCurrentTime = () => {
    return currentTime.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrentDate = () => {
    return currentTime.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric'
    }).replace(/\//g, '月').replace(/(\d+)$/, '$1日');
  };



  // 计算倒计时 - 使用新的目标管理系统
  const getTargetInfo = () => {
    // 首先检查是否有当前活跃的目标
    if (currentGoal) {
      const targetDate = currentGoal.targetDate;
      const goalName = currentGoal.goalName;

      let finalDate = null;
      const displayName = goalName || '';
      const hasTarget = true;

      if (targetDate) {
        finalDate = new Date(targetDate);
      }

      return { date: finalDate, name: displayName, hasTarget };
    }

    // 如果没有活跃目标，返回无目标状态
    return { date: null, name: '', hasTarget: false };
  };

  const { date: targetDate, name: targetName, hasTarget } = getTargetInfo();
  const daysLeft = hasTarget && targetDate ? Math.ceil((targetDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>

      {/* 顶部导航栏 */}
      <Navbar
        userName={user?.name || user?.email || 'User'}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />

      <div className="container" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
        {/* Hero 区域 - 极简欢迎卡片 */}
        <div className="card" style={{
          background: 'var(--bg-secondary)',
          marginBottom: '2rem',
          padding: '2rem',
          textAlign: 'center',
          borderTop: '3px solid var(--accent-primary)'
        }}>
          <div style={{ marginBottom: '1rem' }}>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {getGreeting()}, {user?.name || user?.email}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {formatCurrentDate()}
            </p>
          </div>

          <div style={{
            height: '1px',
            background: 'var(--border-color)',
            margin: '1rem 0'
          }} />

          {/* 快捷功能按钮 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            {[
              { label: '🌅 开启今日', action: () => { setDayReflectionMode('start'); setIsDayReflectionOpen(true); } },
              { label: '🌙 复盘', action: () => { setDayReflectionMode('reflection'); setIsDayReflectionOpen(true); } },
              { label: '📊 历史', action: () => setIsHistoryOpen(true) },
              { label: '📈 概况', action: () => router.push('/overview') }
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.action}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--border-radius)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'var(--accent-primary)';
                  (e.target as HTMLElement).style.color = '#ffffff';
                  (e.target as HTMLElement).style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = 'var(--bg-tertiary)';
                  (e.target as HTMLElement).style.color = 'var(--text-primary)';
                  (e.target as HTMLElement).style.borderColor = 'var(--border-color)';
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* 三栏布局 */}
        <div className="dashboard-layout">
          {/* 左列：倒计时、学习时长和番茄时钟 */}
          <div className="dashboard-left">
            {/* 时间信息卡片 */}
            <div className="card" style={{
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: 'white'
            }}>
              <h2 className="text-xl font-semibold mb-4">
                {hasTarget ? (targetName ? `${targetName}倒计时` : '倒计时') : '时间信息'}
              </h2>

              {hasTarget ? (
                // 有目标时显示完整的倒计时信息
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatCurrentTime()}</div>
                    <div className="text-sm opacity-80">当前时间</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{daysLeft}天</div>
                    <div className="text-sm opacity-80">倒计时</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatCurrentDate()}</div>
                    <div className="text-sm opacity-80">当前日期</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {targetDate?.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                    </div>
                    <div className="text-sm opacity-80">目标日期</div>
                  </div>
                </div>
              ) : (
                // 没有目标时只显示当前时间和日期
                <div className="grid grid-cols-1 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{formatCurrentTime()}</div>
                    <div className="text-sm opacity-80">当前时间</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{formatCurrentDate()}</div>
                    <div className="text-sm opacity-80">当前日期</div>
                  </div>
                </div>
              )}
            </div>

            {/* 学习统计卡片 */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <span style={{ fontSize: '1.25rem' }}>📚</span>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>学习时长</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {formatStudyTime(studyTime)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>今日学习</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {pomodoroCount}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>番茄钟</div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>今日进度</span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {Math.round((studyTime / 360) * 100)}%
                </span>
              </div>

              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min((studyTime / 360) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: 'var(--accent-primary)',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                目标：6小时
              </div>

              {/* 添加时长按钮或输入框 */}
              {!showTimeInput ? (
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '1rem' }}
                  onClick={() => setShowTimeInput(true)}
                >
                  <span>+</span>
                  <span>添加时长</span>
                </button>
              ) : (
                <div style={{ marginTop: '1rem' }}>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      placeholder="输入分钟数"
                      min="1"
                      max="600"
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCustomTimeAdd();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleCustomTimeAdd}
                      disabled={!customMinutes || parseInt(customMinutes) <= 0}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      添加
                    </button>
                  </div>
                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', fontSize: '0.875rem' }}
                    onClick={() => {
                      setShowTimeInput(false);
                      setCustomMinutes('');
                    }}
                  >
                    取消
                  </button>
                </div>
              )}

              {/* 撤销按钮 */}
              {showUndo && (
                <div style={{ marginTop: '1rem' }}>
                  <button
                    className="btn"
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--warning-color)',
                      color: 'white',
                      fontSize: '0.875rem'
                    }}
                    onClick={handleUndo}
                  >
                    撤销 ({undoCountdown}s)
                  </button>
                </div>
              )}
            </div>

            {/* 番茄时钟卡片 */}
            <PomodoroTimer
              ref={pomodoroTimerRef}
              tasks={tasks}
              currentBoundTask={currentBoundTask}
              studyTime={studyTime}
              pomodoroCount={pomodoroCount}
              theme={theme}
              startCountUpTrigger={startCountUpMode}
              onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              onTaskBind={(taskId) => {
                setCurrentBoundTask(taskId);
                // console.log('🔗 任务绑定:', taskId);
              }}
              onRunningStateChange={(isRunning) => {
                setIsPomodoroRunning(isRunning);
                // console.log('🍅 番茄钟运行状态:', isRunning);
              }}
              onElapsedTimeChange={(elapsedTime) => {
                setPomodoroElapsedTime(elapsedTime);
              }}
              onPomodoroComplete={() => {
                // 番茄钟完成后重新加载今日数据和任务列表
                loadTodayStats();
                loadTasks();
                // 触发任务列表刷新
                setPomodoroCompleteRefreshTrigger(prev => prev + 1);
              }}
              onEnterFocusMode={() => {
                // 进入专注模式的处理逻辑
                // console.log('进入专注模式');
              }}
            />
          </div>

          {/* 中列：重要信息和待办任务 */}
          <div className="dashboard-center">
            {/* 重要信息卡片 */}
            <ImportantInfo theme={theme} />

            <PendingTasks
              onTaskClick={handleTaskClick}
              onStartCountUp={handleStartCountUp}
              currentBoundTask={currentBoundTask}
              isRunning={isPomodoroRunning}
              dayStartRefreshTrigger={dayStartRefreshTrigger}
              pomodoroCompleteRefreshTrigger={pomodoroCompleteRefreshTrigger}
              onCompleteTaskWithPomodoro={handleCompleteTaskWithPomodoro}
              onCompleteTaskCancelPomodoro={handleCompleteTaskCancelPomodoro}
              pomodoroElapsedTime={pomodoroElapsedTime}
              taskRefreshTrigger={taskRefreshTrigger}
              onUpdatePomodoroTaskId={handleUpdatePomodoroTaskId}
              onTaskAdded={handleTaskAdded}
            />


          </div>

          {/* 右列：统计信息 */}
          <div className="dashboard-right">
            {/* 运动统计卡片 */}
            <ExerciseStats theme={theme} />

            {/* 消费统计卡片 */}
            <ExpenseStats theme={theme} />
          </div>
        </div>
      </div>

      {/* 底部备案信息 */}
      <footer style={{
        marginTop: '3rem',
        padding: '1.5rem 0',
        borderTop: '1px solid var(--border-color)'
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem'
        }}>
          {/* 备案信息 */}
          <div style={{
            marginTop: '2rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            {/* ICP备案 */}
            <div style={{ marginBottom: '0.5rem' }}>
              <a
                href="https://beian.miit.gov.cn"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  textDecoration: 'none',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'color 0.2s ease'
                }}
                onMouseOver={(e) => {
                  (e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)';
                }}
                onMouseOut={(e) => {
                  (e.target as HTMLAnchorElement).style.color = 'var(--text-muted)';
                }}
              >
                粤ICP备2025456526号-1
              </a>
            </div>

            {/* 公安备案 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem'
            }}>
              <Image
                src="/beian-icon.png"
                alt="备案图标"
                width={14}
                height={14}
                style={{
                  opacity: 0.6
                }}
              />
              <a
                href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784"
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  textDecoration: 'none',
                  transition: 'color 0.2s ease'
                }}
                onMouseOver={(e) => {
                  (e.target as HTMLAnchorElement).style.color = 'var(--text-secondary)';
                }}
                onMouseOut={(e) => {
                  (e.target as HTMLAnchorElement).style.color = 'var(--text-muted)';
                }}
              >
                粤公网安备44030002007784号
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* 历史查看器 */}
      <HistoryViewer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* 修改密码表单 */}
      {isChangePasswordOpen && (
        <ChangePasswordForm
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={() => {
            // 密码修改成功后的处理
            console.log('密码修改成功');
          }}
        />
      )}

      {/* 开启和复盘组件 */}
      {isDayReflectionOpen && (
        <DayReflection
          mode={dayReflectionMode}
          onClose={() => setIsDayReflectionOpen(false)}
          onSave={() => {
            // 触发开启内容刷新
            setDayStartRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {/* 系统建议浮动按钮 */}
      <SystemSuggestion />

      {/* AI 助手浮动聊天面板 */}
      <AgentChatPanel />

    </div>
  );
}
