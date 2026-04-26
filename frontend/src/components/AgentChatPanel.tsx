'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from 'react';
import { Bot, Check, Pencil, Save, Send, ShieldCheck, ShieldOff, Trash2, X } from 'lucide-react';
import { api, captureAPI } from '@/lib/api';
import { dispatchAgentDataChanged, getAgentChangedDomains } from '@/lib/agent-events';

type PanelMode = 'chat' | 'capture';

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'confirm';
  content: string;
  toolCalls?: any;
  pendingAction?: any;
  confirmed?: boolean | null;
  createdAt: string;
}

interface ConfirmCard {
  id: string;
  content: string;
  pendingAction?: any;
}

interface CaptureAnalysis {
  category: 'idea' | 'reflection' | 'method' | 'question' | 'quote' | 'mixed';
  summary: string;
  insight: string;
  actionSuggestion: string;
  tags: string[];
  sourceType: string;
  sourceName: string;
}

interface CaptureItem {
  id: string;
  rawContent: string;
  sourceType: string | null;
  sourceName: string | null;
  status: 'RAW' | 'ANALYZED' | 'ARCHIVED';
  analysis: CaptureAnalysis | null;
  analyzedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CaptureSourceSelection {
  sourceType: string | null;
  sourceName: string;
}

interface CaptureEditDraft {
  content: string;
  sourceType: string;
  sourceName: string;
}

const TOOL_LABELS: Record<string, string> = {
  get_today_tasks: '今日任务',
  get_today_summary: '今日概况',
  start_day: '开启今天',
  create_task: '创建任务',
  create_tasks: '批量创建任务',
  complete_task: '完成任务',
  get_tasks: '任务列表',
  start_pomodoro: '开始番茄',
  stop_pomodoro: '停止番茄',
  get_pomodoro_status: '番茄状态',
  record_meal_expense: '记录餐饮',
  record_other_expense: '记录支出',
  get_today_expenses: '今日支出',
  record_exercise: '记录运动',
  get_exercise_types: '运动类型',
  get_today_exercise: '今日运动',
  set_exercise_feeling: '运动感受',
  update_important_info: '重要信息',
  update_day_reflection: '今日复盘',
};

const READ_ONLY_TOOLS = new Set([
  'get_today_tasks',
  'get_today_summary',
  'get_tasks',
  'get_pomodoro_status',
  'get_today_expenses',
  'get_exercise_types',
  'get_today_exercise',
]);

const CAPTURE_CATEGORY_LABELS: Record<CaptureAnalysis['category'], string> = {
  idea: '观点',
  reflection: '感悟',
  method: '方法',
  question: '问题',
  quote: '摘录',
  mixed: '混合',
};

const CONFIRM_MODE_KEY = 'agent_confirm_mode';
const PANEL_MODE_KEY = 'agent_panel_mode';

const isSafeMarkdownUrl = (url: string) => /^(https?:\/\/|mailto:)/iu.test(url);

const renderInlineTokens = (text: string, keyPrefix: string, tokenPattern: RegExp, renderToken: (match: RegExpExecArray, key: string) => ReactNode): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(renderToken(match, `${keyPrefix}-${match.index}`));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
};

