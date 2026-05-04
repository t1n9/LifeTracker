'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '@/lib/api';
import styles from './ExamTemplateManagement.module.css';

// ── Types ────────────────────────────────────────────────────────

interface PlanReference {
  id: string;
  examType: string;
  name: string;
  matchKeywords: string;
  durationDays: number;
  description?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  isActive: boolean;
  sortOrder: number;
}

// ── Plan references tab ──────────────────────────────────────────

const EXAM_TYPES = [
  { value: 'civil_service', label: '公务员' },
  { value: 'postgraduate', label: '考研' },
  { value: 'cet', label: '英语四六级' },
  { value: 'other', label: '其他' },
];

const DURATION_OPTIONS = [
  { value: 0, label: '不限' },
  { value: 7, label: '7天' },
  { value: 14, label: '14天' },
  { value: 30, label: '1个月' },
  { value: 60, label: '2个月' },
  { value: 90, label: '3个月' },
  { value: 180, label: '6个月' },
];

function durationLabel(days: number) {
  return DURATION_OPTIONS.find(o => o.value === days)?.label ?? `${days}天`;
}

// ── Bulk import modal ────────────────────────────────────────────

const BULK_PLACEHOLDER = `[
  {
    "examType": "civil_service",
    "name": "国考/省考行测申论7天冲刺",
    "matchKeywords": "国考,省考,行测,申论,公务员",
    "durationDays": 7,
    "description": "第1天：资料分析（基础公式梳理+100题专项）；第2天：言语理解（词语辨析50题+语句排列50题）；第3天：判断推理（图形推理+逻辑推理各50题）；第4天：数量关系（15大题型公式+30题精练）；第5天：申论（大作文结构梳理+写1篇）；第6天：综合套卷模拟1套（限时135分钟）；第7天：全套模拟+错题复盘",
    "sourceUrl": "",
    "sortOrder": 1
  }
]`;

function BulkImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Record<string, unknown>[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');

  const sanitize = (raw: string): string => raw
    .trim()
    // 剥掉 ```json ... ``` 代码块包裹
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    // curly double quotes inside JSON string values must become \” not “
    .replace(/[“”]/g, String.fromCharCode(92, 34))
    // curly single quotes → straight
    .replace(/[‘’]/g, String.fromCharCode(39));

  const [errorLine, setErrorLine] = useState<number | null>(null);

  const handleParse = () => {
    setErrorLine(null);
    try {
      const cleaned = sanitize(text);
      let data: unknown;
      try {
        data = JSON.parse(cleaned);
      } catch (je: unknown) {
        const msg = (je as Error).message;
        // extract line number from browser JSON error, e.g. "at position 1619 (line 34 column 79)"
        const lineMatch = msg.match(/line\s+(\d+)/i);
        if (lineMatch) {
          setErrorLine(parseInt(lineMatch[1], 10));
        }
        throw new Error(`JSON 格式错误：${msg}`);
      }
      if (!Array.isArray(data)) throw new Error('顶层必须是数组 [ ... ]');
      // basic validation
      const arr = data as Record<string, unknown>[];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (!item.examType) throw new Error(`第 ${i + 1} 条缺少 examType`);
        if (!item.name) throw new Error(`第 ${i + 1} 条缺少 name`);
        if (!item.description) throw new Error(`第 ${i + 1} 条缺少 description`);
      }
      setParsed(arr);
      setParseError('');
    } catch (e: unknown) {
      setParseError((e as Error).message);
      setParsed(null);
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);
    let ok = 0;
    for (let i = 0; i < parsed.length; i++) {
      setProgress(`导入中 ${i + 1} / ${parsed.length}…`);
      try {
        await adminAPI.createPlanReference(parsed[i]);
        ok++;
      } catch {
        // continue
      }
    }
    setProgress(`完成，成功导入 ${ok} / ${parsed.length} 条`);
    setImporting(false);
    setTimeout(() => { onDone(); onClose(); }, 1200);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12,
        width: 'min(720px, 95vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        padding: 20, gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg)' }}>批量导入计划参考</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.7 }}>
          将 AI 输出的 JSON 粘贴到下方，点击「解析」验证格式，确认无误后点「导入」。
          <br />
          每条必须包含：<code style={{ background: 'var(--bg-1)', padding: '1px 4px', borderRadius: 3 }}>examType</code>、
          <code style={{ background: 'var(--bg-1)', padding: '1px 4px', borderRadius: 3 }}>name</code>、
          <code style={{ background: 'var(--bg-1)', padding: '1px 4px', borderRadius: 3 }}>description</code>。
          可选：<code style={{ background: 'var(--bg-1)', padding: '1px 4px', borderRadius: 3 }}>matchKeywords</code>、
          <code style={{ background: 'var(--bg-1)', padding: '1px 4px', borderRadius: 3 }}>durationDays</code>、
          <code style={{ background: 'var(--bg-1)', padding: '1px 4px', borderRadius: 3 }}>sourceUrl</code>、
          <code style={{ background: 'var(--bg-1)', padding: '1px 4px', borderRadius: 3 }}>sortOrder</code>。
        </div>

        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setParsed(null); setParseError(''); setErrorLine(null); }}
          placeholder={BULK_PLACEHOLDER}
          style={{
            flex: 1, minHeight: 260, padding: '10px 12px',
            background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8,
            color: 'var(--fg)', fontSize: 12, fontFamily: 'var(--font-mono, monospace)',
            resize: 'vertical', outline: 'none',
          }}
        />

        {parseError && (
          <div style={{ fontSize: 12, color: '#f87171', background: 'color-mix(in srgb, #ef4444 10%, transparent)', padding: '8px 10px', borderRadius: 6 }}>
            <div>❌ {parseError}</div>
            {errorLine !== null && (() => {
              const lines = sanitize(text).split('\n');
              const lineContent = lines[errorLine - 1] ?? '';
              return (
                <div style={{ marginTop: 6, fontFamily: 'monospace', background: 'color-mix(in srgb, #ef4444 20%, transparent)', padding: '4px 8px', borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  <span style={{ opacity: 0.6 }}>第 {errorLine} 行：</span>
                  <span>{lineContent.length > 200 ? lineContent.slice(0, 200) + '…' : lineContent}</span>
                </div>
              );
            })()}
          </div>
        )}

        {parsed && (
          <div style={{ fontSize: 12, color: '#4ade80', background: 'color-mix(in srgb, #22c55e 10%, transparent)', padding: '6px 10px', borderRadius: 6 }}>
            ✓ 解析成功，共 {parsed.length} 条，类型分布：
            {Object.entries(
              parsed.reduce((acc, r) => {
                const t = String(r.examType || 'other');
                acc[t] = ((acc[t] as number) || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([k, v]) => ` ${EXAM_TYPES.find(e => e.value === k)?.label ?? k}×${v}`).join('，')}
          </div>
        )}

        {progress && (
          <div style={{ fontSize: 12, color: 'var(--fg-2)', textAlign: 'center' }}>{progress}</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={importing}>取消</button>
          <button className={styles.btnSecondary} onClick={handleParse} disabled={!text.trim() || importing}>解析验证</button>
          <button className={styles.btnPrimary} onClick={handleImport} disabled={!parsed || importing}>
            {importing ? '导入中...' : `导入 ${parsed?.length ?? 0} 条`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Plan references panel ─────────────────────────────────────────

function PlanReferencesPanel() {
  const blank = () => ({
    examType: 'civil_service', name: '', matchKeywords: '', durationDays: 0,
    description: '', sourceUrl: '', sourceTitle: '',
  });

  const [refs, setRefs] = useState<PlanReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(blank());
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PlanReference | null>(null);
  const [editFetchingTitle, setEditFetchingTitle] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await adminAPI.listPlanReferences(); setRefs(r.data || []); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const autoFetchTitle = async (url: string, setter: (t: string) => void) => {
    if (!url.startsWith('http')) return;
    setFetchingTitle(true);
    try {
      const r = await adminAPI.fetchRefTitle(url);
      if (r.data?.title) setter(r.data.title);
    } finally { setFetchingTitle(false); }
  };

  const autoFetchTitleEdit = async (url: string) => {
    if (!url.startsWith('http') || !editDraft) return;
    setEditFetchingTitle(true);
    try {
      const r = await adminAPI.fetchRefTitle(url);
      if (r.data?.title) setEditDraft(d => d ? { ...d, sourceTitle: r.data.title } : d);
    } finally { setEditFetchingTitle(false); }
  };

  const handleAdd = async () => {
    await adminAPI.createPlanReference(draft as Record<string, unknown>);
    setDraft(blank()); setAdding(false); load();
  };

  const handleUpdate = async () => {
    if (!editDraft) return;
    await adminAPI.updatePlanReference(editId!, editDraft as unknown as Record<string, unknown>);
    setEditId(null); setEditDraft(null); load();
  };

  const handleToggle = async (ref: PlanReference) => {
    await adminAPI.setPlanReferenceActive(ref.id, !ref.isActive); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('删除该计划参考？')) return;
    await adminAPI.deletePlanReference(id); load();
  };

  const RefForm = ({
    val, set, fetchingT, onFetchTitle,
  }: {
    val: typeof draft;
    set: (v: typeof draft) => void;
    fetchingT: boolean;
    onFetchTitle: (url: string, setter: (t: string) => void) => void;
  }) => (
    <div className={styles.formBox}>
      <div className={styles.formRow}>
        <span className={styles.formLabel}>类型</span>
        <select className={styles.input} value={val.examType} onChange={e => set({ ...val, examType: e.target.value })} style={{ flex: 1 }}>
          {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span className={styles.formLabel}>天数</span>
        <select className={styles.input} value={val.durationDays} onChange={e => set({ ...val, durationDays: +e.target.value })} style={{ width: 90 }}>
          {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <input className={styles.input} placeholder="名称（如：广东事业单位考试7天冲刺）" value={val.name}
        onChange={e => set({ ...val, name: e.target.value })} />
      <input className={styles.input} placeholder="匹配关键词，逗号分隔（如：广东,事业单位）" value={val.matchKeywords}
        onChange={e => set({ ...val, matchKeywords: e.target.value })} />
      <textarea className={styles.textarea} rows={4}
        placeholder="计划描述（如：前4天每天一个模块：资料分析、言语理解、判断推理、公共基础；后3天套卷练习）"
        value={val.description || ''}
        onChange={e => set({ ...val, description: e.target.value })} />
      <div className={styles.formRow}>
        <input className={styles.input} placeholder="来源链接（可选）" value={val.sourceUrl || ''}
          onChange={e => set({ ...val, sourceUrl: e.target.value })}
          onBlur={e => { const url = e.target.value; onFetchTitle(url, t => set({ ...val, sourceUrl: url, sourceTitle: t })); }} />
        {fetchingT && <span className={styles.formLabel}>抓取中...</span>}
      </div>
    </div>
  );

  // Group by examType for display
  const grouped = EXAM_TYPES.map(t => ({
    ...t,
    items: refs.filter(r => r.examType === t.value),
  })).filter(g => g.items.length > 0 || adding);

  return (
    <div className={styles.wrap}>
      {showBulk && <BulkImportModal onClose={() => setShowBulk(false)} onDone={load} />}

      <div className={styles.header}>
        <h3 className={styles.title}>计划参考库</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={() => setShowBulk(true)}>批量导入</button>
          <button className={styles.btnPrimary} onClick={() => setAdding(true)}>+ 新增</button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: 0 }}>
        按考试类型 + 关键词 + 天数匹配，AI 推荐给用户时会展示名称、描述和来源。
      </p>

      {adding && (
        <>
          <RefForm val={draft} set={setDraft} fetchingT={fetchingTitle}
            onFetchTitle={(url, setter) => autoFetchTitle(url, setter)} />
          <div className={styles.btnRow}>
            <button className={styles.btnPrimary} onClick={handleAdd}>创建</button>
            <button className={styles.btnSecondary} onClick={() => { setAdding(false); setDraft(blank()); }}>取消</button>
          </div>
        </>
      )}

      {loading ? (
        <div className={styles.loading}>加载中...</div>
      ) : (
        grouped.map(g => (
          <div key={g.value}>
            <div className={styles.subTitle} style={{ marginTop: 8 }}>{g.label}</div>
            {g.items.map(ref => (
              <div key={ref.id} className={`${styles.itemCard} ${!ref.isActive ? styles.templateCardInactive : ''}`} style={{ marginBottom: 8 }}>
                {editId === ref.id && editDraft ? (
                  <>
                    <div className={styles.formBox}>
                      <div className={styles.formRow}>
                        <span className={styles.formLabel}>类型</span>
                        <select className={styles.input} value={editDraft.examType} onChange={e => setEditDraft({ ...editDraft, examType: e.target.value })} style={{ flex: 1 }}>
                          {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <span className={styles.formLabel}>天数</span>
                        <select className={styles.input} value={editDraft.durationDays} onChange={e => setEditDraft({ ...editDraft, durationDays: +e.target.value })} style={{ width: 90 }}>
                          {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <input className={styles.input} placeholder="名称" value={editDraft.name}
                        onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
                      <input className={styles.input} placeholder="匹配关键词" value={editDraft.matchKeywords}
                        onChange={e => setEditDraft({ ...editDraft, matchKeywords: e.target.value })} />
                      <textarea className={styles.textarea} rows={4} placeholder="描述" value={editDraft.description || ''}
                        onChange={e => setEditDraft({ ...editDraft, description: e.target.value })} />
                      <div className={styles.formRow}>
                        <input className={styles.input} placeholder="来源链接" value={editDraft.sourceUrl || ''}
                          onChange={e => setEditDraft({ ...editDraft, sourceUrl: e.target.value })}
                          onBlur={e => autoFetchTitleEdit(e.target.value)} />
                        {editFetchingTitle && <span className={styles.formLabel}>抓取中...</span>}
                      </div>
                      {editDraft.sourceTitle && (
                        <div className={styles.itemDesc}>网站标题：{editDraft.sourceTitle}</div>
                      )}
                    </div>
                    <div className={styles.btnRow}>
                      <button className={styles.btnPrimary} onClick={handleUpdate}>保存</button>
                      <button className={styles.btnSecondary} onClick={() => { setEditId(null); setEditDraft(null); }}>取消</button>
                    </div>
                  </>
                ) : (
                  <div className={styles.itemRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className={styles.itemName}>{ref.name}</span>
                        {ref.durationDays > 0 && <span className={styles.itemBadge}>{durationLabel(ref.durationDays)}</span>}
                        {!ref.isActive && <span style={{ fontSize: 11, color: '#f87171' }}>已停用</span>}
                      </div>
                      {ref.matchKeywords && <div className={styles.itemDesc}>关键词：{ref.matchKeywords}</div>}
                      {ref.description && (
                        <div className={styles.itemDesc} style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{ref.description}</div>
                      )}
                      {ref.sourceUrl && (
                        <a href={ref.sourceUrl} target="_blank" rel="noreferrer" className={styles.itemLink} style={{ marginTop: 4, display: 'inline-block' }}>
                          {ref.sourceTitle || ref.sourceUrl}
                        </a>
                      )}
                    </div>
                    <div className={styles.templateBtns} style={{ flexShrink: 0 }}>
                      <button className={styles.btnLink} onClick={() => { setEditId(ref.id); setEditDraft(ref); }}>编辑</button>
                      <button className={ref.isActive ? styles.btnWarning : styles.btnPrimary} onClick={() => handleToggle(ref)}>
                        {ref.isActive ? '停用' : '启用'}
                      </button>
                      <button className={styles.btnDanger} onClick={() => handleDelete(ref.id)}>删除</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

export function PlanReferencesAdminPanel() {
  return <PlanReferencesPanel />;
}
