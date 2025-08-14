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
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

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

  // 获取颜色 - 红色系
  const getColor = (level: number) => {
    const colors = [
      '#ebedf0', // 0 - 灰色（无任务）
      '#fecaca', // 1 - 浅红色（1-2个任务）
      '#fca5a5', // 2 - 中浅红色（3-4个任务）
      '#f87171', // 3 - 中红色（5-7个任务）
      '#ef4444', // 4 - 深红色（8+个任务）
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

    // 计算提示框位置，避免超出屏幕
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = scrollContainerRef.current?.getBoundingClientRect();

    let x = e.clientX + 10;
    let y = e.clientY - 10;

    // 检查是否会超出右边界
    const tooltipWidth = 200; // 估算提示框宽度
    if (x + tooltipWidth > window.innerWidth) {
      x = e.clientX - tooltipWidth - 10; // 显示在鼠标左侧
    }

    // 检查是否会超出下边界
    const tooltipHeight = 60; // 估算提示框高度
    if (y + tooltipHeight > window.innerHeight) {
      y = e.clientY - tooltipHeight - 10; // 显示在鼠标上方
    }

    setMousePosition({ x, y });
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

  // 滚动到最右边（最新日期）
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [data]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
      }}>


        {/* 可滚动的热力图容器 */}
        <div
          ref={scrollContainerRef}
          style={{
            overflowX: 'auto', // 只有这部分可以水平滚动
            marginBottom: '16px',
            // 隐藏滚动条但保持滚动功能
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
          }}
          className="heatmap-scroll-container"
        >
          <div style={{
            minWidth: '800px', // 确保有足够的宽度显示完整的热力图
            padding: '8px 0', // 添加一些垂直间距
          }}>
            {/* 简化的热力图网格 - 去掉月份和星期标签 */}
            <div style={{
              display: 'flex',
              gap: '3px',
              justifyContent: 'flex-start',
            }}>
              {/* 日期网格 */}
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  marginRight: '3px',
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
                          transition: 'all 0.1s ease',
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
          </div>
        </div>

        {/* 固定图例 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
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
            left: mousePosition.x,
            top: mousePosition.y,
            backgroundColor: '#1f2937', // 深灰色背景
            color: '#f9fafb', // 浅色文字
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #374151',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: '500' }}>{formatDate(hoveredDay.date)}</div>
          <div style={{ color: '#d1d5db' }}>{hoveredDay.count} 个任务完成</div>
        </div>
      )}
    </div>
  );
};

export default TaskHeatmap;
