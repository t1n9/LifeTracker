'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Bot, Send, Pencil, Trash2, Check, X } from 'lucide-react';
import { studyPlanAPI } from '@/lib/api';
import { formatDate, formatDisplay, toDateOnly } from './dateUtils';
import type { ChatMessage, PendingAction, PhaseDraft, SlotDraft, PhasePlan, StudyPlanLite } from './types';

interface Props {
  plan: StudyPlanLite;
  phases: PhasePlan[];
  hasWeekSlots: boolean;
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
  hasWeekSlots,
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
  const contextWeekRef = useRef<string | null>(null);
  const autoTriggeredRef = useRef(false);

  const defaultWeekStart = formatDate(toDateOnly(today));

  // mount 后直接发 __auto__，让后端判断是否需要自动推荐
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;

    const doInit = async () => {
      // 无阶段时先显示分析提示
      const noPhases = phases.length === 0;
      const initGreeting = noPhases
        ? `你正在准备 ${plan.examName}，距离考试还有 ${examDaysLeft} 天。\n正在为你分析参考资料，生成阶段规划推荐...`
        : buildGreeting({ plan, phases, hasWeekSlots, examDaysLeft, thisWeekMissing, nextWeekMissing });

      // 设置初始消息 + thinking 占位
      setBusy(true);
      setMessages([
        { id: 'init', role: 'assistant', content: initGreeting, createdAt: new Date().toISOString() },
        { id: 'm-thinking', role: 'assistant', content: '正在分析...', isThinking: true, createdAt: new Date().toISOString() },
      ]);

      try {
        const response = await studyPlanAPI.chat(plan.id, '__auto__', defaultWeekStart);
        const result = response.data as ChatIntentResult;

        if (result.action === 'reply') {
          // 后端说没什么要推荐的，移除 thinking 消息，更新 greeting
          setMessages([{
            id: 'init',
            role: 'assistant',
            content: buildGreeting({ plan, phases, hasWeekSlots, examDaysLeft, thisWeekMissing, nextWeekMissing }),
            createdAt: new Date().toISOString(),
          }]);
        } else {
          // 有推荐内容，把 thinking 消息替换为结果
          setMessages((prev) => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].role === 'assistant') {
                next[i] = { ...next[i], ...buildPatch(result, defaultWeekStart) };
                break;
              }
            }
            return next;
          });
        }
      } catch {
        setMessages([{
          id: 'init',
          role: 'assistant',
          content: buildGreeting({ plan, phases, hasWeekSlots, examDaysLeft, thisWeekMissing, nextWeekMissing }),
          createdAt: new Date().toISOString(),
        }]);
      } finally {
        setBusy(false);
      }
    };

    doInit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部触发展开某周
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
      { ...message, id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() },
    ]);
  };

  const updateLastAssistant = (patch: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'assistant') { next[i] = { ...next[i], ...patch }; break; }
      }
      return next;
    });
  };

  const handleChatResult = (result: ChatIntentResult, weekForRequest: string) => {
    updateLastAssistant(buildPatch(result, weekForRequest));
  };

  const getActiveDraftContext = (): { summary: string; weekStart?: string } | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      if (((m.draftSlots && m.draftSlots.length > 0) || (m.skipDates && m.skipDates.length > 0)) && m.draftWeekStart) {
        const lines = (m.draftSlots ?? []).map((s) => `${s.date} ${s.subjectName}·${s.chapterTitle} ${s.plannedHours}h`);
        const skipLines = (m.skipDates ?? []).map((date) => `${date} 休息`);
        return { summary: `【当前未保存草稿（${m.draftWeekStart} 这周）：\n${[...lines, ...skipLines].join('\n')}\n】`, weekStart: m.draftWeekStart };
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

    const weekStartForRequest = contextWeekRef.current ?? defaultWeekStart;
    contextWeekRef.current = null;

    const draftCtx = getActiveDraftContext();
    const messageWithContext = draftCtx ? `${draftCtx.summary}\n用户修改意见：${text}` : text;
    const weekForRequest = draftCtx?.weekStart ?? weekStartForRequest;

    setInput('');
    appendMessage({ role: 'user', content: text });
    setBusy(true);
    appendMessage({ role: 'assistant', content: '理解中...', isThinking: true });

    try {
      const response = await studyPlanAPI.chat(plan.id, messageWithContext, weekForRequest);
      const result = response.data as ChatIntentResult;
      handleChatResult(result, weekForRequest);
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || (err as any)?.message || 'AI 服务暂时不可用';
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
        plan.id, pending.action, pending.originalMessage, pending.targetWeekStart, pending.parsedIntent,
      );
      const result = response.data as { action: string; reply: string; targetWeekStart?: string; draftPhases?: PhaseDraft[]; draftSlots?: SlotDraft[]; skipDates?: string[] };
      if (result.draftPhases?.length) {
        updateLastAssistant({ content: result.reply, isThinking: false, draftPhases: result.draftPhases });
      } else if (result.draftSlots?.length || result.skipDates?.length) {
        updateLastAssistant({
          content: result.reply,
          isThinking: false,
          draftSlots: result.draftSlots,
          skipDates: result.skipDates,
          draftWeekStart: result.targetWeekStart || pending.targetWeekStart,
        });
      } else {
        updateLastAssistant({ content: result.reply || '没有生成可用的内容。', isThinking: false });
      }
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message || (err as any)?.message || '生成失败';
      updateLastAssistant({ content: `生成失败：${msg}`, isThinking: false });
    } finally {
      setBusy(false);
    }
  };

  const clearDraftFromMessage = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, draftPhases: undefined, draftSlots: undefined, skipDates: undefined, draftWeekStart: undefined } : m),
    );
  };

  const updateDraftSlots = (messageId: string, slots: SlotDraft[]) => {
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, draftSlots: slots } : m));
  };

  const handleConfirmPhases = async (draft: PhaseDraft[], messageId: string) => {
    setBusy(true);
    try {
      await studyPlanAPI.confirmPhases(plan.id, draft as unknown as Array<Record<string, unknown>>);
      clearDraftFromMessage(messageId);
      appendMessage({ role: 'assistant', content: '阶段规划已保存。接下来可以生成本周或下周的具体学习安排。' });
      onPhasesConfirmed();
    } catch {
      appendMessage({ role: 'assistant', content: '保存阶段规划失败，请稍后再试。' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmWeek = async (slots: SlotDraft[], weekStart: string, messageId: string, skipDates: string[] = []) => {
    setBusy(true);
    try {
      const restSlotDates = slots
        .filter(isRestSlot)
        .map((slot) => slot.date);
      const normalSlots = slots.filter((slot) => !isRestSlot(slot));
      const normalizedSkipDates = Array.from(new Set([...skipDates, ...restSlotDates]));
      await studyPlanAPI.confirmWeek(plan.id, {
        weekStart,
        slots: normalSlots as unknown as Array<Record<string, unknown>>,
        skipDates: normalizedSkipDates,
      });
      clearDraftFromMessage(messageId);
      appendMessage({ role: 'assistant', content: normalizedSkipDates.length > 0 && normalSlots.length === 0 ? '已保存休息安排。对应日期未完成的学习计划已清空。' : '周计划已保存。你可以在右侧日历查看，也可以回到首页接收提醒。' });
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
            onConfirmWeek={(slots, ws, id, skipDates) => handleConfirmWeek(slots, ws, id, skipDates)}
            onConfirmAction={(pending, id) => handleConfirmAction(pending, id)}
            onUpdateSlots={(id, slots) => updateDraftSlots(id, slots)}
            busy={busy}
          />
        ))}
      </div>

      {chips.length > 0 && messages.length <= 2 && !busy && (
        <div style={styles.chipsRow}>
          {chips.map((chip) => (
            <button key={chip.label} type="button" style={styles.chip} onClick={() => setInput(chip.send)} disabled={busy}>
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
          placeholder="例如：帮我把剩下的时间分成基础、强化、冲刺阶段，或者调整某天安排..."
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

function isRestSlot(slot: SlotDraft) {
  return /(休息|不安排|不用学|不学习|空出来|暂停|跳过)/u.test(`${slot.subjectName ?? ''} ${slot.chapterTitle ?? ''}`);
}

function isRestPlanMessage(content: string) {
  return /设为休息|休息日|不再安排学习任务|不安排学习/u.test(content);
}

function inferRestDatesFromMessage(content: string, weekStart: string) {
  if (!isRestPlanMessage(content)) return [];
  const weekStartDate = toDateOnly(weekStart);
  const year = weekStartDate.getUTCFullYear();
  const dates = new Set<string>();
  const addDate = (month: number, day: number) => {
    if (month < 1 || month > 12 || day < 1 || day > 31) return;
    dates.add(formatDate(new Date(Date.UTC(year, month - 1, day))));
  };

  for (const match of content.matchAll(/(\d{1,2})[./,，、-](\d{1,2})/gu)) {
    addDate(Number(match[1]), Number(match[2]));
  }
  for (const match of content.matchAll(/(\d{1,2})月(\d{1,2})(?:日|号)?/gu)) {
    addDate(Number(match[1]), Number(match[2]));
  }

  return [...dates];
}

// ── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onConfirmPhases,
  onConfirmWeek,
  onConfirmAction,
  onUpdateSlots,
  busy,
}: {
  message: ChatMessage;
  onConfirmPhases: (draft: PhaseDraft[], messageId: string) => void;
  onConfirmWeek: (slots: SlotDraft[], weekStart: string, messageId: string, skipDates?: string[]) => void;
  onConfirmAction: (pending: PendingAction, messageId: string) => void;
  onUpdateSlots: (messageId: string, slots: SlotDraft[]) => void;
  busy: boolean;
}) {
  const isUser = message.role === 'user';
  return (
    <div style={isUser ? styles.userRow : styles.assistantRow}>
      {!isUser && <Bot size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 4 }} />}
      <div style={isUser ? styles.userBubble : styles.assistantBubble}>
        <MarkdownContent content={message.content} />

        {message.pendingAction && !message.draftPhases && !message.draftSlots && (
          <div style={styles.confirmRow}>
            <button type="button" style={styles.applyBtn} onClick={() => onConfirmAction(message.pendingAction!, message.id)} disabled={busy}>
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
                  <span style={styles.draftPhaseDates}>{formatDisplay(phase.startDate)} – {formatDisplay(phase.endDate)}</span>
                </div>
                {phase.description && <div style={styles.draftPhaseDesc}>{phase.description}</div>}
                {phase.mastery && (
                  <div style={styles.draftPhaseMastery}>🎯 {phase.mastery}</div>
                )}
              </div>
            ))}
            <button type="button" style={styles.applyBtn} onClick={() => onConfirmPhases(message.draftPhases!, message.id)} disabled={busy}>
              确认保存阶段规划
            </button>
          </div>
        )}

        {((message.draftSlots && message.draftSlots.length > 0) || (message.skipDates && message.skipDates.length > 0) || isRestPlanMessage(message.content)) && message.draftWeekStart && (
          <EditableSlotsCard
            slots={message.draftSlots ?? []}
            skipDates={message.skipDates?.length ? message.skipDates : inferRestDatesFromMessage(message.content, message.draftWeekStart)}
            weekStart={message.draftWeekStart}
            messageId={message.id}
            busy={busy}
            onUpdateSlots={onUpdateSlots}
            onConfirmWeek={onConfirmWeek}
          />
        )}
      </div>
    </div>
  );
}

// ── 简单 Markdown 渲染（加粗 + 链接） ────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const renderLine = (line: string, key: number) => {
    const parts: React.ReactNode[] = [];
    // 支持 **bold** 和 [text](url)
    const regex = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      if (match[1]) {
        parts.push(<strong key={match.index}>{match[1]}</strong>);
      } else {
        parts.push(<a key={match.index} href={match[3]} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{match[2]}</a>);
      }
      last = regex.lastIndex;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <p key={key} style={{ margin: 0 }}>{parts}</p>;
  };
  return (
    <div style={styles.messageContent}>
      {content.split('\n').map((line, i) => renderLine(line, i))}
    </div>
  );
}

