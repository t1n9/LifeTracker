'use client';

import Link from 'next/link';
import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolResults?: { tool: string; args: any; result: any }[];
  timestamp: Date;
}

const TOOL_LABELS: Record<string, string> = {
  get_today_tasks: '今日任务',
  get_today_summary: '查看今日概况',
  start_day: '开启今日',
  create_task: '创建任务',
  create_tasks: '批量创建任务',
  complete_task: '完成任务',
  get_tasks: '获取任务列表',
  start_pomodoro: '开启番茄钟',
  stop_pomodoro: '停止番茄钟',
  get_pomodoro_status: '番茄钟状态',
  record_meal_expense: '记录餐饮',
  record_other_expense: '记录花费',
  get_today_expenses: '今日花费',
  record_exercise: '记录运动',
  get_exercise_types: '运动类型',
  get_today_exercise: '今日运动',
  update_day_reflection: '今日复盘',
};

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { isAuthenticated } = useAuthStore();

  // 初始化：检查 token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      useAuthStore.getState().setToken(token);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/agent/chat', { message: text });
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        toolResults: data.toolResults,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `出错了: ${err.response?.data?.message || err.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    try {
      await api.delete('/agent/history');
    } catch {}
    setMessages([]);
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.loginPrompt}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Agent 测试页</h2>
          <p style={{ color: 'var(--text-secondary)' }}>请先在主页登录后再访问此页面</p>
          <Link href="/" style={styles.link}>返回主页登录</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" style={styles.backBtn}>←</Link>
          <div>
            <h1 style={styles.title}>LifeTracker Agent</h1>
            <span style={styles.badge}>TEST</span>
          </div>
        </div>
        <button onClick={clearChat} style={styles.clearBtn}>清空对话</button>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.length === 0 && (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>🤖</div>
            <p style={{ color: 'var(--text-secondary)', margin: '8px 0' }}>
              你好！我是 LifeTracker 助手
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
              试试说：&quot;开启今天，今天要学习高数3小时&quot; 或 &quot;午餐花了15块&quot;
            </p>
            <div style={styles.quickActions}>
              {['开启今天', '查看今日概况', '开个25分钟番茄钟', '查看任务列表'].map(text => (
                <button
                  key={text}
                  onClick={() => { setInput(text); inputRef.current?.focus(); }}
                  style={styles.quickBtn}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{
            ...styles.messageRow,
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              <div style={styles.messageContent}>{msg.content}</div>
              {msg.toolResults && msg.toolResults.length > 0 && (
                <div style={styles.toolResults}>
                  {msg.toolResults.map((tr, i) => (
                    <div key={i} style={styles.toolTag}>
                      ⚡ {TOOL_LABELS[tr.tool] || tr.tool}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
            <div style={styles.assistantBubble}>
              <div style={styles.thinking}>
                <span style={styles.dot}>●</span>
                <span style={{ ...styles.dot, animationDelay: '0.2s' }}>●</span>
                <span style={{ ...styles.dot, animationDelay: '0.4s' }}>●</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputContainer}>
        <div style={styles.inputWrapper}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            style={styles.textarea}
            rows={1}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            style={{
              ...styles.sendBtn,
              opacity: (!input.trim() || loading) ? 0.5 : 1,
            }}
          >
            ↑
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg-primary)',
    maxWidth: '720px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
  },
  backBtn: {
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: '20px',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    display: 'inline',
  },
  badge: {
    marginLeft: '8px',
    padding: '2px 6px',
    fontSize: '10px',
    fontWeight: 600,
    background: 'var(--warning-color)',
    color: '#fff',
    borderRadius: '4px',
    verticalAlign: 'middle',
  },
  clearBtn: {
    padding: '6px 12px',
    fontSize: '12px',
    color: 'var(--text-muted)',
    background: 'transparent',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  quickActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '20px',
    justifyContent: 'center',
  },
  quickBtn: {
    padding: '6px 14px',
    fontSize: '13px',
    color: 'var(--accent-primary)',
    background: 'var(--accent-primary-alpha)',
    border: 'none',
    borderRadius: '16px',
    cursor: 'pointer',
  },
  messageRow: {
    display: 'flex',
  },
  userBubble: {
    maxWidth: '80%',
    padding: '10px 14px',
    background: 'var(--accent-primary)',
    color: '#fff',
    borderRadius: '16px 16px 4px 16px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  assistantBubble: {
    maxWidth: '85%',
    padding: '10px 14px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: '16px 16px 16px 4px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  messageContent: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  toolResults: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '8px',
  },
  toolTag: {
    padding: '2px 8px',
    fontSize: '11px',
    color: 'var(--accent-primary)',
    background: 'var(--accent-primary-alpha)',
    borderRadius: '4px',
  },
  thinking: {
    display: 'flex',
    gap: '4px',
    padding: '4px 0',
  },
  dot: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    animation: 'blink 1s infinite',
  },
  inputContainer: {
    padding: '12px 20px 20px',
    borderTop: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--border-radius)',
    padding: '8px 8px 8px 14px',
  },
  textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '14px',
    lineHeight: '1.5',
    maxHeight: '120px',
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    background: 'var(--accent-primary)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPrompt: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: '12px',
  },
  link: {
    color: 'var(--accent-primary)',
    textDecoration: 'none',
    fontWeight: 500,
  },
};
