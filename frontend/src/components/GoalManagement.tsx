import React, { useEffect, useState, useCallback } from 'react';
import { Check, Edit, Plus, Trash2, ChevronDown, ChevronRight, PlayCircle, PauseCircle, Archive } from 'lucide-react';
import { goalService, StartGoalData, UpdateGoalData, UserGoal, GoalLinkedPlan } from '../services/goalService';

interface GoalManagementProps {
  onGoalChange?: () => void;
}

type GoalForm = StartGoalData & { startDate?: string };

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--line) 76%, transparent 24%)',
  background: 'color-mix(in srgb, var(--bg-1) 97%, #eef2ef 3%)',
  boxShadow: '0 14px 28px rgba(15, 23, 42, 0.045)',
  borderRadius: '16px',
  padding: '1.25rem',
};

const BLOCK_STYLE: React.CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--line) 78%, transparent 22%)',
  background: 'color-mix(in srgb, var(--bg-2) 90%, var(--bg-1) 10%)',
  borderRadius: '14px',
  padding: '1rem',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  border: '1px solid color-mix(in srgb, var(--line) 78%, transparent 22%)',
  borderRadius: '8px',
  background: 'color-mix(in srgb, var(--bg-1) 96%, #e7ece9 4%)',
  color: 'var(--fg)',
  padding: '0.55rem 0.7rem',
};

const PLAN_STATUS_LABEL: Record<string, string> = {
  active: '进行中',
  paused: '已暂停',
  archived: '已归档',
  completed: '已完成',
};

const PLAN_STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  active:   { color: '#1d4ed8', bg: 'rgba(59,130,246,0.12)' },
  paused:   { color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  archived: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  completed:{ color: '#15803d', bg: 'rgba(22,163,74,0.12)' },
};

