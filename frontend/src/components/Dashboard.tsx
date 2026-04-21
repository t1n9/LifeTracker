'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, BookOpenText, History, LayoutDashboard, PlayCircle, Target, TimerReset } from 'lucide-react';
import { userAPI, studyAPI, taskAPI } from '@/lib/api';
import { AGENT_DATA_CHANGED_EVENT, eventAffectsDomains } from '@/lib/agent-events';
import { goalService, UserGoal } from '../services/goalService';
import DayReflection from './daily/DayReflection';
import HistoryViewer from './HistoryViewer';
import PomodoroTimer, { PomodoroTimerRef } from './PomodoroTimer';
import PendingTasks from './PendingTasks';
import ImportantInfo from './ImportantInfo';
import ExerciseStats from './ExerciseStats';
import ExpenseStats from './ExpenseStats';
import SystemSuggestion from './SystemSuggestion';
import AgentChatPanel from './AgentChatPanel';
import Navbar from './layout/Navbar';
import '../styles/theme.css';
import styles from './Dashboard.module.css';

interface DashboardUser {
  name?: string;
  email?: string;
  theme?: 'light' | 'dark';
}

interface DashboardTask {
  id: string;
  title: string;
  isCompleted: boolean;
  pomodoroCount?: number;
  description?: string;
  priority?: number;
}

const DEFAULT_DAILY_GOAL_MINUTES = 360;

