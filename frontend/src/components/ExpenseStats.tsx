'use client';

import React, { useState, useEffect, useRef } from 'react';
import { expenseAPI } from '@/lib/api';
import {
  AGENT_DATA_CHANGED_EVENT,
  eventAffectsDomains,
} from '@/lib/agent-events';

interface MealExpenses {
  breakfast: number;
  lunch: number;
  dinner: number;
}

interface OtherExpense {
  id: string;
  description: string;
  amount: number;
  createdAt: string;
}

interface TodayExpenses {
  meals: MealExpenses;
  others: OtherExpense[];
  totalMeal: number;
  totalOther: number;
}

interface ExpenseStatsProps {
  theme?: 'light' | 'dark';
}

const ExpenseStats: React.FC<ExpenseStatsProps> = ({ theme = 'light' }) => {
  const [todayExpenses, setTodayExpenses] = useState<TodayExpenses>({
    meals: { breakfast: 0, lunch: 0, dinner: 0 },
    others: [],
    totalMeal: 0,
    totalOther: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [mealValues, setMealValues] = useState<MealExpenses>({ breakfast: 0, lunch: 0, dinner: 0 });
  const [otherForm, setOtherForm] = useState({ description: '', amount: '' });

  // 加载今日消费数据
  const loadData = async ({ silent = false }: { silent?: boolean } = {}) => {
    const useSilentRefresh = silent && hasLoadedOnceRef.current;

    try {
      if (useSilentRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await expenseAPI.getTodayExpenses();
      const data = response.data.data;
      
      setTodayExpenses(data);
      setMealValues(data.meals);
    } catch (error) {
      console.error('加载消费数据失败:', error);
    } finally {
      if (useSilentRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
        hasLoadedOnceRef.current = true;
      }
    }
  };

  // 更新餐饮消费
  const updateMealExpense = async (category: 'breakfast' | 'lunch' | 'dinner', amount: number) => {
    const oldValue = todayExpenses.meals[category];

    if (amount === oldValue) {
      return; // 值没有变化
    }

    setSubmitting(prev => ({ ...prev, [category]: true }));

    try {
      // 先调用API，成功后再更新状态，避免双重更新
      await expenseAPI.setMealExpense({ category, amount });

      // API成功后更新状态
      setTodayExpenses(prev => ({
        ...prev,
        meals: { ...prev.meals, [category]: amount },
        totalMeal: prev.totalMeal - oldValue + amount,
      }));
    } catch (error) {
      console.error('更新餐饮消费失败:', error);
      alert('更新餐饮消费失败');
      // 失败时恢复输入框的值
      setMealValues(prev => ({ ...prev, [category]: oldValue }));
    } finally {
      setSubmitting(prev => ({ ...prev, [category]: false }));
    }
  };

  // 添加其他消费
  const addOtherExpense = async () => {
    const description = otherForm.description.trim();
    const amount = parseFloat(otherForm.amount);

    if (!description || amount <= 0) {
      alert('请填写有效的项目名称和金额');
      return;
    }

    setSubmitting(prev => ({ ...prev, 'other': true }));

    try {
      const response = await expenseAPI.addOtherExpense({ description, amount });
      const newExpense = response.data.data;

      // 乐观更新
      setTodayExpenses(prev => ({
        ...prev,
        others: [...prev.others, {
          id: newExpense.id,
          description: newExpense.description,
          amount: newExpense.amount,
          createdAt: newExpense.createdAt,
        }],
        totalOther: prev.totalOther + amount,
      }));

      // 清空表单
      setOtherForm({ description: '', amount: '' });
    } catch (error) {
      console.error('添加其他消费失败:', error);
      alert('添加其他消费失败');
    } finally {
      setSubmitting(prev => ({ ...prev, 'other': false }));
    }
  };

  // 删除其他消费
  const deleteOtherExpense = async (expenseId: string, amount: number) => {
    if (!confirm('确定要删除这条消费记录吗？')) {
      return;
    }

    try {
      // 乐观更新
      setTodayExpenses(prev => ({
        ...prev,
        others: prev.others.filter(item => item.id !== expenseId),
        totalOther: prev.totalOther - amount,
      }));

      await expenseAPI.deleteOtherExpense(expenseId);
    } catch (error) {
      console.error('删除消费记录失败:', error);
      alert('删除消费记录失败');
      await loadData({ silent: true });
    }
  };

  // 处理餐饮输入变化
  const handleMealInputChange = (category: 'breakfast' | 'lunch' | 'dinner', value: string) => {
    const numValue = parseFloat(value) || 0;
    setMealValues(prev => ({ ...prev, [category]: numValue }));
  };

  // 处理餐饮输入失去焦点
  const handleMealInputBlur = (category: 'breakfast' | 'lunch' | 'dinner') => {
    // 如果正在提交中，跳过blur事件，避免重复提交
    if (submitting[category]) {
      return;
    }
    const value = mealValues[category];
    updateMealExpense(category, value);
  };

  // 处理餐饮输入回车键
  const handleMealInputKeyDown = (e: React.KeyboardEvent, category: 'breakfast' | 'lunch' | 'dinner') => {
    if (e.key === 'Enter') {
      const value = mealValues[category];
      updateMealExpense(category, value);
      // 不调用blur()，避免触发onBlur事件导致重复提交
      // (e.target as HTMLInputElement).blur();
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    loadData();
  }, []);

  // Agent 操作后刷新
  useEffect(() => {
    const handler = (event: Event) => {
      if (eventAffectsDomains(event, ['expenses'])) {
        loadData({ silent: true });
      }
    };
    window.addEventListener(AGENT_DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler);
  }, []);

  const totalExpense = todayExpenses.totalMeal + todayExpenses.totalOther;

  return (
    <div className="card">
      <div className="expense-header">
        <span style={{ fontSize: '1.25rem' }}>💰</span>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          消费统计
        </h3>
        {refreshing && (
          <span className="text-xs opacity-60" style={{ color: 'var(--text-muted)' }}>
            同步中...
          </span>
        )}
        <div className="expense-total">
          今日总计: ¥{totalExpense.toFixed(2)}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="text-sm opacity-60">加载中...</div>
        </div>
      ) : (
        <>
          {/* 餐饮消费 */}
          <div className="expense-meal-grid">
            {[
              { key: 'breakfast' as const, name: '早餐', icon: '🌅' },
              { key: 'lunch' as const, name: '午餐', icon: '🌞' },
              { key: 'dinner' as const, name: '晚餐', icon: '🌙' },
            ].map((meal) => (
              <div key={meal.key} className="expense-meal-item">
                <div className="expense-meal-name">
                  {meal.icon} {meal.name}
                </div>
                <div className="expense-meal-input-group">
                  <input
                    type="number"
                    placeholder={submitting[meal.key] ? '保存中...' : '0'}
                    min="0"
                    step="0.01"
                    value={mealValues[meal.key] > 0 ? mealValues[meal.key] : ''}
                    onChange={(e) => handleMealInputChange(meal.key, e.target.value)}
                    onBlur={() => handleMealInputBlur(meal.key)}
                    onKeyDown={(e) => handleMealInputKeyDown(e, meal.key)}
                    onFocus={(e) => e.target.select()}
                    className="expense-meal-input"
                    style={{ opacity: submitting[meal.key] ? 0.6 : 1 }}
                    disabled={loading || submitting[meal.key]}
                  />

                  <span className="expense-meal-unit">
                    元
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 其他消费添加 */}
          <div className="expense-other-section">
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              🛒 其他消费
            </div>
            <div className="expense-other-form">
              <input
                type="text"
                placeholder="项目名称"
                value={otherForm.description}
                onChange={(e) => setOtherForm(prev => ({ ...prev, description: e.target.value }))}
                onFocus={(e) => e.target.select()}
                className="expense-other-description"
                disabled={loading || submitting['other']}
              />
              <input
                type="number"
                placeholder="金额"
                min="0"
                step="0.01"
                value={otherForm.amount}
                onChange={(e) => setOtherForm(prev => ({ ...prev, amount: e.target.value }))}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && otherForm.description.trim() && otherForm.amount) {
                    addOtherExpense();
                  }
                }}
                className="expense-other-amount"
                disabled={loading || submitting['other']}
              />
              <button
                className="expense-other-btn"
                onClick={addOtherExpense}
                disabled={loading || submitting['other'] || !otherForm.description.trim() || !otherForm.amount}
                style={{ opacity: (!otherForm.description.trim() || !otherForm.amount) ? 0.5 : 1 }}
              >
                {submitting['other'] ? '...' : '添加'}
              </button>
            </div>
          </div>

          {/* 其他消费列表 */}
          {todayExpenses.others.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                今日其他消费
              </div>
              <div className="space-y-2">
                {todayExpenses.others.map((expense) => (
                  <div key={expense.id} className="expense-list-item">
                    <div className="expense-list-content">
                      <div className="expense-list-name">
                        {expense.description}
                      </div>
                      <div className="expense-list-time">
                        {new Date(expense.createdAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Shanghai'
                        })}
                      </div>
                    </div>
                    <div className="expense-list-actions">
                      <span className="expense-list-amount">
                        ¥{expense.amount.toFixed(2)}
                      </span>
                      <button
                        className="expense-delete-btn"
                        onClick={() => deleteOtherExpense(expense.id, expense.amount)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExpenseStats;
