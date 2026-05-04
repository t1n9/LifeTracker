'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, Save, Edit, Settings, LogOut, Shield, MessageSquare } from 'lucide-react';
import { userAPI, api } from '@/lib/api';
import '@/styles/theme.css';
import { useAuthStore } from '@/store/auth';
import SystemConfigPanel from '@/components/admin/SystemConfigPanel';
import SuggestionManagement from '@/components/admin/SuggestionManagement';
import UserManagement from '@/components/admin/UserManagement';
import AuditLogViewer from '@/components/admin/AuditLogViewer';
import { PlanReferencesAdminPanel } from '@/components/admin/ExamTemplateManagement';
import GoalManagement from '@/components/GoalManagement';
import SystemSuggestion from '@/components/SystemSuggestion';
import { VERSION_INFO, getVersionString } from '@/lib/version';

interface UserData {
  name: string;
  email: string;
  isAdmin: boolean;
  role?: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading, hasInitialized, initializeAuth, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'account' | 'suggestion' | 'admin'>('profile');
  const [adminSubTab, setAdminSubTab] = useState<'config' | 'suggestions' | 'users' | 'logs' | 'plan-references'>('config');
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

  const pageShellStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-0)',
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  };

  // 检查认证状态
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!hasInitialized || isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    loadUserData();
  }, [hasInitialized, isAuthLoading, isAuthenticated, router]);

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
        role: user.role || 'USER',
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
      await api.put('/auth/change-password', passwordData);

      setSuccess('密码修改成功！');
      resetForms();

      setTimeout(() => {
        setSuccess('');
      }, 3000);

    } catch (error: any) {
      const message = error?.response?.data?.message || error.message || '修改密码失败，请重试';
      setError(message);
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
  if (isAuthLoading || !hasInitialized || isPageLoading) {
    return (
      <div style={{ ...pageShellStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', border: '3px solid var(--line)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
          <p style={{ margin: 0, color: 'var(--fg-3)', fontSize: '13px' }}>加载用户信息中…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageShellStyle}>

      <div className="profile-container">
        {/* 页面头部 */}
        <div className="profile-header">
          <button onClick={() => router.push('/')} className="back-button">
            <ArrowLeft size={18} />
            返回首页
          </button>
          <h1 className="profile-title">设置中心</h1>
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
            <button
              className={`tab-button ${activeTab === 'suggestion' ? 'active' : ''}`}
              onClick={() => setActiveTab('suggestion')}
            >
              <MessageSquare size={18} />
              系统建议
            </button>
            {userData.role === 'ADMIN' && (
              <button
                className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                <Settings size={18} />
                管理面板
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
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line-2)', borderRadius: '10px', background: 'var(--bg-0)', overflow: 'hidden' }}>
                    <User size={16} style={{ flexShrink: 0, margin: '0 10px', color: 'var(--fg-4)' }} />
                    <input
                      type="text"
                      id="name"
                      value={userData.name}
                      onChange={(e) => setUserData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="请输入姓名"
                      required
                      style={{ flex: 1, padding: '10px 12px 10px 0', border: 'none', background: 'transparent', color: 'var(--fg)', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">邮箱</label>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line-2)', borderRadius: '10px', background: 'var(--bg-0)', overflow: 'hidden', opacity: 0.7 }}>
                    <Mail size={16} style={{ flexShrink: 0, margin: '0 10px', color: 'var(--fg-4)' }} />
                    <input
                      type="text"
                      id="email"
                      value={userData.email}
                      disabled
                      placeholder="邮箱不可修改"
                      style={{ flex: 1, padding: '10px 12px 10px 0', border: 'none', background: 'transparent', color: 'var(--fg-3)', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'not-allowed' }}
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



          {/* 修改密码标签页 */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="form-container">
              {(['current', 'new', 'confirm'] as const).map((field) => {
                const labels = { current: '当前密码 *', new: '新密码 *', confirm: '确认新密码 *' };
                const placeholders = { current: '请输入当前密码', new: '请输入新密码（至少6位）', confirm: '请再次输入新密码' };
                const keys = { current: 'currentPassword', new: 'newPassword', confirm: 'confirmPassword' } as const;
                return (
                  <div key={field} className="form-group">
                    <label htmlFor={keys[field]}>{labels[field]}</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--line-2)', borderRadius: '10px', background: 'var(--bg-0)', overflow: 'hidden' }}>
                      <input
                        type={showPasswords[field] ? 'text' : 'password'}
                        id={keys[field]}
                        value={passwordData[keys[field]]}
                        onChange={(e) => setPasswordData(prev => ({ ...prev, [keys[field]]: e.target.value }))}
                        placeholder={placeholders[field]}
                        required
                        minLength={field !== 'current' ? 6 : undefined}
                        style={{ flex: 1, padding: '10px 0 10px 12px', border: 'none', background: 'transparent', color: 'var(--fg)', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(field)}
                        style={{ padding: '0 12px', background: 'none', border: 'none', color: 'var(--fg-4)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-4)')}
                      >
                        {showPasswords[field] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
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
                <h3 className="account-heading">
                  账户安全
                </h3>

                <div className="account-info">
                  <div className="account-row">
                    <strong className="account-key">当前账户：</strong>
                    <span className="account-value">
                      {userData.email}
                    </span>
                  </div>
                  <div className="account-row">
                    <strong className="account-key">用户名：</strong>
                    <span className="account-value">
                      {userData.name}
                    </span>
                  </div>
                  {userData.role === 'ADMIN' && (
                    <div className="account-row">
                      <strong className="account-key">权限：</strong>
                      <span className="role-badge">
                        管理员
                      </span>
                    </div>
                  )}
                </div>

                <div className="version-section">
                  <h4 className="section-heading">
                    系统信息
                  </h4>
                  <div className="version-box">
                    <div className="version-row">
                      <strong className="account-key">版本：</strong>
                      <span className="account-value">
                        {getVersionString()}
                      </span>
                    </div>
                    <div className="version-row">
                      <strong className="account-key">构建日期：</strong>
                      <span className="account-value">
                        {VERSION_INFO.buildDate}
                      </span>
                    </div>
                    <div className="version-row">
                      <strong className="account-key">系统名称：</strong>
                      <span className="account-value">
                        {VERSION_INFO.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="logout-section">
                  <h4 className="section-heading">
                    退出登录
                  </h4>
                  <p className="logout-desc">
                    退出当前账户，返回到登录页面。请确保已保存所有重要数据。
                  </p>
                  <button
                    onClick={handleLogout}
                    className="logout-button"
                  >
                    <LogOut size={16} />
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 系统管理标签页（仅管理员可见） */}
          {activeTab === 'suggestion' && (
            <div className="form-container">
              <SystemSuggestion embedded />
            </div>
          )}

          {activeTab === 'admin' && userData.role === 'ADMIN' && (
            <div>
              {/* 管理员子标签 */}
              <div className="admin-subtabs">
                <button
                  onClick={() => setAdminSubTab('config')}
                  className={`admin-subtab ${adminSubTab === 'config' ? 'active' : ''}`}
                >
                  系统配置
                </button>
                <button
                  onClick={() => setAdminSubTab('suggestions')}
                  className={`admin-subtab ${adminSubTab === 'suggestions' ? 'active' : ''}`}
                >
                  系统建议
                </button>
                <button
                  onClick={() => setAdminSubTab('users')}
                  className={`admin-subtab ${adminSubTab === 'users' ? 'active' : ''}`}
                >
                  用户管理
                </button>
                <button
                  onClick={() => setAdminSubTab('logs')}
                  className={`admin-subtab ${adminSubTab === 'logs' ? 'active' : ''}`}
                >
                  操作日志
                </button>
                <button
                  onClick={() => setAdminSubTab('plan-references')}
                  className={`admin-subtab ${adminSubTab === 'plan-references' ? 'active' : ''}`}
                >
                  计划参考库
                </button>
              </div>

              {/* 子标签内容 */}
              {adminSubTab === 'config' && <SystemConfigPanel />}
              {adminSubTab === 'suggestions' && <SuggestionManagement />}
              {adminSubTab === 'users' && <UserManagement />}
              {adminSubTab === 'logs' && <AuditLogViewer />}
              {adminSubTab === 'plan-references' && <PlanReferencesAdminPanel />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
