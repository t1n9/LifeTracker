'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import StudyOverview from '@/components/overview/StudyOverview';
import GoalOverview from '@/components/GoalOverview';

import { userAPI } from '@/lib/api';

// 导入统一的主题样式
import '@/styles/theme.css';



export default function OverviewPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'goal' | 'study'>('study');

  // 加载用户信息
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await userAPI.getProfile();
        setUser(response.data);
      } catch (error) {
        console.error('加载用户信息失败:', error);
      }
    };
    loadUser();
  }, []);

  // 主题切换处理
  const handleThemeToggle = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    try {
      // 同步到后端
      await userAPI.updateTheme(newTheme);
      // console.log(`🎨 主题已切换为: ${newTheme}`);
    } catch (error) {
      console.error('主题更新失败:', error);
      // 如果失败，回滚主题
      setTheme(theme);
    }
  };

  // 应用主题到document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // 同时为Tailwind深色模式添加class
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // 初始化主题（从用户配置加载）
  useEffect(() => {
    if (user?.theme) {
      const userTheme = user.theme === 'dark' ? 'dark' : 'light';
      // console.log(`🎨 从用户配置加载主题: ${userTheme}`);
      setTheme(userTheme);
    }
  }, [user?.theme]);

  return (
    <div
      className="overview-container"
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        padding: '2rem',
      }}
    >

      {/* 返回主界面按钮 */}
      <button
        className="back-button"
        onClick={() => router.push('/')}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 1000,
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow)',
          transition: 'all 0.2s ease',
          color: 'var(--text-primary)',
        }}
        title="返回主界面"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'var(--shadow)';
        }}
      >
        <ArrowLeft size={20} />
      </button>

      {/* 主题切换按钮 */}
      <button
        onClick={handleThemeToggle}
        className="theme-toggle"
        title={`切换到${theme === 'dark' ? '浅色' : '深色'}主题`}
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </button>

      {/* 标签页切换 */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex space-x-1 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('study')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'study'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            学习概况
          </button>
          <button
            onClick={() => setActiveTab('goal')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'goal'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            目标概况
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-6xl mx-auto">
        {activeTab === 'study' && <StudyOverview userId={user?.id} theme={theme} />}
        {activeTab === 'goal' && <GoalOverview userId={user?.id} />}
      </div>
    </div>
  );
}
