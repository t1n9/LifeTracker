'use client';

import React, { useState } from 'react';
import { TrendingUp, Clock, Target, BookOpen } from 'lucide-react';

interface ChartData {
  date: string;
  studyTime: number; // 分钟
  tasksCompleted: number;
  pomodoroCount: number;
}

interface StudyChartProps {
  data: ChartData[];
}

const StudyChart: React.FC<StudyChartProps> = ({ data }) => {
  const [activeMetric, setActiveMetric] = useState<'studyTime' | 'tasksCompleted' | 'pomodoroCount'>('studyTime');

  const metrics = {
    studyTime: {
      label: '学习时间',
      icon: <Clock size={16} />,
      color: '#3b82f6',
      unit: '分钟',
      format: (value: number) => `${Math.round(value)}分钟`,
    },
    tasksCompleted: {
      label: '完成任务',
      icon: <Target size={16} />,
      color: '#10b981',
      unit: '个',
      format: (value: number) => `${value}个`,
    },
    pomodoroCount: {
      label: '番茄钟',
      icon: <BookOpen size={16} />,
      color: '#f59e0b',
      unit: '个',
      format: (value: number) => `${value}个`,
    },
  };

  const currentMetric = metrics[activeMetric];
  
  // 获取数据范围
  const values = data.map(d => d[activeMetric]);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  // SVG 尺寸
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 生成路径
  const generatePath = () => {
    if (data.length === 0) return '';
    
    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d[activeMetric] - minValue) / range) * chartHeight;
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  };

  // 生成网格线
  const generateGridLines = () => {
    const lines = [];
    const steps = 5;
    
    for (let i = 0; i <= steps; i++) {
      const y = padding.top + (i / steps) * chartHeight;
      lines.push(
        <line
          key={`grid-${i}`}
          x1={padding.left}
          y1={y}
          x2={padding.left + chartWidth}
          y2={y}
          stroke="var(--border-color)"
          strokeWidth="1"
          opacity="0.3"
        />
      );
    }
    
    return lines;
  };

  // 计算统计数据
  const totalValue = values.reduce((sum, val) => sum + val, 0);
  const avgValue = values.length > 0 ? totalValue / values.length : 0;
  const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;

  return (
    <div style={{
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      padding: '20px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '1.25rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
        }}>
          学习趋势
        </h3>

        {/* 指标切换按钮 */}
        <div style={{
          display: 'flex',
          gap: '8px',
          backgroundColor: 'var(--bg-primary)',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          {Object.entries(metrics).map(([key, metric]) => (
            <button
              key={key}
              onClick={() => setActiveMetric(key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeMetric === key ? currentMetric.color : 'transparent',
                color: activeMetric === key ? 'white' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {metric.icon}
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div style={{
          padding: '12px',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            marginBottom: '4px',
          }}>
            总计
          </div>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: currentMetric.color,
          }}>
            {currentMetric.format(totalValue)}
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            marginBottom: '4px',
          }}>
            平均
          </div>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: currentMetric.color,
          }}>
            {currentMetric.format(avgValue)}
          </div>
        </div>

        <div style={{
          padding: '12px',
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            marginBottom: '4px',
          }}>
            趋势
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '1.25rem',
            fontWeight: '600',
            color: trend >= 0 ? '#10b981' : '#ef4444',
          }}>
            <TrendingUp 
              size={16} 
              style={{ 
                transform: trend < 0 ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease',
              }} 
            />
            {trend >= 0 ? '+' : ''}{currentMetric.format(Math.abs(trend))}
          </div>
        </div>
      </div>

      {/* 图表 */}
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        padding: '16px',
      }}>
        {data.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            color: 'var(--text-secondary)',
          }}>
            <TrendingUp size={40} style={{ opacity: 0.5, marginBottom: '12px' }} />
            <p>暂无数据</p>
          </div>
        ) : (
          <svg width={width} height={height} style={{ overflow: 'visible' }}>
            {/* 网格线 */}
            {generateGridLines()}
            
            {/* Y轴标签 */}
            {Array.from({ length: 6 }, (_, i) => {
              const value = minValue + (range * i / 5);
              const y = padding.top + chartHeight - (i / 5) * chartHeight;
              return (
                <text
                  key={`y-label-${i}`}
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="var(--text-secondary)"
                >
                  {Math.round(value)}
                </text>
              );
            })}
            
            {/* X轴标签 */}
            {data.map((d, i) => {
              if (data.length <= 1 || i % Math.ceil(data.length / 7) !== 0) return null;
              const x = padding.left + (i / (data.length - 1)) * chartWidth;
              const date = new Date(d.date);
              return (
                <text
                  key={`x-label-${i}`}
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="12"
                  fill="var(--text-secondary)"
                >
                  {date.getMonth() + 1}/{date.getDate()}
                </text>
              );
            })}
            
            {/* 数据线 */}
            <path
              d={generatePath()}
              fill="none"
              stroke={currentMetric.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* 数据点 */}
            {data.map((d, i) => {
              const x = data.length === 1 ? padding.left + chartWidth / 2 : padding.left + (i / (data.length - 1)) * chartWidth;
              const y = padding.top + chartHeight - ((d[activeMetric] - minValue) / range) * chartHeight;
              return (
                <circle
                  key={`point-${i}`}
                  cx={x}
                  cy={y}
                  r="4"
                  fill={currentMetric.color}
                  stroke="var(--bg-primary)"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
};

export default StudyChart;
