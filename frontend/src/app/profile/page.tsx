'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, Save, Edit, Activity, Settings, LogOut, Shield } from 'lucide-react';
import { userAPI } from '@/lib/api';
import '@/styles/theme.css';
import { useAuthStore } from '@/store/auth';
import SystemConfigPanel from '@/components/admin/SystemConfigPanel';
import SuggestionManagement from '@/components/admin/SuggestionManagement';
import ExerciseConfigManager from '@/components/ExerciseConfigManager';
import GoalManagement from '@/components/GoalManagement';
import { VERSION_INFO, getVersionString } from '@/lib/version';

interface UserData {
  name: string;
  email: string;
  isAdmin: boolean;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'exercise' | 'account' | 'admin'>('profile');
  const [adminSubTab, setAdminSubTab] = useState<'config' | 'suggestions'>('config');
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  
  // 用户信息表单
  const [userData, setUserData] = useState<UserData>({
    name: '',
    email: '',
    isAdmin: false,
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

  // 加载用户数据（实时从后端获取）
  const loadUserData = async () => {
    try {
      setIsPageLoading(true);
      const response = await userAPI.getProfile();
      const user = response.data;

      setUserData({
        name: user.name || '',
        email: user.email || '',
        isAdmin: user.isAdmin || false,
      });

      // 设置主题
      if (user.theme) {
        const userTheme = user.theme === 'dark' ? 'dark' : 'light';
        setTheme(userTheme);
      }
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

  // 退出登录
  const handleLogout = () => {
    if (confirm('确定要退出登录吗？')) {
      logout();
      router.push('/');
    }
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
            <button
              className={`tab-button ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <Shield size={18} />
              账户管理
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
            <div>
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

              {/* 目标管理功能 */}
              <div className="mt-8">
                <GoalManagement onGoalChange={() => {
                  // 目标变更后的回调，可以用来刷新其他相关数据
                  console.log('目标已更新');
                  loadUserData(); // 重新加载用户数据以更新目标信息
                }} />
              </div>
            </div>
          )}



          {/* 运动配置标签页 */}
          {activeTab === 'exercise' && (
            <div className="form-container">
              <ExerciseConfigManager onUpdate={() => {
                // 运动配置更新后的回调，可以用来刷新其他相关数据
                console.log('运动配置已更新');
              }} />
            </div>
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

          {/* 账户管理标签页 */}
          {activeTab === 'account' && (
            <div className="form-container">
              <div className="account-section">
                <h3 style={{
                  color: 'var(--text-primary)',
                  marginBottom: '1rem',
                  fontSize: '1.1rem',
                  fontWeight: '600'
                }}>
                  账户安全
                </h3>

                <div className="account-info" style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>当前账户：</strong>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      {userData.email}
                    </span>
                  </div>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>用户名：</strong>
                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                      {userData.name}
                    </span>
                  </div>
                  {userData.isAdmin && (
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>权限：</strong>
                      <span style={{
                        color: '#10b981',
                        marginLeft: '0.5rem',
                        fontSize: '0.875rem',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '4px'
                      }}>
                        管理员
                      </span>
                    </div>
                  )}
                </div>

                <div className="version-section" style={{
                  marginBottom: '1.5rem',
                  paddingBottom: '1rem',
                  borderBottom: '1px solid var(--border-color)'
                }}>
                  <h4 style={{
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}>
                    系统信息
                  </h4>
                  <div style={{
                    backgroundColor: 'var(--bg-secondary)',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.875rem'
                  }}>
                    <div style={{ marginBottom: '0.25rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>版本：</strong>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                        {getVersionString()}
                      </span>
                    </div>
                    <div style={{ marginBottom: '0.25rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>构建日期：</strong>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                        {VERSION_INFO.buildDate}
                      </span>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>系统名称：</strong>
                      <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                        {VERSION_INFO.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="logout-section">
                  <h4 style={{
                    color: 'var(--text-primary)',
                    marginBottom: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}>
                    退出登录
                  </h4>
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    marginBottom: '1rem',
                    lineHeight: '1.5'
                  }}>
                    退出当前账户，返回到登录页面。请确保已保存所有重要数据。
                  </p>
                  <button
                    onClick={handleLogout}
                    className="btn"
                    style={{
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                    }}
                  >
                    <LogOut size={16} />
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 系统管理标签页（仅管理员可见） */}
          {activeTab === 'admin' && userData.isAdmin && (
            <div>
              {/* 管理员子标签 */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                marginBottom: '2rem',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <button
                  onClick={() => setAdminSubTab('config')}
                  style={{
                    padding: '0.75rem 1rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: adminSubTab === 'config' ? 'var(--primary-color)' : 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    borderBottom: adminSubTab === 'config' ? '2px solid var(--primary-color)' : '2px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  系统配置
                </button>
                <button
                  onClick={() => setAdminSubTab('suggestions')}
                  style={{
                    padding: '0.75rem 1rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: adminSubTab === 'suggestions' ? 'var(--primary-color)' : 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    borderBottom: adminSubTab === 'suggestions' ? '2px solid var(--primary-color)' : '2px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  系统建议
                </button>
              </div>

              {/* 子标签内容 */}
              {adminSubTab === 'config' && <SystemConfigPanel />}
              {adminSubTab === 'suggestions' && <SuggestionManagement />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
