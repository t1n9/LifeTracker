'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  fetchAvailableDates, 
  fetchDayData, 
  exportDayData,
  formatDate,
  formatStudyTime,
  getTaskStats,
  type DayData 
} from '@/services/historyService';

interface HistoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HistoryViewer({ isOpen, onClose }: HistoryViewerProps) {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [initialLoading, setInitialLoading] = useState(false);
  const [isSwitchingDate, setIsSwitchingDate] = useState(false);
  const [error, setError] = useState<string>('');
  const datePillScrollRef = useRef<HTMLDivElement | null>(null);

  // 组件打开时获取数据
  useEffect(() => {
    if (isOpen) {
      initializeHistoryData();
    }
  }, [isOpen]);

  // 初始化历史数据
  const initializeHistoryData = async () => {
    setInitialLoading(true);
    setError('');
    try {
      // console.log('🚀 初始化历史数据...');
      const dates = await fetchAvailableDates();
      setAvailableDates(dates);
      if (dates.length > 0) {
        setSelectedDate(dates[0]); // 默认选择最新日期
        await loadDateData(dates[0]);
      }
    } catch (error) {
      console.error('初始化历史数据失败:', error);
      setError('获取历史数据失败，请检查网络连接');
    } finally {
      setInitialLoading(false);
    }
  };

  // 加载指定日期的数据
  const loadDateData = async (date: string, options: { keepContent?: boolean } = {}) => {
    const keepContent = options.keepContent ?? false;
    if (keepContent) {
      setIsSwitchingDate(true);
    } else {
      setInitialLoading(true);
    }
    setError('');
    try {
      const data = await fetchDayData(date);
      setDayData(data);
    } catch (error) {
      console.error('加载数据失败:', error);
      setError('加载数据失败');
      if (keepContent) {
        setError('');
      } else {
        setDayData(null);
      }
    } finally {
      if (keepContent) {
        setIsSwitchingDate(false);
      } else {
        setInitialLoading(false);
      }
    }
  };

  // 切换日期
  const handleDateChange = (date: string) => {
    if (date === selectedDate) return;
    setSelectedDate(date);
    loadDateData(date, { keepContent: true });
  };

  // 上一天/下一天导航
  const navigateDate = (direction: 'prev' | 'next') => {
    const currentIndex = availableDates.indexOf(selectedDate);
    let newIndex;
    
    if (direction === 'prev') {
      newIndex = currentIndex + 1; // 数组是倒序的，所以+1是前一天
    } else {
      newIndex = currentIndex - 1; // -1是后一天
    }
    
    if (newIndex >= 0 && newIndex < availableDates.length) {
      const newDate = availableDates[newIndex];
      handleDateChange(newDate);
    }
  };

  // 导出当前查看的数据
  const handleExport = () => {
    if (!dayData) return;
    exportDayData(dayData, selectedDate);
  };

  const studyData: NonNullable<DayData['study']> = dayData?.study ?? {
    totalMinutes: 0,
    pomodoroCount: 0
  };
  const exerciseData: NonNullable<DayData['exercise']> = dayData?.exercise ?? {
    exercises: [],
    feeling: ''
  };
  const expensesData: NonNullable<DayData['expenses']> = dayData?.expenses ?? {
    total: 0,
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    customCategories: {},
    other: []
  };
  const customExpenseCategories = expensesData.customCategories ?? {};
  const otherExpenses = Array.isArray(expensesData.other) ? expensesData.other : [];
  const currentDateIndex = availableDates.indexOf(selectedDate);
  const canGoPrev = currentDateIndex >= 0 && currentDateIndex < availableDates.length - 1;
  const canGoNext = currentDateIndex > 0;
  const visibleRangeStart = Math.max(0, currentDateIndex - 5);
  const visibleRangeEnd = Math.min(availableDates.length, visibleRangeStart + 11);
  const visibleDates = availableDates.slice(visibleRangeStart, visibleRangeEnd).reverse();

