'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  BookOpen, X, ChevronRight, ChevronLeft, Check,
  BarChart2, BookMarked, CalendarDays, Settings2,
  Clock, AlertCircle, Plus, Trash2, Send, Sparkles, Upload,
} from 'lucide-react';
import { studyPlanAPI } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ExamType = 'national_exam' | 'postgraduate' | 'ielts' | 'custom';

interface Chapter { title: string; estimatedHours: number; source?: string }
interface SubjectDraft { name: string; weight: number; level: string; chapters: Chapter[] }
interface OnboardingData {
  examType: ExamType;
  examName: string;
  examDate: string;
  employmentType: string;
  weekdayHours: number;
  weekendHours: number;
  subjects: SubjectDraft[];
}

interface TodaySlot {
  id: string;
  subjectName: string;
  chapterTitle: string;
  plannedHours: number;
  status: string;
  taskId?: string | null;
}

interface PlanStats {
  totalSlots: number;
  completedSlots: number;
  completionRate: number;
  plannedHours: number;
  actualHours: number;
}

interface WeeklyPlan {
  id: string;
  weekNumber: number;
  phase: string;
  weekStart: string;
  weekEnd: string;
  targetHours: number;
  actualHours: number;
  completionRate: number;
  status: string;
}

interface PlanDetail {
  id: string;
  title: string;
  examName: string;
  examDate: string;
  status: string;
  weekdayHours: number;
  weekendHours: number;
  subjects: Array<{
    id: string;
    name: string;
    weight: number;
    level: string;
    chapters: Array<{
      id: string;
      title: string;
      estimatedHours: number;
      actualHours: number;
      status: string;
    }>;
  }>;
}

// ─── Exam templates ──────────────────────────────────────────────────────────

const EXAM_TEMPLATES: Record<ExamType, { label: string; icon: string; subjects: SubjectDraft[] }> = {
  national_exam: {
    label: '国考 / 省考',
    icon: '🏛️',
    subjects: [
      { name: '行测', weight: 0.6, level: 'beginner', chapters: [
        { title: '数量关系', estimatedHours: 12 },
        { title: '言语理解', estimatedHours: 10 },
        { title: '资料分析', estimatedHours: 10 },
        { title: '判断推理', estimatedHours: 12 },
        { title: '常识判断', estimatedHours: 6 },
      ]},
      { name: '申论', weight: 0.4, level: 'beginner', chapters: [
        { title: '归纳概括', estimatedHours: 8 },
        { title: '综合分析', estimatedHours: 10 },
        { title: '提出对策', estimatedHours: 8 },
        { title: '大作文', estimatedHours: 14 },
      ]},
    ],
  },
  postgraduate: {
    label: '考研',
    icon: '🎓',
    subjects: [
      { name: '数学', weight: 0.3, level: 'beginner', chapters: [
        { title: '高等数学', estimatedHours: 40 },
        { title: '线性代数', estimatedHours: 20 },
        { title: '概率论', estimatedHours: 15 },
      ]},
      { name: '英语', weight: 0.25, level: 'beginner', chapters: [
        { title: '词汇积累', estimatedHours: 15 },
        { title: '阅读理解', estimatedHours: 20 },
        { title: '写作训练', estimatedHours: 10 },
      ]},
      { name: '政治', weight: 0.2, level: 'beginner', chapters: [
        { title: '马克思主义原理', estimatedHours: 10 },
        { title: '毛中特', estimatedHours: 10 },
        { title: '史纲 + 思修', estimatedHours: 8 },
      ]},
      { name: '专业课', weight: 0.25, level: 'beginner', chapters: [
        { title: '专业课复习', estimatedHours: 40 },
      ]},
    ],
  },
  ielts: {
    label: '雅思 / 托福',
    icon: '🌍',
    subjects: [
      { name: '听力', weight: 0.25, level: 'beginner', chapters: [{ title: '听力训练', estimatedHours: 20 }] },
      { name: '阅读', weight: 0.25, level: 'beginner', chapters: [{ title: '阅读训练', estimatedHours: 20 }] },
      { name: '写作', weight: 0.25, level: 'beginner', chapters: [{ title: '写作训练', estimatedHours: 20 }] },
      { name: '口语', weight: 0.25, level: 'beginner', chapters: [{ title: '口语训练', estimatedHours: 15 }] },
    ],
  },
  custom: {
    label: '自定义目标',
    icon: '✏️',
    subjects: [{ name: '科目一', weight: 1, level: 'beginner', chapters: [{ title: '章节一', estimatedHours: 10 }] }],
  },
};

// Parse a date-only value (ISO string or YYYY-MM-DD) into a local-time Date,
// avoiding the UTC-midnight timezone shift that breaks East Asia timezones.
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const s = typeof value === 'string' ? value : String(value);
  // "2025-11-30" or "2025-11-30T00:00:00.000Z" → treat as local date
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysUntil(value: string | null | undefined): number {
  const d = parseDate(value);
  if (!d) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((d.getTime() - today.getTime()) / 86400000));
}

function fmtDate(value: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  const d = parseDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('zh-CN', opts ?? { year: 'numeric', month: 'long', day: 'numeric' });
}

function toDateInputValue(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PHASE_LABELS: Record<string, string> = {
  foundation: '基础期',
  specialized: '专项期',
  intensive: '强化期',
  sprint: '冲刺期',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: '零基础',
  intermediate: '有基础',
  advanced: '较强',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--text-secondary)',
  injected: '#3b82f6',
  completed: '#22c55e',
  skipped: '#f59e0b',
  rescheduled: '#a855f7',
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent 30%)',
  background: 'color-mix(in srgb, var(--bg-primary) 90%, black 10%)',
  padding: '0.75rem',
  ...extra,
});