export default function Dashboard() {
  const router = useRouter();
  const pomodoroTimerRef = useRef<PomodoroTimerRef>(null);

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isDayReflectionOpen, setIsDayReflectionOpen] = useState(false);
  const [dayReflectionMode, setDayReflectionMode] = useState<'start' | 'reflection'>('start');
  const [dayStartRefreshTrigger, setDayStartRefreshTrigger] = useState(0);
  const [pomodoroCompleteRefreshTrigger, setPomodoroCompleteRefreshTrigger] = useState(0);
  const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0);

  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [currentBoundTask, setCurrentBoundTask] = useState<string | null>(null);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [startCountUpMode, setStartCountUpMode] = useState<{ taskId: string; taskTitle: string } | null>(null);
  const [pomodoroElapsedTime, setPomodoroElapsedTime] = useState(0);

  const [studyTime, setStudyTime] = useState(0);
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [showUndo, setShowUndo] = useState(false);
  const [undoCountdown, setUndoCountdown] = useState(10);
  const [lastAddedMinutes, setLastAddedMinutes] = useState(0);
  const [lastAddedRecordId, setLastAddedRecordId] = useState<string | null>(null);

  const loadUserData = async () => {
    try {
      const response = await userAPI.getProfile();
      setUser(response.data);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const loadTodayStats = async () => {
    try {
      const response = await studyAPI.getTodayStats();
      setStudyTime(response.data.totalMinutes);
      setPomodoroCount(response.data.pomodoroCount);
    } catch (error) {
      console.error('Failed to load today stats:', error);
    }
  };

  const loadCurrentGoal = async () => {
    try {
      const goal = await goalService.getCurrentGoal();
      setCurrentGoal(goal);
    } catch (error) {
      console.error('Failed to load current goal:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const response = await taskAPI.getTasks();
      const taskList = response.data.map((task: DashboardTask) => ({
        id: task.id,
        title: task.title,
        isCompleted: task.isCompleted,
        pomodoroCount: task.pomodoroCount || 0,
        description: task.description,
        priority: task.priority,
      }));
      setTasks(taskList);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleThemeToggle = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);

    try {
      await userAPI.updateTheme(nextTheme);
    } catch (error) {
      console.error('Failed to update theme:', error);
      setTheme(theme);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (user?.theme) {
      setTheme(user.theme === 'dark' ? 'dark' : 'light');
    }
  }, [user?.theme]);

  useEffect(() => {
    loadUserData();
    loadCurrentGoal();
    loadTodayStats();
    loadTasks();
  }, []);

  useEffect(() => {
    const handleAgentDataChanged = (event: Event) => {
      if (eventAffectsDomains(event, ['tasks'])) {
        loadTasks();
        setTaskRefreshTrigger((current) => current + 1);
      }

      if (eventAffectsDomains(event, ['dayStart'])) {
        setDayStartRefreshTrigger((current) => current + 1);
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      const globalWindow = window as typeof window & { undoTimer?: NodeJS.Timeout };
      if (globalWindow.undoTimer) {
        clearInterval(globalWindow.undoTimer);
      }
    };
  }, []);

  const showUndoButton = () => {
    const globalWindow = window as typeof window & { undoTimer?: NodeJS.Timeout };

    if (globalWindow.undoTimer) {
      clearInterval(globalWindow.undoTimer);
    }

    setShowUndo(true);
    setUndoCountdown(10);

    globalWindow.undoTimer = setInterval(() => {
      setUndoCountdown((current) => {
        if (current <= 1) {
          clearInterval(globalWindow.undoTimer);
          setShowUndo(false);
          setLastAddedMinutes(0);
          setLastAddedRecordId(null);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const addStudyTime = async (minutes: number) => {
    try {
      const response = await studyAPI.createStudyRecord({
        duration: minutes,
        subject: '手动添加',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      await loadTodayStats();
      setLastAddedMinutes(minutes);
      setLastAddedRecordId(response.data.id);
      showUndoButton();
    } catch (error) {
      console.error('Failed to create study record:', error);
      alert('保存学习记录失败，请重试');
    }
  };

  const handleCustomTimeAdd = () => {
    const minutes = Number.parseInt(customMinutes, 10);
    if (minutes > 0 && minutes <= 600) {
      addStudyTime(minutes);
      setCustomMinutes('');
      setShowTimeInput(false);
      return;
    }

    if (minutes > 600) {
      alert('单次学习时长不能超过 10 小时，请分次记录');
    }
  };

  const handleUndo = async () => {
    if (!lastAddedMinutes || !lastAddedRecordId) {
      return;
    }

    try {
      await studyAPI.deleteStudyRecord(lastAddedRecordId);
      await loadTodayStats();

      const globalWindow = window as typeof window & { undoTimer?: NodeJS.Timeout };
      if (globalWindow.undoTimer) {
        clearInterval(globalWindow.undoTimer);
      }

      setShowUndo(false);
      setLastAddedMinutes(0);
      setLastAddedRecordId(null);
    } catch (error) {
      console.error('Failed to undo study record:', error);
      alert('撤销失败，请重试');
    }
  };

  const handleTaskClick = (taskId: string, taskTitle: string) => {
    if (isPomodoroRunning) {
      alert('番茄钟运行中，暂时不能切换绑定任务');
      return;
    }

    setCurrentBoundTask((current) => (current === taskId ? null : taskId));
    console.log('Bind task toggle:', taskTitle, taskId);
  };

  const handleStartCountUp = (taskId: string, taskTitle: string) => {
    if (isPomodoroRunning) {
      alert('番茄钟运行中，请先结束当前会话');
      return;
    }

    setCurrentBoundTask(taskId);
    setStartCountUpMode({ taskId, taskTitle });
    setTimeout(() => setStartCountUpMode(null), 100);
  };

  const handleCompleteTaskWithPomodoro = async (taskId: string) => {
    try {
      await taskAPI.updateTask(taskId, { isCompleted: true });
      pomodoroTimerRef.current?.completeCurrentSession();
      setIsPomodoroRunning(false);
      setCurrentBoundTask(null);
      setPomodoroElapsedTime(0);
      setTaskRefreshTrigger((current) => current + 1);
      loadTodayStats();
    } catch (error) {
      console.error('Failed to complete task with pomodoro:', error);
      alert('完成任务失败，请重试');
    }
  };

  const handleCompleteTaskCancelPomodoro = async (taskId: string) => {
    try {
      await taskAPI.updateTask(taskId, { isCompleted: true });
      pomodoroTimerRef.current?.cancelCurrentSession();
      setIsPomodoroRunning(false);
      setCurrentBoundTask(null);
      setPomodoroElapsedTime(0);
      setTaskRefreshTrigger((current) => current + 1);
      loadTodayStats();
    } catch (error) {
      console.error('Failed to complete task and cancel pomodoro:', error);
      alert('完成任务失败，请重试');
    }
  };

  const handleUpdatePomodoroTaskId = (oldId: string, newId: string) => {
    pomodoroTimerRef.current?.updateBoundTaskId(oldId, newId);
    if (currentBoundTask === oldId) {
      setCurrentBoundTask(newId);
    }
  };

  const handleTaskAdded = () => {
    loadTasks();
  };

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour < 6) return '夜深了';
    if (hour < 9) return '早上好';
    if (hour < 12) return '上午好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }, [currentTime]);

  const todayLabel = useMemo(
    () =>
      currentTime.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
    [currentTime],
  );

  const timeLabel = useMemo(
    () =>
      currentTime.toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }),
    [currentTime],
  );

  const pendingTasksCount = useMemo(() => tasks.filter((task) => !task.isCompleted).length, [tasks]);
  const completedTasksCount = useMemo(() => tasks.filter((task) => task.isCompleted).length, [tasks]);
  const progressPercent = Math.min(Math.round((studyTime / DEFAULT_DAILY_GOAL_MINUTES) * 100), 100);

  const goalSummary = useMemo(() => {
    if (!currentGoal) {
      return {
        title: '还没有设置当前目标',
        subtitle: '去个人资料页设置一个长期目标，首页会自动显示倒计时。',
        daysLeft: null as number | null,
        targetDateLabel: '未设置',
      };
    }

    const targetDate = currentGoal.targetDate ? new Date(currentGoal.targetDate) : null;
    const daysLeft =
      targetDate !== null
        ? Math.ceil((targetDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    return {
      title: currentGoal.goalName || '当前目标',
      subtitle: currentGoal.description || '保持节奏，逐步推进。',
      daysLeft,
      targetDateLabel: targetDate
        ? targetDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
        : '未设置日期',
    };
  }, [currentGoal, currentTime]);

  const quickActions = [
    {
      label: '开启今天',
      icon: <PlayCircle size={16} />,
      variant: 'primary' as const,
      action: () => {
        setDayReflectionMode('start');
        setIsDayReflectionOpen(true);
      },
    },
    {
      label: '今日复盘',
      icon: <BookOpenText size={16} />,
      variant: 'secondary' as const,
      action: () => {
        setDayReflectionMode('reflection');
        setIsDayReflectionOpen(true);
      },
    },
    {
      label: '历史记录',
      icon: <History size={16} />,
      variant: 'secondary' as const,
      action: () => setIsHistoryOpen(true),
    },
    {
      label: '数据概览',
      icon: <LayoutDashboard size={16} />,
      variant: 'secondary' as const,
      action: () => router.push('/overview'),
    },
  ];

  return (
    <div className={styles.page}>
      <Navbar userName={user?.name || user?.email || 'User'} theme={theme} onThemeToggle={handleThemeToggle} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              <span>Today workspace</span>
            </div>
            <p className={styles.heroEyebrow}>{todayLabel}</p>
            <h1 className={styles.heroTitle}>
              {greeting}，{user?.name || user?.email || '今天继续推进'}。
            </h1>
            <p className={styles.heroDescription}>
              首页先展示真正影响你今天节奏的东西：当前目标、任务推进、番茄钟和每日记录。
            </p>

            <div className={styles.quickActions}>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={action.variant === 'primary' ? styles.primaryAction : styles.secondaryAction}
                  onClick={action.action}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.heroMetrics}>
            <div className={`${styles.metricCard} ${styles.metricCardAccent}`}>
              <div className={styles.metricLabel}>当前目标</div>
              <div className={styles.metricValue}>{goalSummary.title}</div>
              <div className={styles.metricMeta}>{goalSummary.subtitle}</div>
              <div className={styles.goalFooter}>
                <span className={styles.goalDate}>{goalSummary.targetDateLabel}</span>
                <span className={styles.goalCountdown}>
                  {goalSummary.daysLeft === null ? '待设置' : `${goalSummary.daysLeft} 天`}
                </span>
              </div>
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>当前时间</div>
                <div className={styles.metricValue}>{timeLabel}</div>
                <div className={styles.metricMeta}>保持今天的推进节奏</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>今日专注</div>
                <div className={styles.metricValue}>{pomodoroCount}</div>
                <div className={styles.metricMeta}>已完成番茄钟</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>待办任务</div>
                <div className={styles.metricValue}>{pendingTasksCount}</div>
                <div className={styles.metricMeta}>{completedTasksCount} 项已完成</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>学习时长</div>
                <div className={styles.metricValue}>{formatStudyTime(studyTime)}</div>
                <div className={styles.metricMeta}>目标 {DEFAULT_DAILY_GOAL_MINUTES / 60} 小时</div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.focusArea}>
          <div className={styles.primaryColumn}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Today focus</p>
                <h2 className={styles.sectionTitle}>任务与专注</h2>
              </div>
              <button type="button" className={styles.inlineLink} onClick={() => router.push('/overview')}>
                <span>查看更完整的数据概览</span>
                <ArrowRight size={16} />
              </button>
            </div>

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

            <PomodoroTimer
              ref={pomodoroTimerRef}
              tasks={tasks}
              currentBoundTask={currentBoundTask}
              studyTime={studyTime}
              pomodoroCount={pomodoroCount}
              theme={theme}
              startCountUpTrigger={startCountUpMode}
              onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              onTaskBind={(taskId) => setCurrentBoundTask(taskId)}
              onRunningStateChange={(isRunning) => setIsPomodoroRunning(isRunning)}
              onElapsedTimeChange={(elapsedTime) => setPomodoroElapsedTime(elapsedTime)}
              onPomodoroComplete={() => {
                loadTodayStats();
                loadTasks();
                setPomodoroCompleteRefreshTrigger((current) => current + 1);
              }}
              onEnterFocusMode={() => undefined}
            />
          </div>

          <aside className={styles.secondaryColumn}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Daily system</p>
                <h2 className={styles.sectionTitle}>记录与反馈</h2>
              </div>
            </div>

            <div className={styles.studyCard}>
              <div className={styles.studyHeader}>
                <div>
                  <p className={styles.studyEyebrow}>Manual log</p>
                  <h3 className={styles.studyTitle}>今日学习推进</h3>
                </div>
                <div className={styles.studyBadge}>
                  <Target size={14} />
                  <span>{progressPercent}%</span>
                </div>
              </div>

              <div className={styles.studyNumbers}>
                <div>
                  <span className={styles.studyNumberLabel}>累计时长</span>
                  <strong className={styles.studyNumberValue}>{formatStudyTime(studyTime)}</strong>
                </div>
                <div>
                  <span className={styles.studyNumberLabel}>专注次数</span>
                  <strong className={styles.studyNumberValue}>{pomodoroCount}</strong>
                </div>
              </div>

              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
              </div>

              <p className={styles.progressCaption}>
                默认目标 {DEFAULT_DAILY_GOAL_MINUTES / 60} 小时。你也可以手动补录今天的学习时长。
              </p>

              {!showTimeInput ? (
                <button type="button" className={styles.secondaryAction} onClick={() => setShowTimeInput(true)}>
                  <TimerReset size={16} />
                  <span>补录学习时长</span>
                </button>
              ) : (
                <div className={styles.manualEntry}>
                  <div className={styles.manualInputRow}>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="600"
                      value={customMinutes}
                      onChange={(event) => setCustomMinutes(event.target.value)}
                      placeholder="输入分钟数"
                      className={styles.manualInput}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          handleCustomTimeAdd();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={styles.primaryAction}
                      disabled={!customMinutes || Number.parseInt(customMinutes, 10) <= 0}
                      onClick={handleCustomTimeAdd}
                    >
                      保存
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.textAction}
                    onClick={() => {
                      setShowTimeInput(false);
                      setCustomMinutes('');
                    }}
                  >
                    取消
                  </button>
                </div>
              )}

              {showUndo && (
                <button type="button" className={styles.undoButton} onClick={handleUndo}>
                  撤销刚才的补录（{undoCountdown}s）
                </button>
              )}
            </div>

            <ImportantInfo theme={theme} />
            <ExerciseStats theme={theme} />
            <ExpenseStats theme={theme} />
          </aside>
        </section>
      </main>

      <footer className={styles.footer}>
  <div>
    <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">
      粤ICP备2025456526号-1
    </a>
  </div>
  <div>
    <a
      href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784"
      target="_blank"
      rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
    >
      <Image src="/beian-icon.png" alt="备案图标" width={14} height={14} />
      粤公网安备44030002007784号
    </a>
  </div>
</footer>

      <HistoryViewer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

      {isDayReflectionOpen && (
        <DayReflection
          mode={dayReflectionMode}
          onClose={() => setIsDayReflectionOpen(false)}
          onSave={() => setDayStartRefreshTrigger((current) => current + 1)}
        />
      )}

      <SystemSuggestion />
      <AgentChatPanel />
    </div>
  );
}

function formatStudyTime(minutes: number) {
  if (minutes < 60) {
    return `${minutes} 分钟`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`;
}

