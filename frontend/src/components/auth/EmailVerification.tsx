'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { emailAPI } from '@/lib/api';

interface EmailVerificationProps {
  email: string;
  purpose: 'register' | 'reset_password' | 'change_email';
  onVerified: (email: string, code: string) => void;
  onCancel?: () => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({
  email,
  purpose,
  onVerified,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const handleSendCode = async () => {
    if (countdown > 0) return;
    
    try {
      setSending(true);
      setError('');
      
      const response = await emailAPI.sendVerificationCode(email, purpose);
      
      if (response.data.success) {
        setSuccess('验证码已发送，请查收邮件');
        setCountdown(60); // 60秒倒计时
        
        // 开发环境显示验证码
        if (response.data.code) {
          console.log('🔐 开发环境验证码:', response.data.code);
        }
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '发送验证码失败');
    } finally {
      setSending(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError('请输入验证码');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await emailAPI.verifyCode(email, code.trim(), purpose);
      
      if (response.data.success) {
        setSuccess('验证成功！');
        onVerified(email, code.trim());
      }
    } catch (error: any) {
      setError(error.response?.data?.message || '验证码验证失败');
    } finally {
      setLoading(false);
    }
  };

  const getPurposeText = () => {
    switch (purpose) {
      case 'register':
        return '注册账户';
      case 'reset_password':
        return '重置密码';
      case 'change_email':
        return '变更邮箱';
      default:
        return '验证身份';
    }
  };

  return (
    <div style={{
      maxWidth: '400px',
      margin: '0 auto',
      padding: '2rem',
      backgroundColor: 'var(--bg-secondary)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)',
    }}>
      {/* 标题 */}
      <div style={{
        textAlign: 'center',
        marginBottom: '2rem',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}>
          <Mail size={48} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: 'var(--text-primary)',
          margin: '0 0 0.5rem 0',
        }}>
          邮箱验证
        </h2>
        <p style={{
          color: 'var(--text-secondary)',
          margin: 0,
        }}>
          {getPurposeText()}需要验证邮箱
        </p>
      </div>

      {/* 邮箱地址 */}
      <div style={{
        padding: '1rem',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          marginBottom: '0.25rem',
        }}>
          验证码将发送至
        </div>
        <div style={{
          fontSize: '1rem',
          fontWeight: '500',
          color: 'var(--text-primary)',
        }}>
          {email}
        </div>
      </div>

      {/* 验证码输入 */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: '500',
          color: 'var(--text-primary)',
          marginBottom: '0.5rem',
        }}>
          验证码
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="请输入6位验证码"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '1rem',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            textAlign: 'center',
            letterSpacing: '0.2em',
          }}
          maxLength={6}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleVerifyCode();
            }
          }}
        />
      </div>

      {/* 发送验证码按钮 */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        <button
          onClick={handleSendCode}
          disabled={sending || countdown > 0}
          style={{
            flex: 1,
            padding: '0.75rem',
            border: '1px solid var(--accent-primary)',
            borderRadius: '6px',
            backgroundColor: countdown > 0 ? 'var(--bg-tertiary)' : 'transparent',
            color: countdown > 0 ? 'var(--text-secondary)' : 'var(--accent-primary)',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: countdown > 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {sending ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--accent-primary)',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              发送中...
            </>
          ) : countdown > 0 ? (
            <>
              <Clock size={16} />
              {countdown}秒后重发
            </>
          ) : (
            <>
              <Mail size={16} />
              发送验证码
            </>
          )}
        </button>
      </div>

      {/* 验证按钮 */}
      <button
        onClick={handleVerifyCode}
        disabled={loading || !code.trim()}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: 'none',
          borderRadius: '6px',
          backgroundColor: loading || !code.trim() ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
          color: loading || !code.trim() ? 'var(--text-secondary)' : 'white',
          fontSize: '1rem',
          fontWeight: '500',
          cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}
      >
        {loading ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid white',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            验证中...
          </>
        ) : (
          <>
            <CheckCircle size={16} />
            验证
          </>
        )}
      </button>

      {/* 错误和成功消息 */}
      {error && (
        <div style={{
          padding: '0.75rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '6px',
          color: '#ef4444',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}>
          <AlertCircle size={16} />
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
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
        }}>
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* 取消按钮 */}
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
        >
          取消
        </button>
      )}
    </div>
  );
};

export default EmailVerification;
