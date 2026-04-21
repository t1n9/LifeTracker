'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Sparkles, UserRound } from 'lucide-react';
import { authAPI, emailAPI, systemConfigAPI } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import styles from './LoginForm.module.css';

type FormMode = 'login' | 'register';

interface ApiError {
  response?: {
    data?: {
      message?: string | string[];
    };
  };
  message?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiError;
  const message = apiError.response?.data?.message;

  if (Array.isArray(message)) {
    return message.join('，');
  }

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return apiError.message || fallback;
}

export default function LoginForm() {
  const { login } = useAuthStore();
  const [mode, setMode] = useState<FormMode>('login');
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const isLogin = mode === 'login';

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await systemConfigAPI.getPublicConfigs();
        setRegistrationEnabled(response.data.registration_enabled === 'true');
      } catch (fetchError) {
        console.error('Failed to load registration config:', fetchError);
        setRegistrationEnabled(false);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    setError('');
    setSuccess('');
    setShowPassword(false);
    setShowVerificationInput(false);
    setVerificationCode('');
    setCountdown(0);
  }, [mode]);

  const modeCopy = useMemo(
    () =>
      isLogin
        ? {
            eyebrow: 'LifeTracker',
            title: '欢迎回来',
            description: '登录后继续你的任务、专注和每日记录。',
            submit: '登录',
            loading: '登录中...',
            switchText: '还没有账号？',
            switchAction: '创建账号',
          }
        : {
            eyebrow: 'Create account',
            title: '创建你的工作台',
            description: '注册后即可开始记录任务、番茄钟和每日进展。',
            submit: '注册',
            loading: '注册中...',
            switchText: '已经有账号？',
            switchAction: '返回登录',
          },
    [isLogin],
  );

  const handleModeChange = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setError('');
    setSuccess('');
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSendCode = async () => {
    if (!formData.email || sendingCode || countdown > 0) {
      return;
    }

    setSendingCode(true);
    setError('');
    setSuccess('');

    try {
      const response = await emailAPI.sendVerificationCode(formData.email, 'register');

      if (response.data.success) {
        setShowVerificationInput(true);
        setCountdown(60);
        setSuccess('验证码已发送，请查看邮箱。');
      }
    } catch (sendError) {
      setError(getErrorMessage(sendError, '发送验证码失败，请稍后重试。'));
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        const response = await authAPI.login({
          email: formData.email.trim(),
          password: formData.password,
        });
        login(response.data.accessToken);
        return;
      }

      if (!registrationEnabled) {
        setError('注册功能当前未开放。');
        return;
      }

      if (!formData.name.trim()) {
        setError('请输入昵称。');
        return;
      }

      if (formData.password.length < 6) {
        setError('密码至少需要 6 位。');
        return;
      }

      if (!showVerificationInput) {
        setError('请先获取邮箱验证码。');
        return;
      }

      if (verificationCode.length !== 6) {
        setError('请输入 6 位验证码。');
        return;
      }

      const response = await authAPI.register({
        email: formData.email.trim(),
        password: formData.password,
        name: formData.name.trim(),
        verificationCode,
      });
      login(response.data.accessToken);
    } catch (submitError) {
      setError(getErrorMessage(submitError, isLogin ? '登录失败，请重试。' : '注册失败，请重试。'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.backgroundGlow} aria-hidden="true" />

      <main className={styles.layout}>
        <section className={styles.brandPanel}>
          <div className={styles.brandBadge}>
            <Sparkles size={16} />
            <span>Calm Productivity</span>
          </div>

          <div className={styles.brandContent}>
            <p className={styles.eyebrow}>{modeCopy.eyebrow}</p>
            <h1 className={styles.brandTitle}>像一个现代工作台，而不是旧后台。</h1>
            <p className={styles.brandDescription}>
              任务、专注、记录和复盘应该待在一个清晰、安静、长期可用的界面里。
            </p>
          </div>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <span className={styles.featureLabel}>任务管理</span>
              <span className={styles.featureValue}>更清晰的每日视图</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureLabel}>专注记录</span>
              <span className={styles.featureValue}>番茄钟与学习统计</span>
            </div>
            <div className={styles.featureItem}>
              <span className={styles.featureLabel}>生活记录</span>
              <span className={styles.featureValue}>运动、消费、复盘一体化</span>
            </div>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardEyebrow}>{modeCopy.eyebrow}</p>
                <h2 className={styles.cardTitle}>{modeCopy.title}</h2>
                <p className={styles.cardDescription}>{modeCopy.description}</p>
              </div>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              {!isLogin && (
                <label className={styles.field}>
                  <span className={styles.label}>昵称</span>
                  <span className={styles.inputWrap}>
                    <UserRound size={18} className={styles.icon} />
                    <input
                      className={styles.input}
                      name="name"
                      type="text"
                      autoComplete="nickname"
                      placeholder="输入你希望显示的名字"
                      value={formData.name}
                      onChange={handleInputChange}
                      required={!isLogin}
                    />
                  </span>
                </label>
              )}

              <label className={styles.field}>
                <span className={styles.label}>邮箱</span>
                <span className={styles.inputWrap}>
                  <Mail size={18} className={styles.icon} />
                  <input
                    className={styles.input}
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </span>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>密码</span>
                <span className={styles.inputWrap}>
                  <LockKeyhole size={18} className={styles.icon} />
                  <input
                    className={styles.inputWithAction}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    placeholder={isLogin ? '输入你的密码' : '至少 6 位'}
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                  />
                  <button
                    type="button"
                    className={styles.visibilityButton}
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>

              {!isLogin && (
                <div className={styles.field}>
                  <span className={styles.label}>邮箱验证码</span>
                  <div className={styles.codeRow}>
                    <span className={styles.inputWrap}>
                      <Mail size={18} className={styles.icon} />
                      <input
                        className={styles.codeInput}
                        type="text"
                        inputMode="numeric"
                        placeholder="6 位验证码"
                        value={verificationCode}
                        onChange={(event) => {
                          setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                          setError('');
                        }}
                        disabled={!showVerificationInput}
                        maxLength={6}
                      />
                    </span>
                    <button
                      type="button"
                      className={styles.codeButton}
                      onClick={handleSendCode}
                      disabled={sendingCode || countdown > 0 || !formData.email.trim()}
                    >
                      {sendingCode ? '发送中...' : countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </button>
                  </div>
                </div>
              )}

              {(error || success) && (
                <div className={error ? styles.alertError : styles.alertSuccess}>
                  {error || success}
                </div>
              )}

              <button className={styles.submitButton} type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LoaderCircle size={18} className={styles.spinner} />
                    <span>{modeCopy.loading}</span>
                  </>
                ) : (
                  <span>{modeCopy.submit}</span>
                )}
              </button>
            </form>

            {registrationEnabled ? (
              <div className={styles.switchRow}>
                <span>{modeCopy.switchText}</span>
                <button type="button" className={styles.switchButton} onClick={handleModeChange}>
                  {modeCopy.switchAction}
                </button>
              </div>
            ) : !isLogin ? (
              <div className={styles.registrationClosed}>注册功能当前未开放，请联系管理员。</div>
            ) : null}
          </div>

          <footer className={styles.footer}>
            <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">
              粤ICP备2025456526号-1
            </a>
            <a
              href="https://beian.mps.gov.cn/#/query/webSearch?code=44030002007784"
              target="_blank"
              rel="noreferrer"
              className={styles.footerPublicSecurity}
            >
              <Image src="/beian-icon.png" alt="备案图标" width={14} height={14} />
              <span>粤公网安备44030002007784号</span>
            </a>
          </footer>
        </section>
      </main>
    </div>
  );
}
