'use client';

import React, { useState, useEffect } from 'react';
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

export default function SharePageClient({ shareCode }: { shareCode: string }) {
  const [data, setData] = useState<SharedOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await shareAPI.getSharedOverview(shareCode);
        setData(response.data);
      } catch (err: any) {
        console.error('获取分享数据失败:', err);
        setError(err.response?.data?.message || '获取分享数据失败');
      } finally {
        setLoading(false);
      }
    };

    if (shareCode && shareCode !== 'example') {
      fetchData();
    } else {
      setLoading(false);
      setError('无效的分享链接');
    }
  }, [shareCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              学习概况分享
            </h1>
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
              <div className="h-32 bg-gray-200 rounded mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              正在加载分享内容...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              分享链接无效
            </h1>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              请检查链接是否正确，或联系分享者获取新的链接。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              暂无数据
            </h1>
            <p className="text-gray-600">
              该分享链接暂时没有可显示的内容。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部信息 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {data.userInfo.shareTitle || `${data.userInfo.displayName}的学习概况`}
            </h1>
            <p className="text-gray-600 mb-4">
              {data.userInfo.shareNote}
            </p>
            <div className="flex justify-center items-center space-x-4 text-sm text-gray-500">
              <span>分享者: {data.userInfo.displayName}</span>
              <span>•</span>
              <span>更新时间: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {data.stats.totalTasks}
              </div>
              <div className="text-gray-600">总任务数</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {Math.round(data.stats.totalStudyTime / 60)}h
              </div>
              <div className="text-gray-600">学习时长</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {data.stats.totalPomodoros}
              </div>
              <div className="text-gray-600">番茄钟</div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {data.stats.currentStreak}
              </div>
              <div className="text-gray-600">连续天数</div>
            </div>
          </div>
        </div>

        {/* 图表和活动 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">学习趋势</h2>
            <StudyChart data={data.chartData} />
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">最近活动</h2>
            <RecentActivities activities={data.activities} />
          </div>
        </div>

        {/* 热力图 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">活动热力图</h2>
          <TaskHeatmap data={data.heatmapData} />
        </div>
      </div>
    </div>
  );
}
