'use client';

import React, { useState, useEffect } from 'react';
import StudyOverview from '@/components/overview/StudyOverview';
import { userAPI } from '@/lib/api';

// CSS变量定义
const cssVariables = `
  :root {
    --bg-primary: #f8f9fa;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f1f3f4;
    --text-primary: #2d3748;
    --text-secondary: #4a5568;
    --text-muted: #718096;
    --border-color: #e2e8f0;
    --accent-primary: #4299e1;
    --accent-secondary: #63b3ed;
    --success-color: #48bb78;
    --warning-color: #ed8936;
    --error-color: #f56565;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  [data-theme="dark"] {
    --bg-primary: #1a202c;
    --bg-secondary: #2d3748;
    --bg-tertiary: #4a5568;
    --text-primary: #f7fafc;
    --text-secondary: #e2e8f0;
    --text-muted: #cbd5e0;
    --border-color: #4a5568;
    --accent-primary: #4299e1;
    --accent-secondary: #63b3ed;
    --success-color: #48bb78;
    --warning-color: #ed8936;
    --error-color: #f56565;
    --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.4);
  }

  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: var(--shadow);
    transition: all 0.2s ease;
    font-size: 1.2rem;
  }

  .theme-toggle:hover {
    transform: scale(1.05);
    box-shadow: var(--shadow-lg);
  }
`;

export default function OverviewPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [user, setUser] = useState<any>(null);

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
      console.log(`🎨 主题已切换为: ${newTheme}`);
    } catch (error) {
      console.error('主题更新失败:', error);
      // 如果失败，回滚主题
      setTheme(theme);
    }
  };

  // 应用主题到document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 初始化主题（从用户配置加载）
  useEffect(() => {
    if (user?.theme) {
      const userTheme = user.theme === 'dark' ? 'dark' : 'light';
      console.log(`🎨 从用户配置加载主题: ${userTheme}`);
      setTheme(userTheme);
    }
  }, [user?.theme]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      padding: '2rem',
    }}>
      <style dangerouslySetInnerHTML={{ __html: cssVariables }} />

      {/* 主题切换按钮 */}
      <button
        onClick={handleThemeToggle}
        className="theme-toggle"
        title={`切换到${theme === 'dark' ? '浅色' : '深色'}主题`}
      >
        {theme === 'dark' ? '🌙' : '☀️'}
      </button>

      <StudyOverview />
    </div>
  );
}
