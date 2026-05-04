'use client';

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, MessageSquare } from 'lucide-react';
import { studyPlanAPI } from '@/lib/api';
import PhaseListPanel from './PhaseListPanel';
import StudyPlanChat from './StudyPlanChat';
import WeekCalendarView from './WeekCalendarView';
import { addDays, dayDiff, formatDate, getMonday, toDateOnly } from './dateUtils';
import type { DailySlot, PhasePlan, StudyPlanLite } from './types';

type MobileTab = 'chat' | 'calendar';

interface SubjectDraft {
  name: string;
  weight: number;
  level: string;
  chapters: Array<{ title: string; estimatedHours: number }>;
}

interface CreatePlanForm {
  examName: string;
  examType: string;
  examDate: string;
  employmentType: string;
  weekdayHours: number;
  weekendHours: number;
}

const DEFAULT_SUBJECTS: SubjectDraft[] = [
  {
    name: '行测',
    weight: 0.6,
    level: 'beginner',
    chapters: [
      { title: '数量关系', estimatedHours: 12 },
      { title: '言语理解', estimatedHours: 10 },
      { title: '资料分析', estimatedHours: 10 },
      { title: '判断推理', estimatedHours: 12 },
      { title: '常识判断', estimatedHours: 6 },
    ],
  },
  {
    name: '申论',
    weight: 0.4,
    level: 'beginner',
    chapters: [
      { title: '归纳概括', estimatedHours: 8 },
      { title: '综合分析', estimatedHours: 10 },
      { title: '提出对策', estimatedHours: 8 },
      { title: '大作文', estimatedHours: 14 },
    ],
  },
];

function defaultExamDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return formatDate(d);
}

