'use client';

import React, { useState } from 'react';

interface DayData {
  date: string;
  count: number;
  level: number;
}

interface TaskHeatmapProps {
  data: DayData[];
  theme?: 'dark' | 'light';
}

const LIGHT_COLORS = ['var(--bg-3)', '#c6f0e8', '#7dd8c8', '#34b5a0', 'var(--accent)'];
const DARK_COLORS  = ['var(--bg-3)', '#0e3a34', '#145e53', '#1a8a7a', '#0f766e'];

const TaskHeatmap: React.FC<TaskHeatmapProps> = ({ data, theme = 'light' }) => {
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const colors = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  const generateYearDates = () => {
    const dates: Date[] = [];
    const today = new Date();
    const start = new Date(today);
    start.setFullYear(today.getFullYear() - 1);
    start.setDate(start.getDate() - start.getDay());
    const cur = new Date(start);
    while (cur <= today) {
      dates.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const yearDates = generateYearDates();
  const dataMap = new Map(data.map(d => [d.date, d]));
  const weeks: Date[][] = [];
  for (let i = 0; i < yearDates.length; i += 7) weeks.push(yearDates.slice(i, i + 7));

  const handleMouseMove = (e: React.MouseEvent, day: DayData) => {
    setHoveredDay(day);
    let x = e.clientX + 12, y = e.clientY - 12;
    if (x + 180 > window.innerWidth) x = e.clientX - 190;
    if (y + 56 > window.innerHeight) y = e.clientY - 66;
    setMousePos({ x, y });
  };

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [data]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ background: 'var(--bg-1)', borderRadius: '14px', border: '1px solid var(--line)', padding: '16px 18px' }}>
        {/* scroll area */}
        <div
          ref={scrollRef}
          style={{ overflowX: 'auto', marginBottom: '10px', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
        >
          <div style={{ minWidth: '720px', padding: '4px 0' }}>
            <div style={{ display: 'flex', gap: '3px' }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {week.map((date, di) => {
                    const ds = date.toISOString().split('T')[0];
                    const day = dataMap.get(ds) || { date: ds, count: 0, level: 0 };
                    return (
                      <div
                        key={di}
                        style={{
                          width: '11px',
                          height: '11px',
                          background: colors[day.level] || colors[0],
                          borderRadius: '2px',
                          cursor: 'pointer',
                          border: '1px solid var(--line)',
                          transition: 'opacity .1s',
                        }}
                        onMouseEnter={(e) => handleMouseMove(e, day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        onMouseMove={(e) => handleMouseMove(e, day)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', fontSize: '11px', color: 'var(--fg-4)' }}>
          <span>少</span>
          {[0, 1, 2, 3, 4].map(l => (
            <div key={l} style={{ width: '10px', height: '10px', background: colors[l], borderRadius: '2px', border: '1px solid var(--line)' }} />
          ))}
          <span>多</span>
        </div>
      </div>

      {/* tooltip */}
      {hoveredDay && (
        <div style={{
          position: 'fixed',
          left: mousePos.x,
          top: mousePos.y,
          background: 'var(--bg-0)',
          color: 'var(--fg)',
          padding: '7px 11px',
          borderRadius: '9px',
          border: '1px solid var(--line-2)',
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600 }}>{new Date(hoveredDay.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</div>
          <div style={{ color: 'var(--fg-3)', marginTop: '2px' }}>{hoveredDay.count} 个任务完成</div>
        </div>
      )}
    </div>
  );
};

export default TaskHeatmap;
