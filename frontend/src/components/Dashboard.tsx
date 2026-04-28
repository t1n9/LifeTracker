'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  CalendarClock, History, LayoutDashboard,
  Moon, Settings2, Sun, Sunrise, Sunset,
} from 'lucide-react';
import { userAPI, studyAPI, taskAPI } from '@/lib/api';
import { AGENT_DATA_CHANGED_EVENT, eventAffectsDomains } from '@/lib/agent-events';
import { goalService, UserGoal } from '../services/goalService';
import DayReflection from './daily/DayReflection';
import HistoryViewer from './HistoryViewer';
import PomodoroTimer, { PomodoroTimerRef } from './PomodoroTimer';
import PendingTasks from './PendingTasks';
import AgentChatPanel from './AgentChatPanel';
import StudyPlanSidebar, { StudyPlanSidebarRef } from './StudyPlanSidebar';
import QuickStatsHover from './QuickStatsHover';
import '../styles/theme.css';
import styles from './DashboardBoard.module.css';

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

const DAILY_GOAL_MINUTES = 360;

export default function Dashboard() {
  const router = useRouter();
  const pomodoroTimerRef = useRef<PomodoroTimerRef>(null);
  const studyPlanSidebarRef = useRef<StudyPlanSidebarRef>(null);

  const [user, setUser] = useState<DashboardUser | null>(null);
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [isDayReflectionOpen, setIsDayReflectionOpen] = useState(false);
  const [dayReflectionMode, setDayReflectionMode] = useState<'start' | 'reflection'>('start');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [dayStarted, setDayStarted] = useState(false);

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
  const [viewportWidth, setViewportWidth] = useState(1440);

  // ── 数据加载 ──────────────────────────────────────────────────────

  const loadUserData = async () => {
    try {
      const res = await userAPI.getProfile();
      setUser(res.data);
    } catch {}
  };

  const loadTodayStats = async () => {
    try {
      const res = await studyAPI.getTodayStats();
      setStudyTime(res.data.totalMinutes);
      setPomodoroCount(res.data.pomodoroCount);
    } catch {}
  };

  const loadCurrentGoal = async () => {
    try {
      const goal = await goalService.getCurrentGoal();
      setCurrentGoal(goal);
    } catch {}
  };

  const loadTasks = async () => {
    try {
      const res = await taskAPI.getTasks();
      const loaded = res.data.map((t: DashboardTask) => ({
        id: t.id, title: t.title, isCompleted: t.isCompleted,
        pomodoroCount: t.pomodoroCount || 0, description: t.description, priority: t.priority,
      }));
      setTasks(loaded);
      if (loaded.length > 0) setDayStarted(true);
    } catch {}
  };

  const handleThemeToggle = async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { await userAPI.updateTheme(next); } catch { setTheme(theme); }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    theme === 'dark'
      ? document.documentElement.classList.add('dark')
      : document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    if (user?.theme) setTheme(user.theme === 'dark' ? 'dark' : 'light');
  }, [user?.theme]);

  useEffect(() => {
    loadUserData();
    loadCurrentGoal();
    loadTodayStats();
    loadTasks();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      if (eventAffectsDomains(event, ['tasks'])) { loadTasks(); setTaskRefreshTrigger(n => n + 1); }
      if (eventAffectsDomains(event, ['dayStart'])) setDayStartRefreshTrigger(n => n + 1);
      if (eventAffectsDomains(event, ['study'])) loadTodayStats();
      if (eventAffectsDomains(event, ['pomodoro'])) pomodoroTimerRef.current?.refreshSession();
    };
    window.addEventListener(AGENT_DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  // ── 任务 & 番茄交互 ───────────────────────────────────────────────

  const handleTaskClick = (taskId: string, taskTitle: string) => {
    if (isPomodoroRunning) { alert('番茄钟运行中，暂时不能切换绑定任务'); return; }
    setCurrentBoundTask(cur => cur === taskId ? null : taskId);
    console.log('Bind task:', taskTitle, taskId);
  };

  const handleStartCountUp = (taskId: string, taskTitle: string) => {
    if (isPomodoroRunning) { alert('番茄钟运行中，请先结束当前会话'); return; }
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
      setTaskRefreshTrigger(n => n + 1);
      loadTodayStats();
    } catch { alert('完成任务失败，请重试'); }
  };

  const handleCompleteTaskCancelPomodoro = async (taskId: string) => {
    try {
      await taskAPI.updateTask(taskId, { isCompleted: true });
      pomodoroTimerRef.current?.cancelCurrentSession();
      setIsPomodoroRunning(false);
      setCurrentBoundTask(null);
      setPomodoroElapsedTime(0);
      setTaskRefreshTrigger(n => n + 1);
      loadTodayStats();
    } catch { alert('完成任务失败，请重试'); }
  };

  const handleUpdatePomodoroTaskId = (oldId: string, newId: string) => {
    pomodoroTimerRef.current?.updateBoundTaskId(oldId, newId);
    if (currentBoundTask === oldId) setCurrentBoundTask(newId);
  };

  // ── 派生数据 ──────────────────────────────────────────────────────

  const hh = currentTime.getHours().toString().padStart(2, '0');
  const mm = currentTime.getMinutes().toString().padStart(2, '0');
  const ss = currentTime.getSeconds().toString().padStart(2, '0');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const wd = weekdays[currentTime.getDay()];
  const md = `${currentTime.getMonth() + 1}月${currentTime.getDate()}日`;

  const goalSummary = useMemo(() => {
    if (!currentGoal) return { title: '暂无目标', daysLeft: null as number | null };
    const d = currentGoal.targetDate ? new Date(currentGoal.targetDate) : null;
    const daysLeft = d ? Math.ceil((d.getTime() - Date.now()) / 86400000) : null;
    return { title: currentGoal.goalName || '当前目标', daysLeft };
  }, [currentGoal]);

  const pendingCount = useMemo(() => tasks.filter(t => !t.isCompleted).length, [tasks]);
  const completedCount = useMemo(() => tasks.filter(t => t.isCompleted).length, [tasks]);
  const totalCount = completedCount + pendingCount;
  const isTabletOrBelow = viewportWidth <= 900;
  const isMobile = viewportWidth <= 600;

  const focusH = Math.floor(studyTime / 60);
  const focusM = String(studyTime % 60).padStart(2, '0');

  // ── 渲染 ──────────────────────────────────────────────────────────

  return (
    <div className={styles.board}>

      {/* ── 顶栏 ── */}
      <header className={styles.topbar}>

        {/* 品牌 */}
        <div className={styles.brand}>
          <span className={styles.brandDot} />
          LifeTracker
        </div>

        {/* 状态分段 */}
        <div className={styles.statusStrip}>
          {/* 时钟 */}
          <div className={styles.seg}>
            <span className={styles.clock}>
              {hh}<span style={{ color: 'var(--fg-3)', fontWeight: 300 }}>:</span>{mm}
              <span className={styles.clockSec}> :{ss}</span>
            </span>
          </div>

          {/* 日期 */}
          <div className={styles.seg}>
            <span className={styles.segLabel}>今天</span>
            <span className={styles.segVal}>{md} · {wd}</span>
          </div>

          {/* 目标 */}
          {currentGoal && (
            <div className={styles.seg}>
              <span className={styles.segLabel}>目标</span>
              <span className={styles.segVal}>{goalSummary.title}</span>
              {goalSummary.daysLeft !== null && (
                <span className={styles.goalPill}>
                  <span className={styles.goalDays}>{goalSummary.daysLeft}</span>
                </span>
              )}
            </div>
          )}

          {/* 今日统计（开启后显示） */}
          {dayStarted && (
            <>
              <div className={styles.seg}>
                <span className={styles.segLabel}>番茄</span>
                <span className={styles.segValMono}>{pomodoroCount}</span>
              </div>
              <div className={styles.seg}>
                <span className={styles.segLabel}>专注</span>
                <span className={styles.segValMono}>{focusH}h {focusM}m</span>
              </div>
              {isPomodoroRunning && (
                <div className={styles.seg} style={{ color: 'var(--danger)' }}>
                  <span className={styles.liveDot} />
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>FOCUSING</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 右侧工具 */}
        <div className={styles.rightTools}>
          <button
            className={styles.iconBtn}
            title="开启今日"
            onClick={() => { setDayReflectionMode('start'); setIsDayReflectionOpen(true); }}
          >
            <Sunrise size={14} />
          </button>

          <button className={styles.iconBtn} title="今日总结"
            onClick={() => { setDayReflectionMode('reflection'); setIsDayReflectionOpen(true); }}>
            <Sunset size={16} />
          </button>

          <button className={styles.iconBtn} title="学习计划"
            onClick={() => studyPlanSidebarRef.current?.open()}>
            <CalendarClock size={16} />
          </button>

          <button className={styles.iconBtn} title="历史记录"
            onClick={() => setIsHistoryOpen(true)}>
            <History size={16} />
          </button>

          <button className={styles.iconBtn} title="学习概览"
            onClick={() => router.push('/overview')}>
            <LayoutDashboard size={16} />
          </button>

          <button className={styles.iconBtn} title="设置"
            onClick={() => router.push('/profile')}>
            <Settings2 size={16} />
          </button>

          <span className={styles.toolDivider} />

          <QuickStatsHover />

          <span className={styles.toolDivider} />

          <button className={styles.iconBtn} title="切换主题" onClick={handleThemeToggle}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* ── 三列主区 ── */}
      <div className={styles.columns}>

        {/* 左列：任务列表 */}
        <div className={styles.colLeft}>
          <div className={styles.taskWrap}>
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
              onTaskAdded={loadTasks}
            />
          </div>
        </div>

        {/* 中列：番茄钟 */}
        <div className={styles.colMid}>
          <div className={styles.centerBody}>
            <div className={styles.centerHeader}>
              <div className={styles.centerTitleWrap}>
                <span className={styles.centerTitle}>专注计时</span>
              </div>
              <span className={styles.centerMeta}>
                {currentBoundTask ? '已绑定任务' : '未绑定任务'}
              </span>
            </div>
            <div className={styles.pomodoroWrap}>
              <PomodoroTimer
                ref={pomodoroTimerRef}
                tasks={tasks}
                currentBoundTask={currentBoundTask}
                compactMode={isMobile}
                hideHeader
                studyTime={studyTime}
                pomodoroCount={pomodoroCount}
                theme={theme}
                startCountUpTrigger={startCountUpMode}
                onToggleTheme={handleThemeToggle}
                onTaskBind={id => setCurrentBoundTask(id)}
                onRunningStateChange={setIsPomodoroRunning}
                onElapsedTimeChange={setPomodoroElapsedTime}
                onPomodoroComplete={() => {
                  loadTodayStats();
                  loadTasks();
                  setPomodoroCompleteRefreshTrigger(n => n + 1);
                }}
                onEnterFocusMode={() => undefined}
              />
            </div>
          </div>
        </div>

        {/* 右列：AI 陪伴 */}
        {!isTabletOrBelow && (
          <div className={styles.aiCol}>
            <AgentChatPanel inline />
          </div>
        )}

      </div>

      {isTabletOrBelow && <AgentChatPanel />}

      {/* ── 弹窗 ── */}
      <HistoryViewer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />

      {isDayReflectionOpen && (
        <DayReflection
          mode={dayReflectionMode}
          onClose={() => setIsDayReflectionOpen(false)}
          onSave={() => { setDayStartRefreshTrigger(n => n + 1); setDayStarted(true); }}
        />
      )}
      <StudyPlanSidebar ref={studyPlanSidebarRef} showFloatingTrigger={false} />

      {/* 备案 */}
      {!isTabletOrBelow && (
      <footer className={styles.footer} style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 16,
        padding: '4px 16px', fontSize: 11,
        color: 'var(--fg-4)', pointerEvents: 'none',
        background: 'transparent',
      }}>
        <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'none', pointerEvents: 'auto', opacity: 0.5 }}>
          粤ICP备2025456526号-1
        </a>
        <a href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784"
          target="_blank" rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'none', pointerEvents: 'auto', opacity: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Image src="/beian-icon.png" alt="备案" width={11} height={11} />
          粤公网安备44030002007784号
        </a>
      </footer>
      )}
    </div>
  );
}
