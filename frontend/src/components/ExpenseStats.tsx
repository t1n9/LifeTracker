'use client';

import React, { useState, useEffect, useRef } from 'react';
import { expenseAPI } from '@/lib/api';
import {
  AGENT_DATA_CHANGED_EVENT,
  eventAffectsDomains,
} from '@/lib/agent-events';
import styles from './ExpenseStats.module.css';

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

const ExpenseStats: React.FC<ExpenseStatsProps> = () => {
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

  const updateMealExpense = async (category: 'breakfast' | 'lunch' | 'dinner', amount: number) => {
    const oldValue = todayExpenses.meals[category];

    if (amount === oldValue) {
      return;
    }

    setSubmitting(prev => ({ ...prev, [category]: true }));

    try {
      await expenseAPI.setMealExpense({ category, amount });

      setTodayExpenses(prev => ({
        ...prev,
        meals: { ...prev.meals, [category]: amount },
        totalMeal: prev.totalMeal - oldValue + amount,
      }));
    } catch (error) {
      console.error('更新餐饮消费失败:', error);
      alert('更新餐饮消费失败');
      setMealValues(prev => ({ ...prev, [category]: oldValue }));
    } finally {
      setSubmitting(prev => ({ ...prev, [category]: false }));
    }
  };

  const addOtherExpense = async () => {
    const description = otherForm.description.trim();
    const amount = parseFloat(otherForm.amount);

    if (!description || amount <= 0) {
      alert('请输入项目名称和正确金额');
      return;
    }

    setSubmitting(prev => ({ ...prev, other: true }));

    try {
      const response = await expenseAPI.addOtherExpense({ description, amount });
      const newExpense = response.data.data;

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

      setOtherForm({ description: '', amount: '' });
    } catch (error) {
      console.error('添加其他消费失败:', error);
      alert('添加其他消费失败');
    } finally {
      setSubmitting(prev => ({ ...prev, other: false }));
    }
  };

  const deleteOtherExpense = async (expenseId: string, amount: number) => {
    if (!confirm('确定删除这条消费记录吗？')) {
      return;
    }

    try {
      setTodayExpenses(prev => ({
        ...prev,
        others: prev.others.filter(item => item.id !== expenseId),
        totalOther: prev.totalOther - amount,
      }));

      await expenseAPI.deleteOtherExpense(expenseId);
    } catch (error) {
      console.error('删除消费失败:', error);
      alert('删除消费失败');
      await loadData({ silent: true });
    }
  };

  const handleMealInputChange = (category: 'breakfast' | 'lunch' | 'dinner', value: string) => {
    const numValue = parseFloat(value) || 0;
    setMealValues(prev => ({ ...prev, [category]: numValue }));
  };

  const handleMealInputBlur = (category: 'breakfast' | 'lunch' | 'dinner') => {
    if (submitting[category]) return;
    const value = mealValues[category];
    updateMealExpense(category, value);
  };

  const handleMealInputKeyDown = (e: React.KeyboardEvent, category: 'breakfast' | 'lunch' | 'dinner') => {
    if (e.key === 'Enter') {
      const value = mealValues[category];
      updateMealExpense(category, value);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <span className={styles.titleIcon}>💳</span>
          <h3 className={styles.title}>消费统计</h3>
        </div>
        {refreshing && <span className={styles.sync}>同步中...</span>}
        <div className={styles.total}>今日总计 ¥{totalExpense.toFixed(2)}</div>
      </div>

      {loading ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <>
          <div className={styles.mealGrid}>
            {[
              { key: 'breakfast' as const, name: '早餐', icon: '🥪' },
              { key: 'lunch' as const, name: '午餐', icon: '🍱' },
              { key: 'dinner' as const, name: '晚餐', icon: '🍲' },
            ].map((meal) => (
              <div key={meal.key} className={styles.mealItem}>
                <div className={styles.mealName}>{meal.icon} {meal.name}</div>
                <div className={styles.mealInputGroup}>
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
                    className={styles.mealInput}
                    style={{ opacity: submitting[meal.key] ? 0.6 : 1 }}
                    disabled={loading || submitting[meal.key]}
                  />
                  <span className={styles.mealUnit}>¥</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.otherSection}>
            <div className={styles.sectionTitle}>其他消费</div>
            <div className={styles.otherForm}>
              <input
                type="text"
                placeholder="项目名称"
                value={otherForm.description}
                onChange={(e) => setOtherForm(prev => ({ ...prev, description: e.target.value }))}
                className={styles.otherInput}
                disabled={loading || submitting.other}
              />
              <input
                type="number"
                placeholder="金额"
                min="0"
                step="0.01"
                value={otherForm.amount}
                onChange={(e) => setOtherForm(prev => ({ ...prev, amount: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && otherForm.description.trim() && otherForm.amount) {
                    addOtherExpense();
                  }
                }}
                className={styles.otherInput}
                disabled={loading || submitting.other}
              />
              <button
                className={styles.addButton}
                onClick={addOtherExpense}
                disabled={loading || submitting.other || !otherForm.description.trim() || !otherForm.amount}
              >
                {submitting.other ? '...' : '添加'}
              </button>
            </div>
          </div>

          {todayExpenses.others.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>今日其他消费</div>
              <div className={styles.list}>
                {todayExpenses.others.map((expense) => (
                  <div key={expense.id} className={styles.listItem}>
                    <div className={styles.listContent}>
                      <div className={styles.name}>{expense.description}</div>
                      <div className={styles.time}>
                        {new Date(expense.createdAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Shanghai'
                        })}
                      </div>
                    </div>
                    <div className={styles.actions}>
                      <span className={styles.amount}>¥{expense.amount.toFixed(2)}</span>
                      <button
                        className={styles.deleteButton}
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
