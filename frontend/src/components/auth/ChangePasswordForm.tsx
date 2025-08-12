'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Check, X } from 'lucide-react';

interface ChangePasswordFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChangePasswordForm({ onClose, onSuccess }: ChangePasswordFormProps) {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 验证表单
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError('请填写所有字段');
      return;
    }

    if (formData.newPassword.length < 6) {
      setError('新密码至少需要6个字符');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('新密码和确认密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3002/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '修改密码失败');
      }

      setSuccess('密码修改成功！');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (error: any) {
      setError(error.message || '修改密码失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--card-bg)',
        borderRadius: '12px',
        padding: '2rem',
        width: '100%',
        maxWidth: '400px',
        margin: '1rem',
        border: '1px solid var(--border-color)',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            margin: 0,
            color: 'var(--text-primary)',
            fontSize: '1.25rem',
            fontWeight: '600'
          }}>
            修改密码
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 当前密码 */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}>
              当前密码
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={18} 
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={formData.currentPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 40px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                placeholder="请输入当前密码"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 新密码 */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}>
              新密码
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={18} 
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type={showPasswords.new ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 40px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                placeholder="请输入新密码（至少6个字符）"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 确认密码 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              marginBottom: '0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}>
              确认新密码
            </label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={18} 
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              />
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '12px 40px 12px 40px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
                placeholder="请再次输入新密码"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 错误和成功消息 */}
          {error && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '6px',
              marginBottom: '1rem',
              color: '#dc2626',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <X size={16} />
              {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '6px',
              marginBottom: '1rem',
              color: '#16a34a',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Check size={16} />
              {success}
            </div>
          )}

          {/* 按钮 */}
          <div style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'flex-end'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.75rem 1.5rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: isLoading ? 'var(--text-muted)' : 'var(--primary-color)',
                color: 'white',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              {isLoading ? '修改中...' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
