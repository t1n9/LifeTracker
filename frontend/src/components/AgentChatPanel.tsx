'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Trash2, Check, ShieldCheck, ShieldOff } from 'lucide-react';
import { api } from '@/lib/api';
import {
  dispatchAgentDataChanged,
  getAgentChangedDomains,
} from '@/lib/agent-events';

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'confirm';
  content: string;
  toolCalls?: any;
  pendingAction?: any;
  confirmed?: boolean | null;
  createdAt: string;
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
  set_exercise_feeling: '运动感受',
  update_important_info: '更新重要信息',
  update_day_reflection: '今日复盘',
};

const CONFIRM_MODE_KEY = 'agent_confirm_mode';

// 数据变更事件，通知 Dashboard 刷新

export default function AgentChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmMode, setConfirmMode] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 初始化确认模式
  useEffect(() => {
    const saved = localStorage.getItem(CONFIRM_MODE_KEY);
    if (saved !== null) {
      setConfirmMode(saved === 'true');
    }
  }, []);

  // 切换确认模式
  const toggleConfirmMode = () => {
    const next = !confirmMode;
    setConfirmMode(next);
    localStorage.setItem(CONFIRM_MODE_KEY, String(next));
  };

  // 加载历史消息
  const loadHistory = useCallback(async (cursor?: string) => {
    if (loadingHistory) return;
    setLoadingHistory(true);
    try {
      const { data } = await api.get('/agent/messages', {
        params: { cursor, limit: 30 },
      });
      const newMessages = data.messages || [];
      setMessages(prev => cursor ? [...newMessages, ...prev] : newMessages);
      setHasMore(data.hasMore);
      if (!cursor) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 50);
      }
    } catch (err) {
      console.error('加载历史消息失败:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [loadingHistory]);

  // 打开面板时加载历史
  useEffect(() => {
    if (isOpen && !historyLoaded) {
      loadHistory();
      setHistoryLoaded(true);
    }
  }, [isOpen, historyLoaded, loadHistory]);

  // 滚动到顶部时加载更多
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop < 50 && hasMore && !loadingHistory && messages.length > 0) {
      const oldHeight = target.scrollHeight;
      loadHistory(messages[0].id).then(() => {
        requestAnimationFrame(() => {
          if (target) target.scrollTop = target.scrollHeight - oldHeight;
        });
      });
    }
  };

  // 新消息时滚到底部
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role !== 'confirm' || lastMsg.confirmed === null) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // 乐观更新：立即显示用户消息
    const tempUserMsg: AgentMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/agent/chat', { message: text, confirmMode });

      if (data.type === 'confirms') {
        // 多个独立确认气泡
        const confirmMsgs: AgentMessage[] = (data.confirms as any[]).map((c) => ({
          id: c.id,
          role: 'confirm' as const,
          content: c.summary,
          pendingAction: { action: c.action },
          confirmed: null,
          createdAt: new Date().toISOString(),
        }));
        setMessages(prev => [...prev, ...confirmMsgs]);
      } else if (data.type === 'confirm') {
        // 兼容旧格式（单个确认）
        const confirmMsg: AgentMessage = {
          id: data.id,
          role: 'confirm',
          content: data.summary,
          pendingAction: { actions: data.actions },
          confirmed: null,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, confirmMsg]);
      } else if (data.type === 'auto_write_applied') {
        dispatchAgentDataChanged(getAgentChangedDomains(data.toolResults || []));
      } else {
        // 普通回复
        const assistantMsg: AgentMessage = {
          id: data.id,
          role: 'assistant',
          content: data.reply,
          toolCalls: data.toolResults,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMsg]);
        // 自动模式执行了写操作，通知 Dashboard 刷新
        dispatchAgentDataChanged(getAgentChangedDomains(data.toolResults || []));
      }
    } catch (err: any) {
      const errorMsg: AgentMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `出错了: ${err.response?.data?.message || err.message}`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleConfirm = async (messageId: string) => {
    // 乐观标记为已确认
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, confirmed: true } : m));

    try {
      const { data } = await api.post('/agent/confirm', { messageId });

      if (data.type === 'confirm_error' || data.error) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, confirmed: null } : m));
        const errorMsg: AgentMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `执行失败: ${data.error || '未知错误'}`,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMsg]);
        return;
      }

      if (data.type === 'confirm_updated') {
        setMessages(prev => prev.map(m => (
          m.id === messageId
            ? {
                ...m,
                confirmed: data.confirmed,
                content: data.summary || m.content,
                toolCalls: data.toolResults || m.toolCalls,
              }
            : m
        )));
        dispatchAgentDataChanged(getAgentChangedDomains(data.toolResults || []));
        return;
      }

      const reply: AgentMessage = {
        id: data.id,
        role: 'assistant',
        content: data.reply,
        toolCalls: data.toolResults,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, reply]);
      dispatchAgentDataChanged(getAgentChangedDomains(data.toolResults || []));
    } catch (err: any) {
      // 回滚乐观更新
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, confirmed: null } : m));
      const errorMsg: AgentMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `执行失败: ${err.response?.data?.message || err.message}`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleReject = async (messageId: string) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, confirmed: false } : m));
    try {
      const { data } = await api.post('/agent/reject', { messageId });

      if (data.type === 'confirm_updated') {
        setMessages(prev => prev.map(m => (
          m.id === messageId
            ? {
                ...m,
                confirmed: data.confirmed,
                content: data.summary || m.content,
              }
            : m
        )));
        return;
      }

      const reply: AgentMessage = {
        id: data.id,
        role: 'assistant',
        content: data.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, reply]);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = async () => {
    if (!confirm('确定清空所有对话历史吗？')) return;
    try {
      await api.delete('/agent/history');
      setMessages([]);
    } catch (err) {
      console.error('清空失败:', err);
    }
  };

  return (
    <>
      {/* 浮动按钮 */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={styles.floatingButton}
          className="agent-float-btn"
          aria-label="打开 AI 助手"
        >
          <Bot size={24} />
        </button>
      )}

      {/* 聊天面板 */}
      {isOpen && (
        <div style={styles.panel} className="agent-panel">
          {/* 头部 */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <Bot size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={styles.headerTitle}>LifeTracker 助手</span>
            </div>
            <div style={styles.headerRight}>
              <button
                onClick={toggleConfirmMode}
                style={{
                  ...styles.iconBtn,
                  color: confirmMode ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
                title={confirmMode ? '确认模式已开启' : '确认模式已关闭'}
              >
                {confirmMode ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
              </button>
              <button onClick={clearChat} style={styles.iconBtn} title="清空对话">
                <Trash2 size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} style={styles.iconBtn} title="收起">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 模式提示条 */}
          <div style={{
            ...styles.modeBar,
            background: confirmMode ? 'rgba(15, 118, 110, 0.08)' : 'rgba(217, 119, 6, 0.08)',
            color: confirmMode ? 'var(--accent-primary)' : 'var(--warning-color)',
          }}>
            {confirmMode ? '🛡️ 确认模式：写操作前会先询问' : '⚡ 自动模式：直接执行操作'}
          </div>

          {/* 消息列表 */}
          <div
            ref={messagesContainerRef}
            style={styles.messagesContainer}
            onScroll={handleScroll}
          >
            {loadingHistory && messages.length > 0 && (
              <div style={styles.loadingMore}>加载中...</div>
            )}

            {messages.length === 0 && !loadingHistory && (
              <div style={styles.empty}>
                <div style={{ fontSize: 36 }}>🤖</div>
                <p style={{ color: 'var(--text-secondary)', margin: '8px 0', fontSize: 13 }}>
                  你好！我是 LifeTracker 助手
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>
                  试试：&quot;开启今天&quot; 或 &quot;午餐花了15块&quot;
                </p>
              </div>
            )}

            {messages.map(msg => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} style={{ ...styles.messageRow, justifyContent: 'flex-end' }}>
                    <div style={styles.userBubble}>{msg.content}</div>
                  </div>
                );
              }

              if (msg.role === 'confirm') {
                const isPending = msg.confirmed === null || msg.confirmed === undefined;
                const wasConfirmed = msg.confirmed === true;
                return (
                  <div key={msg.id} style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
                    <div style={styles.confirmBubble}>
                      <div style={styles.confirmContent}>{msg.content}</div>
                      {isPending ? (
                        <div style={styles.confirmActions}>
                          <button
                            onClick={() => handleConfirm(msg.id)}
                            style={styles.confirmBtn}
                          >
                            <Check size={12} /> 执行
                          </button>
                          <button
                            onClick={() => handleReject(msg.id)}
                            style={styles.rejectBtn}
                          >
                            <X size={12} /> 取消
                          </button>
                        </div>
                      ) : (
                        <div style={{
                          ...styles.confirmStatus,
                          color: wasConfirmed ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}>
                          {wasConfirmed ? '✓ 已执行' : '✗ 已取消'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // assistant
              return (
                <div key={msg.id} style={{ ...styles.messageRow, justifyContent: 'flex-start' }}>
                  <div style={styles.assistantBubble}>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                    {Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                      <div style={styles.toolResults}>
                        {msg.toolCalls.map((tr: any, i: number) => (
                          <div key={i} style={styles.toolTag}>
                            ⚡ {TOOL_LABELS[tr.tool] || tr.tool}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

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

          {/* 输入框 */}
          <div style={styles.inputContainer}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              style={styles.textarea}
              rows={1}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                ...styles.sendBtn,
                opacity: (!input.trim() || loading) ? 0.4 : 1,
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 480px) {
          .agent-panel {
            width: 100vw !important;
            height: 85vh !important;
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            border-radius: 16px 16px 0 0 !important;
          }
          .agent-float-btn {
            bottom: 80px !important;
            right: 16px !important;
          }
        }
      `}</style>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  floatingButton: {
    position: 'fixed',
    bottom: '84px',
    right: '20px',
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: 'var(--accent-primary)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 16px rgba(15, 118, 110, 0.3)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 998,
    transition: 'transform 0.2s ease',
  },
  panel: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '400px',
    height: '600px',
    maxHeight: 'calc(100vh - 48px)',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--border-radius-lg)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
    border: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 999,
    overflow: 'hidden',
    animation: 'slideUp 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  iconBtn: {
    width: '28px',
    height: '28px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: 'var(--border-radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBar: {
    padding: '6px 16px',
    fontSize: '11px',
    fontWeight: 500,
    textAlign: 'center' as const,
    flexShrink: 0,
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  loadingMore: {
    textAlign: 'center' as const,
    fontSize: '11px',
    color: 'var(--text-muted)',
    padding: '4px 0',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
  },
  messageRow: {
    display: 'flex',
  },
  userBubble: {
    maxWidth: '80%',
    padding: '8px 12px',
    background: 'var(--accent-primary)',
    color: '#fff',
    borderRadius: '14px 14px 4px 14px',
    fontSize: '13px',
    lineHeight: '1.5',
    wordBreak: 'break-word' as const,
    whiteSpace: 'pre-wrap' as const,
  },
  assistantBubble: {
    maxWidth: '85%',
    padding: '8px 12px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: '14px 14px 14px 4px',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  confirmBubble: {
    maxWidth: '88%',
    padding: '10px 12px',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderRadius: '10px 10px 10px 4px',
    fontSize: '13px',
    lineHeight: '1.5',
    border: '1px solid var(--accent-primary-alpha)',
  },
  confirmContent: {
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    color: 'var(--text-primary)',
    marginBottom: '8px',
  },
  confirmActions: {
    display: 'flex',
    gap: '6px',
  },
  confirmBtn: {
    flex: 1,
    padding: '4px 10px',
    background: 'var(--accent-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
  rejectBtn: {
    flex: 1,
    padding: '4px 10px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--border-radius-sm)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
  confirmStatus: {
    fontSize: '11px',
    fontStyle: 'italic',
  },
  toolResults: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '6px',
  },
  toolTag: {
    padding: '2px 6px',
    fontSize: '10px',
    color: 'var(--accent-primary)',
    background: 'var(--accent-primary-alpha)',
    borderRadius: '4px',
  },
  thinking: {
    display: 'flex',
    gap: '4px',
    padding: '2px 0',
  },
  dot: {
    fontSize: '8px',
    color: 'var(--text-muted)',
    animation: 'blink 1s infinite',
  },
  inputContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '10px 12px 12px',
    borderTop: '1px solid var(--border-color)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    border: '1px solid var(--border-color)',
    outline: 'none',
    resize: 'none' as const,
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    lineHeight: '1.5',
    maxHeight: '100px',
    padding: '8px 12px',
    borderRadius: 'var(--border-radius)',
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    background: 'var(--accent-primary)',
    color: '#fff',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
