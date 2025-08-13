'use client';

import React, { useState, useEffect } from 'react';

interface DayData {
  date: string;
  count: number;
  level: number; // 0-4 对应不同的颜色深度
}

interface TaskHeatmapProps {
  data: DayData[];
}

const TaskHeatmap: React.FC<TaskHeatmapProps> = ({ data }) => {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // 生成过去一年的日期数组
  const generateYearDates = () => {
    const dates = [];
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    // 找到一年前的周日
    const startDate = new Date(oneYearAgo);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const currentDate = new Date(startDate);
    while (currentDate <= today) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  };

  const yearDates = generateYearDates();
  
  // 将数据转换为日期映射
  const dataMap = new Map(data.map(d => [d.date, d]));

  // 获取颜色
  const getColor = (level: number) => {
    const colors = [
      '#ebedf0', // 0 - 灰色（无任务）
      '#c6e48b', // 1 - 浅绿色（1-2个任务）
      '#7bc96f', // 2 - 中绿色（3-4个任务）
      '#239a3b', // 3 - 深绿色（5-7个任务）
      '#196127', // 4 - 最深绿色（8+个任务）
    ];
    return colors[level] || colors[0];
  };

  // 按周分组
  const weeks = [];
  for (let i = 0; i < yearDates.length; i += 7) {
    weeks.push(yearDates.slice(i, i + 7));
  }

  const handleMouseMove = (e: React.MouseEvent, day: DayData) => {
    setHoveredDay(day);
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        padding: '20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
      }}>
        <h3 style={{
          margin: '0 0 20px 0',
          fontSize: '1.25rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
        }}>
          任务完成情况
        </h3>
        
        {/* 月份标签 */}
        <div style={{
          display: 'flex',
          marginBottom: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          paddingLeft: '27px', // 对齐星期标签的宽度
        }}>
          {['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'].map((month, i) => (
            <div key={i} style={{
              flex: 1,
              textAlign: 'center',
              minWidth: '14px'
            }}>
              {i % 2 === 0 ? month : ''}
            </div>
          ))}
        </div>

        {/* 热力图网格 */}
        <div style={{
          display: 'flex',
          gap: '3px',
        }}>
          {/* 星期标签 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            marginRight: '8px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}>
            <div style={{ height: '11px' }}></div>
            <div>一</div>
            <div style={{ height: '11px' }}></div>
            <div>三</div>
            <div style={{ height: '11px' }}></div>
            <div>五</div>
            <div style={{ height: '11px' }}></div>
          </div>

          {/* 日期网格 */}
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}>
              {week.map((date, dayIndex) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayData = dataMap.get(dateStr) || { date: dateStr, count: 0, level: 0 };
                
                return (
                  <div
                    key={dayIndex}
                    style={{
                      width: '11px',
                      height: '11px',
                      backgroundColor: getColor(dayData.level),
                      borderRadius: '2px',
                      cursor: 'pointer',
                      border: '1px solid rgba(27,31,35,0.06)',
                    }}
                    onMouseEnter={(e) => handleMouseMove(e, dayData)}
                    onMouseLeave={() => setHoveredDay(null)}
                    onMouseMove={(e) => handleMouseMove(e, dayData)}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* 图例 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginTop: '16px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          gap: '8px',
        }}>
          <span>少</span>
          {[0, 1, 2, 3, 4].map(level => (
            <div
              key={level}
              style={{
                width: '11px',
                height: '11px',
                backgroundColor: getColor(level),
                borderRadius: '2px',
                border: '1px solid rgba(27,31,35,0.06)',
              }}
            />
          ))}
          <span>多</span>
        </div>
      </div>

      {/* 悬浮提示 */}
      {hoveredDay && (
        <div
          style={{
            position: 'fixed',
            left: mousePosition.x + 10,
            top: mousePosition.y - 10,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          <div>{formatDate(hoveredDay.date)}</div>
          <div>{hoveredDay.count} 个任务完成</div>
        </div>
      )}
    </div>
  );
};

export default TaskHeatmap;
