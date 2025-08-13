'use client';

import React, { useState, useEffect } from 'react';
import { exerciseAPI, userAPI } from '@/lib/api';

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

const ExerciseStats: React.FC<ExerciseStatsProps> = ({ theme = 'light' }) => {
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [todayRecords, setTodayRecords] = useState<TodayRecord[]>([]);
  const [exerciseConfig, setExerciseConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [distanceValues, setDistanceValues] = useState<Record<string, number>>({});
  const [exerciseFeeling, setExerciseFeeling] = useState<string>('');

  // 加载运动类型和今日记录
  const loadData = async () => {
    try {
      setLoading(true);
      const [typesResponse, recordsResponse, feelingResponse, configResponse] = await Promise.all([
        exerciseAPI.getExerciseTypes(),
        exerciseAPI.getTodayRecords(),
        exerciseAPI.getExerciseFeeling(),
        userAPI.getExerciseConfig(),
      ]);

      const types = typesResponse.data.data || [];
      const records = recordsResponse.data.data || [];
      const feeling = feelingResponse.data.data?.feeling || '';
      const config = configResponse.data || {};

      setExerciseTypes(types);
      setTodayRecords(records);
      setExerciseFeeling(feeling);
      setExerciseConfig(config);

      // 初始化里程型运动的输入框值
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
      setLoading(false);
    }
  };

  // 添加计数型运动记录
  const addCountRecord = async (exerciseId: string, increment: number) => {
    // 设置提交状态
    setSubmitting(prev => ({ ...prev, [exerciseId]: true }));

    try {
      // 乐观更新：立即更新UI
      setTodayRecords(prev => {
        const existing = prev.find(r => r.exerciseId === exerciseId);
        if (existing) {
          return prev.map(r =>
            r.exerciseId === exerciseId
              ? { ...r, totalValue: r.totalValue + increment }
              : r
          );
        } else {
          const exerciseType = exerciseTypes.find(e => e.id === exerciseId);
          return [...prev, {
            exerciseId,
            exerciseName: exerciseType?.name || '',
            exerciseType: 'COUNT' as const,
            unit: exerciseType?.unit || '次',
            totalValue: increment,
          }];
        }
      });

      // 后台提交 - 使用setTodayExerciseValue来更新今日总值
      const currentRecord = todayRecords.find(r => r.exerciseId === exerciseId);
      const newTotalValue = (currentRecord?.totalValue || 0) + increment;

      await exerciseAPI.setTodayExerciseValue({
        exerciseId,
        totalValue: newTotalValue,
      });
    } catch (error) {
      console.error('添加运动记录失败:', error);
      alert('添加运动记录失败');
      // 失败时重新加载数据
      await loadData();
    } finally {
      // 清除提交状态
      setSubmitting(prev => ({ ...prev, [exerciseId]: false }));
    }
  };

  // 更新里程型运动记录
  const updateDistanceRecord = async (exerciseId: string, newValue: number) => {
    const oldValue = getTodayValue(exerciseId);

    if (newValue === oldValue) {
      return; // 值没有变化，不需要提交
    }

    // 设置提交状态
    setSubmitting(prev => ({ ...prev, [exerciseId]: true }));

    try {
      // 乐观更新：立即更新UI
      setTodayRecords(prev => {
        const existing = prev.find(r => r.exerciseId === exerciseId);
        if (existing) {
          return prev.map(r =>
            r.exerciseId === exerciseId
              ? { ...r, totalValue: newValue }
              : r
          );
        } else {
          const exerciseType = exerciseTypes.find(e => e.id === exerciseId);
          return [...prev, {
            exerciseId,
            exerciseName: exerciseType?.name || '',
            exerciseType: 'DISTANCE' as const,
            unit: exerciseType?.unit || '公里',
            totalValue: newValue,
          }];
        }
      });

      // 后台提交 - 设置今日总值
      await exerciseAPI.setTodayExerciseValue({
        exerciseId,
        totalValue: newValue,
      });
    } catch (error) {
      console.error('更新运动记录失败:', error);
      alert('更新运动记录失败');
      // 失败时恢复原值
      setDistanceValues(prev => ({ ...prev, [exerciseId]: oldValue }));
      await loadData();
    } finally {
      // 清除提交状态
      setSubmitting(prev => ({ ...prev, [exerciseId]: false }));
    }
  };

  // 获取今日记录值
  const getTodayValue = (exerciseId: string): number => {
    const record = todayRecords.find(r => r.exerciseId === exerciseId);
    return record?.totalValue || 0;
  };

  // 处理距离输入变化
  const handleDistanceInputChange = (exerciseId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setDistanceValues(prev => ({ ...prev, [exerciseId]: numValue }));
  };

  // 处理距离输入失去焦点
  const handleDistanceInputBlur = (exerciseId: string) => {
    const value = distanceValues[exerciseId] || 0;
    updateDistanceRecord(exerciseId, value);
  };

  // 处理距离输入回车键
  const handleDistanceInputKeyPress = (e: React.KeyboardEvent, exerciseId: string) => {
    if (e.key === 'Enter') {
      const value = distanceValues[exerciseId] || 0;
      updateDistanceRecord(exerciseId, value);
      (e.target as HTMLInputElement).blur(); // 移除焦点
    }
  };

  // 保存运动感受
  const saveExerciseFeeling = async (feeling: string) => {
    try {
      setExerciseFeeling(feeling);
      await exerciseAPI.setExerciseFeeling(feeling);
    } catch (error) {
      console.error('保存运动感受失败:', error);
      alert('保存运动感受失败');
    }
  };

  // 组件加载时获取数据
  useEffect(() => {
    loadData();
  }, []);

  // 根据用户配置过滤运动类型
  const getExerciseNameKey = (name: string) => {
    const nameMap: Record<string, string> = {
      '单杠': 'showPullUps',
      '深蹲': 'showSquats',
      '俯卧撑': 'showPushUps',
      '跑步': 'showRunning',
      '游泳': 'showSwimming',
      '骑行': 'showCycling'
    };
    return nameMap[name];
  };

  const isExerciseVisible = (exercise: ExerciseType) => {
    if (!exerciseConfig) return true; // 配置未加载时显示所有
    const configKey = getExerciseNameKey(exercise.name);
    return configKey ? exerciseConfig[configKey] : true;
  };

  // 按类型分组运动并根据配置过滤
  const countExercises = exerciseTypes.filter(e => e.type === 'COUNT' && isExerciseVisible(e));
  const distanceExercises = exerciseTypes.filter(e => e.type === 'DISTANCE' && isExerciseVisible(e));

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ fontSize: '1.25rem' }}>🏃</span>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          运动统计
        </h3>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="text-sm opacity-60">加载中...</div>
        </div>
      ) : (
        <>
          {/* 计数型运动 - 横向紧凑布局 */}
          {countExercises.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {countExercises.map((exercise) => (
                <div key={exercise.id} style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    color: exercise.color || 'var(--accent-primary)',
                    marginBottom: '0.25rem'
                  }}>
                    {getTodayValue(exercise.id)}
                  </div>
                  <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                    {exercise.icon} {exercise.name}
                  </div>
                  <button
                    className="btn exercise-btn"
                    style={{
                      backgroundColor: exercise.color || 'var(--accent-primary)',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      width: '100%',
                      opacity: submitting[exercise.id] ? 0.6 : 1
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

          {/* 里程型运动 */}
          {distanceExercises.map((exercise) => (
            <div key={exercise.id} className="flex items-center gap-2 mb-3" style={{
              padding: '0.5rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '6px',
              border: '1px solid var(--border-color)'
            }}>
              <span className="text-sm font-medium" style={{
                color: 'var(--text-primary)',
                minWidth: '60px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>{exercise.icon}</span>
                <span>{exercise.name}</span>
              </span>

              <div className="flex items-center gap-2 flex-1">
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
                  className="input"
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    opacity: submitting[exercise.id] ? 0.6 : 1,
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}
                  disabled={loading || submitting[exercise.id]}
                />

                <span className="text-sm" style={{
                  color: 'var(--text-secondary)',
                  minWidth: '30px'
                }}>
                  {exercise.unit}
                </span>
              </div>
            </div>
          ))}

          {/* 运动感受选择 */}
          {exerciseTypes.length > 0 && (
            <div className="mt-4" style={{
              padding: '0.75rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                💭 今日运动感受
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'excellent', label: '非常棒', emoji: '🔥', color: '#ff6b6b' },
                  { value: 'good', label: '不错', emoji: '😊', color: '#51cf66' },
                  { value: 'normal', label: '一般', emoji: '😐', color: '#ffd43b' },
                  { value: 'tired', label: '有点累', emoji: '😴', color: '#74c0fc' },
                ].map((feeling) => (
                  <button
                    key={feeling.value}
                    onClick={() => saveExerciseFeeling(feeling.value)}
                    className="btn"
                    style={{
                      padding: '0.5rem',
                      fontSize: '0.875rem',
                      backgroundColor: exerciseFeeling === feeling.value ? feeling.color : 'var(--bg-secondary)',
                      color: exerciseFeeling === feeling.value ? 'white' : 'var(--text-primary)',
                      border: `1px solid ${exerciseFeeling === feeling.value ? feeling.color : 'var(--border-color)'}`,
                      borderRadius: '6px',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <span>{feeling.emoji}</span>
                    <span>{feeling.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 空状态 */}
          {exerciseTypes.length === 0 && (
            <div className="text-center py-8 opacity-60">
              <div className="text-2xl mb-2">🏃</div>
              <p className="mb-2">还没有设置运动类型</p>
              <p className="text-xs opacity-75">系统将自动为您创建默认运动类型</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExerciseStats;