  const formatDayPill = (dateText: string) => {
    const parsed = new Date(dateText);
    if (Number.isNaN(parsed.getTime())) {
      return { weekday: '', monthDay: dateText };
    }
    const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(parsed);
    const monthDay = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(parsed);
    return { weekday, monthDay };
  };
  const sectionCardStyle: React.CSSProperties = {
    padding: '1rem',
    background: 'color-mix(in srgb, var(--bg-tertiary) 84%, white 16%)',
    borderRadius: '16px',
    border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    boxShadow: '0 10px 22px rgba(15, 23, 42, 0.04)',
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '0.82rem',
    fontWeight: 700,
    marginBottom: '0.8rem',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  };

  useEffect(() => {
    if (!isOpen) return;
    const container = datePillScrollRef.current;
    if (!container) return;
    container.scrollTo({
      left: container.scrollWidth,
      behavior: 'auto'
    });
  }, [isOpen, visibleDates.length, selectedDate]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.56)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '860px',
        maxHeight: '90vh',
        overflow: 'hidden',
        boxShadow: '0 28px 56px rgba(15, 23, 42, 0.22)',
        border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📓</span>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 'bold',
              margin: 0,
              color: 'var(--text-primary)'
            }}>
              历史数据查看
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 82%, white 18%)',
              border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem'
            }}
          >
            X
          </button>
        </div>

        {/* Date selector */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
          background: 'color-mix(in srgb, var(--bg-tertiary) 86%, white 14%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          <button
            onClick={() => navigateDate('prev')}
            disabled={!canGoPrev}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              backgroundColor: !canGoPrev ? 'var(--bg-secondary)' : 'var(--accent-primary)',
              border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
              color: !canGoPrev ? 'var(--text-muted)' : 'white',
              cursor: !canGoPrev ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
            title="Prev"
          >
            {'<'}
          </button>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              ref={datePillScrollRef}
              style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              overflowX: 'auto',
              paddingBottom: '0.35rem',
              scrollbarWidth: 'thin'
            }}>
              {visibleDates.map((date) => {
                const active = date === selectedDate;
                const { weekday, monthDay } = formatDayPill(date);
                return (
                  <button
                    key={date}
                    onClick={() => handleDateChange(date)}
                    style={{
                      minWidth: '74px',
                      border: active
                        ? '1px solid color-mix(in srgb, var(--accent-primary) 52%, transparent 48%)'
                        : '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
                      background: active
                        ? 'color-mix(in srgb, var(--accent-primary) 14%, var(--bg-primary) 86%)'
                        : 'color-mix(in srgb, var(--bg-primary) 90%, white 10%)',
                      borderRadius: '12px',
                      padding: '0.55rem 0.62rem',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'grid',
                      gap: '0.16rem',
                      textAlign: 'center',
                      boxShadow: active ? '0 10px 20px rgba(15, 23, 42, 0.08)' : 'none',
                      flexShrink: 0
                    }}
                    title={date}
                  >
                    <span style={{ fontSize: '0.68rem', opacity: 0.82, fontWeight: 600 }}>{weekday}</span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>{monthDay}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              共 {availableDates.length} 天记录
            </div>
          </div>

          <button
            onClick={() => navigateDate('next')}
            disabled={!canGoNext}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              backgroundColor: !canGoNext ? 'var(--bg-secondary)' : 'var(--accent-primary)',
              border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
              color: !canGoNext ? 'var(--text-muted)' : 'white',
              cursor: !canGoNext ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
            title="Next"
          >
            {'>'}
          </button>
        </div>

        {/* 内容区域 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '1.25rem 1.35rem'
        }}>
          {initialLoading && !dayData ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--text-muted)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
              <p>加载数据中...</p>
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--error-color)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
              <p>{error}</p>
            </div>
          ) : dayData ? (
            <div>
              {/* 日期标题 */}
              <div style={{
                textAlign: 'center',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'color-mix(in srgb, var(--bg-tertiary) 86%, white 14%)',
                borderRadius: '14px',
                border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)'
              }}>
                <h4 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  margin: 0,
                  color: 'var(--text-primary)'
                }}>
                  📅 {formatDate(selectedDate)}
                </h4>
                {isSwitchingDate ? (
                  <p style={{
                    margin: '0.45rem 0 0',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)'
                  }}>
                    更新中...
                  </p>
                ) : null}
              </div>

              {/* 数据展示内容 */}
              <div style={{ display: 'grid', gap: '1rem' }}>
                {/* 学习统计 */}
                <div style={sectionCardStyle}>
                  <h5 style={sectionTitleStyle}>
                    📚 学习统计
                  </h5>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: 'var(--accent-primary)',
                        marginBottom: '0.25rem'
                      }}>
                        {formatStudyTime(studyData.totalMinutes)}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                        学习时长
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: 'var(--success-color)',
                        marginBottom: '0.25rem'
                      }}>
                        {studyData.pomodoroCount}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                        番茄钟
                      </div>
                    </div>
                  </div>
                </div>

                {/* 任务统计 */}
                <div style={sectionCardStyle}>
                  <h5 style={sectionTitleStyle}>
                    ✅ 任务完成情况
                  </h5>
                  {dayData.tasks && dayData.tasks.length > 0 ? (
                    <div>
                      {/* 统计信息 */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '0.75rem',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: '1.25rem',
                            fontWeight: 'bold',
                            color: 'var(--success-color)',
                            marginBottom: '0.25rem'
                          }}>
                            {getTaskStats(dayData.tasks).rate}%
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            完成率
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: '1.25rem',
                            fontWeight: 'bold',
                            color: 'var(--accent-primary)',
                            marginBottom: '0.25rem'
                          }}>
                            {getTaskStats(dayData.tasks).completed}/{getTaskStats(dayData.tasks).total}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            已完成
                          </div>
                        </div>
                      </div>

                      {/* 任务列表 */}
                      <div style={{
                        maxHeight: '150px',
                        overflowY: 'auto'
                      }}>
                        {dayData.tasks.map((task, index) => (
                          <div key={task.id || index} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 0.6rem',
                            marginBottom: '0.25rem',
                            backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                            borderRadius: '10px',
                            border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)'
                          }}>
                            <span style={{
                              fontSize: '0.875rem',
                              color: task.completed ? 'var(--success-color)' : 'var(--text-muted)'
                            }}>
                              {task.completed ? '✅' : '⭕'}
                            </span>
                            <span style={{
                              flex: 1,
                              fontSize: '0.875rem',
                              color: 'var(--text-primary)',
                              textDecoration: task.completed ? 'line-through' : 'none',
                              opacity: task.completed ? 0.7 : 1
                            }}>
                              {task.text}
                            </span>
                            {task.pomodoroCount > 0 && (
                              <span style={{
                                fontSize: '0.625rem',
                                color: 'white',
                                backgroundColor: 'var(--warning-color)',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '8px',
                                fontWeight: 'bold'
                              }}>
                                🍅 {task.pomodoroCount}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      padding: '1rem'
                    }}>
                      该日期没有任务记录
                    </div>
                  )}
                </div>

                {/* 运动统计 */}
                <div style={sectionCardStyle}>
                  <h5 style={sectionTitleStyle}>
                    🏃 运动记录
                  </h5>
                  {exerciseData.exercises.length > 0 ? (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                      gap: '0.5rem',
                      marginBottom: '0.75rem'
                    }}>
                      {exerciseData.exercises.map((exercise, index) => (
                        <div key={exercise.id || index} style={{ textAlign: 'center' }}>
                          <div style={{
                            fontSize: '1.125rem',
                            fontWeight: 'bold',
                            color: `hsl(${(index * 60) % 360}, 60%, 50%)`,
                            marginBottom: '0.25rem'
                          }}>
                            {exercise.value}{exercise.unit}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {exercise.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '1rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.875rem'
                    }}>
                      今日无运动记录
                    </div>
                  )}
                  {exerciseData.feeling && (
                    <div style={{
                      padding: '0.55rem 0.6rem',
                      backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                      borderRadius: '10px',
                      border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
                      textAlign: 'center'
                    }}>
                      <span style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)'
                      }}>
                        感受: {exerciseData.feeling}
                      </span>
                    </div>
                  )}
                </div>

                {/* 消费统计 */}
                <div style={sectionCardStyle}>
                  <h5 style={sectionTitleStyle}>
                    💰 消费记录
                  </h5>

                  {/* 总消费 */}
                  <div style={{
                    textAlign: 'center',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: 'var(--accent-primary)',
                      marginBottom: '0.25rem'
                    }}>
                      ¥{(expensesData.total || 0).toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      总消费
                    </div>
                  </div>

                  {/* 三餐消费 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0.5rem',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--warning-color)', marginBottom: '0.25rem' }}>
                        ¥{(expensesData.breakfast || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>早餐</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--success-color)', marginBottom: '0.25rem' }}>
                        ¥{(expensesData.lunch || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>午餐</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>
                        ¥{(expensesData.dinner || 0).toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>晚餐</div>
                    </div>
                  </div>

                  {/* 自定义消费类别 */}
                  {customExpenseCategories && Object.keys(customExpenseCategories).length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.5rem',
                        fontWeight: '600'
                      }}>
                        自定义类别
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                        gap: '0.5rem'
                      }}>
                        {Object.entries(customExpenseCategories).map(([categoryId, amount]) => (
                          <div key={categoryId} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                              ¥{Number(amount || 0).toFixed(2)}
                            </div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>
                              {categoryId}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 其他消费项目 */}
                  {otherExpenses && Array.isArray(otherExpenses) && otherExpenses.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.5rem',
                        fontWeight: '600'
                      }}>
                        其他消费
                      </div>
                      <div style={{
                        maxHeight: '100px',
                        overflowY: 'auto'
                      }}>
                        {otherExpenses.map((item, index) => (
                          <div key={index} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.45rem 0.6rem',
                            marginBottom: '0.25rem',
                            backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                            borderRadius: '10px',
                            border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)'
                          }}>
                            <span style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-primary)',
                              flex: 1
                            }}>
                              {item.name || item.description || '未命名'}
                            </span>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              color: 'var(--accent-primary)'
                            }}>
                              ¥{Number(item.amount || 0).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 复盘记录 */}
                {(dayData.dayStart || dayData.dayReflection || dayData.wakeUpTime) && (
                  <div style={sectionCardStyle}>
                    <h5 style={{
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      marginBottom: '1rem',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      🌅 复盘记录
                    </h5>
                    {dayData.wakeUpTime && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.5rem'
                        }}>
                          起床时间:
                        </div>
                        <div style={{
                          padding: '0.75rem',
                          backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                          borderRadius: '10px',
                          border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
                          color: 'var(--text-primary)',
                          lineHeight: '1.5',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <span style={{ fontSize: '1.2rem' }}>⏰</span>
                          {dayData.wakeUpTime}
                        </div>
                      </div>
                    )}
                    {dayData.dayStart && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.5rem'
                        }}>
                          当日目标:
                        </div>
                        <div style={{
                          padding: '0.75rem',
                          backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                          borderRadius: '10px',
                          border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
                          color: 'var(--text-primary)',
                          lineHeight: '1.5'
                        }}>
                          {dayData.dayStart}
                        </div>
                      </div>
                    )}
                    {dayData.dayReflection && (
                      <div>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.5rem'
                        }}>
                          复盘总结:
                        </div>
                        <div style={{
                          padding: '0.75rem',
                          backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                          borderRadius: '10px',
                          border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
                          color: 'var(--text-primary)',
                          lineHeight: '1.5'
                        }}>
                          {dayData.dayReflection}
                        </div>
                        {dayData.reflectionTime && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.5rem',
                            textAlign: 'right'
                          }}>
                            记录时间: {dayData.reflectionTime}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--text-muted)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📅</div>
              <p>该日期没有数据记录</p>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.6rem'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.62rem 1rem',
              borderRadius: '11px',
              border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
              background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
              color: 'var(--text-primary)',
              fontSize: '0.83rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            关闭
          </button>
          {dayData && (
            <button
              onClick={handleExport}
              style={{
                padding: '0.62rem 1rem',
                borderRadius: '11px',
                border: '1px solid transparent',
                background: 'var(--accent-primary)',
                color: 'white',
                fontSize: '0.83rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 12px 24px rgba(15, 23, 42, 0.18)',
              }}
            >
              📥 导出该日数据
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
