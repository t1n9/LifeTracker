'use client';

import React, { useState } from 'react';
import { TrendingUp, Clock, Target, BookOpen } from 'lucide-react';

interface ChartData {
  date: string;
  studyTime: number;
  tasksCompleted: number;
  pomodoroCount: number;
}

interface StudyChartProps {
  data: ChartData[];
  theme?: 'dark' | 'light';
}

const METRICS = {
  studyTime:      { label: '学习时间', icon: <Clock size={13} />,   color: 'var(--accent)',        format: (v: number) => `${Math.round(v)}分钟` },
  tasksCompleted: { label: '完成任务', icon: <Target size={13} />,  color: 'var(--success-color)', format: (v: number) => `${v}个` },
  pomodoroCount:  { label: '番茄钟',   icon: <BookOpen size={13} />, color: 'var(--warn)',           format: (v: number) => `${v}个` },
} as const;

type MetricKey = keyof typeof METRICS;

const StudyChart: React.FC<StudyChartProps> = ({ data }) => {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('studyTime');
  const chartScrollRef = React.useRef<HTMLDivElement>(null);

  const metric = METRICS[activeMetric];
  const values = data.map(d => d[activeMetric]);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const W = 600, H = 200;
  const pad = { top: 20, right: 20, bottom: 40, left: 50 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;

  const totalValue = values.reduce((s, v) => s + v, 0);
  const avgValue = values.length > 0 ? totalValue / values.length : 0;
  const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;

  React.useEffect(() => {
    if (chartScrollRef.current) chartScrollRef.current.scrollLeft = chartScrollRef.current.scrollWidth;
  }, [data, activeMetric]);

  return (
    <div>
      {/* metric toggle */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', background: 'var(--bg-2)', padding: '3px', borderRadius: '10px', border: '1px solid var(--line)' }}>
        {(Object.entries(METRICS) as [MetricKey, typeof METRICS[MetricKey]][]).map(([key, m]) => (
          <button
            key={key}
            onClick={() => setActiveMetric(key)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '8px',
              border: 'none',
              background: activeMetric === key ? 'var(--bg-0)' : 'transparent',
              color: activeMetric === key ? 'var(--fg)' : 'var(--fg-3)',
              fontSize: '11.5px',
              fontWeight: activeMetric === key ? 700 : 500,
              cursor: 'pointer',
              boxShadow: activeMetric === key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              transition: 'all .15s',
            }}
          >
            <span style={{ color: activeMetric === key ? m.color : 'var(--fg-4)' }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {/* summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '14px' }}>
        {[
          { label: '总计', value: metric.format(totalValue) },
          { label: '平均', value: activeMetric === 'studyTime' ? `${Math.round(avgValue)}分钟` : `${Math.round(avgValue * 10) / 10}个` },
          { label: '趋势', value: `${trend >= 0 ? '+' : ''}${metric.format(Math.abs(trend))}`, icon: true },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: '10px', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: metric.color, fontFamily: 'var(--font-mono)' }}>
              {icon && <TrendingUp size={13} style={{ transform: trend < 0 ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* chart */}
      <div style={{ background: 'var(--bg-2)', borderRadius: '10px', border: '1px solid var(--line)', padding: '14px', overflow: 'hidden' }}>
        {data.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', color: 'var(--fg-4)', gap: '10px' }}>
            <TrendingUp size={36} style={{ opacity: 0.35 }} />
            <span style={{ fontSize: '12px' }}>暂无数据</span>
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', height: H }}>
            {/* fixed y-axis */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: pad.left, height: H, background: 'var(--bg-2)', borderRight: '1px solid var(--line)', zIndex: 10 }}>
              <svg width={pad.left} height={H}>
                {Array.from({ length: 6 }, (_, i) => {
                  const val = minValue + (range * i / 5);
                  const y = pad.top + cH - (i / 5) * cH;
                  return <text key={i} x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--fg-4)">{Math.round(val)}</text>;
                })}
              </svg>
            </div>

            {/* scrollable chart */}
            <div ref={chartScrollRef} style={{ marginLeft: pad.left, width: `calc(100% - ${pad.left}px)`, overflowX: 'auto', scrollbarWidth: 'none' }}>
              <svg width={Math.max(W - pad.left, 400)} height={H} style={{ minWidth: '400px', display: 'block' }}>
                {/* grid */}
                {Array.from({ length: 6 }, (_, i) => {
                  const y = pad.top + (i / 5) * cH;
                  return <line key={i} x1={0} y1={y} x2={Math.max(cW, 400 - pad.right)} y2={y} stroke="var(--line)" strokeWidth="1" />;
                })}

                {/* x labels */}
                {data.map((d, i) => {
                  if (data.length <= 1 || i % Math.ceil(data.length / 7) !== 0) return null;
                  const adjW = Math.max(W - pad.left - pad.right, 400 - pad.right);
                  const x = (i / (data.length - 1)) * adjW;
                  const dt = new Date(d.date);
                  return <text key={i} x={x} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--fg-4)">{dt.getMonth() + 1}/{dt.getDate()}</text>;
                })}

                {/* area fill */}
                <path
                  d={(() => {
                    if (data.length === 0) return '';
                    const adjW = Math.max(W - pad.left - pad.right, 400 - pad.right);
                    const pts = data.map((d, i) => {
                      const x = data.length === 1 ? adjW / 2 : (i / (data.length - 1)) * adjW;
                      const y = pad.top + cH - ((d[activeMetric] - minValue) / range) * cH;
                      return `${x},${y}`;
                    });
                    const first = pts[0].split(',');
                    const last = pts[pts.length - 1].split(',');
                    return `M ${pts.join(' L ')} L ${last[0]},${pad.top + cH} L ${first[0]},${pad.top + cH} Z`;
                  })()}
                  fill={metric.color}
                  opacity="0.07"
                />

                {/* line */}
                <path
                  d={(() => {
                    if (data.length === 0) return '';
                    const adjW = Math.max(W - pad.left - pad.right, 400 - pad.right);
                    const pts = data.map((d, i) => {
                      const x = data.length === 1 ? adjW / 2 : (i / (data.length - 1)) * adjW;
                      const y = pad.top + cH - ((d[activeMetric] - minValue) / range) * cH;
                      return `${x},${y}`;
                    });
                    return `M ${pts.join(' L ')}`;
                  })()}
                  fill="none"
                  stroke={metric.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* dots */}
                {data.map((d, i) => {
                  const adjW = Math.max(W - pad.left - pad.right, 400 - pad.right);
                  const x = data.length === 1 ? adjW / 2 : (i / (data.length - 1)) * adjW;
                  const y = pad.top + cH - ((d[activeMetric] - minValue) / range) * cH;
                  return <circle key={i} cx={x} cy={y} r="3.5" fill={metric.color} stroke="var(--bg-2)" strokeWidth="2" />;
                })}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyChart;
