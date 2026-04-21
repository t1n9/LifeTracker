'use client';

import React, { useState, useEffect, useRef } from 'react';
import { exerciseAPI } from '@/lib/api';
import {
  AGENT_DATA_CHANGED_EVENT,
  eventAffectsDomains,
} from '@/lib/agent-events';
import styles from './ExerciseStats.module.css';

interface ExerciseType {
  id: string;
  name: string;
  type: 'COUNT' | 'DISTANCE';
  unit: string;
  increment?: number;
  icon?: string;
  color?: string;
}

interface TodayRecord {
  exerciseId: string;
  exerciseName: string;
  exerciseType: 'COUNT' | 'DISTANCE';
  unit: string;
  totalValue: number;
}

interface ExerciseStatsProps {
  theme?: 'light' | 'dark';
}

const ExerciseStats: React.FC<ExerciseStatsProps> = () => {
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [distanceValues, setDistanceValues] = useState<Record<string, number>>({});
  const [exerciseFeeling, setExerciseFeeling] = useState<string>('');

  const loadData = async ({ silent = false }: { silent?: boolean } = {}) => {
    const useSilentRefresh = silent && hasLoadedOnceRef.current;

    try {
      if (useSilentRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [typesResponse, recordsResponse, feelingResponse] = await Promise.all([
        exerciseAPI.getExerciseTypes(),
        exerciseAPI.getTodayRecords(),
        exerciseAPI.getExerciseFeeling(),
      ]);

      const types = typesResponse.data.data || [];
      const records = recordsResponse.data.data || [];
      const feeling = feelingResponse.data.data?.feeling || '';

      setExerciseTypes(types);
      setTodayRecords(records);
      setExerciseFeeling(feeling);

      const initialDistanceValues: Record<string, number> = {};
      types.forEach((type: ExerciseType) => {
        if (type.type === 'DISTANCE') {
          const record = records.find((r: TodayRecord) => r.exerciseId === type.id);
          initialDistanceValues[type.id] = record?.totalValue || 0;
        }
      });
      setDistanceValues(initialDistanceValues);
    } catch (error) {
      console.error('加载运动数据失败:', error);
    } finally {
      if (useSilentRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
        hasLoadedOnceRef.current = true;
      }
    }
  };

  const addCountRecord = async (exerciseId: string, increment: number) => {
    setSubmitting(prev => ({ ...prev, [exerciseId]: true }));

    try {
      setTodayRecords(prev => {
        const existing = prev.find(r => r.exerciseId === exerciseId);
        if (existing) {
          return prev.map(r =>
            r.exerciseId === exerciseId
              ? { ...r, totalValue: r.totalValue + increment }
              : r
          );
        }

        const exerciseType = exerciseTypes.find(e => e.id === exerciseId);
        return [...prev, {
          exerciseId,
          exerciseName: exerciseType?.name || '',
          exerciseType: 'COUNT' as const,
          unit: exerciseType?.unit || '次',
          totalValue: increment,
        }];
      });

      const currentRecord = todayRecords.find(r => r.exerciseId === exerciseId);
      const newTotalValue = (currentRecord?.totalValue || 0) + increment;

      await exerciseAPI.setTodayExerciseValue({
        exerciseId,
        totalValue: newTotalValue,
      });
    } catch (error) {
      console.error('添加运动记录失败:', error);
      alert('添加运动记录失败');
      await loadData({ silent: true });
    } finally {
      setSubmitting(prev => ({ ...prev, [exerciseId]: false }));
    }
  };

  const updateDistanceRecord = async (exerciseId: string, newValue: number) => {
    const oldValue = getTodayValue(exerciseId);

    if (newValue === oldValue) {
      return;
    }

    setSubmitting(prev => ({ ...prev, [exerciseId]: true }));

    try {
      setTodayRecords(prev => {
        const existing = prev.find(r => r.exerciseId === exerciseId);
        if (existing) {
          return prev.map(r =>
            r.exerciseId === exerciseId
              ? { ...r, totalValue: newValue }
              : r
          );
        }

        const exerciseType = exerciseTypes.find(e => e.id === exerciseId);
        return [...prev, {
          exerciseId,
          exerciseName: exerciseType?.name || '',
          exerciseType: 'DISTANCE' as const,
          unit: exerciseType?.unit || 'km',
          totalValue: newValue,
        }];
      });

      await exerciseAPI.setTodayExerciseValue({
        exerciseId,
        totalValue: newValue,
      });
    } catch (error) {
      console.error('更新运动记录失败:', error);
      alert('更新运动记录失败');
      setDistanceValues(prev => ({ ...prev, [exerciseId]: oldValue }));
      await loadData({ silent: true });
    } finally {
      setSubmitting(prev => ({ ...prev, [exerciseId]: false }));
    }
  };

  const getTodayValue = (exerciseId: string): number => {
    const record = todayRecords.find(r => r.exerciseId === exerciseId);
    return record?.totalValue || 0;
  };

  const handleDistanceInputChange = (exerciseId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setDistanceValues(prev => ({ ...prev, [exerciseId]: numValue }));
  };

  const handleDistanceInputBlur = (exerciseId: string) => {
    const value = distanceValues[exerciseId] || 0;
    updateDistanceRecord(exerciseId, value);
  };

  const handleDistanceInputKeyPress = (e: React.KeyboardEvent, exerciseId: string) => {
    if (e.key === 'Enter') {
      const value = distanceValues[exerciseId] || 0;
      updateDistanceRecord(exerciseId, value);
      (e.target as HTMLInputElement).blur();
    }
  };

  const saveExerciseFeeling = async (feeling: string) => {
    try {
      setExerciseFeeling(feeling);
      await exerciseAPI.setExerciseFeeling(feeling);
    } catch (error) {
      console.error('保存运动感受失败:', error);
      alert('保存运动感受失败');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      if (eventAffectsDomains(event, ['exercise'])) {
        loadData({ silent: true });
      }
    };
    window.addEventListener(AGENT_DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler);
  }, []);

  const countExercises = exerciseTypes.filter(e => e.type === 'COUNT');
  const distanceExercises = exerciseTypes.filter(e => e.type === 'DISTANCE');

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <span className={styles.titleIcon}>🏃</span>
          <h3 className={styles.title}>运动统计</h3>
        </div>
        {refreshing && <span className={styles.sync}>同步中...</span>}
      </div>

      {loading ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        <>
          {countExercises.length > 0 && (
            <div className={styles.countGrid}>
              {countExercises.map((exercise) => (
                <div key={exercise.id} className={styles.countItem}>
                  <div
                    className={styles.countValue}
                    style={{ color: exercise.color || 'var(--accent-primary)' }}
                  >
                    {getTodayValue(exercise.id)}
                  </div>
                  <div className={styles.countName}>
                    {exercise.icon} {exercise.name}
                  </div>
                  <button
                    className={styles.countButton}
                    style={{
                      backgroundColor: exercise.color || 'var(--accent-primary)',
                      opacity: submitting[exercise.id] ? 0.6 : 1,
                    }}
                    onClick={() => addCountRecord(exercise.id, exercise.increment || 1)}
                    disabled={loading || submitting[exercise.id]}
                  >
                    {submitting[exercise.id] ? (
                      <span>...</span>
                    ) : (
                      <>
                        <span>+</span>
                        <span>{exercise.increment || 1}</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {distanceExercises.map((exercise) => (
            <div key={exercise.id} className={styles.distanceItem}>
              <span className={styles.distanceName}>
                <span>{exercise.icon}</span>
                <span>{exercise.name}</span>
              </span>

              <div className={styles.inputGroup}>
                <input
                  type="number"
                  placeholder={submitting[exercise.id] ? '保存中...' : '0'}
                  min="0"
                  step="0.1"
                  value={distanceValues[exercise.id] > 0 ? distanceValues[exercise.id] : ''}
                  onChange={(e) => handleDistanceInputChange(exercise.id, e.target.value)}
                  onBlur={() => handleDistanceInputBlur(exercise.id)}
                  onKeyPress={(e) => handleDistanceInputKeyPress(e, exercise.id)}
                  onFocus={(e) => e.target.select()}
                  className={styles.distanceInput}
                  style={{ opacity: submitting[exercise.id] ? 0.6 : 1 }}
                  disabled={loading || submitting[exercise.id]}
                />

                <span className={styles.unit}>{exercise.unit}</span>
              </div>
            </div>
          ))}

          {exerciseTypes.length > 0 && (
            <div className={styles.feelingCard}>
              <div className={styles.feelingTitle}>今日运动感受</div>
              <div className={styles.feelingGrid}>
                {[
                  { value: 'excellent', label: '非常棒', emoji: '🔥', color: '#ff6b6b' },
                  { value: 'good', label: '不错', emoji: '👍', color: '#51cf66' },
                  { value: 'normal', label: '一般', emoji: '🙂', color: '#ffd43b' },
                  { value: 'tired', label: '有点累', emoji: '😵', color: '#74c0fc' },
                ].map((feeling) => (
                  <button
                    key={feeling.value}
                    onClick={() => saveExerciseFeeling(feeling.value)}
                    className={styles.feelingButton}
                    style={{
                      backgroundColor: exerciseFeeling === feeling.value ? feeling.color : 'var(--bg-secondary)',
                      color: exerciseFeeling === feeling.value ? 'white' : 'var(--text-primary)',
                      borderColor: exerciseFeeling === feeling.value ? feeling.color : 'var(--border-color)',
                    }}
                  >
                    <span>{feeling.emoji}</span>
                    <span>{feeling.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {exerciseTypes.length === 0 && (
            <div className={styles.empty}>
              <div>🏃</div>
              <p>还没有运动类型</p>
              <p>请先在系统里创建运动项</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExerciseStats;
