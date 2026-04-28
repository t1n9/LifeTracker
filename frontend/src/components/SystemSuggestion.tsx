'use client';

import React, { useState } from 'react';
import { Lightbulb, MessageSquare, Send, X } from 'lucide-react';
import { suggestionsAPI } from '@/lib/api';

interface SystemSuggestionProps {
  onClose?: () => void;
  embedded?: boolean;
  showFloatingTrigger?: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.56)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '24px',
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
  marginBottom: '0.5rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.8rem 0.9rem',
  border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
  borderRadius: '12px',
  backgroundColor: 'color-mix(in srgb, var(--bg-primary) 90%, black 10%)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
  outline: 'none',
};

export default function SystemSuggestion({
  onClose,
  embedded = false,
  showFloatingTrigger = false,
}: SystemSuggestionProps) {
  const [isOpen, setIsOpen] = useState(embedded);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('normal');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('');
    setPriority('normal');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('请先填写标题和详细说明');
      return;
    }

    try {
      setLoading(true);
      await suggestionsAPI.createSuggestion({
        title: title.trim(),
        content: content.trim(),
        category: category || undefined,
        priority,
      });

      setSuccess(true);
      resetForm();

      setTimeout(() => {
        setSuccess(false);
        if (!embedded) {
          setIsOpen(false);
          onClose?.();
        }
      }, 1600);
    } catch (error: any) {
      console.error('提交系统建议失败:', error);
      alert(error.response?.data?.message || '提交系统建议失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!embedded) {
      setIsOpen(false);
    }
    onClose?.();
  };

  const panelStyle: React.CSSProperties = {
    backgroundColor: embedded
      ? 'color-mix(in srgb, var(--bg-secondary) 92%, black 8%)'
      : 'color-mix(in srgb, var(--bg-secondary) 88%, black 12%)',
    borderRadius: embedded ? '20px' : '24px',
    border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
    padding: embedded ? '1.4rem' : '1.5rem',
    width: '100%',
    maxWidth: embedded ? 'none' : '560px',
    boxShadow: embedded ? 'none' : '0 28px 56px rgba(15, 23, 42, 0.22)',
  };

  const contentNode = (
    <div
      style={{
        ...panelStyle,
        maxHeight: embedded ? 'none' : '88vh',
        overflow: embedded ? 'visible' : 'auto',
      }}
    >
      {success ? (
        <div style={{ textAlign: 'center', padding: embedded ? '2rem 1rem' : '2rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: 'var(--success-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <MessageSquare size={24} color="white" />
          </div>
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.5rem 0',
            }}
          >
            建议已提交
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, lineHeight: 1.7 }}>
            我们已收到你的反馈，后续会结合优先级持续优化。
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '1rem',
              marginBottom: '1.4rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '14px',
                  background: 'color-mix(in srgb, #60a5fa 18%, var(--bg-primary) 82%)',
                  color: '#7dd3fc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid color-mix(in srgb, #60a5fa 34%, transparent 66%)',
                  flexShrink: 0,
                }}
              >
                <Lightbulb size={20} />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  系统建议
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    margin: '0.35rem 0 0 0',
                    lineHeight: 1.65,
                  }}
                >
                  把你觉得不顺手的地方、缺失功能或设计建议直接告诉我们。
                </p>
              </div>
            </div>
            {!embedded && (
              <button
                onClick={handleClose}
                style={{
                  background: 'color-mix(in srgb, var(--bg-tertiary) 78%, white 22%)',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.45rem',
                  borderRadius: '10px',
                  flexShrink: 0,
                }}
              >
                <X size={20} />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={fieldLabelStyle}>建议标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：任务卡片的展开方式不够自然"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={fieldLabelStyle}>详细说明 *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="请描述你的使用场景、遇到的问题，以及你希望它如何改进。"
                style={{
                  ...inputStyle,
                  minHeight: '140px',
                  lineHeight: 1.65,
                  resize: 'vertical',
                }}
                rows={5}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label style={fieldLabelStyle}>建议类型</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                  <option value="">请选择类型</option>
                  <option value="bug">问题反馈</option>
                  <option value="feature">功能建议</option>
                  <option value="improvement">体验优化</option>
                  <option value="other">其他</option>
                </select>
              </div>

              <div style={{ flex: '1 1 220px' }}>
                <label style={fieldLabelStyle}>优先级</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} style={inputStyle}>
                  <option value="low">低</option>
                  <option value="normal">普通</option>
                  <option value="high">高</option>
                  <option value="urgent">紧急</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              {!embedded && (
                <button
                  type="button"
                  onClick={handleClose}
                  style={{
                    padding: '0.75rem 1.25rem',
                    border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
                    borderRadius: '10px',
                    backgroundColor: 'color-mix(in srgb, var(--bg-primary) 88%, black 12%)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  取消
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !title.trim() || !content.trim()}
                style={{
                  padding: '0.75rem 1.25rem',
                  border: 'none',
                  borderRadius: '10px',
                  backgroundColor: loading ? 'var(--text-muted)' : 'var(--primary-color)',
                  color: 'white',
                  fontSize: '0.875rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <Send size={16} />
                {loading ? '提交中...' : '提交建议'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );

  return (
    <>
      {showFloatingTrigger && !embedded && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid color-mix(in srgb, var(--border-color) 80%, transparent 20%)',
            cursor: 'pointer',
            boxShadow: '0 8px 18px rgba(15, 23, 42, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            zIndex: 999,
          }}
          title="系统建议"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--bg-tertiary) 76%, white 24%)';
            e.currentTarget.style.boxShadow = '0 14px 24px rgba(15, 23, 42, 0.18)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.boxShadow = '0 8px 18px rgba(15, 23, 42, 0.12)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <Lightbulb size={20} />
        </button>
      )}

      {embedded && contentNode}
      {!embedded && isOpen && <div style={overlayStyle}>{contentNode}</div>}
    </>
  );
}
