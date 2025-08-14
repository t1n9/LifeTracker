// 为静态导出生成所有可能的分享码路径
export async function generateStaticParams() {
  // 静态导出模式下，返回空数组，让动态路由在运行时处理
  return [];
}

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { shareAPI } from '@/lib/api';
import TaskHeatmap from '@/components/overview/TaskHeatmap';
import StudyChart from '@/components/overview/StudyChart';
import RecentActivities from '@/components/overview/RecentActivities';

interface SharedOverviewData {
  heatmapData: any[];
  activities: any[];
  chartData: any[];
  stats: {
    totalTasks: number;
    totalStudyTime: number;
    totalPomodoros: number;
    activeDays: number;
    avgTasksPerDay: string;
    currentStreak: number;
  };
  userInfo: {
    email: string;
    displayName: string;
    shareNote: string;
    shareTitle?: string;
  };
}

export default function ShareCodePage() {
  const params = useParams();
  const shareCode = params.shareCode as string;
  
  const [data, setData] = useState<SharedOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 设置页面标题和深色主题
    document.title = '学习概况分享 - LifeTracker';
    document.documentElement.classList.add('dark');
    
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await shareAPI.getSharedOverviewByCode(shareCode);
        setData(response.data);
        
        // 更新页面标题
        if (response.data.userInfo.shareTitle) {
          document.title = `${response.data.userInfo.shareTitle} - LifeTracker`;
        }
      } catch (err) {
        console.error('获取分享数据失败:', err);
        setError('分享链接不存在或已失效');
      } finally {
        setLoading(false);
      }
    };

    if (shareCode) {
      fetchData();
    }
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-300">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">加载失败</h1>
          <p className="text-gray-300">{error || '数据不可用'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* 头部 */}
      <div className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">
              📚 {data.userInfo.shareTitle || '学习概况分享'}
            </h1>
            <p className="text-gray-300 mb-1">
              {data.userInfo.displayName} ({data.userInfo.email})
            </p>
            <p className="text-sm text-gray-400">
              {data.userInfo.shareNote}
            </p>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-900 rounded-lg flex items-center justify-center">
                  <span className="text-blue-400 text-lg">📖</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">总学习时间</p>
                <p className="text-2xl font-bold text-gray-100">
                  {Math.round((data.stats.totalStudyTime || 0) / 60)}h
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-900 rounded-lg flex items-center justify-center">
                  <span className="text-green-400 text-lg">✅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">完成任务</p>
                <p className="text-2xl font-bold text-gray-100">
                  {data.stats.totalTasks || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-900 rounded-lg flex items-center justify-center">
                  <span className="text-orange-400 text-lg">🍅</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">番茄钟</p>
                <p className="text-2xl font-bold text-gray-100">
                  {data.stats.totalPomodoros || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 热力图 */}
        <div className="bg-gray-800 rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-gray-100">学习热力图</h2>
            <p className="text-sm text-gray-400">过去一年的学习活动分布</p>
          </div>
          <div className="p-6">
            <TaskHeatmap data={data.heatmapData} />
          </div>
        </div>

        {/* 学习趋势和最近活动 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 学习趋势 */}
          <div className="bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-gray-100">学习趋势</h2>
              <p className="text-sm text-gray-400">最近30天的学习数据</p>
            </div>
            <div className="p-6">
              <StudyChart data={data.chartData} />
            </div>
          </div>

          {/* 最近活动 */}
          <div className="bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-gray-100">最近活动</h2>
              <p className="text-sm text-gray-400">最新的学习记录</p>
            </div>
            <div className="p-6">
              <RecentActivities activities={data.activities} />
            </div>
          </div>
        </div>

        {/* 页脚 */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-900 rounded-lg">
            <span className="text-blue-300 text-sm">
              💡 这是一个公开的学习概况分享页面
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            数据实时更新 • 最后更新: {new Date().toLocaleString('zh-CN')}
          </p>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400">
                粤ICP备2024123456号-1
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
