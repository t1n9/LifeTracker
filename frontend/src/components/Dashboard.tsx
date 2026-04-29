'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  CalendarClock, History, LayoutDashboard,
  Moon, Settings2, Sun, X,
} from 'lucide-react';
import { userAPI, studyAPI, taskAPI, dailyAPI } from '@/lib/api';
import { AGENT_DATA_CHANGED_EVENT, eventAffectsDomains, PROACTIVE_TRIGGER_EVENT } from '@/lib/agent-events';
import { goalService, UserGoal } from '../services/goalService';
import HistoryViewer from './HistoryViewer';
import PomodoroTimer, { PomodoroTimerRef } from './PomodoroTimer';
import PendingTasks from './PendingTasks';
import AgentChatPanel from './AgentChatPanel';
import StudyPlanSidebar, { StudyPlanSidebarRef } from './StudyPlanSidebar';
import QuickStatsHover, { QuickStatsInline } from './QuickStatsHover';
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

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [dayStarted, setDayStarted] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);

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

  // ── 晨间流检测：若无 dayStart 则发送 morning 主动推送（每天只发一次） ──
  useEffect(() => {
    let cancelled = false;
    const checkDayStart = async () => {
      try {
        const res = await dailyAPI.getTodayStatus();
        const hasDayStart = res.data?.dayStart;
        if (cancelled || hasDayStart) return;

        // 当天已发送过则跳过，避免页面切换回来重复问候
        const today = new Date().toISOString().slice(0, 10);
        const lastSent = localStorage.getItem('proactive_morning_date');
        if (lastSent === today) return;

        localStorage.setItem('proactive_morning_date', today);
        window.dispatchEvent(
          new CustomEvent(PROACTIVE_TRIGGER_EVENT, {
            detail: { trigger: 'morning' },
          }),
        );
      } catch { /* 静默失败，不影响主流程 */ }
    };
    void checkDayStart();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      if (eventAffectsDomains(event, ['tasks'])) { loadTasks(); setTaskRefreshTrigger(n => n + 1); }
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

  // ── 专注模式 Escape 退出 ──
  useEffect(() => {
    if (!isFocusMode) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFocusMode(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isFocusMode]);

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
  const footerContent = (
    <>
      <a
        href="https://beian.miit.gov.cn"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'inherit', textDecoration: 'none', pointerEvents: 'auto', opacity: 0.5 }}
      >
        粤 ICP 备 2025456526 号-1
      </a>
      <a
        href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784"
        target="_blank"
        rel="noreferrer"
        style={{ color: 'inherit', textDecoration: 'none', pointerEvents: 'auto', opacity: 0.5, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <Image src="/beian-icon.png" alt="备案图标" width={11} height={11} />
        粤公网安备 44030002007784 号
      </a>
    </>
  );

  const focusH = Math.floor(studyTime / 60);
  const focusM = String(studyTime % 60).padStart(2, '0');

  // ── 渲染 ──────────────────────────────────────────────────────────

  return (
    <div className={`${styles.board}${isFocusMode ? ` ${styles.boardFocus}` : ''}`}>

      {/* ── 顶栏 ── */}
      <header className={styles.topbar}>

        {/* 第一行：品牌 + 状态（宽屏）+ 工具 */}
        <div className={styles.topbarRow1}>
          {/* 品牌 */}
          <div className={styles.brand}>
            <span className={styles.brandDot} />
            LifeTracker
          </div>

          {/* 状态分段（宽屏显示在第一行） */}
          <div className={styles.statusStrip}>
            <div className={styles.seg}>
              <span className={styles.clock}>
                {hh}<span style={{ color: 'var(--fg-3)', fontWeight: 300 }}>:</span>{mm}
                <span className={styles.clockSec}> :{ss}</span>
              </span>
            </div>
            <div className={styles.seg}>
              <span className={styles.segLabel}>今天</span>
              <span className={styles.segVal}>{md} · {wd}</span>
            </div>
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
            {!isMobile && <span className={styles.toolDivider} />}
            {!isMobile && <QuickStatsHover />}
            {!isMobile && <span className={styles.toolDivider} />}
            <button className={styles.iconBtn} title="切换主题" onClick={handleThemeToggle}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>

        {/* 第二行：窄屏时显示时钟 + 目标（对应中列位置） */}
        <div className={styles.topbarRow2}>
          <div className={styles.seg}>
            <span className={styles.clock}>
              {hh}<span style={{ color: 'var(--fg-3)', fontWeight: 300 }}>:</span>{mm}
              <span className={styles.clockSec}> :{ss}</span>
            </span>
          </div>
          <div className={styles.seg}>
            <span className={styles.segLabel}>今天</span>
            <span className={styles.segVal}>{md} · {wd}</span>
          </div>
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
          {dayStarted && isPomodoroRunning && (
            <div className={styles.seg} style={{ color: 'var(--danger)' }}>
              <span className={styles.liveDot} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>FOCUSING</span>
            </div>
          )}
        </div>

      </header>

      {/* ── 三列主区 ── */}
      <div className={`${styles.columns}${isFocusMode ? ` ${styles.focusMode}` : ''}`}>

        {/* 左列：任务列表 */}
        <div className={styles.colLeft}>
          <div className={styles.taskWrap}>
            <PendingTasks
              onTaskClick={handleTaskClick}
              onStartCountUp={handleStartCountUp}
              currentBoundTask={currentBoundTask}
              isRunning={isPomodoroRunning}
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
            {/* 常驻标题栏 */}
            <div className={styles.centerHeader}>
              <div className={styles.centerTitleWrap}>
                <span className={styles.centerTitle}>专注计时</span>
              </div>
              {isFocusMode && (
                <button
                  className={styles.centerFocusExit}
                  onClick={() => setIsFocusMode(false)}
                  title="退出专注模式 (Esc)"
                  aria-label="退出专注模式"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {/* 专注模式信息条：时钟 + 目标 + 今日进度 */}
            <div className={`${styles.focusInfoBar}${isFocusMode ? ` ${styles.focusInfoBarVisible}` : ''}`}>
              <span className={styles.focusInfoClock}>
                {hh}<span style={{ opacity: 0.4, fontWeight: 300 }}>:</span>{mm}
              </span>
              <span className={styles.focusInfoDivider} />
              {currentGoal && (
                <>
                  <span className={styles.focusInfoLabel}>{goalSummary.title}</span>
                  {goalSummary.daysLeft !== null && (
                    <span className={styles.focusInfoPill}>{goalSummary.daysLeft}天</span>
                  )}
                  <span className={styles.focusInfoDivider} />
                </>
              )}
              <span className={styles.focusInfoLabel}>今日</span>
              <span className={styles.focusInfoMono}>{pomodoroCount} 🍅</span>
              <span className={styles.focusInfoMono}>{focusH}h {focusM}m</span>
              {currentBoundTask && tasks.find(t => t.id === currentBoundTask) && (
                <>
                  <span className={styles.focusInfoDivider} />
                  <span className={styles.focusInfoTask}>
                    ◎ {tasks.find(t => t.id === currentBoundTask)?.title}
                  </span>
                </>
              )}
            </div>
            <div className={styles.pomodoroWrap}>
              <PomodoroTimer
                ref={pomodoroTimerRef}
                tasks={tasks}
                currentBoundTask={currentBoundTask}
                compactMode={isMobile}
                hideHeader
                isFocusMode={isFocusMode}
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
                onEnterFocusMode={() => setIsFocusMode(true)}
              />
            </div>
            {/* 单栏：运动 & 消费内联展示在番茄钟下方 */}
            {isMobile && !isFocusMode && (
              <div style={{ padding: '0 16px 16px' }}>
                <QuickStatsInline />
              </div>
            )}
          </div>
        </div>

        {/*        {/* AI ?? */}
        {!isTabletOrBelow && (
          <div className={styles.aiCol}>
            <AgentChatPanel inline />
          </div>
        )}

      </div>

      {isTabletOrBelow && <AgentChatPanel />}

      {/* ── 弹窗 ── */}
      <HistoryViewer isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
      <StudyPlanSidebar ref={studyPlanSidebarRef} showFloatingTrigger={false} />

      {/* 备案 */}
      {!isMobile ? (
        <footer className={styles.footer} style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 16,
          padding: '4px 16px', fontSize: 11,
          color: 'var(--fg-4)', pointerEvents: 'none',
          background: 'transparent',
        }}>
          {footerContent}
        </footer>
      ) : !isFocusMode ? (
        <footer style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '18px 16px 28px',
          fontSize: 11,
          color: 'var(--fg-4)',
          borderTop: '1px solid var(--line)',
          marginTop: 12,
          background: 'var(--bg-1)',
        }}>
          {footerContent}
        </footer>
      ) : null}
    </div>
  );
}
