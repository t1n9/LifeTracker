import React, { useEffect, useState } from 'react';
import { Check, Edit, Plus, Trash2 } from 'lucide-react';
import { goalService, StartGoalData, UpdateGoalData, UserGoal } from '../services/goalService';

interface GoalManagementProps {
  onGoalChange?: () => void;
}

type GoalForm = StartGoalData & { startDate?: string };

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
  background: 'color-mix(in srgb, var(--bg-secondary) 97%, #eef2ef 3%)',
  boxShadow: '0 14px 28px rgba(15, 23, 42, 0.045)',
  borderRadius: '16px',
  padding: '1.25rem',
};

const BLOCK_STYLE: React.CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
  background: 'color-mix(in srgb, var(--bg-tertiary) 90%, var(--bg-secondary) 10%)',
  borderRadius: '14px',
  padding: '1rem',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
  borderRadius: '8px',
  background: 'color-mix(in srgb, var(--bg-secondary) 96%, #e7ece9 4%)',
  color: 'var(--text-primary)',
  padding: '0.55rem 0.7rem',
};

export default function GoalManagement({ onGoalChange }: GoalManagementProps) {
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [goalHistory, setGoalHistory] = useState<UserGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGoalForm, setShowNewGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      const start = next.startDate || '';
      const target = next.targetDate || '';
      if (field === 'startDate' && start && target && target < start) {
        next.targetDate = start;
      }
      return next;
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '未设置';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '无效日期';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}年${month}月${day}日`;
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

  useEffect(() => {
    void loadData();
  }, []);

  const handleStartNewGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.goalName.trim()) {
      alert('请输入目标名称');
      return;
    }
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
    } catch (error) {
      console.error('开启新目标失败:', error);
      alert('开启新目标失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteGoal = async () => {
    if (!currentGoal) return;
    if (!confirm('确定要完成当前目标吗？')) return;
    try {
      setIsSubmitting(true);
      await goalService.completeGoal(currentGoal.id);
      await loadData();
      onGoalChange?.();
    } catch (error) {
      console.error('完成目标失败:', error);
      alert('完成目标失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
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
    if (!editingGoal || !formData.goalName.trim()) {
      alert('请输入目标名称');
      return;
    }
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
    } catch (error) {
      console.error('更新目标失败:', error);
      alert('更新目标失败');
    } finally {
      setIsSubmitting(false);
    }
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
    } catch (error) {
      console.error('删除目标失败:', error);
      alert('删除目标失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={CARD_STYLE}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 700 }}>当前目标</h3>
          <button
            onClick={() => {
              setEditingGoal(null);
              setExpandedHistoryId(null);
              setShowNewGoalForm((prev) => !prev);
              resetForm();
            }}
            className="btn btn-primary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={14} />
            {showNewGoalForm ? '收起新目标' : '开启新目标'}
          </button>
        </div>

        {currentGoal ? (
          <div style={{ ...BLOCK_STYLE, borderColor: 'color-mix(in srgb, var(--accent-primary) 24%, var(--border-color) 76%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '1.03rem', fontWeight: 700 }}>{currentGoal.goalName}</div>
                {currentGoal.description && (
                  <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.6 }}>{currentGoal.description}</div>
                )}
                <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem', display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
                  <span>开始：{formatDate(currentGoal.startDate)}</span>
                  {currentGoal.targetDate && <span>目标：{formatDate(currentGoal.targetDate)}</span>}
                </div>
              </div>
              <button
                onClick={handleCompleteGoal}
                disabled={isSubmitting}
                className="btn btn-sm"
                style={{ background: '#16a34a', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Check size={14} />
                完成目标
              </button>
            </div>
          </div>
        ) : (
          <div style={{ ...BLOCK_STYLE, borderStyle: 'dashed', color: 'var(--text-muted)', textAlign: 'center' }}>
            暂无当前目标，建议先开启一个新的阶段目标。
          </div>
        )}

        {showNewGoalForm && (
          <div style={{ ...BLOCK_STYLE, marginTop: '0.9rem' }}>
            <h4 style={{ margin: '0 0 0.75rem', color: 'var(--text-primary)', fontSize: '0.96rem' }}>开启新目标</h4>
            <form onSubmit={handleStartNewGoal} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <input
                type="text"
                value={formData.goalName}
                onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
                placeholder="目标名称"
                style={INPUT_STYLE}
                required
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  min={getTodayDate()}
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
                <button type="button" className="btn btn-sm" onClick={() => setFormData((prev) => ({ ...prev, targetDate: getTodayDate() }))}>今天</button>
                <button type="button" className="btn btn-sm" onClick={() => setFormData((prev) => ({ ...prev, targetDate: getOffsetDate(7) }))}>7天后</button>
                <button type="button" className="btn btn-sm" onClick={() => setFormData((prev) => ({ ...prev, targetDate: getOffsetDate(30) }))}>30天后</button>
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

      <div style={CARD_STYLE}>
        <h3 style={{ margin: '0 0 0.9rem', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 700 }}>目标历史</h3>
        {goalHistory.length === 0 ? (
          <div style={{ ...BLOCK_STYLE, textAlign: 'center', color: 'var(--text-muted)' }}>暂无历史目标</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {goalHistory.map((goal) => {
              const isEditing = editingGoal?.id === goal.id && expandedHistoryId === goal.id;
              return (
                <div key={goal.id} style={BLOCK_STYLE}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{goal.goalName}</strong>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            borderRadius: '999px',
                            padding: '0.14rem 0.48rem',
                            color: goal.status === 'COMPLETED' ? '#15803d' : goal.status === 'TERMINATED' ? '#dc2626' : '#1d4ed8',
                            background: goal.status === 'COMPLETED' ? 'rgba(22,163,74,0.12)' : goal.status === 'TERMINATED' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                          }}
                        >
                          {goal.status === 'COMPLETED' ? '已完成' : goal.status === 'TERMINATED' ? '已终止' : '进行中'}
                        </span>
                      </div>
                      <div style={{ marginTop: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.84rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <span>开始：{formatDate(goal.startDate)}</span>
                        {goal.targetDate && <span>目标：{formatDate(goal.targetDate)}</span>}
                        {goal.endDate && <span>结束：{formatDate(goal.endDate)}</span>}
                      </div>
                      {goal.description && <div style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{goal.description}</div>}
                    </div>
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingGoal(null);
                          setExpandedHistoryId(null);
                          resetForm();
                        } else {
                          handleEditGoal(goal);
                        }
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Edit size={14} />
                      {isEditing ? '收起编辑' : '编辑'}
                    </button>
                  </div>

                  {isEditing && (
                    <form onSubmit={handleUpdateGoal} style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <input
                        type="text"
                        value={formData.goalName}
                        onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
                        style={INPUT_STYLE}
                        required
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => updateDateField('startDate', e.target.value)}
                          style={INPUT_STYLE}
                        />
                        <input
                          type="date"
                          value={formData.targetDate}
                          min={formData.startDate || ''}
                          onChange={(e) => updateDateField('targetDate', e.target.value)}
                          style={INPUT_STYLE}
                        />
                      </div>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