function getMissingSchedulableDates(
  slots: DailySlot[],
  rangeStart: Date,
  rangeEnd: Date,
  today: Date,
  examDate: Date,
  plan: Pick<StudyPlanLite, 'weekdayHours' | 'weekendHours'>,
) {
  const start = rangeStart < today ? today : rangeStart;
  const lastStudyDay = addDays(examDate, -1);
  const end = lastStudyDay < rangeEnd ? lastStudyDay : rangeEnd;
  if (end < start) return [];

  const coveredDates = new Set(
    slots
      .map((slot) => formatDate(toDateOnly(slot.date))),
  );
  const missingDates: string[] = [];
  const current = toDateOnly(start);
  while (current <= end) {
    const iso = formatDate(current);
    const day = current.getUTCDay();
    const dailyHours = day === 0 || day === 6 ? plan.weekendHours : plan.weekdayHours;
    if (dailyHours > 0 && !coveredDates.has(iso)) missingDates.push(iso);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return missingDates;
}

export default function StudyPlanWorkspace() {
  const router = useRouter();
  const [plan, setPlan] = useState<StudyPlanLite | null>(null);
  const [phases, setPhases] = useState<PhasePlan[]>([]);
  const [slots, setSlots] = useState<DailySlot[]>([]);
  const [weekSlotsLoaded, setWeekSlotsLoaded] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingExpand, setPendingExpand] = useState<Date | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
  const [isMobile, setIsMobile] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreatePlanForm>({
    examName: '公务员考试',
    examType: 'national_exam',
    examDate: defaultExamDate(),
    employmentType: 'working',
    weekdayHours: 2,
    weekendHours: 5,
  });

  const today = toDateOnly(new Date());

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const response = await studyPlanAPI.getActivePlan();
      const activePlan = response.data;
      if (!activePlan) {
        setPlan(null);
        setPhases([]);
        setError('no-plan');
        return;
      }

      setPlan({
        id: activePlan.id,
        examName: activePlan.examName,
        examDate: activePlan.examDate,
        examType: activePlan.examType,
        status: activePlan.status,
        weekdayHours: activePlan.weekdayHours,
        weekendHours: activePlan.weekendHours,
      });
      setPhases(activePlan.phasePlans || []);
      setError(null);
    } catch {
      setError('load-failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeekSlots = useCallback(async () => {
    if (!plan) {
      setWeekSlotsLoaded(true);
      return;
    }
    setWeekSlotsLoaded(false);
    const requests: Promise<DailySlot[]>[] = [];
    for (let i = 0; i < 7; i += 1) {
      const day = addDays(weekStart, i);
      requests.push(
        studyPlanAPI
          .getTodaySlots(plan.id, formatDate(day))
          .then((response) => (response.data || []) as DailySlot[])
          .catch(() => [] as DailySlot[]),
      );
    }
    const allSlots = (await Promise.all(requests)).flat();
    setSlots(allSlots);
    setWeekSlotsLoaded(true);
  }, [plan, weekStart]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    void loadWeekSlots();
  }, [loadWeekSlots]);

  const handleCreatePlan = async () => {
    if (!createForm.examName.trim()) {
      setCreateError('请填写考试名称');
      return;
    }
    if (!createForm.examDate) {
      setCreateError('请选择考试日期');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await studyPlanAPI.createPlan({
        title: `${createForm.examName.trim()}备考计划`,
        examName: createForm.examName.trim(),
        examType: createForm.examType,
        examDate: createForm.examDate,
        employmentType: createForm.employmentType,
        weekdayHours: createForm.weekdayHours,
        weekendHours: createForm.weekendHours,
        holidayEnabled: true,
        subjects: DEFAULT_SUBJECTS,
      });
      await loadPlan();
    } catch {
      setCreateError('创建失败，请检查后端服务或稍后再试');
    } finally {
      setCreating(false);
    }
  };

  const handlePhasesConfirmed = async () => {
    await loadPlan();
    // 等 React 把 loadPlan 产生的 phases 状态更新刷到 DOM 之后，再 remount Chat
    // 这样新 mount 的 Chat 拿到的 phases 已经是非空的，不会再触发阶段推荐
    setTimeout(() => setChatKey((k) => k + 1), 0);
  };

  const handleWeekConfirmed = async () => {
    await loadWeekSlots();
  };

  const handleSlotComplete = async (slot: DailySlot) => {
    if (!plan) return;
    await studyPlanAPI.completeSlot(plan.id, slot.id);
    await loadWeekSlots();
  };

  const handleSlotSkip = async (slot: DailySlot) => {
    if (!plan) return;
    await studyPlanAPI.skipSlot(plan.id, slot.id);
    await loadWeekSlots();
  };

  const handleGenerateWeek = (start: Date) => {
    setPendingExpand(start);
    if (isMobile) setMobileTab('chat');
  };

  if (loading) {
    return <div style={styles.loading}>正在加载学习计划...</div>;
  }

  if (error === 'no-plan' || !plan) {
    return (
      <div style={styles.createPage}>
        <header style={styles.topBar}>
          <button type="button" style={styles.backBtn} onClick={() => router.push('/')}>
            <ArrowLeft size={16} />
          </button>
          <div style={styles.titleBlock}>
            <span style={styles.examName}>创建学习计划</span>
            <span style={styles.examMeta}>先建立备考目标，后续在这里做阶段规划和周计划安排。</span>
          </div>
        </header>

        <main style={styles.createBody}>
          <section style={styles.createCard}>
            <div>
              <h1 style={styles.createTitle}>从一个可执行的备考计划开始</h1>
              <p style={styles.createText}>
                侧边栏只负责查看进度；创建、编辑、拆阶段和排周计划都在这个页面完成。
              </p>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span style={styles.label}>考试名称</span>
                <input
                  value={createForm.examName}
                  onChange={(e) => setCreateForm((p) => ({ ...p, examName: e.target.value }))}
                  style={styles.input}
                  placeholder="例如：2026 国考"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>考试类型</span>
                <select
                  value={createForm.examType}
                  onChange={(e) => setCreateForm((p) => ({ ...p, examType: e.target.value }))}
                  style={styles.input}
                >
                  <option value="national_exam">公务员考试</option>
                  <option value="postgraduate">考研</option>
                  <option value="ielts">雅思 / 托福</option>
                  <option value="custom">自定义目标</option>
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.label}>考试日期</span>
                <input
                  type="date"
                  value={createForm.examDate}
                  onChange={(e) => setCreateForm((p) => ({ ...p, examDate: e.target.value }))}
                  style={styles.input}
                />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>备考状态</span>
                <select
                  value={createForm.employmentType}
                  onChange={(e) => setCreateForm((p) => ({ ...p, employmentType: e.target.value }))}
                  style={styles.input}
                >
                  <option value="working">在职备考</option>
                  <option value="student">学生备考</option>
                  <option value="fulltime">全职备考</option>
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.label}>工作日学习时长</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={createForm.weekdayHours}
                  onChange={(e) => setCreateForm((p) => ({ ...p, weekdayHours: Number(e.target.value) }))}
                  style={styles.input}
                />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>周末学习时长</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={createForm.weekendHours}
                  onChange={(e) => setCreateForm((p) => ({ ...p, weekendHours: Number(e.target.value) }))}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.subjectPreview}>
              <span style={styles.label}>默认科目</span>
              <div style={styles.subjectPills}>
                {DEFAULT_SUBJECTS.map((subject) => (
                  <span key={subject.name} style={styles.subjectPill}>
                    {subject.name} · {subject.chapters.length} 章
                  </span>
                ))}
              </div>
              <p style={styles.hint}>创建后可以继续用 AI 拆阶段、改科目、生成本周和下周计划。</p>
            </div>

            {createError && <div style={styles.errorText}>{createError}</div>}

            <div style={styles.emptyActions}>
              <button type="button" style={styles.primaryBtn} onClick={handleCreatePlan} disabled={creating}>
                {creating ? '创建中...' : '创建并进入规划'}
              </button>
              <button type="button" style={styles.backBtn} onClick={() => router.push('/')}>返回首页</button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (error === 'load-failed') {
    return (
      <div style={styles.empty}>
        <h2 style={styles.emptyTitle}>学习计划加载失败</h2>
        <p style={styles.emptyText}>可以稍后重试，或检查后端服务是否正常。</p>
        <button type="button" style={styles.backBtn} onClick={() => router.push('/')}>返回首页</button>
      </div>
    );
  }

  const examDate = toDateOnly(plan.examDate);
  const examDaysLeft = Math.max(0, dayDiff(today, examDate));
  const thisWeek = { start: getMonday(today), end: addDays(getMonday(today), 6) };
  const nextWeek = { start: addDays(thisWeek.start, 7), end: addDays(thisWeek.end, 7) };
  const isExamPassed = examDate < today;
  const isViewingThisWeek = formatDate(weekStart) === formatDate(thisWeek.start);
  const isViewingNextWeek = formatDate(weekStart) === formatDate(nextWeek.start);
  const thisWeekMissingDates = getMissingSchedulableDates(slots, today, thisWeek.end, today, examDate, plan);
  const nextWeekMissingDates = getMissingSchedulableDates(slots, nextWeek.start, nextWeek.end, today, examDate, plan);
  const thisWeekMissing = weekSlotsLoaded && !isExamPassed && isViewingThisWeek && thisWeekMissingDates.length > 0;
  const nextWeekMissing = weekSlotsLoaded && !isExamPassed && isViewingNextWeek && nextWeekMissingDates.length > 0;

  const headerNode = (
    <header style={styles.topBar}>
      <button type="button" style={styles.backBtn} onClick={() => router.push('/')}>
        <ArrowLeft size={16} />
      </button>
      <div style={styles.titleBlock}>
        <span style={styles.examName}>{plan.examName}</span>
        <span style={styles.examMeta}>
          距离考试 {examDaysLeft} 天 · 工作日 {plan.weekdayHours}h / 周末 {plan.weekendHours}h
        </span>
      </div>
    </header>
  );

  const chatNode = (
    weekSlotsLoaded ? (
      <StudyPlanChat
        key={chatKey}
        plan={plan}
        phases={phases}
        hasWeekSlots={slots.length > 0}
        today={today}
        examDaysLeft={examDaysLeft}
        thisWeekMissing={thisWeekMissing}
        nextWeekMissing={nextWeekMissing}
        onPhasesConfirmed={handlePhasesConfirmed}
        onWeekConfirmed={handleWeekConfirmed}
        pendingExpandWeekStart={pendingExpand}
        onExpandHandled={() => setPendingExpand(null)}
      />
    ) : (
      <div style={styles.chatLoading}>正在读取周计划...</div>
    )
  );

  const calendarNode = (
    <div style={styles.rightCol}>
      <PhaseListPanel phases={phases} today={today} />
      <WeekCalendarView
        weekStart={weekStart}
        slots={slots}
        phases={phases}
        today={today}
        onSlotComplete={handleSlotComplete}
        onSlotSkip={handleSlotSkip}
        onWeekChange={setWeekStart}
        onGenerateWeek={handleGenerateWeek}
      />
    </div>
  );

  if (isMobile) {
    return (
      <div style={styles.workspaceMobile}>
        {headerNode}
        <div style={styles.tabBar}>
          <button
            type="button"
            style={{ ...styles.tabBtn, ...(mobileTab === 'chat' ? styles.tabBtnActive : {}) }}
            onClick={() => setMobileTab('chat')}
          >
            <MessageSquare size={14} /> AI 对话
          </button>
          <button
            type="button"
            style={{ ...styles.tabBtn, ...(mobileTab === 'calendar' ? styles.tabBtnActive : {}) }}
            onClick={() => setMobileTab('calendar')}
          >
            <Calendar size={14} /> 周计划
          </button>
        </div>
        <div style={styles.mobileBody}>
          {mobileTab === 'chat' ? chatNode : calendarNode}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.workspace}>
      {headerNode}
      <div style={styles.body}>
        <div style={styles.leftCol}>{chatNode}</div>
        {calendarNode}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  workspace: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-0)', color: 'var(--fg)' },
  workspaceMobile: { display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-0)', color: 'var(--fg)' },
  topBar: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
    borderBottom: '1px solid var(--line)', background: 'var(--bg-1)',
  },
  backBtn: {
    minWidth: 32, height: 32, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '0 10px',
  },
  titleBlock: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  examName: { fontSize: 15, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  examMeta: { fontSize: 12, color: 'var(--fg-3)' },
  body: { flex: 1, display: 'grid', gridTemplateColumns: '40% 60%', minHeight: 0 },
  leftCol: { display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' },
  chatLoading: {
    height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--fg-3)', background: 'var(--bg-1)', borderRight: '1px solid var(--line)',
  },
  rightCol: { display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto', background: 'var(--bg-1)' },
  loading: {
    height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--fg-3)', background: 'var(--bg-0)',
  },
  empty: {
    height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
    background: 'var(--bg-0)', color: 'var(--fg)', padding: 20,
  },
  createPage: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', color: 'var(--fg)' },
  createBody: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  createCard: {
    width: 'min(720px, 100%)', display: 'flex', flexDirection: 'column', gap: 18,
    borderRadius: 24, border: '1px solid var(--line)', background: 'var(--bg-1)', padding: 24,
    boxShadow: '0 24px 70px rgba(2, 6, 23, 0.18)',
  },
  createTitle: { margin: 0, fontSize: 26, lineHeight: 1.2, color: 'var(--fg)' },
  createText: { margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--fg-3)' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 700, color: 'var(--fg-3)' },
  input: {
    height: 38, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg)',
    padding: '0 12px', outline: 'none',
  },
  subjectPreview: {
    borderRadius: 16, border: '1px solid var(--line)', background: 'var(--bg-2)', padding: 14,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  subjectPills: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  subjectPill: {
    borderRadius: 999, border: '1px solid color-mix(in srgb, var(--accent) 35%, var(--line))',
    background: 'color-mix(in srgb, var(--accent) 12%, var(--bg-2))', color: 'var(--fg)', padding: '6px 10px', fontSize: 13,
  },
  hint: { margin: 0, fontSize: 12, color: 'var(--fg-3)' },
  errorText: { color: '#ef4444', fontSize: 13 },
  emptyTitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  emptyText: { fontSize: 13, color: 'var(--fg-3)', margin: 0 },
  emptyActions: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-start' },
  primaryBtn: {
    height: 38, padding: '0 16px', borderRadius: 999, border: 'none',
    background: 'var(--accent)', color: 'var(--accent-ink)', cursor: 'pointer', fontSize: 13, fontWeight: 700,
  },
  tabBar: { display: 'flex', borderBottom: '1px solid var(--line)' },
  tabBtn: {
    flex: 1, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
    color: 'var(--fg-3)', cursor: 'pointer', fontSize: 13,
  },
  tabBtnActive: { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' },
  mobileBody: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' },
};
