'use client';

import React, { useState, useEffect } from 'react';
import { expenseAPI } from '@/lib/api';

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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [mealValues, setMealValues] = useState<MealExpenses>({ breakfast: 0, lunch: 0, dinner: 0 });
  const [otherForm, setOtherForm] = useState({ description: '', amount: '' });

  // 加载今日消费数据
  const loadData = async () => {
    try {
      setLoading(true);
      const response = await expenseAPI.getTodayExpenses();
      const data = response.data.data;
      
      setTodayExpenses(data);
      setMealValues(data.meals);
    } catch (error) {
      console.error('加载消费数据失败:', error);
    } finally {
      setLoading(false);
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
      // 乐观更新
      setTodayExpenses(prev => ({
        ...prev,
        meals: { ...prev.meals, [category]: amount },
        totalMeal: prev.totalMeal - oldValue + amount,
      }));

      // 后台提交
      await expenseAPI.setMealExpense({ category, amount });
    } catch (error) {
      console.error('更新餐饮消费失败:', error);
      alert('更新餐饮消费失败');
      // 失败时恢复原值
      setMealValues(prev => ({ ...prev, [category]: oldValue }));
      await loadData();
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
      await loadData();
    }
  };

  // 处理餐饮输入变化
  const handleMealInputChange = (category: 'breakfast' | 'lunch' | 'dinner', value: string) => {
    const numValue = parseFloat(value) || 0;
    setMealValues(prev => ({ ...prev, [category]: numValue }));
  };

  // 处理餐饮输入失去焦点
  const handleMealInputBlur = (category: 'breakfast' | 'lunch' | 'dinner') => {
    const value = mealValues[category];
    updateMealExpense(category, value);
  };

  // 处理餐饮输入回车键
  const handleMealInputKeyPress = (e: React.KeyboardEvent, category: 'breakfast' | 'lunch' | 'dinner') => {
    if (e.key === 'Enter') {
      const value = mealValues[category];
      updateMealExpense(category, value);
      (e.target as HTMLInputElement).blur();
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    loadData();
  }, []);

  const totalExpense = todayExpenses.totalMeal + todayExpenses.totalOther;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ fontSize: '1.25rem' }}>💰</span>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          消费统计
        </h3>
        <div className="ml-auto text-sm" style={{ color: 'var(--accent-primary)' }}>
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
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { key: 'breakfast' as const, name: '早餐', icon: '🌅' },
              { key: 'lunch' as const, name: '午餐', icon: '🌞' },
              { key: 'dinner' as const, name: '晚餐', icon: '🌙' },
            ].map((meal) => (
              <div key={meal.key} style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textAlign: 'center'
              }}>
                <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  {meal.icon} {meal.name}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder={submitting[meal.key] ? '保存中...' : '0'}
                    min="0"
                    step="0.01"
                    value={mealValues[meal.key] > 0 ? mealValues[meal.key] : ''}
                    onChange={(e) => handleMealInputChange(meal.key, e.target.value)}
                    onBlur={() => handleMealInputBlur(meal.key)}
                    onKeyPress={(e) => handleMealInputKeyPress(e, meal.key)}
                    onFocus={(e) => e.target.select()}
                    className="input"
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      opacity: submitting[meal.key] ? 0.6 : 1
                    }}
                    disabled={loading || submitting[meal.key]}
                  />

                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    元
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 其他消费添加 */}
          <div className="mb-4" style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              🛒 其他消费
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="项目名称"
                value={otherForm.description}
                onChange={(e) => setOtherForm(prev => ({ ...prev, description: e.target.value }))}
                onFocus={(e) => e.target.select()} // 选中所有内容
                className="input"
                style={{
                  flex: 2,
                  padding: '0.5rem',
                  fontSize: '0.875rem'
                }}
                disabled={loading || submitting['other']}
              />
              <input
                type="number"
                placeholder="金额"
                min="0"
                step="0.01"
                value={otherForm.amount}
                onChange={(e) => setOtherForm(prev => ({ ...prev, amount: e.target.value }))}
                onFocus={(e) => e.target.select()} // 选中所有内容
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && otherForm.description.trim() && otherForm.amount) {
                    addOtherExpense();
                  }
                }}
                className="input"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.875rem'
                }}
                disabled={loading || submitting['other']}
              />
              <button
                className="btn btn-primary"
                onClick={addOtherExpense}
                disabled={loading || submitting['other'] || !otherForm.description.trim() || !otherForm.amount}
                style={{
                  minWidth: '60px',
                  opacity: (!otherForm.description.trim() || !otherForm.amount) ? 0.5 : 1
                }}
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
                  <div key={expense.id} className="flex items-center justify-between" style={{
                    padding: '0.5rem',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div className="flex-1">
                      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {expense.description}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {new Date(expense.createdAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Shanghai'
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: 'var(--accent-primary)' }}>
                        ¥{expense.amount.toFixed(2)}
                      </span>
                      <button
                        className="btn btn-sm"
                        onClick={() => deleteOtherExpense(expense.id, expense.amount)}
                        style={{
                          backgroundColor: 'var(--error-color)',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem'
                        }}
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
