import React, { useState, useEffect } from 'react';
import { goalService, UserGoal, StartGoalData, UpdateGoalData } from '../services/goalService';
import { Edit, Trash2, Plus, Check } from 'lucide-react';

interface GoalManagementProps {
  onGoalChange?: () => void;
}

const GoalManagement: React.FC<GoalManagementProps> = ({ onGoalChange }) => {
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const getOffsetDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [goalHistory, setGoalHistory] = useState<UserGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGoalForm, setShowNewGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<UserGoal | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<StartGoalData & { startDate?: string }>({
    goalName: '',
    targetDate: '',
    description: '',
    startDate: '',
  });

  const updateDateField = (field: 'startDate' | 'targetDate', value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      const start = next.startDate || '';
      const target = next.targetDate || '';

      if (field === 'startDate' && start) {
        if (target && target < start) {
          next.targetDate = start;
        }
      }

      return next;
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [current, history] = await Promise.all([
        goalService.getCurrentGoal(),
        goalService.getGoalHistory(),
      ]);
      setCurrentGoal(current);
      // 按开始时间排序历史目标
      setGoalHistory(history.sort((a, b) => new Date(b.startDate || '').getTime() - new Date(a.startDate || '').getTime()));
    } catch (error) {
      console.error('加载目标数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '未设置';

    try {
      const date = new Date(dateString);

      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return '无效日期';
      }

      // 格式化日期
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');

      return `${year}年${month}月${day}日`;
    } catch (error) {
      console.error('Error formatting date:', error, dateString);
      return '日期格式错误';
    }
  };

  // 开启新目标
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
      setFormData({ goalName: '', targetDate: '', description: '', startDate: '' });
      await loadData();
      onGoalChange?.();
    } catch (error) {
      console.error('开启新目标失败:', error);
      alert('开启新目标失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 完成当前目标
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

  // 编辑目标
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

  // 更新目标
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
      setFormData({ goalName: '', targetDate: '', description: '', startDate: '' });
      await loadData();
      onGoalChange?.();
    } catch (error) {
      console.error('更新目标失败:', error);
      alert('更新目标失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除目标
  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('确定要删除这个目标吗？此操作不可撤销。')) return;

    try {
      setIsSubmitting(true);
      await goalService.deleteGoal(goalId);
      setEditingGoal(null);
      setExpandedHistoryId(null);
      setFormData({ goalName: '', targetDate: '', description: '', startDate: '' });
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">当前目标</h3>
          <button
            onClick={() => {
              setEditingGoal(null);
              setExpandedHistoryId(null);
              setShowNewGoalForm((prev) => !prev);
              setFormData({ goalName: '', targetDate: '', description: '', startDate: '' });
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
          >
            <Plus size={16} />
            {showNewGoalForm ? '收起新目标' : '开启新目标'}
          </button>
        </div>

        {currentGoal ? (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-lg">{currentGoal.goalName}</h4>
                {currentGoal.description && (
                  <p className="text-blue-700 dark:text-blue-300 mt-1">{currentGoal.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <span>开始：{formatDate(currentGoal.startDate)}</span>
                  {currentGoal.targetDate && <span>目标：{formatDate(currentGoal.targetDate)}</span>}
                </div>
              </div>
              <button
                onClick={handleCompleteGoal}
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
              >
                <Check size={16} />
                完成目标
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 p-5 text-center text-gray-500 dark:text-gray-400">
            暂无当前目标，建议先开启一个新的阶段目标。
          </div>
        )}

        {showNewGoalForm && (
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 p-4">
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">开启新目标</h4>
            <form onSubmit={handleStartNewGoal} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">目标名称 *</label>
                <input
                  type="text"
                  value={formData.goalName}
                  onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="请输入目标名称"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">目标日期</label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    min={getTodayDate()}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, targetDate: getTodayDate() }))}
                      className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600"
                    >
                      今天
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, targetDate: getOffsetDate(7) }))}
                      className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600"
                    >
                      7天后
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, targetDate: getOffsetDate(30) }))}
                      className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600"
                    >
                      30天后
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, targetDate: '' }))}
                      className="px-2.5 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-500"
                    >
                      清空
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">目标描述</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="可选"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium"
                >
                  {isSubmitting ? '创建中...' : '创建目标'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewGoalForm(false);
                    setFormData({ goalName: '', targetDate: '', description: '', startDate: '' });
                  }}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">目标历史</h3>
        {goalHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">暂无历史目标</div>
        ) : (
          <div className="space-y-3">
            {goalHistory.map((goal) => {
              const isEditing = editingGoal?.id === goal.id;
              return (
                <div
                  key={goal.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">{goal.goalName}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          goal.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : goal.status === 'TERMINATED'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                        }`}>
                          {goal.status === 'COMPLETED' ? '已完成' : goal.status === 'TERMINATED' ? '已终止' : '进行中'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-x-5 gap-y-1">
                        <span>开始：{formatDate(goal.startDate)}</span>
                        {goal.targetDate && <span>目标：{formatDate(goal.targetDate)}</span>}
                        {goal.endDate && <span>结束：{formatDate(goal.endDate)}</span>}
                      </div>
                      {goal.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{goal.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingGoal(null);
                          setExpandedHistoryId(null);
                          setFormData({ goalName: '', targetDate: '', description: '', startDate: '' });
                        } else {
                          handleEditGoal(goal);
                        }
                      }}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
                    >
                      <Edit size={16} />
                      {isEditing ? '收起编辑' : '编辑'}
                    </button>
                  </div>

                  {isEditing && expandedHistoryId === goal.id && (
                    <form onSubmit={handleUpdateGoal} className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">目标名称 *</label>
                        <input
                          type="text"
                          value={formData.goalName}
                          onChange={(e) => setFormData({ ...formData, goalName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">开始时间</label>
                          <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => updateDateField('startDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">目标日期</label>
                          <input
                            type="date"
                            value={formData.targetDate}
                            min={formData.startDate || ''}
                            onChange={(e) => updateDateField('targetDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        rows={3}
                        placeholder="目标描述（可选）"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg transition-colors font-medium"
                        >
                          {isSubmitting ? '更新中...' : '保存修改'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGoal(null);
                            setExpandedHistoryId(null);
                            setFormData({ goalName: '', targetDate: '', description: '', startDate: '' });
                          }}
                          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGoal(goal.id)}
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors font-medium inline-flex items-center gap-2"
                        >
                          <Trash2 size={16} />
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
};

export default GoalManagement;
