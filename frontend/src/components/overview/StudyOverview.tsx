'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Award, Clock } from 'lucide-react';
import TaskHeatmap from './TaskHeatmap';
import RecentActivities from './RecentActivities';
import StudyChart from './StudyChart';
import { overviewAPI } from '@/lib/api';

// 模拟数据生成函数
const generateMockHeatmapData = () => {
  const data = [];
  const today = new Date();
  
  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // 随机生成任务完成数量
    const count = Math.floor(Math.random() * 12);
    let level = 0;
    
    if (count === 0) level = 0;
    else if (count <= 2) level = 1;
    else if (count <= 4) level = 2;
    else if (count <= 7) level = 3;
    else level = 4;
    
    data.push({
      date: date.toISOString().split('T')[0],
      count,
      level,
    });
  }
  
  return data;
};

const generateMockActivities = () => {
  const activities = [
    {
      id: '1',
      type: 'task' as const,
      title: '完成数学作业第三章',
      description: '解决了所有练习题，重点掌握了微积分基础',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: '2',
      type: 'pomodoro' as const,
      title: '专注学习英语',
      duration: 25,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: '3',
      type: 'reflection' as const,
      title: '今日复盘总结',
      description: '今天学习效率很高，明天继续保持',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: '4',
      type: 'study' as const,
      title: '阅读《算法导论》',
      duration: 90,
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: '5',
      type: 'task' as const,
      title: '整理学习笔记',
      description: '整理了本周所有课程的重点内容',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    },
  ];
  
  return activities;
};

const generateMockChartData = () => {
  const data = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      studyTime: Math.floor(Math.random() * 180) + 30, // 30-210分钟
      tasksCompleted: Math.floor(Math.random() * 8) + 1, // 1-8个任务
      pomodoroCount: Math.floor(Math.random() * 6) + 1, // 1-6个番茄钟
    });
  }
  
  return data;
};

const StudyOverview: React.FC = () => {
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 尝试加载真实数据
      const response = await overviewAPI.getFullOverview();
      const data = response.data;

      setHeatmapData(data.heatmapData || []);
      setActivities(data.activities || []);
      setChartData(data.chartData || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('加载概况数据失败，使用模拟数据:', error);
      setError('加载数据失败，显示模拟数据');

      // 如果API失败，使用模拟数据
      setHeatmapData(generateMockHeatmapData());
      setActivities(generateMockActivities());
      setChartData(generateMockChartData());
      setStats({
        totalTasks: 156,
        activeDays: 89,
        avgTasksPerDay: '1.8',
        currentStreak: 7,
      });
    } finally {
      setLoading(false);
    }
  };

  // 使用API返回的统计数据，如果没有则从热力图数据计算
  const totalTasks = stats.totalTasks || heatmapData.reduce((sum, day) => sum + day.count, 0);
  const activeDays = stats.activeDays || heatmapData.filter(day => day.count > 0).length;
  const avgTasksPerDay = stats.avgTasksPerDay || (activeDays > 0 ? (totalTasks / activeDays).toFixed(1) : '0');
  const currentStreak = stats.currentStreak || (() => {
    let streak = 0;
    for (let i = heatmapData.length - 1; i >= 0; i--) {
      if (heatmapData[i].count > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  })();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: 'var(--text-secondary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
            borderTop: '3px solid var(--primary-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p>加载学习数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 20px',
    }}>
      {/* 页面标题 */}
      <div style={{
        marginBottom: '32px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          margin: '0 0 8px 0',
        }}>
          学习概况
        </h1>
        <p style={{
          fontSize: '1.125rem',
          color: 'var(--text-secondary)',
          margin: 0,
        }}>
          追踪你的学习进度和成就
        </p>
        {error && (
          <div style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '6px',
            color: '#f59e0b',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* 统计卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '20px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '12px',
          }}>
            <Calendar size={24} style={{ color: '#3b82f6' }} />
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}>
            {totalTasks}
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}>
            总完成任务
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '20px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '12px',
          }}>
            <TrendingUp size={24} style={{ color: '#10b981' }} />
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}>
            {avgTasksPerDay}
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}>
            日均完成任务
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '20px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '12px',
          }}>
            <Award size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}>
            {currentStreak}
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}>
            当前连续天数
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '20px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '12px',
          }}>
            <Clock size={24} style={{ color: '#8b5cf6' }} />
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}>
            {activeDays}
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}>
            活跃天数
          </div>
        </div>
      </div>

      {/* 任务完成热力图 */}
      <div style={{ marginBottom: '32px' }}>
        <TaskHeatmap data={heatmapData} />
      </div>

      {/* 图表和活动 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '32px',
        marginBottom: '32px',
      }}>
        <StudyChart data={chartData} />
        <RecentActivities activities={activities} />
      </div>
    </div>
  );
};

export default StudyOverview;
