'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { authAPI } from '@/lib/api';

export default function LoginForm() {
  const [isLogin] = useState(true); // 固定为登录模式，不允许注册
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // 只支持登录
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password,
      });

      login(response.data.accessToken);
      console.log('登录成功');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      console.error('登录失败', err.response?.data?.message || err.message);
      alert(err.response?.data?.message || '请检查您的登录信息');
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
              {isLoading ? '登录中...' : '登录'}
            </button>
          </div>
        </form>

        {/* 注册功能已关闭 */}
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