const btn = (variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'secondary'): React.CSSProperties => {
  const base: React.CSSProperties = {
    borderRadius: 10,
    padding: '0.45rem 0.8rem',
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  };
  if (variant === 'primary') return { ...base, background: 'var(--accent-primary)', color: '#fff', border: '1px solid var(--accent-primary)' };
  if (variant === 'danger') return { ...base, background: 'color-mix(in srgb, #ef4444 15%, var(--bg-primary) 85%)', color: '#ef4444', border: '1px solid color-mix(in srgb, #ef4444 35%, transparent 65%)' };
  if (variant === 'ghost') return { ...base, background: 'transparent', color: 'var(--text-secondary)' };
  return { ...base, background: 'color-mix(in srgb, var(--accent-primary) 12%, var(--bg-primary) 88%)', color: 'var(--text-primary)', border: '1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent 60%)' };
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent 30%)',
  background: 'color-mix(in srgb, var(--bg-primary) 90%, black 10%)',
  color: 'var(--text-primary)',
  padding: '0.5rem 0.7rem',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
};

// ─── AI Assist Bar ────────────────────────────────────────────────────────────

interface AiMessage { role: 'ai' | 'user'; text: string }

const STEP_HINTS: Record<string, string[]> = {
  exam_type: [
    '你在备考什么考试？直接告诉我，我帮你自动填写科目。',
    '比如说"我要考2026年国考"，我会帮你预填考试名称和大纲科目。',
  ],
  exam_info: [
    '帮我查一下考试时间，或者直接告诉我你的考试日期。',
    '比如"国考笔试一般在11月下旬"，我可以帮你估算并填入日期。',
  ],
  schedule: [
    '每天能花多少时间备考？告诉我你的情况，我来推荐合理的每日学习量。',
    '比如"我在职，工作日只有2小时，周末能学8小时"。',
  ],
  subjects: [
    '如果你有网课资源，可以上传截图，我来识别科目和章节。',
    '也可以直接告诉我需要增减哪些章节，比如"行测去掉数量关系，因为太难了"。',
  ],
};

function AiAssistBar({
  step,
  context,
  onPatch,
}: {
  step: string;
  context: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hintIdx, setHintIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // rotate hint every 6s when idle
  useEffect(() => {
    const hints = STEP_HINTS[step] || [];
    if (hints.length <= 1) return;
    const t = setInterval(() => setHintIdx((i) => (i + 1) % hints.length), 6000);
    return () => clearInterval(t);
  }, [step]);

  // scroll to bottom on new message
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async (msg?: string) => {
    const text = (msg ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setExpanded(true);
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await studyPlanAPI.aiAssist({ step, userMessage: text, context });
      const { reply, patch } = res.data as { reply: string; patch: Record<string, unknown> | null };
      setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
      if (patch && Object.keys(patch).length > 0) onPatch(patch);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: '暂时无法连接 AI 服务，请稍后再试。' }]);
    } finally {
      setLoading(false);
    }
  };

  const hints = STEP_HINTS[step] || [];
  const currentHint = hints[hintIdx % hints.length] || '';

  return (
    <div style={{
      borderRadius: 12,
      border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, var(--border-color) 70%)',
      background: 'color-mix(in srgb, var(--accent-primary) 4%, var(--bg-primary) 96%)',
      marginBottom: '1rem',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '0.55rem 0.75rem', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Sparkles size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', flex: 1, lineHeight: 1.4 }}>
          {messages.length === 0 ? currentHint : `AI 助手（${messages.length} 条消息）`}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <>
          {/* Message list */}
          {messages.length > 0 && (
            <div ref={listRef} style={{
              maxHeight: 180, overflowY: 'auto', padding: '0 0.75rem 0.5rem',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '88%', padding: '0.4rem 0.65rem', borderRadius: 10, fontSize: '0.82rem',
                    background: m.role === 'user'
                      ? 'color-mix(in srgb, var(--accent-primary) 20%, var(--bg-primary) 80%)'
                      : 'color-mix(in srgb, var(--bg-secondary) 80%, var(--bg-primary) 20%)',
                    color: 'var(--text-primary)',
                    border: m.role === 'user'
                      ? '1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent 60%)'
                      : '1px solid color-mix(in srgb, var(--border-color) 60%, transparent 40%)',
                    lineHeight: 1.45,
                  }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.2rem 0' }}>
                  <Sparkles size={12} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>思考中...</span>
                </div>
              )}
            </div>
          )}

          {/* Hint chips */}
          {messages.length === 0 && (
            <div style={{ padding: '0 0.75rem 0.5rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hints.slice(0, 2).map((h, i) => (
                <button key={i} onClick={() => send(h)} style={{
                  fontSize: '0.75rem', padding: '0.28rem 0.6rem', borderRadius: 20, cursor: 'pointer',
                  background: 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-primary) 90%)',
                  border: '1px solid color-mix(in srgb, var(--accent-primary) 35%, transparent 65%)',
                  color: 'var(--text-secondary)',
                }}>
                  {h.length > 28 ? h.slice(0, 28) + '…' : h}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 6, padding: '0 0.75rem 0.65rem' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="输入消息，AI 帮你填写…"
              disabled={loading}
              style={{
                ...inputStyle, flex: 1, fontSize: '0.82rem', padding: '0.38rem 0.6rem',
              }}
            />
            <button
              onClick={() => void send()}
              disabled={!input.trim() || loading}
              style={{
                ...btn('primary'), padding: '0.38rem 0.6rem', display: 'flex', alignItems: 'center',
                opacity: (!input.trim() || loading) ? 0.5 : 1,
              }}
            >
              <Send size={13} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── OCR Upload Button ────────────────────────────────────────────────────────

function OcrUploadZone({ onExtracted }: { onExtracted: (subjects: SubjectDraft[]) => void }) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('请上传图片文件'); return; }
    setStatus('uploading');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        // Send raw text placeholder — real OCR would call a vision endpoint
        // For now we post the file name as rawText and let backend parse
        const res = await studyPlanAPI.uploadOcr({
          imageUrl: reader.result as string,
          rawText: `[图片文件: ${file.name}]`,
        });
        const uploadId = res.data?.id;
        if (uploadId) {
          // Auto-confirm with empty chapters — server stub returns parsed chapters
          const confirm = await studyPlanAPI.confirmOcr(uploadId, { chapters: [] });
          const chapters = confirm.data?.chapters || [];
          if (chapters.length > 0) {
            onExtracted([{ name: '识别科目', weight: 1, level: 'beginner', chapters }]);
            setStatus('done');
          } else {
            setStatus('done');
          }
        } else {
          setStatus('done');
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setStatus('error');
    }
  };

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={status === 'uploading'}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '0.6rem', borderRadius: 10, cursor: 'pointer',
          border: '1.5px dashed color-mix(in srgb, var(--accent-primary) 40%, var(--border-color) 60%)',
          background: 'color-mix(in srgb, var(--accent-primary) 4%, var(--bg-primary) 96%)',
          color: 'var(--text-secondary)', fontSize: '0.82rem',
        }}
      >
        <Upload size={14} style={{ color: 'var(--accent-primary)' }} />
        {status === 'uploading' ? 'OCR 识别中...' : status === 'done' ? '✓ 识别完成，已追加科目' : status === 'error' ? '识别失败，请重试' : '上传网课截图 / 大纲图片识别科目'}
      </button>
    </div>
  );
}

