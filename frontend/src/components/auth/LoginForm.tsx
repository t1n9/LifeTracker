'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { authAPI, systemConfigAPI } from '@/lib/api';

export default function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const { login } = useAuthStore();

  // 获取系统配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await systemConfigAPI.getPublicConfigs();
        setRegistrationEnabled(response.data.registration_enabled === 'true');
      } catch (error) {
        console.error('获取系统配置失败:', error);
        setRegistrationEnabled(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        // 登录
        const response = await authAPI.login({
          email: formData.email,
          password: formData.password,
        });
        login(response.data.accessToken);
        console.log('登录成功');
      } else {
        // 注册
        const response = await authAPI.register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        });
        login(response.data.accessToken);
        console.log('注册成功');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const action = isLogin ? '登录' : '注册';
      console.error(`${action}失败`, err.response?.data?.message || err.message);
      alert(err.response?.data?.message || `${action}失败，请检查您的信息`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'white',
        padding: '2.5rem',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '0.5rem',
            letterSpacing: '-0.025em'
          }}>
            LifeTracker
          </h1>
          <p style={{ color: '#475569', fontSize: '1rem', fontWeight: '500' }}>
            生活记录系统 v2.0
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            {!isLogin && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  fontSize: '0.875rem'
                }}>
                  姓名
                </label>
                <input
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="请输入您的姓名"
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    color: '#1f2937',
                    backgroundColor: '#ffffff',
                    transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  required
                />
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
                fontSize: '0.875rem'
              }}>
                邮箱
              </label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="请输入邮箱地址"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  color: '#1f2937',
                  backgroundColor: '#ffffff',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                required
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '600',
                color: '#1f2937',
                fontSize: '0.875rem'
              }}>
                密码
              </label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="请输入密码"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  color: '#1f2937',
                  backgroundColor: '#ffffff',
                  transition: 'border-color 0.2s',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: isLoading ? '#94a3b8' : '#1e40af',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 4px 6px rgba(30, 64, 175, 0.3)'
              }}
              onMouseOver={(e) => {
                if (!isLoading) (e.target as HTMLButtonElement).style.backgroundColor = '#1d4ed8';
              }}
              onMouseOut={(e) => {
                if (!isLoading) (e.target as HTMLButtonElement).style.backgroundColor = '#1e40af';
              }}
            >
              {isLoading ? (isLogin ? '登录中...' : '注册中...') : (isLogin ? '登录' : '注册')}
            </button>
          </div>
        </form>

        {/* 模式切换 */}
        {registrationEnabled && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              {isLogin ? '还没有账号？' : '已有账号？'}
            </p>
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              style={{
                background: 'none',
                border: 'none',
                color: '#1e40af',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                (e.target as HTMLButtonElement).style.color = '#1d4ed8';
                (e.target as HTMLButtonElement).style.backgroundColor = '#f1f5f9';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLButtonElement).style.color = '#1e40af';
                (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              {isLogin ? '立即注册' : '返回登录'}
            </button>
          </div>
        )}

        {!registrationEnabled && !isLogin && (
          <div style={{
            textAlign: 'center',
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px'
          }}>
            <p style={{ color: '#92400e', fontSize: '0.875rem', margin: 0 }}>
              注册功能暂时关闭，请联系管理员
            </p>
          </div>
        )}
      </div>

      {/* ICP备案信息 */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        zIndex: 1000
      }}>
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#64748b',
            fontSize: '0.75rem',
            textDecoration: 'none',
            padding: '4px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(226, 232, 240, 0.5)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            (e.target as HTMLAnchorElement).style.color = '#475569';
            (e.target as HTMLAnchorElement).style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
          }}
          onMouseOut={(e) => {
            (e.target as HTMLAnchorElement).style.color = '#64748b';
            (e.target as HTMLAnchorElement).style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
          }}
        >
          粤ICP备2025456526号-1
        </a>
      </div>
    </div>
  );
}
