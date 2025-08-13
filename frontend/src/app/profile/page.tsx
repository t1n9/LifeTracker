'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, Save, Edit, Activity, Settings } from 'lucide-react';
import { userAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import SystemConfigPanel from '@/components/admin/SystemConfigPanel';

interface UserData {
  name: string;
  email: string;
  targetName: string;
  targetDate: string;
  examDate: string;
  isAdmin: boolean;
  // 运动配置
  showPullUps: boolean;
  showSquats: boolean;
  showPushUps: boolean;
  showRunning: boolean;
  showSwimming: boolean;
  showCycling: boolean;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'exercise' | 'admin'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 用户信息表单
  const [userData, setUserData] = useState<UserData>({
    name: '',
    email: '',
    targetName: '',
    targetDate: '',
    examDate: '',
    isAdmin: false,
    // 运动配置默认值
    showPullUps: true,
    showSquats: true,
    showPushUps: true,
    showRunning: true,
    showSwimming: false,
    showCycling: false,
  });
  
  // 密码修改表单
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // 检查认证状态
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadUserData();
  }, [isAuthenticated, router]);

  // 加载用户数据（实时从后端获取）
  const loadUserData = async () => {
    try {
      setIsPageLoading(true);
      const response = await userAPI.getProfile();
      const user = response.data;
      
      setUserData({
        name: user.name || '',
        email: user.email || '',
        targetName: user.targetName || '',
        targetDate: user.targetDate ? user.targetDate.split('T')[0] : '',
        examDate: user.examDate ? user.examDate.split('T')[0] : '',
        isAdmin: user.isAdmin || false,
        // 运动配置
        showPullUps: user.showPullUps ?? true,
        showSquats: user.showSquats ?? true,
        showPushUps: user.showPushUps ?? true,
        showRunning: user.showRunning ?? true,
        showSwimming: user.showSwimming ?? false,
        showCycling: user.showCycling ?? false,
      });
    } catch (error: any) {
      console.error('加载用户数据失败:', error);
      if (error.response?.status === 401) {
        logout();
        router.push('/');
      } else {
        setError('加载用户数据失败，请刷新页面重试');
      }
    } finally {
      setIsPageLoading(false);
    }
  };

  // 重置表单
  const resetForms = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setError('');
    setSuccess('');
  };

  // 处理用户信息更新
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData: any = {
        name: userData.name,
        targetName: userData.targetName || null,
        targetDate: userData.targetDate ? new Date(userData.targetDate).toISOString() : null,
        examDate: userData.examDate ? new Date(userData.examDate).toISOString() : null,
        // 运动配置
        showPullUps: userData.showPullUps,
        showSquats: userData.showSquats,
        showPushUps: userData.showPushUps,
        showRunning: userData.showRunning,
        showSwimming: userData.showSwimming,
        showCycling: userData.showCycling,
      };

      await userAPI.updateProfile(updateData);
      setSuccess('用户信息更新成功！');
      
      // 重新加载用户数据以确保显示最新信息
      await loadUserData();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || '更新失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理密码修改
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // 验证密码
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('新密码和确认密码不一致');
      setIsLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('新密码长度至少6位');
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3002/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(passwordData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '修改密码失败');
      }

      setSuccess('密码修改成功！');
      resetForms();
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);

    } catch (error: any) {
      setError(error.message || '修改密码失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 切换密码显示
  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // 页面加载中
  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>加载用户信息中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <style dangerouslySetInnerHTML={{ __html: `
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

        .profile-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border-color);
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          text-decoration: none;
          font-size: 0.875rem;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .back-button:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent-primary);
          transform: translateY(-1px);
        }

        .profile-card {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 2rem;
          box-shadow: var(--shadow);
          border: 1px solid var(--border-color);
        }

        .profile-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 2rem;
        }

        .tab-button {
          flex: 1;
          padding: 1rem;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-size: 1rem;
          border-bottom: 2px solid transparent;
        }

        .tab-button:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        .tab-button.active {
          color: var(--accent-primary);
          border-bottom-color: var(--accent-primary);
          background: var(--bg-tertiary);
        }

        .form-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-width: 100%;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .form-group label {
          font-weight: 500;
          color: var(--text-primary);
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
        }

        .input-with-icon {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-with-icon svg {
          position: absolute;
          left: 0.75rem;
          color: var(--text-muted);
          z-index: 1;
        }

        .input-with-icon input {
          padding-left: 2.5rem;
        }

        .form-input {
          width: 100%;
          padding: 0.875rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.875rem;
          transition: all 0.2s ease;
          box-sizing: border-box;
          min-height: 2.75rem;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }

        .form-input:disabled {
          background: var(--bg-tertiary);
          color: var(--text-muted);
          cursor: not-allowed;
        }

        .form-help {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .password-input {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .password-input input {
          width: 100%;
          padding-right: 3rem !important;
        }

        .password-toggle {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 6px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          height: 2rem;
        }

        .password-toggle:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        .form-actions {
          margin-top: 2rem;
          display: flex;
          justify-content: flex-end;
          width: 100%;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem 2rem;
          border-radius: 8px;
          border: none;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          min-height: 2.75rem;
          min-width: 120px;
        }

        .btn-primary {
          background-color: var(--accent-primary);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--accent-secondary);
          transform: translateY(-1px);
        }

        .btn-primary:disabled {
          background: var(--bg-tertiary);
          color: var(--text-muted);
          cursor: not-allowed;
        }

        .alert {
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .alert-success {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        @media (max-width: 768px) {
          .profile-container {
            padding: 1rem 0.5rem;
          }

          .profile-card {
            padding: 1.5rem 1rem;
          }

          .tab-button {
            padding: 0.75rem;
            font-size: 0.875rem;
          }

          .form-container {
            gap: 1.25rem;
          }

          .form-input {
            padding: 0.75rem;
            font-size: 16px; /* 防止iOS缩放 */
          }

          .btn {
            width: 100%;
            padding: 1rem;
          }

          .form-actions {
            margin-top: 1.5rem;
          }

          .password-toggle {
            padding: 0.75rem;
            min-width: 2.5rem;
            height: 2.5rem;
          }
        }
      ` }} />

      <div className="profile-container">
        {/* 页面头部 */}
        <div className="profile-header">
          <button onClick={() => router.push('/')} className="back-button">
            <ArrowLeft size={18} />
            返回首页
          </button>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600', 
            color: 'var(--text-primary)',
            margin: 0 
          }}>
            用户信息管理
          </h1>
        </div>

        {/* 主要内容卡片 */}
        <div className="profile-card">
          {/* 标签页 */}
          <div className="profile-tabs">
            <button
              className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <Edit size={18} />
              个人信息
            </button>
            <button
              className={`tab-button ${activeTab === 'exercise' ? 'active' : ''}`}
              onClick={() => setActiveTab('exercise')}
            >
              <Activity size={18} />
              运动配置
            </button>
            <button
              className={`tab-button ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              <Lock size={18} />
              修改密码
            </button>
            {userData.isAdmin && (
              <button
                className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <Settings size={18} />
                系统配置
              </button>
            )}
          </div>

          {/* 错误和成功提示 */}
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}

          {/* 个人信息标签页 */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="form-container">
              <div className="form-group">
                <label htmlFor="name">姓名 *</label>
                <div className="input-with-icon">
                  <User size={18} />
                  <input
                    type="text"
                    id="name"
                    className="form-input"
                    value={userData.name}
                    onChange={(e) => setUserData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="请输入姓名"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="email">邮箱</label>
                <div className="input-with-icon">
                  <Mail size={18} />
                  <input
                    type="email"
                    id="email"
                    className="form-input"
                    value={userData.email}
                    disabled
                    placeholder="邮箱不可修改"
                  />
                </div>
                <small className="form-help">邮箱地址不可修改</small>
              </div>

              <div className="form-group">
                <label htmlFor="targetName">目标名称</label>
                <input
                  type="text"
                  id="targetName"
                  className="form-input"
                  value={userData.targetName}
                  onChange={(e) => setUserData(prev => ({ ...prev, targetName: e.target.value }))}
                  placeholder="如：雅思、考研、托福等"
                />
              </div>

              <div className="form-group">
                <label htmlFor="targetDate">目标日期</label>
                <input
                  type="date"
                  id="targetDate"
                  className="form-input"
                  value={userData.targetDate}
                  onChange={(e) => setUserData(prev => ({ ...prev, targetDate: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label htmlFor="examDate">考试日期</label>
                <input
                  type="date"
                  id="examDate"
                  className="form-input"
                  value={userData.examDate}
                  onChange={(e) => setUserData(prev => ({ ...prev, examDate: e.target.value }))}
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  <Save size={16} />
                  {isLoading ? '保存中...' : '保存更改'}
                </button>
              </div>
            </form>
          )}

          {/* 运动配置标签页 */}
          {activeTab === 'exercise' && (
            <form onSubmit={handleProfileUpdate} className="form-container">
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem'
                }}>
                  选择要显示的运动项目
                </h3>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-muted)',
                  marginBottom: '1rem'
                }}>
                  开启的运动项目将在运动统计中显示，关闭的项目将被隐藏
                </p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                {/* 单杠 */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: userData.showPullUps ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={userData.showPullUps}
                    onChange={(e) => setUserData(prev => ({ ...prev, showPullUps: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--accent-primary)'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>💪 单杠</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>计数型运动</div>
                  </div>
                </label>

                {/* 深蹲 */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: userData.showSquats ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={userData.showSquats}
                    onChange={(e) => setUserData(prev => ({ ...prev, showSquats: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--accent-primary)'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>🦵 深蹲</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>计数型运动</div>
                  </div>
                </label>

                {/* 俯卧撑 */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: userData.showPushUps ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={userData.showPushUps}
                    onChange={(e) => setUserData(prev => ({ ...prev, showPushUps: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--accent-primary)'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>🤲 俯卧撑</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>计数型运动</div>
                  </div>
                </label>

                {/* 跑步 */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: userData.showRunning ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={userData.showRunning}
                    onChange={(e) => setUserData(prev => ({ ...prev, showRunning: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--accent-primary)'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>🏃 跑步</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>距离型运动</div>
                  </div>
                </label>

                {/* 游泳 */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: userData.showSwimming ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={userData.showSwimming}
                    onChange={(e) => setUserData(prev => ({ ...prev, showSwimming: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--accent-primary)'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>🏊 游泳</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>距离型运动</div>
                  </div>
                </label>

                {/* 骑行 */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  background: userData.showCycling ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="checkbox"
                    checked={userData.showCycling}
                    onChange={(e) => setUserData(prev => ({ ...prev, showCycling: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      accentColor: 'var(--accent-primary)'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>🚴 骑行</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>距离型运动</div>
                  </div>
                </label>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  <Save size={16} />
                  {isLoading ? '保存中...' : '保存配置'}
                </button>
              </div>
            </form>
          )}

          {/* 修改密码标签页 */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="form-container">
              <div className="form-group">
                <label htmlFor="currentPassword">当前密码 *</label>
                <div className="password-input">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    id="currentPassword"
                    className="form-input"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="请输入当前密码"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility('current')}
                  >
                    {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">新密码 *</label>
                <div className="password-input">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    id="newPassword"
                    className="form-input"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="请输入新密码（至少6位）"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility('new')}
                  >
                    {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">确认新密码 *</label>
                <div className="password-input">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    id="confirmPassword"
                    className="form-input"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="请再次输入新密码"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => togglePasswordVisibility('confirm')}
                  >
                    {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  <Lock size={16} />
                  {isLoading ? '修改中...' : '修改密码'}
                </button>
              </div>
            </form>
          )}

          {/* 系统配置标签页（仅管理员可见） */}
          {activeTab === 'admin' && userData.isAdmin && (
            <SystemConfigPanel />
          )}
        </div>
      </div>
    </div>
  );
}