// ─── Onboarding Wizard ───────────────────────────────────────────────────────

function OnboardingWizard({ onCreated }: { onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    examType: 'national_exam',
    examName: '2025国家公务员考试',
    examDate: '',
    employmentType: 'fulltime',
    weekdayHours: 3,
    weekendHours: 6,
    subjects: EXAM_TEMPLATES.national_exam.subjects,
  });

  const applyPatch = (patch: Record<string, unknown>) => {
    setData((prev) => {
      const next = { ...prev };
      if (patch.examName && typeof patch.examName === 'string') next.examName = patch.examName;
      if (patch.examDate && typeof patch.examDate === 'string') next.examDate = patch.examDate;
      if (patch.employmentType && (patch.employmentType === 'fulltime' || patch.employmentType === 'employed')) next.employmentType = patch.employmentType;
      if (patch.weekdayHours && typeof patch.weekdayHours === 'number') next.weekdayHours = Math.max(1, Math.min(12, patch.weekdayHours));
      if (patch.weekendHours && typeof patch.weekendHours === 'number') next.weekendHours = Math.max(1, Math.min(16, patch.weekendHours));
      if (Array.isArray(patch.subjects) && patch.subjects.length > 0) next.subjects = patch.subjects as SubjectDraft[];
      if (patch.examType && typeof patch.examType === 'string' && patch.examType in EXAM_TEMPLATES) {
        const type = patch.examType as ExamType;
        next.examType = type;
        if (!patch.subjects) next.subjects = EXAM_TEMPLATES[type].subjects;
      }
      return next;
    });
  };

  const selectExamType = (type: ExamType) => {
    const tpl = EXAM_TEMPLATES[type];
    setData((prev) => ({
      ...prev,
      examType: type,
      examName: type === 'custom' ? '' : tpl.label,
      subjects: tpl.subjects,
    }));
    setStep(1);
  };

  const addChapter = (sIdx: number) => {
    setData((prev) => {
      const subjects = prev.subjects.map((s, i) =>
        i === sIdx ? { ...s, chapters: [...s.chapters, { title: '新章节', estimatedHours: 5 }] } : s
      );
      return { ...prev, subjects };
    });
  };

  const removeChapter = (sIdx: number, cIdx: number) => {
    setData((prev) => {
      const subjects = prev.subjects.map((s, i) =>
        i === sIdx ? { ...s, chapters: s.chapters.filter((_, j) => j !== cIdx) } : s
      );
      return { ...prev, subjects };
    });
  };

  const updateChapter = (sIdx: number, cIdx: number, field: 'title' | 'estimatedHours', value: string | number) => {
    setData((prev) => {
      const subjects = prev.subjects.map((s, i) =>
        i === sIdx
          ? { ...s, chapters: s.chapters.map((c, j) => j === cIdx ? { ...c, [field]: value } : c) }
          : s
      );
      return { ...prev, subjects };
    });
  };

  const handleCreate = async () => {
    if (!data.examDate) { alert('请选择考试日期'); return; }
    setSaving(true);
    try {
      await studyPlanAPI.createPlan({
        title: `${data.examName} 备考计划`,
        examType: data.examType,
        examName: data.examName,
        examDate: data.examDate,
        employmentType: data.employmentType,
        weekdayHours: data.weekdayHours,
        weekendHours: data.weekendHours,
        holidayEnabled: true,
        subjects: data.subjects,
      });
      onCreated();
    } catch {
      alert('创建失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const totalHours = data.subjects.reduce((s, sub) =>
    s + sub.chapters.reduce((t, c) => t + (Number(c.estimatedHours) || 0), 0), 0);

  const daysLeft = daysUntil(data.examDate);

  return (
    <div style={{ padding: '0 1rem 1.5rem', flex: 1, overflowY: 'auto' }}>
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '1rem 0 1.25rem' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{
            width: i === step ? 20 : 8, height: 8, borderRadius: 4,
            background: i <= step ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--border-color) 80%, transparent 20%)',
            transition: 'all 0.2s',
          }} />
        ))}
      </div>

      {/* Step 0: 选择考试类型 */}
      {step === 0 && (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>你在准备什么？</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>选择后会自动预填科目和章节</div>
          <AiAssistBar step="exam_type" context={data as unknown as Record<string, unknown>} onPatch={(patch) => { applyPatch(patch); if (patch.examType || patch.examName) setStep(1); }} />
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {(Object.entries(EXAM_TEMPLATES) as [ExamType, typeof EXAM_TEMPLATES[ExamType]][]).map(([type, tpl]) => (
              <button key={type} onClick={() => selectExamType(type)} style={{
                ...card(),
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent 30%)',
                textAlign: 'left', width: '100%',
              }}>
                <span style={{ fontSize: '1.6rem' }}>{tpl.icon}</span>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{tpl.label}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    {tpl.subjects.length} 个科目
                  </div>
                </div>
                <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: 考试信息 */}
      {step === 1 && (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>考试信息</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>填写考试名称和笔试日期</div>
          <AiAssistBar step="exam_info" context={data as unknown as Record<string, unknown>} onPatch={applyPatch} />
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>考试名称</div>
              <input
                style={inputStyle}
                value={data.examName}
                onChange={(e) => setData((p) => ({ ...p, examName: e.target.value }))}
                placeholder="如：2025国家公务员考试"
              />
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>笔试日期</div>
              <input
                type="date"
                style={inputStyle}
                value={data.examDate}
                onChange={(e) => setData((p) => ({ ...p, examDate: e.target.value }))}
              />
            </div>
            {data.examDate && daysLeft > 0 && (
              <div style={{ ...card({ padding: '0.6rem 0.75rem', background: 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-primary) 92%)' }), display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={14} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>距考试还有 <strong>{daysLeft}</strong> 天</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
            <button style={btn('ghost')} onClick={() => setStep(0)}><ChevronLeft size={14} /></button>
            <button style={{ ...btn('primary'), flex: 1 }} onClick={() => setStep(2)} disabled={!data.examDate || !data.examName}>
              下一步
            </button>
          </div>
        </div>
      )}

      {/* Step 2: 个人情况 */}
      {step === 2 && (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>你的情况</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>用于计算每天的学习量</div>
          <AiAssistBar step="schedule" context={data as unknown as Record<string, unknown>} onPatch={applyPatch} />
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>备考状态</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[{ value: 'fulltime', label: '🏠 全职备考' }, { value: 'employed', label: '💼 在职备考' }].map((opt) => (
                  <button key={opt.value} onClick={() => setData((p) => ({ ...p, employmentType: opt.value }))} style={{
                    ...card({ padding: '0.65rem' }),
                    cursor: 'pointer', textAlign: 'center', fontSize: '0.88rem', fontWeight: 600,
                    color: data.employmentType === opt.value ? 'var(--accent-primary)' : 'var(--text-primary)',
                    border: `1px solid ${data.employmentType === opt.value ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--border-color) 70%, transparent 30%)'}`,
                    background: data.employmentType === opt.value ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-primary) 90%)' : 'color-mix(in srgb, var(--bg-primary) 90%, black 10%)',
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>工作日每天可用（小时）</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, 4, 5, 6].map((h) => (
                  <button key={h} onClick={() => setData((p) => ({ ...p, weekdayHours: h }))} style={{
                    flex: 1, padding: '0.45rem 0', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${data.weekdayHours === h ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--border-color) 70%, transparent 30%)'}`,
                    background: data.weekdayHours === h ? 'color-mix(in srgb, var(--accent-primary) 15%, var(--bg-primary) 85%)' : 'color-mix(in srgb, var(--bg-primary) 90%, black 10%)',
                    color: data.weekdayHours === h ? 'var(--accent-primary)' : 'var(--text-primary)',
                  }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>周末每天可用（小时）</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[2, 4, 6, 8, 10].map((h) => (
                  <button key={h} onClick={() => setData((p) => ({ ...p, weekendHours: h }))} style={{
                    flex: 1, padding: '0.45rem 0', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${data.weekendHours === h ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--border-color) 70%, transparent 30%)'}`,
                    background: data.weekendHours === h ? 'color-mix(in srgb, var(--accent-primary) 15%, var(--bg-primary) 85%)' : 'color-mix(in srgb, var(--bg-primary) 90%, black 10%)',
                    color: data.weekendHours === h ? 'var(--accent-primary)' : 'var(--text-primary)',
                  }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
            <button style={btn('ghost')} onClick={() => setStep(1)}><ChevronLeft size={14} /></button>
            <button style={{ ...btn('primary'), flex: 1 }} onClick={() => setStep(3)}>下一步</button>
          </div>
        </div>
      )}

      {/* Step 3: 科目设置 */}
      {step === 3 && (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>科目 & 章节</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>根据你的资料调整章节和预计时长</div>
          <OcrUploadZone onExtracted={(newSubjects) => setData((p) => ({ ...p, subjects: [...p.subjects, ...newSubjects] }))} />
          <AiAssistBar step="subjects" context={data as unknown as Record<string, unknown>} onPatch={applyPatch} />
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {data.subjects.map((subject, sIdx) => (
              <div key={sIdx} style={card()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.92rem' }}>{subject.name}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    权重 {Math.round(subject.weight * 100)}%
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {subject.chapters.map((chapter, cIdx) => (
                    <div key={cIdx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        style={{ ...inputStyle, flex: 1, fontSize: '0.82rem', padding: '0.38rem 0.55rem' }}
                        value={chapter.title}
                        onChange={(e) => updateChapter(sIdx, cIdx, 'title', e.target.value)}
                      />
                      <input
                        type="number"
                        min={1}
                        max={200}
                        style={{ ...inputStyle, width: 56, fontSize: '0.82rem', padding: '0.38rem 0.45rem', textAlign: 'center' }}
                        value={chapter.estimatedHours}
                        onChange={(e) => updateChapter(sIdx, cIdx, 'estimatedHours', Number(e.target.value) || 1)}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>h</span>
                      <button onClick={() => removeChapter(sIdx, cIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, display: 'flex' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addChapter(sIdx)} style={{ ...btn('ghost'), marginTop: 6, fontSize: '0.78rem', padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={12} /> 添加章节
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
            <button style={btn('ghost')} onClick={() => setStep(2)}><ChevronLeft size={14} /></button>
            <button style={{ ...btn('primary'), flex: 1 }} onClick={() => setStep(4)}>下一步</button>
          </div>
        </div>
      )}

      {/* Step 4: 确认生成 */}
      {step === 4 && (
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>确认生成计划</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>生成后可在设置中修改</div>
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <div style={card({ padding: '0.65rem 0.75rem' })}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>考试</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.examName}</div>
            </div>
            <div style={card({ padding: '0.65rem 0.75rem' })}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>笔试日期</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.examDate} （剩余 {daysLeft} 天）</div>
            </div>
            <div style={card({ padding: '0.65rem 0.75rem' })}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>每日投入</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                工作日 {data.weekdayHours}h · 周末 {data.weekendHours}h
              </div>
            </div>
            <div style={card({ padding: '0.65rem 0.75rem' })}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>科目 / 总学时</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {data.subjects.map((s) => s.name).join(' + ')} · 共 {totalHours}h
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem' }}>
            <button style={btn('ghost')} onClick={() => setStep(3)}><ChevronLeft size={14} /></button>
            <button style={{ ...btn('primary'), flex: 1 }} onClick={handleCreate} disabled={saving}>
              {saving ? '生成中...' : '✨ 生成学习计划'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ planId, plan }: { planId: string; plan: PlanDetail }) {
  const [todaySlots, setTodaySlots] = useState<TodaySlot[]>([]);
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [injectingAll, setInjectingAll] = useState(false);
  const [lastWeek, setLastWeek] = useState<WeeklyPlan | null>(null);
  const [currentWeek, setCurrentWeek] = useState<WeeklyPlan | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [slotsRes, statsRes, weeksRes] = await Promise.all([
        studyPlanAPI.getTodaySlots(planId),
        studyPlanAPI.getPlanStats(planId),
        studyPlanAPI.getWeeklyPlans(planId),
      ]);
      setTodaySlots(slotsRes.data || []);
      setStats(statsRes.data);
      // Identify current/last week
      const todayTs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
      const ws: WeeklyPlan[] = weeksRes.data || [];
      const curIdx = ws.findIndex(w => {
        const s = parseDate(w.weekStart)?.getTime() ?? 0;
        const e = parseDate(w.weekEnd)?.getTime() ?? 0;
        return s <= todayTs && todayTs <= e;
      });
      setCurrentWeek(curIdx >= 0 ? ws[curIdx] : null);
      setLastWeek(curIdx > 0 ? ws[curIdx - 1] : null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleSlotAction = async (slotId: string, action: 'inject' | 'skip' | 'complete') => {
    if (action === 'inject') await studyPlanAPI.injectSlot(planId, slotId);
    if (action === 'skip') await studyPlanAPI.skipSlot(planId, slotId);
    if (action === 'complete') await studyPlanAPI.completeSlot(planId, slotId);
    void loadData();
  };

  const handleInjectAll = async () => {
    setInjectingAll(true);
    try {
      await studyPlanAPI.injectToday();
      void loadData();
    } finally {
      setInjectingAll(false);
    }
  };

  const daysLeft = daysUntil(plan.examDate);
  const completionRate = stats ? Math.round(stats.completionRate * 100) : 0;
  const pendingSlots = todaySlots.filter((s) => s.status === 'pending');

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>加载中...</div>;

  return (
    <div style={{ padding: '0 1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
      {/* 核心指标 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '0.9rem' }}>
        <div style={card({ padding: '0.65rem 0.75rem' })}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>距考试</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>{daysLeft} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>天</span></div>
        </div>
        <div style={card({ padding: '0.65rem 0.75rem' })}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>总完成率</div>
          <div style={{ color: completionRate >= 70 ? '#22c55e' : completionRate >= 40 ? '#f59e0b' : 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>{completionRate}<span style={{ fontSize: '0.8rem', fontWeight: 400 }}>%</span></div>
        </div>
      </div>

      {/* 进度条 */}
      <div style={{ ...card(), marginBottom: '0.9rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>总进度</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            {stats?.completedSlots ?? 0} / {stats?.totalSlots ?? 0} 槽位
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'color-mix(in srgb, var(--border-color) 60%, transparent 40%)' }}>
          <div style={{ height: '100%', borderRadius: 3, background: 'var(--accent-primary)', width: `${completionRate}%`, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* 上周完成率警告 */}
      {lastWeek && (lastWeek.completionRate ?? 0) < 0.7 && (
        <div style={{
          ...card({ padding: '0.6rem 0.8rem' }),
          marginBottom: '0.9rem',
          background: 'color-mix(in srgb, #f59e0b 8%, var(--bg-primary) 92%)',
          border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent 70%)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <AlertCircle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 700, marginBottom: 2 }}>
              上周完成率 {Math.round((lastWeek.completionRate ?? 0) * 100)}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              本周需追回约 {((lastWeek.targetHours ?? 0) - (lastWeek.actualHours ?? 0)).toFixed(1)}h，建议适当增加每日学习时间。
            </div>
          </div>
        </div>
      )}

      {/* 今日任务 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>今日学习任务</span>
        {pendingSlots.length > 0 && (
          <button style={{ ...btn('primary'), fontSize: '0.78rem', padding: '0.32rem 0.65rem' }} onClick={handleInjectAll} disabled={injectingAll}>
            {injectingAll ? '注入中...' : '全部加入任务'}
          </button>
        )}
      </div>

      {todaySlots.length === 0 ? (
        <div style={{ ...card({ padding: '1.25rem' }), textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          今天没有学习任务 🎉
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {todaySlots.map((slot) => (
            <div key={slot.id} style={card()}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: slot.status === 'completed' || slot.status === 'skipped' ? 0 : 8 }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.88rem' }}>
                    {slot.subjectName} · {slot.chapterTitle}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{slot.plannedHours}h</span>
                    <span style={{ color: STATUS_COLORS[slot.status] || 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
                      {slot.status === 'completed' ? '✓ 已完成' : slot.status === 'skipped' ? '跳过' : slot.status === 'injected' ? '已加入任务' : '待执行'}
                    </span>
                  </div>
                </div>
              </div>
              {slot.status !== 'completed' && slot.status !== 'skipped' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {slot.status === 'pending' && (
                    <button style={{ ...btn(), fontSize: '0.78rem', padding: '0.28rem 0.55rem' }} onClick={() => handleSlotAction(slot.id, 'inject')}>
                      加入任务
                    </button>
                  )}
                  <button style={{ ...btn(), fontSize: '0.78rem', padding: '0.28rem 0.55rem' }} onClick={() => handleSlotAction(slot.id, 'complete')}>
                    <Check size={12} style={{ marginRight: 3 }} />完成
                  </button>
                  <button style={{ ...btn('ghost'), fontSize: '0.78rem', padding: '0.28rem 0.55rem' }} onClick={() => handleSlotAction(slot.id, 'skip')}>
                    顺延
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Subjects Tab ─────────────────────────────────────────────────────────────

function SubjectsTab({ plan }: { plan: PlanDetail }) {
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  return (
    <div style={{ padding: '0 1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        {plan.subjects.map((subject) => {
          const completed = subject.chapters.filter((c) => c.status === 'completed').length;
          const total = subject.chapters.length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
          const totalH = subject.chapters.reduce((s, c) => s + (c.estimatedHours ?? 0), 0);
          const actualH = subject.chapters.reduce((s, c) => s + (c.actualHours ?? 0), 0);
          const expanded = expandedSubject === subject.id;

          return (
            <div key={subject.id} style={card()}>
              <button
                onClick={() => setExpandedSubject(expanded ? null : subject.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{subject.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>{actualH.toFixed(1)}h / {totalH}h</span>
                    <span style={{ color: pct >= 70 ? '#22c55e' : 'var(--accent-primary)', fontWeight: 700, fontSize: '0.85rem' }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'color-mix(in srgb, var(--border-color) 60%, transparent 40%)' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: pct >= 70 ? '#22c55e' : 'var(--accent-primary)', width: `${pct}%`, transition: 'width 0.4s' }} />
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 4 }}>
                  {completed}/{total} 章节完成 · 权重 {Math.round(subject.weight * 100)}% · {LEVEL_LABELS[subject.level] || subject.level}
                </div>
              </button>

              {expanded && (
                <div style={{ marginTop: '0.75rem', display: 'grid', gap: 6, borderTop: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent 50%)', paddingTop: '0.75rem' }}>
                  {subject.chapters.map((chapter) => (
                    <div key={chapter.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: chapter.status === 'completed' ? '#22c55e' : chapter.status === 'in_progress' ? 'var(--accent-primary)' : 'color-mix(in srgb, var(--border-color) 80%, transparent 20%)',
                          flexShrink: 0,
                        }} />
                        <span style={{ color: chapter.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)', fontSize: '0.84rem',
                          textDecoration: chapter.status === 'completed' ? 'line-through' : 'none' }}>
                          {chapter.title}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', flexShrink: 0 }}>
                        {(chapter.actualHours ?? 0) > 0 ? `${(chapter.actualHours).toFixed(1)}/` : ''}{chapter.estimatedHours}h
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weekly Tab ───────────────────────────────────────────────────────────────

interface DailySlotDetail {
  id: string;
  date: string;
  subjectName: string;
  chapterTitle: string;
  plannedHours: number;
  status: string;
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function WeeklyTab({ planId }: { planId: string }) {
  const [weeks, setWeeks] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [weekSlots, setWeekSlots] = useState<DailySlotDetail[]>([]);
  const [weekDetailLoading, setWeekDetailLoading] = useState(false);

  useEffect(() => {
    studyPlanAPI.getWeeklyPlans(planId).then((res) => {
      const data: WeeklyPlan[] = res.data || [];
      setWeeks(data);
      setLoading(false);
      // Auto-expand current week
      const todayTs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
      const cur = data.find(w => {
        const s = parseDate(w.weekStart)?.getTime() ?? 0;
        const e = parseDate(w.weekEnd)?.getTime() ?? 0;
        return s <= todayTs && todayTs <= e;
      });
      if (cur) setExpandedWeek(cur.weekNumber);
    });
  }, [planId]);

  const loadWeekDetail = async (weekNumber: number) => {
    setWeekDetailLoading(true);
    try {
      const res = await studyPlanAPI.getWeekDetail(planId, weekNumber);
      setWeekSlots(res.data?.dailySlots || []);
    } finally {
      setWeekDetailLoading(false);
    }
  };

  const handleToggleWeek = (weekNumber: number) => {
    if (expandedWeek === weekNumber) {
      setExpandedWeek(null);
      setWeekSlots([]);
    } else {
      setExpandedWeek(weekNumber);
      loadWeekDetail(weekNumber);
    }
  };

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>加载中...</div>;

  const todayTs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();

  return (
    <div style={{ padding: '0 1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        {weeks.map((week) => {
          const startTs = parseDate(week.weekStart)?.getTime() ?? 0;
          const endTs = parseDate(week.weekEnd)?.getTime() ?? 0;
          const isCurrentWeek = startTs <= todayTs && todayTs <= endTs;
          const pct = Math.round((week.completionRate || 0) * 100);
          const isExpanded = expandedWeek === week.weekNumber;

          // Build 7-day cells for this week
          const dayCells: { label: string; dateStr: string; ts: number }[] = [];
          if (isExpanded) {
            for (let i = 0; i < 7; i++) {
              const d = new Date(startTs + i * 86400000);
              const label = DAY_LABELS[d.getDay()];
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              dayCells.push({ label, dateStr, ts: d.getTime() });
            }
          }

          return (
            <div key={week.id} style={{
              ...card(),
              border: isCurrentWeek ? '1px solid color-mix(in srgb, var(--accent-primary) 50%, transparent 50%)' : undefined,
              background: isCurrentWeek ? 'color-mix(in srgb, var(--accent-primary) 6%, var(--bg-primary) 94%)' : undefined,
            }}>
              <button
                onClick={() => handleToggleWeek(week.weekNumber)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.88rem' }}>
                      第 {week.weekNumber} 周
                    </span>
                    {isCurrentWeek && (
                      <span style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: '0.7rem', fontWeight: 600 }}>
                        本周
                      </span>
                    )}
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {PHASE_LABELS[week.phase] || week.phase}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: pct >= 70 ? '#22c55e' : pct > 0 ? '#f59e0b' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.85rem' }}>
                      {pct}%
                    </span>
                    <ChevronRight size={14} style={{ color: 'var(--text-secondary)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'color-mix(in srgb, var(--border-color) 60%, transparent 40%)', marginBottom: 4 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: pct >= 70 ? '#22c55e' : 'var(--accent-primary)', width: `${pct}%` }} />
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {(week.actualHours ?? 0).toFixed(1)}h / {week.targetHours ?? 0}h · {fmtDate(week.weekStart, { month: 'numeric', day: 'numeric' })} - {fmtDate(week.weekEnd, { month: 'numeric', day: 'numeric' })}
                </div>
              </button>
              {isCurrentWeek && (week.completionRate ?? 0) < 0.7 && (week.actualHours ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#f59e0b', fontSize: '0.78rem' }}>
                  <AlertCircle size={12} />
                  完成率偏低，建议适当增加今日学习时间
                </div>
              )}

              {/* 7-day grid */}
              {isExpanded && (
                <div style={{ marginTop: 10, borderTop: '1px solid color-mix(in srgb, var(--border-color) 50%, transparent 50%)', paddingTop: 10 }}>
                  {weekDetailLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '0.5rem 0' }}>加载中...</div>
                  ) : (
                    <>
                      {/* 7-cell header row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
                        {dayCells.map(({ label, dateStr, ts }) => {
                          const isToday = ts === todayTs;
                          const daySlots = weekSlots.filter((s) => {
                            if (!s.date) return false;
                            const raw = s.date as unknown;
                            if (typeof raw === 'string') return raw.slice(0, 10) === dateStr;
                            const d = raw && typeof raw === 'object' && raw instanceof Date ? raw : new Date(String(raw));
                            if (Number.isNaN(d.getTime())) return false;
                            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            return key === dateStr;
                          });
                          const dayH = daySlots.reduce((sum, s) => sum + (s.plannedHours || 0), 0);
                          const allDone = daySlots.length > 0 && daySlots.every(s => s.status === 'completed');
                          return (
                            <div key={dateStr} style={{
                              textAlign: 'center',
                              borderRadius: 8,
                              padding: '0.3rem 0',
                              background: isToday
                                ? 'color-mix(in srgb, var(--accent-primary) 15%, var(--bg-secondary) 85%)'
                                : 'var(--bg-secondary)',
                              border: isToday ? '1px solid color-mix(in srgb, var(--accent-primary) 40%, transparent 60%)' : '1px solid color-mix(in srgb, var(--border-color) 40%, transparent 60%)',
                            }}>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: isToday ? 700 : 400 }}>
                                周{label}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: isToday ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: 700, margin: '1px 0' }}>
                                {daySlots.length > 0 ? `${dayH}h` : '–'}
                              </div>
                              <div style={{
                                width: 6, height: 6, borderRadius: '50%', margin: '0 auto',
                                background: allDone ? '#22c55e' : daySlots.length > 0 ? 'var(--accent-primary)' : 'transparent',
                              }} />
                            </div>
                          );
                        })}
                      </div>
                      {/* Slot list for the week */}
                      {weekSlots.length > 0 && (
                        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                          {dayCells.map(({ label, dateStr }) => {
                            const daySlots = weekSlots.filter((s) => {
                              if (!s.date) return false;
                              const raw = s.date as unknown;
                              if (typeof raw === 'string') return raw.slice(0, 10) === dateStr;
                              const d = raw && typeof raw === 'object' && raw instanceof Date ? raw : new Date(String(raw));
                              if (Number.isNaN(d.getTime())) return false;
                              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                              return key === dateStr;
                            });
                            if (daySlots.length === 0) return null;
                            return (
                              <div key={dateStr}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 2 }}>
                                  周{label} {dateStr.slice(5).replace('-', '/')}
                                </div>
                                {daySlots.map(slot => (
                                  <div key={slot.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: 6,
                                    background: slot.status === 'completed' ? 'color-mix(in srgb, #22c55e 8%, var(--bg-secondary) 92%)' : 'var(--bg-secondary)',
                                    border: '1px solid color-mix(in srgb, var(--border-color) 40%, transparent 60%)',
                                    marginBottom: 2,
                                  }}>
                                    <span style={{
                                      fontSize: '0.75rem',
                                      color: slot.status === 'completed' ? 'var(--text-secondary)' : 'var(--text-primary)',
                                      textDecoration: slot.status === 'completed' ? 'line-through' : 'none',
                                      flex: 1,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {slot.subjectName} · {slot.chapterTitle}
                                    </span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 6, flexShrink: 0 }}>
                                      {slot.plannedHours}h
                                    </span>
                                    {slot.status === 'completed' && (
                                      <Check size={10} style={{ color: '#22c55e', marginLeft: 4, flexShrink: 0 }} />
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {weekSlots.length === 0 && (
                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem', padding: '0.5rem 0' }}>
                          本周暂无排期
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ plan, onChanged }: { plan: PlanDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ examDate: toDateInputValue(plan.examDate), weekdayHours: plan.weekdayHours, weekendHours: plan.weekendHours });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await studyPlanAPI.updatePlan(plan.id, form);
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: 'pause' | 'resume' | 'regenerate' | 'archive') => {
    const confirmMsg: Record<string, string> = {
      pause: '暂停计划？',
      resume: '恢复计划？',
      regenerate: '重新生成计划？已完成的记录不会丢失，但未执行的槽位会重新排期',
      archive: '归档并结束这个计划？',
    };
    if (!window.confirm(confirmMsg[action])) return;
    if (action === 'pause') await studyPlanAPI.pausePlan(plan.id);
    if (action === 'resume') await studyPlanAPI.resumePlan(plan.id);
    if (action === 'regenerate') await studyPlanAPI.regeneratePlan(plan.id);
    if (action === 'archive') await studyPlanAPI.archivePlan(plan.id);
    onChanged();
  };

  return (
    <div style={{ padding: '0 1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
      <div style={{ ...card(), marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? '0.75rem' : 0 }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>基本信息</span>
          <button style={{ ...btn('ghost'), fontSize: '0.8rem', padding: '0.28rem 0.55rem' }} onClick={() => setEditing(!editing)}>
            {editing ? '取消' : '编辑'}
          </button>
        </div>
        {!editing ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {[
              ['考试名称', plan.examName],
              ['笔试日期', fmtDate(plan.examDate)],
              ['工作日', `${plan.weekdayHours}h / 天`],
              ['周末', `${plan.weekendHours}h / 天`],
              ['状态', plan.status],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{label}</span>
                <span style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: 3 }}>笔试日期</div>
              <input type="date" style={inputStyle} value={form.examDate} onChange={(e) => setForm((p) => ({ ...p, examDate: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: 3 }}>工作日（h）</div>
                <input type="number" min={0} max={24} style={inputStyle} value={form.weekdayHours} onChange={(e) => setForm((p) => ({ ...p, weekdayHours: Number(e.target.value) }))} />
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: 3 }}>周末（h）</div>
                <input type="number" min={0} max={24} style={inputStyle} value={form.weekendHours} onChange={(e) => setForm((p) => ({ ...p, weekendHours: Number(e.target.value) }))} />
              </div>
            </div>
            <button style={btn('primary')} onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <button style={btn()} onClick={() => handleAction('regenerate')}>
          🔄 重新生成排期
        </button>
        {plan.status === 'active' ? (
          <button style={btn()} onClick={() => handleAction('pause')}>⏸ 暂停计划</button>
        ) : (
          <button style={btn()} onClick={() => handleAction('resume')}>▶️ 恢复计划</button>
        )}
        <button style={btn('danger')} onClick={() => handleAction('archive')}>归档并结束</button>
      </div>
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'subjects' | 'weekly' | 'settings';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: '概览', icon: <BarChart2 size={14} /> },
  { key: 'subjects', label: '科目', icon: <BookMarked size={14} /> },
  { key: 'weekly', label: '周计划', icon: <CalendarDays size={14} /> },
  { key: 'settings', label: '设置', icon: <Settings2 size={14} /> },
];

export interface StudyPlanSidebarRef {
  open: () => void;
}

interface StudyPlanSidebarProps {
  showFloatingTrigger?: boolean;
}

const StudyPlanSidebar = forwardRef<StudyPlanSidebarRef, StudyPlanSidebarProps>(function StudyPlanSidebar({ showFloatingTrigger = true }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const activeRes = await studyPlanAPI.getActivePlan();
      if (!activeRes.data) {
        setHasPlan(false);
        setPlan(null);
        return;
      }
      const detailRes = await studyPlanAPI.getPlanDetail(activeRes.data.id);
      setPlan(detailRes.data);
      setHasPlan(true);
    } catch {
      setHasPlan(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    open: () => setIsOpen(true),
  }));

  useEffect(() => {
    if (isOpen && hasPlan === null) {
      void loadPlan();
    }
  }, [isOpen, hasPlan, loadPlan]);

  const daysLeft = plan?.examDate ? daysUntil(plan.examDate) : null;

  return (
    <>
      {/* Floating trigger button */}
      {showFloatingTrigger && (
        <button
          onClick={() => setIsOpen(true)}
          className="study-plan-btn"
          aria-label="????"
          style={{
            position: 'fixed',
            bottom: 152,
            right: 20,
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'color-mix(in srgb, #10b981 88%, #059669 12%)',
            color: '#fff',
            border: '1px solid color-mix(in srgb, #10b981 62%, transparent 38%)',
            boxShadow: '0 14px 28px rgba(2, 6, 23, 0.28)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 998,
          }}
        >
          <BookOpen size={21} />
        </button>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: isOpen ? 0 : -420,
          width: 400,
          height: '100dvh',
          zIndex: 1001,
          background: 'color-mix(in srgb, var(--bg-secondary) 95%, white 5%)',
          borderLeft: '1px solid color-mix(in srgb, var(--border-color) 70%, transparent 30%)',
          boxShadow: isOpen ? '-16px 0 48px rgba(2,6,23,0.24)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          transition: 'right 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1rem 1rem 0.75rem',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent 40%)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexShrink: 0,
        }}>
          <BookOpen size={18} style={{ color: '#10b981' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
              {plan ? plan.examName : '学习计划'}
            </div>
            {daysLeft !== null && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                距考试 {daysLeft} 天
              </div>
            )}
          </div>
          <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab bar (only when plan exists) */}
        {hasPlan && (
          <div style={{
            display: 'flex', gap: 4, padding: '0.5rem 1rem',
            borderBottom: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent 40%)',
            flexShrink: 0,
          }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '0.42rem 0.3rem',
                borderRadius: 8,
                border: '1px solid transparent',
                background: tab === t.key ? 'color-mix(in srgb, var(--accent-primary) 14%, var(--bg-primary) 86%)' : 'transparent',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderColor: tab === t.key ? 'color-mix(in srgb, var(--accent-primary) 40%, transparent 60%)' : 'transparent',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: '0.75rem' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              加载中...
            </div>
          ) : !hasPlan ? (
            <OnboardingWizard onCreated={() => { setHasPlan(null); void loadPlan(); }} />
          ) : plan ? (
            <>
              {tab === 'overview' && <OverviewTab planId={plan.id} plan={plan} />}
              {tab === 'subjects' && <SubjectsTab plan={plan} />}
              {tab === 'weekly' && <WeeklyTab planId={plan.id} />}
              {tab === 'settings' && <SettingsTab plan={plan} onChanged={() => { void loadPlan(); setTab('overview'); }} />}
            </>
          ) : null}
        </div>
      </div>

      <style>{`
        @media (max-width: 480px) {
          .study-plan-btn { bottom: 220px !important; right: 14px !important; }
        }
      `}</style>
    </>
  );
});

export default StudyPlanSidebar;