const renderMarkdownInline = (text: string, keyPrefix: string): ReactNode[] => {
  const codeSplit = renderInlineTokens(
    text,
    `${keyPrefix}-code`,
    /`([^`]+)`/gu,
    (match, key) => <code key={key} style={styles.markdownInlineCode}>{match[1]}</code>,
  );

  return codeSplit.flatMap((node, nodeIndex) => {
    if (typeof node !== 'string') return [node];

    const linkSplit = renderInlineTokens(
      node,
      `${keyPrefix}-link-${nodeIndex}`,
      /\[([^\]]+)\]\(([^)\s]+)\)/gu,
      (match, key) => {
        const href = match[2];
        if (!isSafeMarkdownUrl(href)) {
          return match[1];
        }
        return (
          <a key={key} href={href} target="_blank" rel="noreferrer" style={styles.markdownLink}>
            {match[1]}
          </a>
        );
      },
    );

    return linkSplit.flatMap((linkNode, linkIndex) => {
      if (typeof linkNode !== 'string') return [linkNode];

      const styleSplit = renderInlineTokens(
        linkNode,
        `${keyPrefix}-style-${nodeIndex}-${linkIndex}`,
        /(\*\*(.+?)\*\*|~~(.+?)~~)/gu,
        (match, key) => {
          if (match[2]) return <strong key={key}>{match[2]}</strong>;
          return <del key={key} style={styles.markdownDeleted}>{match[3]}</del>;
        },
      );

      return styleSplit;
    });
  });
};

const renderMarkdownContent = (content: string) => {
  const lines = String(content || '').split(/\r?\n/u);
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,4})\s+(.+)$/u);
    if (headingMatch) {
      blocks.push(
        <div key={`heading-${index}`} style={styles.markdownHeading}>
          {renderMarkdownInline(headingMatch[2], `heading-${index}`)}
        </div>,
      );
      index += 1;
      continue;
    }

    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/u.test(line)) {
      blocks.push(<div key={`divider-${index}`} style={styles.markdownDivider} />);
      index += 1;
      continue;
    }

    if (/^\s*```/u.test(line)) {
      const language = line.replace(/^\s*```/u, '').trim();
      index += 1;
      const codeLines: string[] = [];

      while (index < lines.length && !/^\s*```/u.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }

      blocks.push(
        <pre key={`code-${index}`} style={styles.markdownCodeBlock}>
          {language && <div style={styles.markdownCodeLanguage}>{language}</div>}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    if (/^\s*>\s?/u.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>\s?/u.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/u, ''));
        index += 1;
      }

      blocks.push(
        <blockquote key={`quote-${index}`} style={styles.markdownQuote}>
          {quoteLines.map((quoteLine, quoteIndex) => (
            <span key={`quote-${index}-${quoteIndex}`}>
              {quoteIndex > 0 && <br />}
              {renderMarkdownInline(quoteLine, `quote-${index}-${quoteIndex}`)}
            </span>
          ))}
        </blockquote>,
      );
      continue;
    }

    const taskListMatch = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/u);
    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/u);
    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/u);
    if (taskListMatch || unorderedMatch || orderedMatch) {
      const isTaskList = Boolean(taskListMatch);
      const isOrdered = Boolean(orderedMatch);
      const items: Array<{ text: string; checked?: boolean }> = [];

      while (index < lines.length) {
        const current = lines[index];
        if (isTaskList) {
          const currentTaskMatch = current.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/u);
          if (!currentTaskMatch) break;
          items.push({ text: currentTaskMatch[2], checked: currentTaskMatch[1].toLowerCase() === 'x' });
          index += 1;
          continue;
        }

        const currentMatch = current.match(isOrdered ? /^\s*\d+[.)]\s+(.+)$/u : /^\s*[-*]\s+(.+)$/u);
        if (!currentMatch) break;
        items.push({ text: currentMatch[1] });
        index += 1;
      }

      const ListTag = isOrdered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={`list-${index}`} style={styles.markdownList}>
          {items.map((item, itemIndex) => (
            <li key={`list-${index}-${itemIndex}`} style={isTaskList ? styles.markdownTaskItem : styles.markdownListItem}>
              {isTaskList && (
                <input
                  type="checkbox"
                  checked={Boolean(item.checked)}
                  readOnly
                  tabIndex={-1}
                  style={styles.markdownCheckbox}
                />
              )}
              <span>{renderMarkdownInline(item.text, `list-${index}-${itemIndex}`)}</span>
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const current = lines[index];
      if (
        !current.trim()
        || /^\s*[-*]\s+.+$/u.test(current)
        || /^\s*\d+[.)]\s+.+$/u.test(current)
        || /^\s*>\s?/u.test(current)
        || /^\s*```/u.test(current)
        || /^\s{0,3}#{1,4}\s+.+$/u.test(current)
        || /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/u.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      index += 1;
    }

    blocks.push(
      <p key={`paragraph-${index}`} style={styles.markdownParagraph}>
        {paragraphLines.map((paragraphLine, lineIndex) => (
          <span key={`paragraph-${index}-${lineIndex}`}>
            {lineIndex > 0 && <br />}
            {renderMarkdownInline(paragraphLine, `paragraph-${index}-${lineIndex}`)}
          </span>
        ))}
      </p>,
    );
  }

  return <div style={styles.markdownContent}>{blocks}</div>;
};

export default function AgentChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('chat');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [activeConfirmCards, setActiveConfirmCards] = useState<ConfirmCard[]>([]);
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmMode, setConfirmMode] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadingCaptures, setLoadingCaptures] = useState(false);
  const [capturesLoaded, setCapturesLoaded] = useState(false);
  const [captureMessage, setCaptureMessage] = useState('');
  const [captureError, setCaptureError] = useState('');
  const [analyzingIds, setAnalyzingIds] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<CaptureSourceSelection | null>(null);
  const [editingCaptureId, setEditingCaptureId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CaptureEditDraft | null>(null);
  const [savingCaptureId, setSavingCaptureId] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const shouldShowChatMessage = useCallback((message: AgentMessage) => {
    if (message.role === 'confirm') return false;
    if (message.role !== 'assistant') return true;
    if (!Array.isArray(message.toolCalls) || message.toolCalls.length === 0) return true;

    return !message.toolCalls.some((item: any) => item?.tool && !READ_ONLY_TOOLS.has(item.tool));
  }, []);

  const resizeInput = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 220;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    const savedConfirmMode = localStorage.getItem(CONFIRM_MODE_KEY);
    if (savedConfirmMode !== null) {
      setConfirmMode(savedConfirmMode === 'true');
    }
    const savedPanelMode = localStorage.getItem(PANEL_MODE_KEY);
    if (savedPanelMode === 'chat' || savedPanelMode === 'capture') {
      setPanelMode(savedPanelMode);
    }
  }, []);

  const loadHistory = useCallback(async (cursor?: string) => {
    if (loadingHistory) return;
    setLoadingHistory(true);
    try {
      const { data } = await api.get('/agent/messages', { params: { cursor, limit: 30 } });
      const newMessages = (data.messages || []).filter(shouldShowChatMessage);
      setMessages((prev) => (cursor ? [...newMessages, ...prev] : newMessages));
      setHasMore(data.hasMore);
      if (!cursor) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      }
    } catch (err) {
      console.error('加载历史消息失败:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [loadingHistory, shouldShowChatMessage]);

  const loadCaptures = useCallback(async () => {
    if (loadingCaptures) return;
    setLoadingCaptures(true);
    setCaptureError('');
    try {
      const { data } = await captureAPI.getCaptures(20);
      setCaptures(data.items || []);
      setCapturesLoaded(true);
    } catch (err: any) {
      setCaptureError(err.response?.data?.message || err.message || '加载记录失败');
    } finally {
      setLoadingCaptures(false);
    }
  }, [loadingCaptures]);

  useEffect(() => {
    if (!isOpen) return;
    if (panelMode === 'chat' && !historyLoaded) {
      void loadHistory();
      setHistoryLoaded(true);
    }
    if (panelMode === 'capture' && !capturesLoaded) {
      void loadCaptures();
    }
    inputRef.current?.focus();
  }, [capturesLoaded, historyLoaded, isOpen, loadCaptures, loadHistory, panelMode]);

  useEffect(() => {
    if (panelMode !== 'chat' || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== 'confirm' || last.confirmed === null) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, panelMode]);

  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = '38px';
      inputRef.current.style.overflowY = 'hidden';
    }
  }, [input]);

  const getCaptureSourceType = useCallback(
    (capture: CaptureItem) => capture.sourceType || capture.analysis?.sourceType || null,
    [],
  );

  const getCaptureSourceName = useCallback(
    (capture: CaptureItem) => capture.sourceName || capture.analysis?.sourceName || null,
    [],
  );

  const getCaptureSource = useCallback((capture: CaptureItem): CaptureSourceSelection | null => {
    const sourceName = getCaptureSourceName(capture);
    if (!sourceName) {
      return null;
    }

    return {
      sourceType: getCaptureSourceType(capture),
      sourceName,
    };
  }, [getCaptureSourceName, getCaptureSourceType]);

  const buildSourceSelection = useCallback((sourceType: string, sourceName: string): CaptureSourceSelection | null => {
    const trimmedSourceName = sourceName.trim();
    if (!trimmedSourceName) {
      return null;
    }

    const trimmedSourceType = sourceType.trim();
    return {
      sourceType: trimmedSourceType || null,
      sourceName: trimmedSourceName,
    };
  }, []);

  const getEditDraftFromCapture = useCallback((capture: CaptureItem): CaptureEditDraft => ({
    content: capture.rawContent,
    sourceType: getCaptureSourceType(capture) || '',
    sourceName: getCaptureSourceName(capture) || '',
  }), [getCaptureSourceName, getCaptureSourceType]);

  const isSameSource = useCallback(
    (left: CaptureSourceSelection | null, right: CaptureSourceSelection | null) => {
      if (!left || !right) {
        return false;
      }

      return (
        left.sourceName === right.sourceName
        && (left.sourceType || '') === (right.sourceType || '')
      );
    },
    [],
  );

  useEffect(() => {
    if (!selectedSource) {
      return;
    }

    const stillExists = captures.some((capture) => isSameSource(getCaptureSource(capture), selectedSource));
    if (!stillExists) {
      setSelectedSource(null);
    }
  }, [captures, getCaptureSource, isSameSource, selectedSource]);

  const changePanelMode = (mode: PanelMode) => {
    setPanelMode(mode);
    localStorage.setItem(PANEL_MODE_KEY, mode);
    setCaptureMessage('');
    setCaptureError('');
  };

  const toggleConfirmMode = () => {
    const next = !confirmMode;
    setConfirmMode(next);
    localStorage.setItem(CONFIRM_MODE_KEY, String(next));
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (panelMode !== 'chat') return;
    const target = event.currentTarget;
    if (target.scrollTop < 50 && hasMore && !loadingHistory && messages.length > 0) {
      const oldHeight = target.scrollHeight;
      loadHistory(messages[0].id).then(() => {
        requestAnimationFrame(() => {
          target.scrollTop = target.scrollHeight - oldHeight;
        });
      });
    }
  };

  const sendChatMessage = async (text: string) => {
    setActiveConfirmCards([]);
    setMessages((prev) => prev.filter((message) => message.role !== 'confirm'));

    const tempUserMsg: AgentMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInput('');
    setLoading(true);
    const thinkingId = `thinking-${Date.now()}`;
    const removeThinkingMessage = () => {
      setMessages((prev) => prev.filter((message) => message.id !== thinkingId));
    };
    setMessages((prev) => [
      ...prev,
      {
        id: thinkingId,
        role: 'assistant',
        content: '正在思考...',
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const baseURL = String(api.defaults.baseURL || '');
      const streamUrl = `${baseURL.replace(/\/$/, '')}/agent/chat/stream`;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, confirmMode }),
      });

      if (!response.ok || !response.body) {
        let fallbackError = `请求失败（${response.status}）`;
        try {
          const errorData = await response.json();
          fallbackError = errorData?.message || fallbackError;
        } catch {}
        throw new Error(fallbackError);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';
      let currentAssistantId: string | null = null;

      const ensureAssistantMessage = (messageId: string) => {
        setMessages((prev) => {
          if (prev.some((message) => message.id === messageId)) {
            return prev;
          }
          return [
            ...prev,
            {
              id: messageId,
              role: 'assistant',
              content: '',
              createdAt: new Date().toISOString(),
            },
          ];
        });
      };

      const appendAssistantChunk = (messageId: string, chunk: string) => {
        setMessages((prev) => prev.map((message) => (
          message.id === messageId ? { ...message, content: `${message.content}${chunk}` } : message
        )));
      };

      const applyAssistantToolCalls = (messageId: string, toolCalls: any[]) => {
        setMessages((prev) => prev.map((message) => (
          message.id === messageId ? { ...message, toolCalls } : message
        )));
      };

      const appendConfirmMessages = (confirms: any[]) => {
        const confirmMsgs: ConfirmCard[] = confirms.map((item: any) => ({
          id: item.id,
          content: item.summary,
          pendingAction: { action: item.action },
        }));
        if (confirmMsgs.length > 0) {
          setActiveConfirmCards(confirmMsgs);
        }
      };

      const handleStreamEvent = (event: any) => {
        switch (event?.type) {
          case 'progress': {
            setMessages((prev) => prev.map((message) => (
              message.id === thinkingId
                ? { ...message, content: String(event.text || '正在思考...') }
                : message
            )));
            break;
          }
          case 'progress_done': {
            removeThinkingMessage();
            break;
          }
          case 'reply_start': {
            removeThinkingMessage();
            const messageId = String(event.id || `asst-${Date.now()}`);
            currentAssistantId = messageId;
            ensureAssistantMessage(messageId);
            break;
          }
          case 'reply_delta': {
            const messageId = String(event.id || currentAssistantId || `asst-${Date.now()}`);
            if (!currentAssistantId) {
              currentAssistantId = messageId;
              ensureAssistantMessage(messageId);
            }
            appendAssistantChunk(messageId, String(event.chunk || ''));
            break;
          }
          case 'reply_done': {
            const messageId = String(event.id || currentAssistantId || `asst-${Date.now()}`);
            const toolResults = Array.isArray(event.toolResults) ? event.toolResults : [];
            applyAssistantToolCalls(messageId, toolResults);
            dispatchAgentDataChanged(getAgentChangedDomains(toolResults));
            break;
          }
          case 'confirms': {
            removeThinkingMessage();
            appendConfirmMessages(Array.isArray(event.confirms) ? event.confirms : []);
            break;
          }
          case 'auto_write_applied': {
            removeThinkingMessage();
            dispatchAgentDataChanged(getAgentChangedDomains(Array.isArray(event.toolResults) ? event.toolResults : []));
            break;
          }
          case 'error': {
            removeThinkingMessage();
            setMessages((prev) => [...prev, {
              id: `err-${Date.now()}`,
              role: 'assistant',
              content: `出错了：${String(event.message || '未知错误')}`,
              createdAt: new Date().toISOString(),
            }]);
            break;
          }
          case 'end': {
            removeThinkingMessage();
            break;
          }
          default:
            break;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            continue;
          }
          try {
            handleStreamEvent(JSON.parse(trimmed));
          } catch (parseError) {
            console.error('解析流事件失败:', parseError, trimmed);
          }
        }
      }

      const tail = streamBuffer.trim();
      if (tail) {
        try {
          handleStreamEvent(JSON.parse(tail));
        } catch (parseError) {
          console.error('解析收尾流事件失败:', parseError, tail);
        }
      }
    } catch (err: any) {
      removeThinkingMessage();
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `出错了：${err.response?.data?.message || err.message}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const saveCapture = async (text: string) => {
    setLoading(true);
    setCaptureMessage('');
    setCaptureError('');
    try {
      const { data } = await captureAPI.createCapture({
        content: text,
        sourceType: selectedSource?.sourceType || undefined,
        sourceName: selectedSource?.sourceName,
      });
      setCaptures((prev) => [data, ...prev]);
      setCapturesLoaded(true);
      setInput('');
      setCaptureMessage(
        selectedSource
          ? `已保存原文，并沿用了来源“${selectedSource.sourceName}”。`
          : '已保存原文，可继续记录或点“整理这条”。',
      );
    } catch (err: any) {
      setCaptureError(err.response?.data?.message || err.message || '保存记录失败');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (panelMode === 'capture') {
      await saveCapture(text);
      return;
    }
    await sendChatMessage(text);
  };

  const handleConfirm = async (messageId: string) => {
    setActiveConfirmCards((prev) => prev.filter((card) => card.id !== messageId));
    try {
      const { data } = await api.post('/agent/confirm', { messageId });
      if (data.type === 'confirm_error' || data.error) {
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `执行失败：${data.error || '未知错误'}`,
          createdAt: new Date().toISOString(),
        }]);
        return;
      }
      if (data.type === 'confirm_updated') {
        if (data.confirmed) {
          dispatchAgentDataChanged(getAgentChangedDomains(data.toolResults || []));
          return;
        }
        return;
      }
      setMessages((prev) => [...prev, {
        id: data.id,
        role: 'assistant',
        content: data.reply,
        toolCalls: data.toolResults,
        createdAt: new Date().toISOString(),
      }]);
      dispatchAgentDataChanged(getAgentChangedDomains(data.toolResults || []));
    } catch (err: any) {
      setMessages((prev) => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `执行失败：${err.response?.data?.message || err.message}`,
        createdAt: new Date().toISOString(),
      }]);
    }
  };

  const handleReject = async (messageId: string) => {
    setActiveConfirmCards((prev) => prev.filter((card) => card.id !== messageId));
    try {
      const { data } = await api.post('/agent/reject', { messageId });
      if (data.type === 'confirm_updated') {
        return;
      }
      setMessages((prev) => [...prev, {
        id: data.id,
        role: 'assistant',
        content: data.reply,
        createdAt: new Date().toISOString(),
      }]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyzeCapture = async (captureId: string) => {
    if (analyzingIds.includes(captureId)) return;
    setAnalyzingIds((prev) => [...prev, captureId]);
    setCaptureMessage('');
    setCaptureError('');
    try {
      const { data } = await captureAPI.analyzeCapture(captureId);
      setCaptures((prev) => prev.map((item) => (item.id === captureId ? data : item)));
      setCaptureMessage('这条记录已整理完成。');
    } catch (err: any) {
      setCaptureError(err.response?.data?.message || err.message || '整理记录失败');
    } finally {
      setAnalyzingIds((prev) => prev.filter((id) => id !== captureId));
    }
  };

  const toggleSourceSelection = (source: CaptureSourceSelection) => {
    setSelectedSource((current) => (isSameSource(current, source) ? null : source));
    setCaptureMessage('');
    setCaptureError('');
  };

  const startCaptureEdit = (capture: CaptureItem) => {
    setEditingCaptureId(capture.id);
    setEditDraft(getEditDraftFromCapture(capture));
    setCaptureMessage('');
    setCaptureError('');
  };

  const cancelCaptureEdit = () => {
    setEditingCaptureId(null);
    setEditDraft(null);
    setSavingCaptureId(null);
  };

  const saveCaptureEdit = async (capture: CaptureItem) => {
    if (!editDraft || savingCaptureId === capture.id) {
      return;
    }

    const previousSelectedSource = getCaptureSource(capture);
    const contentChanged = editDraft.content.trim() !== capture.rawContent.trim();

    setSavingCaptureId(capture.id);
    setCaptureMessage('');
    setCaptureError('');

    try {
      const { data } = await captureAPI.updateCapture(capture.id, {
        content: editDraft.content,
        sourceType: editDraft.sourceType,
        sourceName: editDraft.sourceName,
      });

      setCaptures((prev) => prev.map((item) => (item.id === capture.id ? data : item)));

      if (previousSelectedSource && isSameSource(previousSelectedSource, selectedSource)) {
        setSelectedSource(buildSourceSelection(data.sourceType || '', data.sourceName || ''));
      }

      setEditingCaptureId(null);
      setEditDraft(null);
      setCaptureMessage(contentChanged ? '原始内容已更新，旧整理结果已清空，请重新整理。' : '记录已更新。');
    } catch (err: any) {
      setCaptureError(err.response?.data?.message || err.message || '更新记录失败');
    } finally {
      setSavingCaptureId(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const clearChat = async () => {
    if (!confirm('确定清空所有对话历史吗？')) return;
    try {
      await api.delete('/agent/history');
      setMessages([]);
      setActiveConfirmCards([]);
    } catch (err) {
      console.error('清空对话失败:', err);
    }
  };

  const formatTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const renderChat = () => {
    const hasThinkingMessage = messages.some((message) => message.id.startsWith('thinking-'));

    return (
      <div ref={messagesContainerRef} style={styles.body} onScroll={handleScroll}>
      {loadingHistory && messages.length > 0 && <div style={styles.hint}>加载中...</div>}
      {messages.length === 0 && !loadingHistory && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🤖</div>
          <div style={styles.emptyTitle}>我是 LifeTracker 助手</div>
          <div style={styles.emptyText}>试试：“开启今天” 或 “帮我开 1 小时番茄”</div>
        </div>
      )}
      {messages.map((msg) => {
        if (msg.role === 'user') {
          return <div key={msg.id} style={{ ...styles.row, justifyContent: 'flex-end' }}><div style={styles.userBubble}>{msg.content}</div></div>;
        }
        if (msg.role === 'confirm') return null;
        return (
          <div key={msg.id} style={styles.row}>
            <div style={styles.assistantBubble}>
              {renderMarkdownContent(msg.content)}
              {Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && (
                <div style={styles.tagWrap}>
                  {msg.toolCalls.map((item: any, index: number) => (
                    <span key={`${msg.id}-${index}`} style={styles.tag}>{TOOL_LABELS[item.tool] || item.tool}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {loading && !hasThinkingMessage && (
        <div style={styles.row}>
          <div style={styles.assistantBubble}>
            <div style={styles.hint}>处理中...</div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
      </div>
    );
  };

  const renderTaskQueue = () => {
    if (panelMode !== 'chat' || activeConfirmCards.length === 0) return null;

    return (
      <div style={styles.taskQueue}>
        {activeConfirmCards.map((card) => (
          <div key={card.id} style={styles.taskCard}>
            <div style={styles.taskCardText}>{card.content}</div>
            <div style={styles.taskCardActions}>
              <button type="button" onClick={() => handleConfirm(card.id)} style={styles.confirmBtn}>
                <Check size={12} />
                执行
              </button>
              <button type="button" onClick={() => handleReject(card.id)} style={styles.rejectBtn}>
                <X size={12} />
                取消
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCapture = () => (
    <div ref={messagesContainerRef} style={styles.body}>
      {(captureError || captureMessage) && (
        <div style={{ ...styles.notice, color: captureError ? 'var(--danger-color, #dc2626)' : 'var(--info-color, #2563eb)', background: captureError ? 'rgba(220,38,38,.08)' : 'rgba(37,99,235,.08)' }}>
          {captureError || captureMessage}
        </div>
      )}
      {loadingCaptures && captures.length === 0 && <div style={styles.hint}>加载记录中...</div>}
      {!loadingCaptures && captures.length === 0 && !captureError && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📝</div>
          <div style={styles.emptyTitle}>随手记录模式</div>
          <div style={styles.emptyText}>直接写下整句话，原文会完整保存，后面再整理。</div>
        </div>
      )}
      {captures.map((capture) => {
        const hasAnalysis = Boolean(capture.analysis);
        const analyzing = analyzingIds.includes(capture.id);
        const editing = editingCaptureId === capture.id && editDraft !== null;
        const savingEdit = savingCaptureId === capture.id;
        const sourceType = getCaptureSourceType(capture);
        const source = getCaptureSource(capture);
        const sourceSelected = isSameSource(source, selectedSource);

        return (
          <div key={capture.id} style={styles.captureCard}>
            <div style={styles.captureTop}>
              <div style={styles.captureMeta}>
                <span style={styles.captureTime}>{formatTime(capture.createdAt)}</span>
                <span style={{ ...styles.captureBadge, color: hasAnalysis ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                  {hasAnalysis ? '已整理' : '原文'}
                </span>
              </div>
              <div style={styles.captureActions}>
                <button
                  onClick={() => handleAnalyzeCapture(capture.id)}
                  disabled={analyzing || editing || savingEdit}
                  style={{ ...styles.smallBtn, opacity: analyzing || editing || savingEdit ? 0.6 : 1, cursor: analyzing || editing || savingEdit ? 'default' : 'pointer' }}
                >
                  {analyzing ? '整理中...' : hasAnalysis ? '重新整理' : '整理这条'}
                </button>
                <button
                  type="button"
                  onClick={() => startCaptureEdit(capture)}
                  disabled={editing || savingEdit}
                  style={{ ...styles.iconBtnSecondary, opacity: editing || savingEdit ? 0.5 : 1, cursor: editing || savingEdit ? 'default' : 'pointer' }}
                  title="修改记录"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
            {editing && editDraft ? (
              <div style={styles.editCard}>
                <div>
                  <div style={styles.sectionHeader}>
                    <span style={styles.analysisLabel}>原始内容</span>
                  </div>
                  <textarea
                    value={editDraft.content}
                    onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, content: event.target.value } : prev))}
                    rows={4}
                    disabled={savingEdit}
                    style={styles.editTextarea}
                  />
                </div>
                <div style={styles.editGrid}>
                  <div>
                    <div style={styles.analysisLabel}>来源类型</div>
                    <input
                      value={editDraft.sourceType}
                      onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, sourceType: event.target.value } : prev))}
                      disabled={savingEdit}
                      placeholder="如：播客、梦境、电影"
                      style={styles.editInput}
                    />
                  </div>
                  <div>
                    <div style={styles.analysisLabel}>来源</div>
                    <input
                      value={editDraft.sourceName}
                      onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, sourceName: event.target.value } : prev))}
                      disabled={savingEdit}
                      placeholder="如：鲁豫播客对话窦文涛"
                      style={styles.editInput}
                    />
                  </div>
                </div>
                <div style={styles.editHint}>
                  修改原始内容后，这条记录会回到“原文”状态，旧摘要会被清空，需要重新整理。
                </div>
                <div style={styles.editActions}>
                  <button
                    type="button"
                    onClick={() => void saveCaptureEdit(capture)}
                    disabled={!editDraft.content.trim() || savingEdit}
                    style={{ ...styles.confirmBtn, flex: 'unset', minWidth: '88px', opacity: !editDraft.content.trim() || savingEdit ? 0.5 : 1 }}
                  >
                    <Save size={12} />
                    {savingEdit ? '保存中...' : '保存'}
                  </button>
                  <button type="button" onClick={cancelCaptureEdit} disabled={savingEdit} style={styles.rejectBtn}>
                    <X size={12} />
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div style={styles.sectionHeader}>
                    <span style={styles.analysisLabel}>原始内容</span>
                  </div>
                  <div style={styles.captureText}>{capture.rawContent}</div>
                </div>
                {(sourceType || source) && (
                  <div style={styles.sourceSection}>
                    {sourceType && (
                      <div style={styles.analysisRow}>
                        <span style={styles.analysisLabel}>来源类型</span>
                        <span>{sourceType}</span>
                      </div>
                    )}
                    <div>
                      <div style={styles.sectionHeader}>
                        <span style={styles.analysisLabel}>来源</span>
                      </div>
                      {source ? (
                        <button
                          type="button"
                          onClick={() => toggleSourceSelection(source)}
                          style={{
                            ...styles.sourceChip,
                            ...(sourceSelected ? styles.sourceChipActive : null),
                          }}
                        >
                          {source.sourceName}
                        </button>
                      ) : (
                        <div style={styles.emptySourceText}>未填写来源</div>
                      )}
                    </div>
                  </div>
                )}
                {capture.analysis && (
                  <div style={styles.analysisBox}>
                    <div style={styles.analysisRow}><span style={styles.analysisLabel}>内容类型</span><span>{CAPTURE_CATEGORY_LABELS[capture.analysis.category]}</span></div>
                    <div><div style={styles.analysisLabel}>摘要</div><div style={styles.analysisText}>{capture.analysis.summary}</div></div>
                    {capture.analysis.insight && <div><div style={styles.analysisLabel}>洞察</div><div style={styles.analysisText}>{capture.analysis.insight}</div></div>}
                    {capture.analysis.actionSuggestion && <div><div style={styles.analysisLabel}>行动</div><div style={styles.analysisText}>{capture.analysis.actionSuggestion}</div></div>}
                    {capture.analysis.tags.length > 0 && (
                      <div style={styles.tagWrap}>
                        {capture.analysis.tags.map((tag) => <span key={`${capture.id}-${tag}`} style={styles.tag}>{tag}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} style={styles.floatingButton} className="agent-float-btn" aria-label="打开 AI 助手">
          <Bot size={24} />
        </button>
      )}
      {isOpen && (
        <div style={styles.panel} className="agent-panel">
          <div style={styles.header}>
            <div style={styles.headerTitleWrap}>
              <Bot size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={styles.headerTitle}>LifeTracker 助手</span>
            </div>
            <div style={styles.headerActions}>
              {panelMode === 'chat' && (
                <>
                  <button onClick={toggleConfirmMode} style={{ ...styles.iconBtn, color: confirmMode ? 'var(--accent-primary)' : 'var(--text-muted)' }} title={confirmMode ? '确认模式已开启' : '确认模式已关闭'}>
                    {confirmMode ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
                  </button>
                  <button onClick={clearChat} style={styles.iconBtn} title="清空对话"><Trash2 size={16} /></button>
                </>
              )}
              <button onClick={() => setIsOpen(false)} style={styles.iconBtn} title="收起"><X size={18} /></button>
            </div>
          </div>
          <div style={styles.switchBar}>
            <button onClick={() => changePanelMode('chat')} style={{ ...styles.switchBtn, ...(panelMode === 'chat' ? styles.switchBtnActive : null) }}>对话</button>
            <button onClick={() => changePanelMode('capture')} style={{ ...styles.switchBtn, ...(panelMode === 'capture' ? styles.switchBtnActive : null) }}>记录</button>
          </div>
          <div style={{ ...styles.modeBar, background: panelMode === 'chat' ? (confirmMode ? 'rgba(15,118,110,.08)' : 'rgba(217,119,6,.08)') : 'rgba(37,99,235,.08)', color: panelMode === 'chat' ? (confirmMode ? 'var(--accent-primary)' : 'var(--warning-color)') : 'var(--info-color, #2563eb)' }}>
            {panelMode === 'chat' ? (confirmMode ? '确认模式：写操作会先询问你。' : '自动模式：写操作会直接执行。') : '记录模式：先保存原文，整理需手动触发。'}
          </div>
          {panelMode === 'chat' ? renderChat() : renderCapture()}
          {panelMode === 'capture' && selectedSource && (
            <div style={styles.selectedSourceBar}>
              <span style={styles.selectedSourceLabel}>当前沿用来源</span>
              {selectedSource.sourceType && <span style={styles.selectedSourceType}>{selectedSource.sourceType}</span>}
              <span style={styles.selectedSourceText}>{selectedSource.sourceName}</span>
              <button type="button" onClick={() => setSelectedSource(null)} style={styles.clearSourceBtn}>
                清除
              </button>
            </div>
          )}
          {renderTaskQueue()}
          <div style={styles.inputBar}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                resizeInput(event.target);
              }}
              onKeyDown={handleKeyDown}
              placeholder={panelMode === 'chat' ? '输入消息...' : '直接记下整句话，原文会完整保存...'}
              style={styles.textarea}
              rows={1}
              disabled={loading}
            />
            <button onClick={() => void sendMessage()} disabled={!input.trim() || loading} style={{ ...styles.sendBtn, opacity: !input.trim() || loading ? 0.4 : 1 }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          .agent-panel {
            width: min(100vw - 20px, 420px) !important;
            height: min(82vh, 720px) !important;
            max-height: calc(100vh - 20px) !important;
            bottom: 10px !important;
            right: 10px !important;
            left: auto !important;
            border-radius: 18px !important;
          }
          .agent-float-btn { bottom: 78px !important; right: 14px !important; }
        }
        @media (max-width: 480px) {
          .agent-panel {
            width: 100vw !important;
            height: calc(100vh - 10px) !important;
            max-height: calc(100vh - 10px) !important;
            bottom: 0 !important;
            right: 0 !important;
            left: 0 !important;
            border-radius: 16px 16px 0 0 !important;
            padding-bottom: env(safe-area-inset-bottom);
          }
          .agent-float-btn { bottom: 76px !important; right: 14px !important; }
        }
      `}</style>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  floatingButton: { position: 'fixed', bottom: '84px', right: '20px', width: '50px', height: '50px', borderRadius: '50%', background: 'color-mix(in srgb, var(--accent-primary) 88%, #0ea5e9 12%)', color: '#fff', border: '1px solid color-mix(in srgb, var(--accent-primary) 62%, transparent 38%)', boxShadow: '0 14px 28px rgba(2, 6, 23, 0.28)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 998 },
  panel: { position: 'fixed', bottom: '20px', right: '20px', width: '420px', height: '640px', maxHeight: 'calc(100vh - 40px)', background: 'color-mix(in srgb, var(--bg-secondary) 92%, white 8%)', borderRadius: '20px', boxShadow: '0 28px 56px rgba(2, 6, 23, 0.3)', border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)', display: 'flex', flexDirection: 'column', zIndex: 999, overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)', background: 'color-mix(in srgb, var(--bg-tertiary) 82%, white 18%)' },
  headerTitleWrap: { display: 'flex', alignItems: 'center', gap: '8px' },
  headerTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '4px' },
  iconBtn: { width: '30px', height: '30px', border: '1px solid color-mix(in srgb, var(--border-color) 74%, transparent 26%)', background: 'color-mix(in srgb, var(--bg-secondary) 88%, white 12%)', cursor: 'pointer', color: 'var(--text-muted)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconBtnSecondary: {
    width: '28px',
    height: '28px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    background: 'color-mix(in srgb, var(--bg-secondary) 88%, white 12%)',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBar: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '10px 12px 8px', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)' },
  switchBtn: { border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)', background: 'color-mix(in srgb, var(--bg-tertiary) 82%, white 18%)', color: 'var(--text-secondary)', borderRadius: '999px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  switchBtnActive: { background: 'var(--accent-primary)', color: '#fff', border: '1px solid var(--accent-primary)' },
  modeBar: { padding: '6px 16px', fontSize: '11px', fontWeight: 500, textAlign: 'center', borderBottom: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)' },
  body: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  hint: { textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '8px' },
  emptyText: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.6 },
  row: { display: 'flex', justifyContent: 'flex-start' },
  userBubble: { maxWidth: '80%', padding: '8px 12px', background: 'var(--accent-primary)', color: '#fff', borderRadius: '14px 14px 4px 14px', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  assistantBubble: { maxWidth: '85%', padding: '8px 12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '14px 14px 14px 4px', fontSize: '13px', lineHeight: 1.5 },
  confirmBubble: { maxWidth: '88%', padding: '10px 12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', borderRadius: '10px 10px 10px 4px', fontSize: '13px', lineHeight: 1.5, border: '1px solid var(--accent-primary-alpha)' },
  messageText: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  markdownContent: { display: 'flex', flexDirection: 'column', gap: '6px', wordBreak: 'break-word' },
  markdownParagraph: { margin: 0, whiteSpace: 'normal' },
  markdownHeading: { marginTop: '2px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, lineHeight: 1.45 },
  markdownDivider: { height: '1px', margin: '2px 0', background: 'color-mix(in srgb, var(--border-color) 78%, transparent 22%)' },
  markdownList: { margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' },
  markdownListItem: { paddingLeft: '2px' },
  markdownTaskItem: { listStyle: 'none', display: 'flex', alignItems: 'flex-start', gap: '6px', marginLeft: '-18px', paddingLeft: 0 },
  markdownCheckbox: { width: '13px', height: '13px', margin: '3px 0 0', accentColor: 'var(--accent-primary)', flexShrink: 0 },
  markdownInlineCode: {
    padding: '1px 5px',
    borderRadius: '5px',
    background: 'color-mix(in srgb, var(--bg-secondary) 82%, var(--accent-primary-alpha) 18%)',
    border: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent 30%)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  markdownCodeBlock: {
    margin: 0,
    padding: '9px 10px',
    borderRadius: '8px',
    background: 'color-mix(in srgb, var(--bg-secondary) 88%, black 12%)',
    border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    lineHeight: 1.55,
    overflowX: 'auto',
    whiteSpace: 'pre',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  markdownCodeLanguage: { marginBottom: '6px', color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'inherit', textTransform: 'uppercase' },
  markdownQuote: {
    margin: 0,
    padding: '7px 10px',
    borderLeft: '3px solid var(--accent-primary)',
    borderRadius: '0 8px 8px 0',
    background: 'color-mix(in srgb, var(--bg-secondary) 88%, var(--accent-primary-alpha) 12%)',
    color: 'var(--text-secondary)',
  },
  markdownLink: { color: 'var(--accent-primary)', textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: 600 },
  markdownDeleted: { color: 'var(--text-muted)' },
  confirmActions: { display: 'flex', gap: '6px', marginTop: '8px' },
  confirmBtn: { flex: 1, padding: '4px 10px', background: 'var(--accent-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
  rejectBtn: { flex: 1, padding: '4px 10px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
  confirmStatus: { fontSize: '11px', marginTop: '8px' },
  tagWrap: { display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' },
  tag: { padding: '2px 6px', fontSize: '10px', color: 'var(--accent-primary)', background: 'var(--accent-primary-alpha)', borderRadius: '999px' },
  notice: { padding: '8px 10px', borderRadius: '10px', fontSize: '12px', lineHeight: 1.5 },
  captureCard: {
    padding: '12px',
    borderRadius: '16px',
    background: 'color-mix(in srgb, var(--bg-tertiary) 86%, var(--bg-secondary) 14%)',
    border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    boxShadow: '0 10px 22px rgba(2, 6, 23, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  captureTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  captureActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  captureMeta: { display: 'flex', alignItems: 'center', gap: '8px' },
  captureTime: { fontSize: '11px', color: 'var(--text-muted)' },
  captureBadge: { fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border-color)' },
  smallBtn: {
    border: '1px solid color-mix(in srgb, var(--accent-primary) 56%, transparent 44%)',
    background: 'color-mix(in srgb, var(--accent-primary) 88%, #0ea5e9 12%)',
    color: '#fff',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 600,
    flexShrink: 0,
    boxShadow: '0 8px 18px rgba(15, 118, 110, 0.2)',
  },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
  captureText: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.6 },
  editCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    borderRadius: '14px',
    background: 'color-mix(in srgb, var(--bg-secondary) 88%, var(--bg-tertiary) 12%)',
    border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, var(--border-color) 70%)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  },
  editGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '10px' },
  editInput: {
    width: '100%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    outline: 'none',
    background: 'color-mix(in srgb, var(--bg-tertiary) 86%, white 14%)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    lineHeight: 1.5,
    padding: '8px 10px',
    borderRadius: '10px',
    fontFamily: 'inherit',
  },
  editTextarea: {
    width: '100%',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    outline: 'none',
    resize: 'vertical',
    minHeight: '96px',
    background: 'color-mix(in srgb, var(--bg-tertiary) 86%, white 14%)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    lineHeight: 1.6,
    padding: '10px 12px',
    borderRadius: '10px',
    fontFamily: 'inherit',
  },
  editHint: { fontSize: '11px', lineHeight: 1.6, color: 'var(--text-muted)' },
  editActions: { display: 'flex', alignItems: 'center', gap: '8px' },
  sourceSection: {
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'color-mix(in srgb, var(--bg-secondary) 90%, var(--accent-primary-alpha) 10%)',
    border: '1px solid color-mix(in srgb, var(--border-color) 80%, transparent 20%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sourceChip: {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: '6px 10px',
    borderRadius: '999px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--border-color)',
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    fontSize: '12px',
    cursor: 'pointer',
  },
  sourceChipActive: {
    borderColor: 'var(--accent-primary)',
    background: 'var(--accent-primary-alpha)',
    color: 'var(--accent-primary)',
    fontWeight: 600,
  },
  emptySourceText: { fontSize: '12px', color: 'var(--text-muted)' },
  analysisBox: {
    borderTop: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    paddingTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  analysisRow: { display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' },
  analysisLabel: { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' },
  analysisText: { fontSize: '12px', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  selectedSourceBar: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', padding: '8px 12px', borderTop: '1px solid var(--border-color)', background: 'rgba(15,118,110,.04)' },
  selectedSourceLabel: { fontSize: '11px', color: 'var(--text-muted)' },
  selectedSourceType: { padding: '2px 8px', borderRadius: '999px', background: 'var(--accent-primary-alpha)', color: 'var(--accent-primary)', fontSize: '10px', fontWeight: 600 },
  selectedSourceText: { fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 },
  clearSourceBtn: { marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' },
  taskQueue: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px 12px 8px',
    borderTop: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
    background: 'color-mix(in srgb, var(--bg-tertiary) 70%, white 30%)',
  },
  taskCard: {
    border: '1px solid color-mix(in srgb, var(--accent-primary) 40%, var(--border-color) 60%)',
    background: 'color-mix(in srgb, var(--bg-secondary) 92%, var(--accent-primary-alpha) 8%)',
    borderRadius: '12px',
    padding: '10px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '10px',
  },
  taskCardText: {
    flex: 1,
    minWidth: 0,
    color: 'var(--text-primary)',
    fontSize: '12px',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  taskCardActions: {
    display: 'flex',
    gap: '6px',
    width: 'auto',
    flexShrink: 0,
  },
  inputBar: { display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 12px 12px', borderTop: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)', background: 'color-mix(in srgb, var(--bg-tertiary) 78%, white 22%)' },
  textarea: { flex: 1, border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)', outline: 'none', resize: 'none', overflowY: 'hidden', minHeight: '38px', background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)', color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.5, maxHeight: '220px', padding: '9px 12px', borderRadius: '12px', fontFamily: 'inherit' },
  sendBtn: { width: '36px', height: '36px', borderRadius: '50%', border: '1px solid color-mix(in srgb, var(--accent-primary) 56%, transparent 44%)', background: 'var(--accent-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 10px 20px rgba(15, 118, 110, 0.24)' },
};
