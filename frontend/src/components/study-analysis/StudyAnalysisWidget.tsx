'use client';

import { useState } from 'react';
import { useStudyAnalysis, AnalysisQuery, StudyAnalysisResponse } from '@/hooks/useStudyAnalysis';
import { AnalysisModal } from './AnalysisModal';
import { BarChart3, X } from 'lucide-react';

export function StudyAnalysisWidget() {
  const { analyze, loading, error } = useStudyAnalysis();

  const [isOpen, setIsOpen] = useState(false);
  const [analysis, setAnalysis] = useState<StudyAnalysisResponse | null>(null);
  const [queryType, setQueryType] = useState<'time-range' | 'goal-based' | 'subject-based'>('time-range');
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleAnalyze = async () => {
    const query: AnalysisQuery = {
      queryType,
      period,
    };

    if (period === 'custom') {
      query.startDate = startDate;
      query.endDate = endDate;
    }

    const result = await analyze(query);
    if (result) {
      setAnalysis(result);
      setShowForm(false);
    }
  };

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary-color)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          zIndex: 999,
        }}
        title="学习分析"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
        }}
      >
        <BarChart3 size={20} />
      </button>

      {/* 分析模态框 */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => setIsOpen(false)}
        >
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: 'var(--shadow-lg)',
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setIsOpen(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '1.5rem',
                padding: '0.5rem',
              }}
            >
              <X size={20} />
            </button>

            {!showForm && !analysis ? (
              // 初始状态 - 提示开始
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary-alpha)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}>
                  <BarChart3 size={24} color='var(--accent-primary)' />
                </div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: '0 0 0.5rem 0',
                }}>
                  学习情况分析
                </h3>
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  margin: '0 0 2rem 0',
                }}>
                  根据学习记录生成分析和改进建议
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 2rem',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'opacity 0.3s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  开始分析
                </button>
              </div>
            ) : showForm ? (
              // 表单状态
              <div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: '0 0 1.5rem 0',
                }}>
                  学习分析
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.5rem',
                    }}>
                      分析类型
                    </label>
                    <select
                      value={queryType}
                      onChange={(e) => setQueryType(e.target.value as any)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="time-range">按时间段</option>
                      <option value="goal-based">按目标</option>
                      <option value="subject-based">按学科</option>
                    </select>
                  </div>

                  {queryType === 'time-range' && (
                    <>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.5rem',
                        }}>
                          时间周期
                        </label>
                        <select
                          value={period}
                          onChange={(e) => setPeriod(e.target.value as any)}
                          disabled={loading}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.875rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <option value="day">今天</option>
                          <option value="week">本周</option>
                          <option value="month">本月</option>
                          <option value="custom">自定义</option>
                        </select>
                      </div>

                      {period === 'custom' && (
                        <>
                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.5rem',
                            }}>
                              开始日期
                            </label>
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              disabled={loading}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.875rem',
                              }}
                            />
                          </div>
                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.5rem',
                            }}>
                              结束日期
                            </label>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              disabled={loading}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.875rem',
                              }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {error && (
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: '#fee',
                      color: '#c33',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                    }}>
                      {error}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => setShowForm(false)}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      {loading ? '分析中...' : '生成分析'}
                    </button>
                  </div>
                </div>
              </div>
            ) : analysis ? (
              // 结果状态
              <AnalysisModal
                analysis={analysis}
                onBack={() => {
                  setAnalysis(null);
                  setShowForm(true);
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
