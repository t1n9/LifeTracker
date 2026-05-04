'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Bot, Send } from 'lucide-react';
import { studyPlanAPI } from '@/lib/api';
import { formatDate, formatDisplay, toDateOnly } from './dateUtils';
import type { ChatMessage, PendingAction, PhaseDraft, PhasePlan, SlotDraft, StudyPlanLite } from './types';

interface Props {
  plan: StudyPlanLite;
  phases: PhasePlan[];
  today: Date;
  examDaysLeft: number;
  thisWeekMissing: boolean;
  nextWeekMissing: boolean;
  onPhasesConfirmed: () => void;
  onWeekConfirmed: () => void;
  pendingExpandWeekStart?: Date | null;
  onExpandHandled?: () => void;
}

export default function StudyPlanChat({
  plan,
  phases,
  today,
  examDaysLeft,
  thisWeekMissing,
  nextWeekMissing,
  onPhasesConfirmed,
  onWeekConfirmed,
  pendingExpandWeekStart,
  onExpandHandled,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 记住 AI 最近一次问问题时对应的周（用户回答时带上去）
  const contextWeekRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages.length > 0) return;
    setMessages([{
      id: 'init',
      role: 'assistant',
      content: buildGreeting({ plan, phases, examDaysLeft, thisWeekMissing, nextWeekMissing }),
      createdAt: new Date().toISOString(),
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pendingExpandWeekStart) return;
    const weekDate = toDateOnly(pendingExpandWeekStart);
    const weekStr = formatDisplay(weekDate);
    const weekISO = formatDate(weekDate);
    contextWeekRef.current = weekISO;
    appendMessage({
      role: 'assistant',
      content: `你想怎么安排 ${weekStr} 开始这一周？可以告诉我每天学什么、学多久，也可以让我根据当前进度自动安排。`,
    });
    onExpandHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingExpandWeekStart]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const appendMessage = (message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    setMessages((prev) => [
      ...prev,
      {
        ...message,
        id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const updateLastAssistant = (patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'assistant') {
          next[i] = { ...next[i], ...patch };
          break;
        }
      }
      return next;
    });
  };

  const defaultWeekStart = formatDate(toDateOnly(
    nextWeekMissing && !thisWeekMissing ? new Date(today.getTime() + 7 * 86400000) : today,
  ));

  // 找消息列表中最近一条未保存的草稿，返回其摘要字符串
  const getActiveDraftContext = (): { summary: string; weekStart?: string } | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      if (m.draftSlots && m.draftSlots.length > 0 && m.draftWeekStart) {
        const lines = m.draftSlots.map((s) => `${s.date} ${s.subjectName}·${s.chapterTitle} ${s.plannedHours}h`);
        return {
          summary: `【当前未保存草稿（${m.draftWeekStart} 这周）：\n${lines.join('\n')}\n】`,
          weekStart: m.draftWeekStart,
        };
      }
      if (m.draftPhases && m.draftPhases.length > 0) {
        const lines = m.draftPhases.map((p) => `${p.name} ${p.startDate}~${p.endDate}`);
        return { summary: `【当前未保存阶段草稿：\n${lines.join('\n')}\n】` };
      }
    }
    return null;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;

    // 优先用 AI 问题中携带的上下文周，否则用默认周
    const weekStartForRequest = contextWeekRef.current ?? defaultWeekStart;
    contextWeekRef.current = null;

    // 如果有未保存草稿，把草稿摘要拼入消息让 AI 有上下文
    const draftCtx = getActiveDraftContext();
    const messageWithContext = draftCtx ? `${draftCtx.summary}\n用户修改意见：${text}` : text;
    const weekForRequest = draftCtx?.weekStart ?? weekStartForRequest;

    setInput('');
    appendMessage({ role: 'user', content: text });
    setBusy(true);
    appendMessage({ role: 'assistant', content: '理解中...', isThinking: true });

    try {
      const response = await studyPlanAPI.chat(plan.id, messageWithContext, weekForRequest);
      const result = response.data as {
        action: 'generate_phases' | 'expand_week' | 'reply' | 'onboard_phases' | 'onboard_week';
        reply: string;
        targetWeekStart?: string;
        parsedIntent?: unknown;
      };

      if (result.action === 'reply' || result.action === 'onboard_phases') {
        updateLastAssistant({ content: result.reply, isThinking: false });
      } else {
        // 意图识别后，展示理解+确认按钮，不立即生成
        updateLastAssistant({
          content: result.reply,
          isThinking: false,
          pendingAction: {
            action: result.action as 'generate_phases' | 'expand_week',
            originalMessage: text,
            targetWeekStart: result.targetWeekStart || defaultWeekStart,
            parsedIntent: result.parsedIntent,
          },
        });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as { message?: string })?.message
        || 'AI 服务暂时不可用';
      updateLastAssistant({ content: `请求失败：${msg}`, isThinking: false });
    } finally {
      setBusy(false);
    }
  };

  const clearPendingAction = (messageId: string) => {
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, pendingAction: undefined } : m));
  };

  const handleConfirmAction = async (pending: PendingAction, messageId: string) => {
    clearPendingAction(messageId);
    setBusy(true);
    appendMessage({ role: 'assistant', content: '生成中，请稍候...', isThinking: true });
    try {
      const response = await studyPlanAPI.chatExecute(
        plan.id,
        pending.action,
        pending.originalMessage,
        pending.targetWeekStart,
        pending.parsedIntent,
      );
      const result = response.data as {
        action: string;
        reply: string;
        targetWeekStart?: string;
        draftPhases?: PhaseDraft[];
        draftSlots?: SlotDraft[];
      };

      if (result.draftPhases?.length) {
        updateLastAssistant({ content: result.reply, isThinking: false, draftPhases: result.draftPhases });
      } else if (result.draftSlots?.length) {
        updateLastAssistant({
          content: result.reply,
          isThinking: false,
          draftSlots: result.draftSlots,
          draftWeekStart: result.targetWeekStart || pending.targetWeekStart,
        });
      } else {
        updateLastAssistant({ content: result.reply || '没有生成可用的内容，章节可能已全部完成。', isThinking: false });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        || (err as { message?: string })?.message
        || '生成失败';
      updateLastAssistant({ content: `生成失败：${msg}`, isThinking: false });
    } finally {
      setBusy(false);
    }
  };

  const handleExpandWeek = async (weekStart: Date, intent?: string) => {
    setBusy(true);
    appendMessage({ role: 'assistant', content: '理解中...', isThinking: true });
    try {
      const ws = formatDate(toDateOnly(weekStart));
      const response = await studyPlanAPI.chat(plan.id, intent || '帮我生成本周学习计划', ws);
      const result = response.data as { action: 'generate_phases' | 'expand_week' | 'reply' | 'onboard_phases' | 'onboard_week'; reply: string; targetWeekStart?: string; parsedIntent?: unknown };
      if (result.action === 'onboard_phases' || result.action === 'reply' || result.action === 'onboard_week') {
        // AI 在询问用户想法 — 记住这一周，下次用户回复带过去
        contextWeekRef.current = result.targetWeekStart || ws;
        updateLastAssistant({ content: result.reply, isThinking: false });
      } else {
        updateLastAssistant({
          content: result.reply,
          isThinking: false,
          pendingAction: {
            action: result.action as 'generate_phases' | 'expand_week',
            originalMessage: intent || '帮我生成本周学习计划',
            targetWeekStart: result.targetWeekStart || ws,
            parsedIntent: result.parsedIntent,
          },
        });
      }
    } catch {
      updateLastAssistant({ content: '请求失败，请稍后重试。', isThinking: false });
    } finally {
      setBusy(false);
    }
  };

  const clearDraftFromMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, draftPhases: undefined, draftSlots: undefined, draftWeekStart: undefined } : m),
    );
  };

  const handleConfirmPhases = async (draft: PhaseDraft[], messageId: string) => {
    setBusy(true);
    try {
      await studyPlanAPI.confirmPhases(plan.id, draft as unknown as Array<Record<string, unknown>>);
      clearDraftFromMessage(messageId);
      appendMessage({ role: 'assistant', content: '阶段规划已保存。下一步可以生成本周或下周的具体学习安排。' });
      onPhasesConfirmed();
    } catch {
      appendMessage({ role: 'assistant', content: '保存阶段规划失败，请稍后再试。' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmWeek = async (slots: SlotDraft[], weekStart: string, messageId: string) => {
    setBusy(true);
    try {
      await studyPlanAPI.confirmWeek(plan.id, { weekStart, slots: slots as unknown as Array<Record<string, unknown>> });
      clearDraftFromMessage(messageId);
      appendMessage({ role: 'assistant', content: '周计划已保存。你可以在右侧日历里查看，也可以回到首页接收提醒。' });
      onWeekConfirmed();
    } catch {
      appendMessage({ role: 'assistant', content: '保存周计划失败，请稍后再试。' });
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      handleSend();
    }
  };

  const chips = buildChips({ thisWeekMissing, nextWeekMissing, hasPhases: phases.length > 0 });

  return (
    <section style={styles.container}>
      <div style={styles.header}>
        <Bot size={16} style={{ color: 'var(--accent)' }} />
        <span style={styles.headerTitle}>学习计划 AI</span>
      </div>

      <div ref={scrollRef} style={styles.messages}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onConfirmPhases={(draft, id) => handleConfirmPhases(draft, id)}
            onConfirmWeek={(slots, ws, id) => handleConfirmWeek(slots, ws, id)}
            onConfirmAction={(pending, id) => handleConfirmAction(pending, id)}
            busy={busy}
          />
        ))}
      </div>

      {chips.length > 0 && messages.length <= 2 && (
        <div style={styles.chipsRow}>
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              style={styles.chip}
              onClick={() => setInput(chip.send)}
              disabled={busy}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div style={styles.inputRow}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="例如：帮我把剩下的备考时间分成基础、强化和冲刺阶段..."
          style={styles.textarea}
          disabled={busy}
        />
        <button type="button" style={styles.sendBtn} onClick={handleSend} disabled={busy || !input.trim()}>
          <Send size={15} />
        </button>
      </div>
    </section>
  );
}

function MessageBubble({
  message,
  onConfirmPhases,
  onConfirmWeek,
  onConfirmAction,
  busy,
}: {
  message: ChatMessage;
  onConfirmPhases: (draft: PhaseDraft[], messageId: string) => void;
  onConfirmWeek: (slots: SlotDraft[], weekStart: string, messageId: string) => void;
  onConfirmAction: (pending: PendingAction, messageId: string) => void;
  busy: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div style={isUser ? styles.userRow : styles.assistantRow}>
      {!isUser && <Bot size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />}
      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        <div style={styles.messageContent}>
          {message.content.split('\n').map((line, index) => (
            <p key={index} style={{ margin: 0 }}>{line}</p>
          ))}
        </div>

        {message.pendingAction && !message.draftPhases && !message.draftSlots && (
          <div style={styles.confirmRow}>
            <button
              type="button"
              style={styles.applyBtn}
              onClick={() => onConfirmAction(message.pendingAction!, message.id)}
              disabled={busy}
            >
              确认，帮我生成
            </button>
          </div>
        )}


        {message.draftPhases && message.draftPhases.length > 0 && (
          <div style={styles.draftCard}>
            {message.draftPhases.map((phase, index) => (
              <div key={index} style={styles.draftPhaseItem}>
                <div style={styles.draftPhaseHead}>
                  <span style={styles.draftPhaseName}>{phase.name}</span>
                  <span style={styles.draftPhaseDates}>
                    {formatDisplay(phase.startDate)} - {formatDisplay(phase.endDate)}
                  </span>
                </div>
                {phase.description && <div style={styles.draftPhaseDesc}>{phase.description}</div>}
              </div>
            ))}
            <button type="button" style={styles.applyBtn} onClick={() => onConfirmPhases(message.draftPhases!, message.id)} disabled={busy}>
              保存阶段规划
            </button>
          </div>
        )}

        {message.draftSlots && message.draftSlots.length > 0 && message.draftWeekStart && (
          <div style={styles.draftCard}>
            <DraftSlotsTable slots={message.draftSlots} />
            <button type="button" style={styles.applyBtn} onClick={() => onConfirmWeek(message.draftSlots!, message.draftWeekStart!, message.id)} disabled={busy}>
              保存周计划
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DraftSlotsTable({ slots }: { slots: SlotDraft[] }) {
  const byDate = new Map<string, SlotDraft[]>();
  for (const slot of slots) {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date)!.push(slot);
  }

  return (
    <div style={styles.draftSlotTable}>
      {Array.from(byDate.keys()).sort().map((date) => (
        <div key={date} style={styles.draftSlotDay}>
          <span style={styles.draftSlotDate}>{formatDisplay(date, true)}</span>
          <div style={styles.draftSlotItems}>
            {byDate.get(date)!.map((slot, index) => (
              <span key={index} style={styles.draftSlotItem}>
                {slot.timeSegment ? `[${slot.timeSegment}] ` : ''}{slot.subjectName ? `${slot.subjectName} · ` : ''}{slot.chapterTitle} {slot.plannedHours}h
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function buildGreeting({
  plan,
  phases,
  examDaysLeft,
  thisWeekMissing,
  nextWeekMissing,
}: {
  plan: StudyPlanLite;
  phases: PhasePlan[];
  examDaysLeft: number;
  thisWeekMissing: boolean;
  nextWeekMissing: boolean;
}) {
  if (phases.length === 0) {
    return `你正在准备 ${plan.examName}，距离考试还有 ${examDaysLeft} 天。\n还没有阶段规划——可以直接告诉我你的备考阶段安排，或者说"帮我划分阶段"由我来引导。`;
  }
  if (thisWeekMissing) {
    return `本周还没有学习安排。可以直接让我生成本周计划。`;
  }
  if (nextWeekMissing) {
    return `下周还没有学习安排。建议提前生成下周计划，避免临时补课。`;
  }
  return `当前学习计划已就绪。你可以继续微调阶段，也可以生成某一周的具体安排。`;
}

function buildChips({
  thisWeekMissing,
  nextWeekMissing,
  hasPhases,
}: {
  thisWeekMissing: boolean;
  nextWeekMissing: boolean;
  hasPhases: boolean;
}) {
  const chips: Array<{ label: string; send: string }> = [];
  if (!hasPhases) {
    chips.push({ label: '生成阶段规划', send: '帮我生成阶段规划' });
  }
  if (thisWeekMissing) {
    chips.push({ label: '生成本周计划', send: '帮我生成本周学习计划' });
  }
  if (nextWeekMissing) {
    chips.push({ label: '生成下周计划', send: '帮我生成下周学习计划' });
  }
  if (hasPhases && !thisWeekMissing && !nextWeekMissing) {
    chips.push({ label: '调整学习节奏', send: '帮我检查一下当前学习节奏是否合理' });
  }
  return chips.slice(0, 4);
}

const styles: Record<string, CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-1)', borderRight: '1px solid var(--line)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' },
  headerTitle: { fontSize: 13, fontWeight: 700, color: 'var(--fg)' },
  messages: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  assistantRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  userBubble: {
    maxWidth: '78%', padding: '8px 12px', borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-ink)',
    fontSize: 13, lineHeight: 1.5,
  },
  assistantBubble: {
    maxWidth: '90%', padding: '8px 12px', borderRadius: 12, background: 'var(--bg-2)', color: 'var(--fg)',
    fontSize: 13, lineHeight: 1.5, border: '1px solid var(--line)',
  },
  messageContent: { display: 'flex', flexDirection: 'column', gap: 4, whiteSpace: 'pre-wrap' },
  draftCard: {
    marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--line)',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  draftPhaseItem: { display: 'flex', flexDirection: 'column', gap: 2, padding: '7px 9px', background: 'var(--bg-2)', borderRadius: 8 },
  draftPhaseHead: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  draftPhaseName: { fontSize: 13, fontWeight: 700, color: 'var(--fg)' },
  draftPhaseDates: { fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' },
  draftPhaseDesc: { fontSize: 12, color: 'var(--fg-2)' },
  confirmRow: { marginTop: 10 },
  applyBtn: {
    padding: '8px 14px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)',
    cursor: 'pointer', fontSize: 13, fontWeight: 700,
  },
  draftSlotTable: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' },
  draftSlotDay: { display: 'flex', flexDirection: 'column', gap: 3, padding: '7px 9px', background: 'var(--bg-2)', borderRadius: 8 },
  draftSlotDate: { fontSize: 12, fontWeight: 700, color: 'var(--fg)' },
  draftSlotItems: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  draftSlotItem: { fontSize: 11, color: 'var(--fg-2)', padding: '2px 6px', background: 'var(--bg-1)', borderRadius: 999 },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', borderTop: '1px solid var(--line)' },
  chip: {
    padding: '6px 10px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)',
    cursor: 'pointer', fontSize: 12,
  },
  inputRow: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--line)', background: 'var(--bg-1)' },
  textarea: {
    flex: 1, resize: 'none', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', color: 'var(--fg)',
    padding: '8px 10px', outline: 'none', fontSize: 13, lineHeight: 1.5,
  },
  sendBtn: {
    width: 38, borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
