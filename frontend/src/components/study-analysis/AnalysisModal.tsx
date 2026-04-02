'use client';

import { StudyAnalysisResponse } from '@/hooks/useStudyAnalysis';
import { ChevronLeft } from 'lucide-react';

interface AnalysisModalProps {
  analysis: StudyAnalysisResponse | null;
  onBack: () => void;
}

export function AnalysisModal({ analysis, onBack }: AnalysisModalProps) {
  if (!analysis) {
    return null;
  }

  const { summary, healthScore, bySubject, insights, recommendations } = analysis;

  return (
    <div>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent-primary)',
            padding: '0.25rem',
            marginRight: '0.5rem',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
          margin: 0,
        }}>
          分析结果
        </h3>
      </div>

      {/* 总体统计 */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          margin: '0 0 0.75rem 0',
          letterSpacing: '0.5px',
        }}>
          总体统计
        </h4>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
        }}>
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}>
              总学习时长
            </div>
            <div style={{
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
            }}>
              {Math.floor(summary.totalMinutes / 60)}h {summary.totalMinutes % 60}m
            </div>
          </div>
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}>
              学习次数
            </div>
            <div style={{
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
            }}>
              {summary.totalSessions}
            </div>
          </div>
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}>
              平均时长
            </div>
            <div style={{
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
            }}>
              {summary.averageSessionDuration}分钟
            </div>
          </div>
          <div style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}>
              坚持度
            </div>
            <div style={{
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
            }}>
              {summary.consistencyScore}%
            </div>
          </div>
        </div>
      </div>

      {/* 健康分数 */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{
          fontSize: '0.875rem',
          fontWeight: '600',
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          margin: '0 0 0.75rem 0',
          letterSpacing: '0.5px',
        }}>
          学习健康分数
        </h4>
        <div style={{
          padding: '1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '6px',
          marginBottom: '0.75rem',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>总体评分</span>
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: healthScore.score >= 70 ? '#e8f5e9' : healthScore.score >= 50 ? '#fff3e0' : '#ffebee',
              color: healthScore.score >= 70 ? '#2e7d32' : healthScore.score >= 50 ? '#e65100' : '#c62828',
              borderRadius: '4px',
              fontWeight: 'bold',
              fontSize: '0.875rem',
            }}>
              {healthScore.score}分
            </div>
          </div>
          <div style={{
            height: '8px',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${healthScore.score}%`,
              backgroundColor: healthScore.score >= 70 ? '#4caf50' : healthScore.score >= 50 ? '#ff9800' : '#f44336',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem',
        }}>
          {[
            { name: '坚持度', value: healthScore.factors.consistency, color: '#2196f3' },
            { name: '学习时长', value: healthScore.factors.duration, color: '#9c27b0' },
            { name: '多样性', value: healthScore.factors.variety, color: '#00bcd4' },
            { name: '学习效率', value: healthScore.factors.efficiency, color: '#ff9800' },
          ].map((factor) => (
            <div key={factor.name} style={{
              padding: '0.75rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '6px',
            }}>
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                marginBottom: '0.5rem',
              }}>
                {factor.name}
              </div>
              <div style={{
                height: '6px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '0.5rem',
              }}>
                <div style={{
                  height: '100%',
                  width: `${factor.value}%`,
                  backgroundColor: factor.color,
                }} />
              </div>
              <div style={{
                fontSize: '0.875rem',
                fontWeight: 'bold',
                color: 'var(--text-primary)',
              }}>
                {factor.value}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 学科分布 */}
      {bySubject.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            margin: '0 0 0.75rem 0',
            letterSpacing: '0.5px',
          }}>
            学科分布
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bySubject.map((item) => (
              <div key={item.subject} style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '6px',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem',
                }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                    {item.subject}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {item.minutes}分钟 ({item.percentage}%)
                  </span>
                </div>
                <div style={{
                  height: '6px',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${item.percentage}%`,
                    backgroundColor: '#4caf50',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 洞察和建议 */}
      {(insights || recommendations) && (
        <>
          {insights && insights.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                margin: '0 0 0.75rem 0',
                letterSpacing: '0.5px',
              }}>
                学习洞察
              </h4>
              <div style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '6px',
              }}>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}>
                  {insights.map((insight, idx) => (
                    <li key={idx} style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      paddingLeft: '1rem',
                      position: 'relative',
                    }}>
                      <span style={{
                        position: 'absolute',
                        left: 0,
                        color: 'var(--accent-primary)',
                      }}>
                        •
                      </span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {recommendations && recommendations.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                margin: '0 0 0.75rem 0',
                letterSpacing: '0.5px',
              }}>
                改进建议
              </h4>
              <div style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '6px',
              }}>
                <ul style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}>
                  {recommendations.map((rec, idx) => (
                    <li key={idx} style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      paddingLeft: '1rem',
                      position: 'relative',
                    }}>
                      <span style={{
                        position: 'absolute',
                        left: 0,
                        color: 'var(--accent-primary)',
                      }}>
                        •
                      </span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
