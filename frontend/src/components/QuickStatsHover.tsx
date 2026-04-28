'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, Wallet } from 'lucide-react';
import { exerciseAPI, expenseAPI } from '@/lib/api';

/* ── types ── */
interface ExerciseLog {
  exerciseName: string;
  emoji: string | null;
  totalValue: number;
  unit: string;
  count: number;
}
interface OtherExpense { id: string; description: string; amount: number; }
interface ExpenseData {
  meals: { breakfast: number; lunch: number; dinner: number };
  others: OtherExpense[];
  totalMeal: number;
  totalOther: number;
}

function fmt(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(1); }

/* ── combined panel ── */
function CombinedPanel() {
  const [exercise, setExercise] = useState<ExerciseLog[] | null>(null);
  const [expense, setExpense] = useState<ExpenseData | null>(null);
  const [loadingEx, setLoadingEx] = useState(true);
  const [loadingExp, setLoadingExp] = useState(true);

  useEffect(() => {
    exerciseAPI.getTodayLogs()
      .then(r => {
        const payload = r.data?.data ?? r.data;
        setExercise(Array.isArray(payload) ? payload : []);
      })
      .catch(() => setExercise([]))
      .finally(() => setLoadingEx(false));

    expenseAPI.getTodayExpenses()
      .then(r => {
        // controller returns { data: { meals, others, totalMeal, totalOther } }
        const payload = r.data?.data ?? r.data;
        setExpense(payload ?? null);
      })
      .catch(() => setExpense(null))
      .finally(() => setLoadingExp(false));
  }, []);

  const activeEx = (exercise ?? []).filter(r => r.totalValue > 0);

  const mealLabels: Record<string, string> = { breakfast: '早', lunch: '午', dinner: '晚' };
  const total = (expense?.totalMeal ?? 0) + (expense?.totalOther ?? 0);

  return (
    <>
      {/* exercise section */}
      <div className="qs-panel-head">今日运动</div>
      <div className="qs-body">
        {loadingEx
          ? <p className="qs-empty">加载中…</p>
          : activeEx.length === 0
            ? <p className="qs-empty">暂无运动记录</p>
            : (
              <div className="qs-grid">
                {activeEx.map(r => (
                  <div key={r.exerciseName} className="qs-stat">
                    <span className="qs-stat-icon">{r.emoji ?? '🏃'}</span>
                    <span className="qs-stat-name">{r.exerciseName}</span>
                    <span className="qs-stat-val">
                      {fmt(r.totalValue)}<span className="qs-stat-unit">{r.unit}</span>
                    </span>
                  </div>
                ))}
              </div>
            )
        }
      </div>

      {/* divider */}
      <div className="qs-divider" />

      {/* expense section */}
      <div className="qs-panel-head">今日消费</div>
      <div className="qs-body">
        {loadingExp
          ? <p className="qs-empty">加载中…</p>
          : !expense
            ? <p className="qs-empty">暂无消费记录</p>
            : (
              <>
                <div className="qs-meal-row">
                  {Object.entries(expense.meals ?? {}).map(([k, v]) => (
                    <div key={k} className="qs-meal">
                      <span className="qs-meal-label">{mealLabels[k]}</span>
                      <span className="qs-meal-val">{v > 0 ? `¥${fmt(v)}` : '—'}</span>
                    </div>
                  ))}
                </div>
                {expense.others.length > 0 && (
                  <div className="qs-others">
                    {expense.others.map(o => (
                      <div key={o.id} className="qs-other-row">
                        <span className="qs-other-name">{o.description}</span>
                        <span className="qs-other-amt">¥{fmt(o.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="qs-total">合计 <strong>¥{fmt(total)}</strong></div>
              </>
            )
        }
      </div>
    </>
  );
}

/* ── pill with hover dropdown ── */
export default function QuickStatsHover() {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };
  const hide = () => {
    timerRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <>
      <style>{`
        .qs-pill-wrap { position: relative; display: inline-flex; }
        .qs-topbar-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 11px;
          border: 1px solid var(--line);
          border-radius: 999px;
          background: transparent;
          color: var(--fg-3);
          font: 600 11px var(--font-sans);
          cursor: default;
          transition: all .15s;
          letter-spacing: .04em;
        }
        .qs-topbar-pill:hover,
        .qs-topbar-pill.open {
          background: var(--bg-2);
          color: var(--fg);
          border-color: var(--line-2);
        }
        .qs-pill-sep {
          width: 1px; height: 10px;
          background: var(--line-2);
          display: inline-block;
        }
        /* dropdown */
        .qs-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 230px;
          background: var(--bg-1);
          border: 1px solid var(--line);
          border-radius: 14px;
          box-shadow: 0 16px 40px rgba(0,0,0,.14);
          overflow: hidden;
          z-index: 900;
          animation: qsDrop .12s ease;
        }
        @keyframes qsDrop {
          from { opacity:0; transform:translateY(-4px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .qs-panel-head {
          padding: 8px 14px 6px;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: var(--fg-4);
          background: var(--bg-2);
        }
        .qs-divider {
          height: 1px;
          background: var(--line);
          margin: 0;
        }
        .qs-body { padding: 9px 12px; display: flex; flex-direction: column; gap: 7px; }
        .qs-empty { margin:0; font-size:12px; color:var(--fg-4); text-align:center; padding:2px 0; }
        /* exercise */
        .qs-grid { display:flex; flex-direction:column; gap:4px; }
        .qs-stat {
          display:flex; align-items:center; gap:8px;
          padding:5px 8px;
          background:var(--bg-2); border:1px solid var(--line); border-radius:8px;
        }
        .qs-stat-icon { font-size:13px; }
        .qs-stat-name { flex:1; font-size:12px; color:var(--fg-2); font-weight:500; }
        .qs-stat-val  { font-size:12.5px; font-weight:700; color:var(--fg); font-family:var(--font-mono); }
        .qs-stat-unit { font-size:10px; color:var(--fg-3); margin-left:2px; font-weight:400; }
        /* expense */
        .qs-meal-row { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; }
        .qs-meal {
          display:flex; flex-direction:column; align-items:center; gap:2px;
          padding:6px 4px;
          background:var(--bg-2); border:1px solid var(--line); border-radius:8px;
        }
        .qs-meal-label { font-size:9px; color:var(--fg-3); font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
        .qs-meal-val   { font-size:12.5px; font-weight:700; color:var(--fg); font-family:var(--font-mono); }
        .qs-others { display:flex; flex-direction:column; gap:3px; max-height:90px; overflow-y:auto; }
        .qs-other-row {
          display:flex; justify-content:space-between; align-items:center;
          padding:3px 6px; font-size:11.5px;
          background:var(--bg-2); border-radius:6px;
        }
        .qs-other-name { color:var(--fg-2); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .qs-other-amt  { color:var(--accent); font-weight:600; font-family:var(--font-mono); margin-left:8px; flex-shrink:0; }
        .qs-total { font-size:11.5px; color:var(--fg-3); text-align:right; padding-top:4px; border-top:1px solid var(--line); }
        .qs-total strong { color:var(--accent); font-family:var(--font-mono); font-size:12.5px; }
      `}</style>

      <div className="qs-pill-wrap" onMouseEnter={show} onMouseLeave={hide}>
        <button className={`qs-topbar-pill${open ? ' open' : ''}`}>
          <Activity size={12} />
          <span>运动</span>
          <span className="qs-pill-sep" />
          <Wallet size={12} />
          <span>消费</span>
        </button>
        {open && (
          <div className="qs-dropdown" onMouseEnter={show} onMouseLeave={hide}>
            <CombinedPanel />
          </div>
        )}
      </div>
    </>
  );
}
