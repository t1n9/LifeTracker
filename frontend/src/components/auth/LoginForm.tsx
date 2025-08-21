'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { authAPI, systemConfigAPI, emailAPI } from '@/lib/api';

export default function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const { login } = useAuthStore();

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

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

  // 发送验证码
  const handleSendCode = async () => {
    if (countdown > 0 || !formData.email) return;

    try {
      setSendingCode(true);
      setError('');

      const response = await emailAPI.sendVerificationCode(formData.email, 'register');

      if (response.data.success) {
        setSuccess('验证码已发送，请查收邮件');
        setCountdown(60); // 60秒倒计时
        setShowVerificationInput(true);

        // 开发环境显示验证码
        if (response.data.code) {
          console.log('🔐 开发环境验证码:', response.data.code);
        }
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '发送验证码失败');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

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
        if (!formData.email || !formData.password) {
          setError('请填写邮箱和密码');
          return;
        }
        if (formData.password.length < 6) {
          setError('密码至少6位');
          return;
        }
        if (!showVerificationInput) {
          setError('请先获取验证码');
          return;
        }
        if (!verificationCode) {
          setError('请输入验证码');
          return;
        }

        // 注册
        const response = await authAPI.register({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          verificationCode: verificationCode,
        });
        login(response.data.accessToken);
        console.log('注册成功');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const action = isLogin ? '登录' : '注册';
      console.error(`${action}失败`, err.response?.data?.message || err.message);
      setError(err.response?.data?.message || `${action}失败，请检查您的信息`);
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

  // 快速登录演示账号
  const handleDemoLogin = async (email: string, password: string) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await authAPI.login({ email, password });
      login(response.data.accessToken);
      console.log('演示账号登录成功');
    } catch (error: any) {
      setError(error.response?.data?.message || '演示账号登录失败');
    } finally {
      setIsLoading(false);
    }
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

          {/* 备案审核说明 */}
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            fontSize: '0.875rem'
          }}>
            <div style={{ color: '#92400e', fontWeight: '600', marginBottom: '0.25rem' }}>
              🔍 网站备案审核中
            </div>
            <div style={{ color: '#92400e' }}>
              为方便审核人员查看网站功能，提供演示账号快速体验
            </div>
          </div>
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

            {/* 注册时的验证码输入 */}
            {!isLogin && (
              <>
                {/* 邮箱验证码获取 */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    邮箱验证码
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="请输入6位验证码"
                      disabled={!showVerificationInput}
                      style={{
                        flex: 1,
                        padding: '0.875rem',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        color: '#1f2937',
                        backgroundColor: showVerificationInput ? '#ffffff' : '#f9fafb',
                        transition: 'border-color 0.2s',
                        outline: 'none',
                        textAlign: 'center',
                        letterSpacing: '0.1em'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={sendingCode || countdown > 0 || !formData.email}
                      style={{
                        padding: '0.875rem 1rem',
                        border: '2px solid #3b82f6',
                        borderRadius: '8px',
                        backgroundColor: (sendingCode || countdown > 0 || !formData.email) ? '#f3f4f6' : 'transparent',
                        color: (sendingCode || countdown > 0 || !formData.email) ? '#9ca3af' : '#3b82f6',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        cursor: (sendingCode || countdown > 0 || !formData.email) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}秒` : '获取验证码'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* 错误和成功消息 */}
            {error && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: '#ef4444',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                padding: '0.75rem',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '6px',
                color: '#22c55e',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}>
                {success}
              </div>
            )}

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

        {/* 演示账号快速登录 */}
        {isLogin && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            backgroundColor: '#f8fafc',
            border: '2px solid #e2e8f0',
            borderRadius: '12px'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '1rem',
              color: '#475569',
              fontSize: '0.875rem',
              fontWeight: '600'
            }}>
              🎯 备案审核 - 演示账号
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleDemoLogin('demo@lifetracker.com', 'demo123')}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: isLoading ? '#94a3b8' : '#059669',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseOver={(e) => {
                  if (!isLoading) (e.target as HTMLButtonElement).style.backgroundColor = '#047857';
                }}
                onMouseOut={(e) => {
                  if (!isLoading) (e.target as HTMLButtonElement).style.backgroundColor = '#059669';
                }}
              >
                <span>📊</span>
                <span>演示账号 (含丰富数据)</span>
              </button>

              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                textAlign: 'center',
                lineHeight: '1.4'
              }}>
                * 包含学习记录、任务管理、运动数据、消费统计等完整功能演示<br/>
                * 仅用于备案审核，正式上线后将移除
              </div>
            </div>
          </div>
        )}

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