// ── EditableSlotsCard — 包含不可用标记状态和确认按钮 ─────────────────────

function EditableSlotsCard({
  slots, skipDates, weekStart, messageId, busy, onUpdateSlots, onConfirmWeek,
}: {
  slots: SlotDraft[];
  skipDates: string[];
  weekStart: string;
  messageId: string;
  busy: boolean;
  onUpdateSlots: (messageId: string, slots: SlotDraft[]) => void;
  onConfirmWeek: (slots: SlotDraft[], weekStart: string, messageId: string, skipDates?: string[]) => void;
}) {
  // 不可用索引集合（纯 UI，不改 slots prop）
  const [skippedSet, setSkippedSet] = useState<Set<number>>(new Set());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editSegment, setEditSegment] = useState('');

  const byDate = new Map<string, Array<{ slot: SlotDraft; idx: number }>>();
  slots.forEach((slot, idx) => {
    if (!byDate.has(slot.date)) byDate.set(slot.date, []);
    byDate.get(slot.date)!.push({ slot, idx });
  });

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditHours(String(slots[idx].plannedHours));
    setEditSegment(slots[idx].timeSegment ?? '');
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const updated = slots.map((s, i) =>
      i === editingIdx
        ? { ...s, plannedHours: parseFloat(editHours) || s.plannedHours, timeSegment: editSegment || s.timeSegment }
        : s,
    );
    onUpdateSlots(messageId, updated);
    setEditingIdx(null);
  };

  const deleteSlot = (idx: number) => {
    onUpdateSlots(messageId, slots.filter((_, i) => i !== idx));
    // 重置 skippedSet 索引（简单处理：清空）
    setSkippedSet(new Set());
  };

  const toggleSkipped = (idx: number) => {
    setSkippedSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleConfirm = () => {
    // 过滤掉标记不可用的 slots
    const finalSlots = slots.filter((_, i) => !skippedSet.has(i));
    onConfirmWeek(finalSlots, weekStart, messageId, skipDates);
  };

  const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return (
    <div style={styles.draftCard}>
      {skipDates.length > 0 && (
        <div style={styles.draftSlotTable}>
          {skipDates.map((date) => {
            const d = new Date(date + 'T00:00:00Z');
            return (
              <div key={date} style={styles.draftSlotDay}>
                <span style={styles.draftSlotDate}>{date.slice(5)}（{DAY_ZH[d.getUTCDay()]}）</span>
                <span style={styles.slotLabel}>休息，不安排学习任务</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={styles.draftSlotTable}>
        {[...byDate.entries()].sort().map(([date, items]) => {
          const d = new Date(date + 'T00:00:00Z');
          const dow = DAY_ZH[d.getUTCDay()];
          return (
            <div key={date} style={styles.draftSlotDay}>
              <span style={styles.draftSlotDate}>{date.slice(5)}（{dow}）</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map(({ slot, idx }) => (
                  <div key={idx} style={{ ...styles.slotRow, opacity: skippedSet.has(idx) ? 0.35 : 1, textDecoration: skippedSet.has(idx) ? 'line-through' : 'none' }}>
                    {editingIdx === idx ? (
                      <div style={styles.slotEditRow}>
                        <input type="number" value={editHours} onChange={e => setEditHours(e.target.value)}
                          style={styles.editInput} min={0.5} max={12} step={0.5} />
                        <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>h</span>
                        <input type="text" value={editSegment} onChange={e => setEditSegment(e.target.value)}
                          style={{ ...styles.editInput, width: 48 }} placeholder="时段" />
                        <button type="button" style={styles.iconBtn} onClick={commitEdit}><Check size={12} /></button>
                        <button type="button" style={styles.iconBtn} onClick={() => setEditingIdx(null)}><X size={12} /></button>
                      </div>
                    ) : (
                      <>
                        <span style={styles.slotLabel}>
                          {slot.timeSegment ? <span style={{ color: 'var(--fg-3)' }}>[{slot.timeSegment}] </span> : ''}
                          {slot.subjectName ? `${slot.subjectName}·` : ''}
                          {slot.chapterTitle}
                          <span style={styles.slotHours}> {slot.plannedHours}h</span>
                        </span>
                        <div style={styles.slotActions}>
                          <button type="button" style={styles.iconBtn} title="修改时长/时段" onClick={() => startEdit(idx)}><Pencil size={11} /></button>
                          <button type="button"
                            style={{ ...styles.iconBtn, color: skippedSet.has(idx) ? 'var(--accent)' : 'var(--fg-3)' }}
                            title={skippedSet.has(idx) ? '取消不可用' : '标记该时段不可用'}
                            onClick={() => toggleSkipped(idx)}>
                            <X size={11} />
                          </button>
                          <button type="button" style={{ ...styles.iconBtn, color: '#e55' }} title="删除" onClick={() => deleteSlot(idx)}><Trash2 size={11} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {skippedSet.size > 0 && (
        <div style={{ fontSize: 11, color: 'var(--fg-3)', paddingLeft: 2 }}>
          已标记 {skippedSet.size} 条不可用，确认时将跳过。
        </div>
      )}
      <button type="button" style={styles.applyBtn} onClick={handleConfirm} disabled={busy}>
        确认保存周计划{skippedSet.size > 0 ? `（跳过 ${skippedSet.size} 条）` : ''}
      </button>
    </div>
  );
}

// ── ChatIntentResult type + buildPatch (pure, used inside and outside component) ──

type ChatIntentResult = {
  action: 'generate_phases' | 'expand_week' | 'reply' | 'onboard_phases' | 'onboard_week';
  reply: string;
  targetWeekStart?: string;
  parsedIntent?: unknown;
  draftPhases?: PhaseDraft[];
  draftSlots?: SlotDraft[];
  skipDates?: string[];
};

function buildPatch(result: ChatIntentResult, weekForRequest: string): Partial<ChatMessage> {
  if (result.action === 'onboard_phases') {
    return { content: result.reply, isThinking: false, draftPhases: result.draftPhases };
  }
  if (result.action === 'onboard_week') {
    return {
      content: result.reply,
      isThinking: false,
      draftSlots: result.draftSlots,
      skipDates: result.skipDates,
      draftWeekStart: result.targetWeekStart || weekForRequest,
    };
  }
  if (result.action === 'reply') {
    return { content: result.reply, isThinking: false };
  }
  return {
    content: result.reply,
    isThinking: false,
    pendingAction: {
      action: result.action as 'generate_phases' | 'expand_week',
      originalMessage: '',
      targetWeekStart: result.targetWeekStart || weekForRequest,
      parsedIntent: result.parsedIntent,
    },
  };
}

// ── Greeting & Chips ───────────────────────────────────────────────────────

function buildGreeting({ plan, phases, hasWeekSlots, examDaysLeft, thisWeekMissing, nextWeekMissing }: {
  plan: StudyPlanLite; phases: PhasePlan[]; hasWeekSlots: boolean; examDaysLeft: number; thisWeekMissing: boolean; nextWeekMissing: boolean;
}) {
  if (phases.length === 0) {
    return `你正在准备 ${plan.examName}，距离考试还有 ${examDaysLeft} 天。\n正在为你分析参考资料，生成阶段规划推荐...`;
  }
  if (thisWeekMissing && !hasWeekSlots) {
    return `本周还没有学习安排，正在根据当前阶段为你生成推荐计划...`;
  }
  if (thisWeekMissing && hasWeekSlots) {
    return `当前已有学习安排，但本周还有可调整的空缺。你可以告诉我调整某一天、补齐空缺，或者重新平衡学习节奏。`;
  }
  if (nextWeekMissing) {
    return `当前阶段计划和本周安排已就绪。你可以继续调整某天安排、重排学习节奏，或提前生成下周计划。`;
  }
  return `当前阶段计划和周计划已就绪。你可以告诉我调整某天安排、设置休息日、重排学习节奏，或修改阶段计划。`;
}

function buildChips({ thisWeekMissing, nextWeekMissing, hasPhases }: { thisWeekMissing: boolean; nextWeekMissing: boolean; hasPhases: boolean }) {
  const chips: Array<{ label: string; send: string }> = [];
  if (!hasPhases) chips.push({ label: '重新生成方案', send: '帮我重新生成阶段规划' });
  if (thisWeekMissing) chips.push({ label: '重新生成本周', send: '帮我重新生成本周学习计划' });
  if (nextWeekMissing) chips.push({ label: '生成下周计划', send: '帮我生成下周学习计划' });
  if (hasPhases && !thisWeekMissing && !nextWeekMissing) chips.push({ label: '调整学习节奏', send: '帮我检查一下当前学习节奏是否合理' });
  return chips.slice(0, 4);
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-1)', borderRight: '1px solid var(--line)' },
  header: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' },
  headerTitle: { fontSize: 13, fontWeight: 700, color: 'var(--fg)' },
  messages: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 },
  userRow: { display: 'flex', justifyContent: 'flex-end' },
  assistantRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  userBubble: { maxWidth: '78%', padding: '8px 12px', borderRadius: 12, background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 13, lineHeight: 1.5 },
  assistantBubble: { maxWidth: '92%', padding: '8px 12px', borderRadius: 12, background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, lineHeight: 1.5, border: '1px solid var(--line)' },
  messageContent: { display: 'flex', flexDirection: 'column', gap: 4, whiteSpace: 'pre-wrap' },
  draftCard: { marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--bg-1)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 8 },
  draftPhaseItem: { display: 'flex', flexDirection: 'column', gap: 2, padding: '7px 9px', background: 'var(--bg-2)', borderRadius: 8 },
  draftPhaseHead: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  draftPhaseName: { fontSize: 13, fontWeight: 700, color: 'var(--fg)' },
  draftPhaseDates: { fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' },
  draftPhaseDesc: { fontSize: 12, color: 'var(--fg-2)' },
  draftPhaseMastery: { fontSize: 11, color: 'var(--accent)', marginTop: 2 },
  confirmRow: { marginTop: 10 },
  applyBtn: { padding: '8px 14px', borderRadius: 999, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)', cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  draftSlotTable: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' },
  draftSlotDay: { display: 'flex', flexDirection: 'column', gap: 3, padding: '7px 9px', background: 'var(--bg-2)', borderRadius: 8 },
  draftSlotDate: { fontSize: 12, fontWeight: 700, color: 'var(--fg)' },
  slotRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '2px 0' },
  slotLabel: { fontSize: 12, color: 'var(--fg-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  slotHours: { color: 'var(--accent)', fontWeight: 600 },
  slotActions: { display: 'flex', gap: 4, flexShrink: 0 },
  slotEditRow: { display: 'flex', alignItems: 'center', gap: 4 },
  editInput: { width: 40, fontSize: 12, border: '1px solid var(--line)', borderRadius: 4, padding: '2px 4px', background: 'var(--bg-1)', color: 'var(--fg)', outline: 'none' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--fg-2)', display: 'flex', alignItems: 'center' },
  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', borderTop: '1px solid var(--line)' },
  chip: { padding: '6px 10px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 12 },
  inputRow: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--line)', background: 'var(--bg-1)' },
  textarea: { flex: 1, resize: 'none', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', color: 'var(--fg)', padding: '8px 10px', outline: 'none', fontSize: 13, lineHeight: 1.5 },
  sendBtn: { width: 38, borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'var(--accent-ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
