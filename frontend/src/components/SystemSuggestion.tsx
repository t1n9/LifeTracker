'use client';

import React, { useState } from 'react';
import { Lightbulb, MessageSquare, Send, X } from 'lucide-react';
import { suggestionsAPI } from '@/lib/api';

interface SystemSuggestionProps {
  onClose?: () => void;
  embedded?: boolean;
  showFloatingTrigger?: boolean;
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--line-2)',
  borderRadius: '10px',
  background: 'var(--bg-0)',
  color: 'var(--fg)',
  fontSize: '14px',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
};

const label: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: 'var(--fg-3)',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  marginBottom: '6px',
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

  const resetForm = () => { setTitle(''); setContent(''); setCategory(''); setPriority('normal'); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert('请先填写标题和详细说明');
      return;
    }
    try {
      setLoading(true);
      await suggestionsAPI.createSuggestion({ title: title.trim(), content: content.trim(), category: category || undefined, priority });
      setSuccess(true);
      resetForm();
      setTimeout(() => {
        setSuccess(false);
        if (!embedded) { setIsOpen(false); onClose?.(); }
      }, 1600);
    } catch (error: any) {
      alert(error.response?.data?.message || '提交系统建议失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!embedded) setIsOpen(false);
    onClose?.();
  };

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg-1)',
    borderRadius: embedded ? '16px' : '20px',
    border: '1px solid var(--line)',
    padding: embedded ? '20px' : '24px',
    width: '100%',
    maxWidth: embedded ? 'none' : '560px',
    boxShadow: embedded ? 'none' : '0 28px 56px rgba(0,0,0,.16)',
    maxHeight: embedded ? 'none' : '88vh',
    overflow: embedded ? 'visible' : 'auto',
  };

  const contentNode = (
    <div style={panelStyle}>
      {success ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <MessageSquare size={22} color="white" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--fg)', margin: '0 0 8px' }}>建议已提交</h3>
          <p style={{ color: 'var(--fg-3)', fontSize: '13px', margin: 0, lineHeight: 1.7 }}>我们已收到你的反馈，后续会结合优先级持续优化。</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid color-mix(in srgb, var(--accent) 24%, transparent)', flexShrink: 0 }}>
                <Lightbulb size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--fg)', margin: 0 }}>系统建议</h3>
                <p style={{ color: 'var(--fg-3)', fontSize: '12.5px', margin: '4px 0 0', lineHeight: 1.6 }}>把你觉得不顺手的地方、缺失功能或设计建议直接告诉我们。</p>
              </div>
            </div>
            {!embedded && (
              <button onClick={handleClose} style={{ background: 'var(--bg-2)', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: '6px', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label style={label}>建议标题 *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：任务卡片的展开方式不够自然" style={input} required />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={label}>详细说明 *</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="请描述你的使用场景、遇到的问题，以及你希望它如何改进。" style={{ ...input, minHeight: '130px', lineHeight: 1.65, resize: 'vertical' }} rows={5} required />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={label}>建议类型</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} style={input}>
                  <option value="">请选择类型</option>
                  <option value="bug">问题反馈</option>
                  <option value="feature">功能建议</option>
                  <option value="improvement">体验优化</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={label}>优先级</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} style={input}>
                  <option value="low">低</option>
                  <option value="normal">普通</option>
                  <option value="high">高</option>
                  <option value="urgent">紧急</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              {!embedded && (
                <button type="button" onClick={handleClose} style={{ padding: '9px 16px', border: '1px solid var(--line-2)', borderRadius: '10px', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  取消
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !title.trim() || !content.trim()}
                style={{ padding: '9px 16px', border: 'none', borderRadius: '10px', background: loading ? 'var(--fg-4)' : 'var(--accent)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: (!title.trim() || !content.trim()) ? .55 : 1 }}
              >
                <Send size={14} />
                {loading ? '提交中…' : '提交建议'}
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
          style={{ position: 'fixed', bottom: '20px', right: '20px', width: '46px', height: '46px', borderRadius: '50%', background: 'var(--bg-1)', color: 'var(--fg-3)', border: '1px solid var(--line-2)', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .18s', zIndex: 999 }}
          title="系统建议"
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.color = 'var(--fg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.color = 'var(--fg-3)'; }}
        >
          <Lightbulb size={18} />
        </button>
      )}
      {embedded && contentNode}
      {!embedded && isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.44)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          {contentNode}
        </div>
      )}
    </>
  );
}
