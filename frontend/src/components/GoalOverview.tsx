import React, { useState, useEffect } from 'react';
import { goalService, UserGoal, GoalOverview as GoalOverviewData } from '../services/goalService';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar, Target, TrendingUp, BookOpen, Activity, DollarSign, Clock } from 'lucide-react';

interface GoalOverviewProps {
  userId?: string;
}

const card: React.CSSProperties = {
  background: 'var(--bg-1)',
  borderRadius: '14px',
  border: '1px solid var(--line)',
  padding: '20px',
};

const GoalOverview: React.FC<GoalOverviewProps> = ({ userId }) => {
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [overviewData, setOverviewData] = useState<GoalOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadData();
  }, [userId]);

  useEffect(() => {
    if (selectedGoalId !== undefined) loadOverviewData();
  }, [selectedGoalId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const goalHistory = await goalService.getGoalHistory();
      setGoals(goalHistory);
      setSelectedGoalId('');
    } catch (error) {
      console.error('加载目标数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOverviewData = async () => {
    try {
      const data = await goalService.getGoalOverview(selectedGoalId || undefined);
      setOverviewData(data);
    } catch (error) {
      console.error('加载概况数据失败:', error);
    }
  };

  const formatDate = (dateString: string) =>
    format(new Date(dateString), 'yyyy年MM月dd日', { locale: zhCN });

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '进行中';
      case 'COMPLETED': return '已完成';
      case 'TERMINATED': return '已终止';
      default: return status;
    }
  };

  const statusStyle = (status: string): React.CSSProperties => {
    switch (status) {
      case 'ACTIVE':
        return { color: 'var(--success-color)', background: 'color-mix(in srgb, var(--success-color) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--success-color) 22%, transparent)' };
      case 'COMPLETED':
        return { color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)' };
      default:
        return { color: 'var(--fg-3)', background: 'var(--bg-2)', border: '1px solid var(--line)' };
    }
  };

  if (loading) {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--fg-3)' }}>
        <div style={{ width: '18px', height: '18px', border: '2px solid var(--line-2)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
        加载中…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 时间段选择 */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <Target size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--fg)', letterSpacing: '-0.01em' }}>数据概况</span>
        </div>

        <div style={{ marginBottom: selectedGoalId ? '12px' : '0' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '6px' }}>
            选择时间段
          </label>
          <select
            value={selectedGoalId}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--line-2)',
              borderRadius: '10px',
              background: 'var(--bg-0)',
              color: 'var(--fg)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">全部时间</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.goalName} ({formatDate(goal.startDate)} - {goal.endDate ? formatDate(goal.endDate) : '进行中'})
                {` [${getStatusText(goal.status)}]`}
              </option>
            ))}
          </select>
        </div>

        {selectedGoalId && (() => {
          const g = goals.find(g => g.id === selectedGoalId);
          if (!g) return null;
          return (
            <div style={{ padding: '12px', background: 'var(--accent-soft)', borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--fg)' }}>{g.goalName}</span>
                <span style={{ ...statusStyle(g.status), fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>
                  {getStatusText(g.status)}
                </span>
              </div>
              {g.description && <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'var(--fg-2)' }}>{g.description}</p>}
              <div style={{ fontSize: '11.5px', color: 'var(--fg-3)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>开始：{formatDate(g.startDate)}</span>
                {g.endDate && <span>结束：{formatDate(g.endDate)}</span>}
                {g.targetDate && <span>目标：{formatDate(g.targetDate)}</span>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 概况数据网格 */}
      {overviewData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {/* 时间段 */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
              <Calendar size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>时间段</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px', color: 'var(--fg-2)' }}>
              <Row label="开始" value={overviewData.period.startDate} />
              <Row label="结束" value={overviewData.period.endDate} />
              <Row label="总天数" value={`${overviewData.period.totalDays} 天`} />
            </div>
          </div>

          {/* 任务 */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
              <TrendingUp size={15} style={{ color: 'var(--success-color)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>任务完成</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px', color: 'var(--fg-2)' }}>
              <Row label="总任务" value={String(overviewData.tasks.total)} />
              <Row label="已完成" value={String(overviewData.tasks.completed)} />
              <Row label="完成率" value={`${overviewData.tasks.completionRate}%`} />
            </div>
            <div style={{ marginTop: '10px', height: '4px', borderRadius: '999px', background: 'var(--bg-2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${overviewData.tasks.completionRate}%`, background: 'var(--success-color)', borderRadius: 'inherit', transition: 'width .4s ease' }} />
            </div>
          </div>

          {/* 学习时间 */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
              <BookOpen size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>学习时间</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px', color: 'var(--fg-2)' }}>
              <Row label="总时长" value={`${overviewData.study.totalHours} 小时`} />
              <Row label="日均" value={`${overviewData.study.averageMinutesPerDay} 分钟`} />
              <Row label="番茄钟" value={`${overviewData.study.pomodoroCount} 个`} />
              <Row label="日均番茄" value={`${overviewData.study.averagePomodoroPerDay} 个`} />
            </div>
          </div>

          {/* 运动 */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
              <Activity size={15} style={{ color: 'var(--warn)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>运动记录</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px', color: 'var(--fg-2)' }}>
              <Row label="总记录" value={String(overviewData.exercise.totalRecords)} />
              {overviewData.exercise.exerciseTypes.length > 0 && (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {overviewData.exercise.exerciseTypes.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--fg-3)' }}>
                      <span>{ex.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>{ex.total} {ex.unit}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 消费 */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
              <DollarSign size={15} style={{ color: 'var(--danger)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>消费记录</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px', color: 'var(--fg-2)' }}>
              <Row label="总消费" value={`¥${overviewData.expense.total}`} />
              <Row label="日均" value={`¥${overviewData.expense.averagePerDay}`} />
              <Row label="记录数" value={String(overviewData.expense.recordCount)} />
            </div>
          </div>

          {/* 效率指标 */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
              <Clock size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--fg)', textTransform: 'uppercase', letterSpacing: '.06em' }}>效率指标</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px', color: 'var(--fg-2)' }}>
              <Row label="学习效率" value={overviewData.study.averageMinutesPerDay > 60 ? '高' : overviewData.study.averageMinutesPerDay > 30 ? '中' : '低'} />
              <Row label="任务效率" value={overviewData.tasks.completionRate > 80 ? '优秀' : overviewData.tasks.completionRate > 60 ? '良好' : '需改进'} />
              <Row label="运动频率" value={overviewData.exercise.totalRecords / overviewData.period.totalDays > 0.5 ? '经常' : '偶尔'} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
      <span style={{ color: 'var(--fg-3)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

export default GoalOverview;