function PlanCard({
  plan,
  onResume,
  onPause,
  onDelete,
}: {
  plan: GoalLinkedPlan;
  onResume: (id: string) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const statusStyle = PLAN_STATUS_COLOR[plan.status] ?? PLAN_STATUS_COLOR.active;

  const formatDate = (s: string | null | undefined) => {
    if (!s) return '未设置';
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '无效日期';
    return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`;
  };

  const handleResume = async () => {
    setActing(true);
    try { await onResume(plan.id); } finally { setActing(false); }
  };
  const handlePause = async () => {
    setActing(true);
    try { await onPause(plan.id); } finally { setActing(false); }
  };
  const handleDelete = async () => {
    setActing(true);
    try { await onDelete(plan.id); } finally { setActing(false); }
  };

  return (
    <div style={{
      border: '1px solid color-mix(in srgb, var(--line) 70%, transparent 30%)',
      borderRadius: '10px',
      overflow: 'hidden',
      background: 'var(--bg-1)',
    }}>
      {/* 计划头部行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.65rem 0.9rem',
          cursor: plan.status === 'archived' ? 'pointer' : 'default',
        }}
        onClick={() => plan.status === 'archived' && setExpanded((v) => !v)}
      >
        {plan.status === 'archived' && (
          <span style={{ color: 'var(--fg-4)', flexShrink: 0 }}>
            {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'var(--fg)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {plan.title}
        </span>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, borderRadius: '999px', padding: '0.13rem 0.45rem',
          color: statusStyle.color, background: statusStyle.bg, flexShrink: 0,
        }}>
          {PLAN_STATUS_LABEL[plan.status] ?? plan.status}
        </span>
        {plan.status === 'paused' && (
          <button
            onClick={(e) => { e.stopPropagation(); void handleResume(); }}
            disabled={acting}
            title="继续计划"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
              background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <PlayCircle size={13} />
            继续
          </button>
        )}
        {plan.status === 'active' && (
          <button
            onClick={(e) => { e.stopPropagation(); void handlePause(); }}
            disabled={acting}
            title="暂停计划"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
              background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--line-2)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <PauseCircle size={13} />
            暂停
          </button>
        )}
        {plan.status !== 'active' && (
          <button
            onClick={(e) => { e.stopPropagation(); void handleDelete(); }}
            disabled={acting}
            title="永久删除学习计划"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              padding: '0.25rem 0.55rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600,
              background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.28)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Trash2 size={13} />
            删除
          </button>
        )}
      </div>

      {/* 进度条（非归档时常驻显示） */}
      {plan.stats && plan.status !== 'archived' && (
        <div style={{ padding: '0 0.9rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${plan.stats.completionRate}%`,
              background: plan.status === 'paused' ? '#f59e0b' : 'var(--accent)',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-3)', flexShrink: 0 }}>
            {plan.stats.completedSlots}/{plan.stats.totalSlots} · {plan.stats.completionRate}%
          </span>
        </div>
      )}

      {/* 归档展开详情 */}
      {expanded && plan.status === 'archived' && (
        <div style={{
          borderTop: '1px solid var(--line-2)',
          padding: '0.75rem 0.9rem',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontSize: '0.83rem', color: 'var(--fg-2)' }}>
            {plan.examDate && <span>考试日期：{new Date(plan.examDate).toLocaleDateString('zh-CN')}</span>}
            <span>工作日 {plan.weekdayHours}h / 周末 {plan.weekendHours}h</span>
            <span>创建于 {formatDate(plan.createdAt)}</span>
          </div>
          {plan.stats && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.83rem', color: 'var(--fg-2)' }}>
              <span>总任务槽：{plan.stats.totalSlots}</span>
              <span>已完成：{plan.stats.completedSlots}</span>
              <span>完成率：{plan.stats.completionRate}%</span>
              <span>计划总时长：{plan.stats.plannedHours.toFixed(1)}h</span>
            </div>
          )}
          {plan.subjects.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {plan.subjects.map((s) => (
                <span key={s.id} style={{
                  padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem',
                  background: 'var(--accent-soft)', color: 'var(--accent)',
                }}>
                  {s.name}
                </span>
              ))}
            </div>
          )}
          {/* 归档的进度条 */}
          {plan.stats && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ flex: 1, height: 4, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${plan.stats.completionRate}%`, background: 'var(--fg-4)' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--fg-4)' }}>{plan.stats.completionRate}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GoalPlans({ goalId, refreshKey }: { goalId: string; refreshKey: number }) {
  const [plans, setPlans] = useState<GoalLinkedPlan[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await goalService.getPlansForGoal(goalId);
      setPlans(data);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const handleResume = async (planId: string) => {
    try {
      await goalService.resumePlan(planId);
      await load();
    } catch (error: any) {
      alert(error?.response?.data?.message || '继续学习计划失败，请先暂停其他进行中的学习计划。');
    }
  };
  const handlePause = async (planId: string) => {
    await goalService.pausePlan(planId);
    await load();
  };
  const handleDelete = async (planId: string) => {
    const plan = plans.find((item) => item.id === planId);
    const planName = plan?.title || '这个学习计划';
    const confirmed = window.confirm(
      `确定永久删除「${planName}」吗？\n\n删除后会清空该学习计划的阶段、科目、章节、周计划和每日学习安排。未产生学习记录或番茄记录的关联任务也会一并删除。\n\n这个操作不可撤销。`,
    );
    if (!confirmed) return;
    await goalService.deletePlanPermanently(planId);
    await load();
  };

  if (loading) return <div style={{ fontSize: '0.8rem', color: 'var(--fg-4)', padding: '0.4rem 0' }}>加载中...</div>;
  if (plans.length === 0) return <div style={{ fontSize: '0.8rem', color: 'var(--fg-4)', padding: '0.4rem 0', fontStyle: 'italic' }}>暂无关联学习计划</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.6rem' }}>
      {plans.map((p) => (
        <PlanCard key={p.id} plan={p} onResume={handleResume} onPause={handlePause} onDelete={handleDelete} />
      ))}
    </div>
  );
}

export default function GoalManagement({ onGoalChange }: GoalManagementProps) {
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [goalHistory, setGoalHistory] = useState<UserGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGoalForm, setShowNewGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [formData, setFormData] = useState<GoalForm>({
    goalName: '',
    targetDate: '',
    description: '',
    startDate: '',
  });

  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getOffsetDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const resetForm = () => {
    setFormData({ goalName: '', targetDate: '', description: '', startDate: '' });
  };

  const updateDateField = (field: 'startDate' | 'targetDate', value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'startDate' && next.startDate && next.targetDate && next.targetDate < next.startDate) {
        next.targetDate = next.startDate;
      }
      return next;
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '未设置';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '无效日期';
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [current, history] = await Promise.all([
        goalService.getCurrentGoal(),
        goalService.getGoalHistory(),
      ]);
      setCurrentGoal(current);
      setGoalHistory(history.sort((a, b) => new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime()));
    } catch (error) {
      console.error('加载目标数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, []);

  const handleStartNewGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.goalName.trim()) { alert('请输入目标名称'); return; }
    try {
      setIsSubmitting(true);
      await goalService.startNewGoal({
        ...formData,
        targetDate: formData.targetDate || undefined,
        description: formData.description || undefined,
      });
      setShowNewGoalForm(false);
      resetForm();
      await loadData();
      onGoalChange?.();
    } catch { alert('开启新目标失败'); }
    finally { setIsSubmitting(false); }
  };

  const handleCompleteGoal = async () => {
    if (!currentGoal || !confirm('确定要完成当前目标吗？')) return;
    try {
      setIsSubmitting(true);
      await goalService.completeGoal(currentGoal.id);
      await loadData();
      onGoalChange?.();
    } catch { alert('完成目标失败，请重试'); }
    finally { setIsSubmitting(false); }
  };

  const handleEditGoal = (goal: UserGoal) => {
    setShowNewGoalForm(false);
    setExpandedHistoryId(goal.id);
    setEditingGoal(goal);
    setFormData({
      goalName: goal.goalName,
      startDate: goal.startDate ? new Date(goal.startDate).toISOString().split('T')[0] : '',
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '',
      description: goal.description || '',
    });
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal || !formData.goalName.trim()) { alert('请输入目标名称'); return; }
    try {
      setIsSubmitting(true);
      const updateData: UpdateGoalData = {
        goalName: formData.goalName,
        startDate: formData.startDate || undefined,
        targetDate: formData.targetDate || undefined,
        description: formData.description || undefined,
      };
      await goalService.updateGoal(editingGoal.id, updateData);
      setEditingGoal(null);
      setExpandedHistoryId(null);
      resetForm();
      await loadData();
      onGoalChange?.();
    } catch { alert('更新目标失败'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('确定要删除这个目标吗？此操作不可撤销。')) return;
    try {
      setIsSubmitting(true);
      await goalService.deleteGoal(goalId);
      setEditingGoal(null);
      setExpandedHistoryId(null);
      resetForm();
      await loadData();
      onGoalChange?.();
    } catch { alert('删除目标失败，请重试'); }
    finally { setIsSubmitting(false); }
  };

  if (loading) {
    return <div style={CARD_STYLE}><div style={{ textAlign: 'center', color: 'var(--fg-3)' }}>加载中...</div></div>;
  }

  // 所有目标（当前 + 历史）按时间倒序，不重复
  const allGoals: UserGoal[] = [];
  if (currentGoal) allGoals.push(currentGoal);
  goalHistory.forEach((g) => { if (!allGoals.find((a) => a.id === g.id)) allGoals.push(g); });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 顶部操作区 */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: currentGoal || showNewGoalForm ? '1rem' : 0, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: 'var(--fg)', fontSize: '1.05rem', fontWeight: 700 }}>目标管理</h3>
          <button
            onClick={() => { setEditingGoal(null); setExpandedHistoryId(null); setShowNewGoalForm((prev) => !prev); resetForm(); }}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start' }}
          >
            <Plus size={14} />
            {showNewGoalForm ? '收起' : '开启新目标'}
          </button>
        </div>

        {/* 当前目标快览 */}
        {currentGoal && !showNewGoalForm && (
          <div style={{ ...BLOCK_STYLE, borderColor: 'color-mix(in srgb, var(--accent) 24%, var(--line) 76%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--fg)', fontSize: '1.03rem', fontWeight: 700 }}>{currentGoal.goalName}</div>
                {currentGoal.description && (
                  <div style={{ color: 'var(--fg-2)', marginTop: '0.25rem', lineHeight: 1.6 }}>{currentGoal.description}</div>
                )}
                <div style={{ marginTop: '0.5rem', color: 'var(--fg-2)', fontSize: '0.88rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
                  <span>开始：{formatDate(currentGoal.startDate)}</span>
                  {currentGoal.targetDate && <span>目标：{formatDate(currentGoal.targetDate)}</span>}
                </div>
              </div>
              <button
                onClick={handleCompleteGoal}
                disabled={isSubmitting}
                className="btn btn-sm"
                style={{ background: 'var(--success-color)', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start', flexShrink: 0 }}
              >
                <Check size={14} />
                完成目标
              </button>
            </div>
          </div>
        )}

        {!currentGoal && !showNewGoalForm && (
          <div style={{ ...BLOCK_STYLE, borderStyle: 'dashed', color: 'var(--fg-3)', textAlign: 'center' }}>
            暂无当前目标，建议先开启一个新的阶段目标。
          </div>
        )}

        {showNewGoalForm && (
          <div style={BLOCK_STYLE}>
            <h4 style={{ margin: '0 0 0.75rem', color: 'var(--fg)', fontSize: '0.96rem' }}>开启新目标</h4>
            <form onSubmit={handleStartNewGoal} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input
                type="text"
                value={formData.goalName}
                onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
                placeholder="目标名称（如：备考法考）"
                style={INPUT_STYLE}
                required
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  min={getTodayDate()}
                  placeholder="目标截止日期"
                  style={INPUT_STYLE}
                />
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="目标描述（可选）"
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm" onClick={() => setFormData((prev) => ({ ...prev, targetDate: getOffsetDate(30) }))}>30天后</button>
                <button type="button" className="btn btn-sm" onClick={() => setFormData((prev) => ({ ...prev, targetDate: getOffsetDate(90) }))}>3个月后</button>
                <button type="button" className="btn btn-sm" onClick={() => setFormData((prev) => ({ ...prev, targetDate: getOffsetDate(180) }))}>半年后</button>
                <button type="button" className="btn btn-sm" onClick={() => setFormData((prev) => ({ ...prev, targetDate: '' }))}>清空</button>
              </div>
              <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>{isSubmitting ? '创建中...' : '创建目标'}</button>
                <button type="button" className="btn btn-sm" onClick={() => { setShowNewGoalForm(false); resetForm(); }}>取消</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* 所有目标列表（含关联计划） */}
      <div style={CARD_STYLE}>
        <h3 style={{ margin: '0 0 0.9rem', color: 'var(--fg)', fontSize: '1.05rem', fontWeight: 700 }}>全部目标</h3>
        {allGoals.length === 0 ? (
          <div style={{ ...BLOCK_STYLE, textAlign: 'center', color: 'var(--fg-3)' }}>暂无目标记录</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {allGoals.map((goal) => {
              const isCurrent = goal.status === 'ACTIVE';
              const isExpanded = expandedHistoryId === goal.id;
              const isEditing = editingGoal?.id === goal.id && isExpanded;

              return (
                <div key={goal.id} style={{
                  ...BLOCK_STYLE,
                  borderColor: isCurrent
                    ? 'color-mix(in srgb, var(--accent) 28%, var(--line) 72%)'
                    : undefined,
                }}>
                  {/* 目标头部 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
                    <div
                      style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
                      onClick={() => {
                        if (isEditing) return;
                        setExpandedHistoryId(isExpanded ? null : goal.id);
                        setEditingGoal(null);
                        resetForm();
                        setPlanRefreshKey((k) => k + 1);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--fg-4)', flexShrink: 0 }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <strong style={{ color: 'var(--fg)', fontSize: '0.97rem' }}>{goal.goalName}</strong>
                        <span style={{
                          fontSize: '0.74rem', fontWeight: 700, borderRadius: '999px', padding: '0.14rem 0.48rem',
                          color: goal.status === 'COMPLETED' ? '#15803d' : goal.status === 'TERMINATED' ? '#dc2626' : '#1d4ed8',
                          background: goal.status === 'COMPLETED' ? 'rgba(22,163,74,0.12)' : goal.status === 'TERMINATED' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                        }}>
                          {goal.status === 'COMPLETED' ? '已完成' : goal.status === 'TERMINATED' ? '已终止' : '进行中'}
                        </span>
                      </div>
                      <div style={{ marginTop: '0.3rem', color: 'var(--fg-2)', fontSize: '0.84rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <span>开始：{formatDate(goal.startDate)}</span>
                        {goal.targetDate && <span>目标：{formatDate(goal.targetDate)}</span>}
                        {goal.endDate && <span>结束：{formatDate(goal.endDate)}</span>}
                      </div>
                      {goal.description && <div style={{ marginTop: '0.2rem', color: 'var(--fg-2)', fontSize: '0.86rem' }}>{goal.description}</div>}
                    </div>

                    <button
                      onClick={() => { if (isEditing) { setEditingGoal(null); setExpandedHistoryId(null); resetForm(); } else { handleEditGoal(goal); } }}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start', flexShrink: 0 }}
                    >
                      <Edit size={14} />
                      {isEditing ? '收起' : '编辑'}
                    </button>
                  </div>

                  {/* 展开区域：关联计划 + 可选编辑表单 */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid color-mix(in srgb, var(--line) 60%, transparent 40%)' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-3)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Archive size={13} />
                        关联学习计划
                      </div>
                      <GoalPlans goalId={goal.id} refreshKey={planRefreshKey} />

                      {isEditing && (
                        <form onSubmit={handleUpdateGoal} style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid color-mix(in srgb, var(--line) 60%, transparent 40%)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--fg-3)', marginBottom: '0.2rem' }}>编辑目标信息</div>
                          <input
                            type="text"
                            value={formData.goalName}
                            onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
                            style={INPUT_STYLE}
                            required
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                            <input type="date" value={formData.startDate} onChange={(e) => updateDateField('startDate', e.target.value)} style={INPUT_STYLE} />
                            <input type="date" value={formData.targetDate} min={formData.startDate || ''} onChange={(e) => updateDateField('targetDate', e.target.value)} style={INPUT_STYLE} />
                          </div>
                          <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            placeholder="目标描述（可选）"
                            style={{ ...INPUT_STYLE, resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={isSubmitting}>{isSubmitting ? '更新中...' : '保存修改'}</button>
                            <button type="button" className="btn btn-sm" onClick={() => { setEditingGoal(null); setExpandedHistoryId(null); resetForm(); }}>取消</button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ background: '#dc2626', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                              disabled={isSubmitting}
                              onClick={() => void handleDeleteGoal(goal.id)}
                            >
                              <Trash2 size={14} />
                              删除
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
