'use client';

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle, Moon, PlusCircle, SkipForward, Sunrise, X } from 'lucide-react';
import { dailyAPI, studyPlanAPI } from '@/lib/api';

interface DailyStatus {
  hasStarted: boolean;
  hasReflected: boolean;
  dayStart: string | null;
  dayReflection: string | null;
  reflectionTime: string | null;
  phoneUsage: number | null;
  wakeUpTime: string | null;
}

interface StudySlot {
  id: string;
  planId: string;
  subjectName: string;
  chapterTitle: string;
  plannedHours: number;
  status: string;
}

interface DayReflectionProps {
  mode?: 'start' | 'reflection';
  onClose?: () => void;
  onSave?: () => void;
}

const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.56)',
  backdropFilter: 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalCardStyle: CSSProperties = {
  backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 88%, white 12%)',
  borderRadius: '24px',
  border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
  padding: '1.5rem',
  width: '92%',
  maxHeight: '88vh',
  overflow: 'auto',
  boxShadow: '0 28px 56px rgba(15, 23, 42, 0.22)',
};

export default function DayReflection({ mode, onClose, onSave }: DayReflectionProps) {
  const [showStartModal, setShowStartModal] = useState(false);
  const [showReflectionModal, setShowReflectionModal] = useState(false);

  const [startContent, setStartContent] = useState('');
  const [wakeUpTime, setWakeUpTime] = useState('');

  const [reflectionContent, setReflectionContent] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [phoneUsageTime, setPhoneUsageTime] = useState('');

  const [loading, setLoading] = useState(false);
  const [studyLoading, setStudyLoading] = useState(false);

  const [dailyStatus, setDailyStatus] = useState<DailyStatus>({
    hasStarted: false,
    hasReflected: false,
    dayStart: null,
    dayReflection: null,
    reflectionTime: null,
    phoneUsage: null,
    wakeUpTime: null,
  });

  const [studySlots, setStudySlots] = useState<StudySlot[]>([]);
  const [studyMode, setStudyMode] = useState<'all' | 'select' | 'skip' | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  const selectedCount = useMemo(() => selectedSlots.size, [selectedSlots]);

  const loadTodayStatus = async () => {
    try {
      const response = await dailyAPI.getTodayStatus();
      setDailyStatus(response.data);
    } catch (error) {
      console.error('加载今日状态失败:', error);
    }
  };

  const loadTodayStudySlots = async () => {
    try {
      const res = await studyPlanAPI.getTodaySuggestion();
      const plan = res.data?.plan;
      const slots = Array.isArray(res.data?.slots) ? res.data.slots : [];
      const normalized = slots.map((slot: any) => ({
        id: slot.id,
        planId: slot.planId || plan?.id || '',
        subjectName: slot.subjectName || '',
        chapterTitle: slot.chapterTitle || '',
        plannedHours: Number(slot.plannedHours || 0),
        status: slot.status || 'pending',
      }));
      setStudySlots(normalized);
    } catch (error) {
      console.error('加载今日学习计划失败:', error);
      setStudySlots([]);
    }
  };

  useEffect(() => {
    void loadTodayStatus();
  }, []);

  useEffect(() => {
    if (mode === 'start') {
      setStartContent(dailyStatus.dayStart || '');
      setWakeUpTime(dailyStatus.wakeUpTime || '');
      setStudyMode(null);
      setSelectedSlots(new Set());
      void loadTodayStudySlots();
      setShowStartModal(true);
    } else if (mode === 'reflection') {
      if (dailyStatus.dayReflection) {
        const parts = dailyStatus.dayReflection.split('\n\n明日计划：\n');
        setReflectionContent(parts[0] || '');
        setTomorrowPlan(parts[1] || '');
      } else {
        setReflectionContent('');
        setTomorrowPlan('');
      }
      setPhoneUsageTime(dailyStatus.phoneUsage ? String(dailyStatus.phoneUsage) : '');
      setShowReflectionModal(true);
    }
  }, [mode, dailyStatus]);

  const closeStart = () => {
    setShowStartModal(false);
    onClose?.();
  };

  const closeReflection = () => {
    setShowReflectionModal(false);
    onClose?.();
  };

  const handleStartDay = async () => {
    if (!startContent.trim()) return;

    try {
      setLoading(true);
      const payload: any = { dayStart: startContent.trim() };
      if (wakeUpTime.trim()) {
        payload.wakeUpTime = wakeUpTime.trim();
      }
      await dailyAPI.updateDayStart(payload);
      await loadTodayStatus();
      onSave?.();
      closeStart();
    } catch (error: any) {
      console.error('开启今天失败:', error);
      alert(error.response?.data?.message || '开启今天失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleReflection = async () => {
    if (!reflectionContent.trim()) return;
    try {
      setLoading(true);
      const fullReflection = tomorrowPlan.trim()
        ? `${reflectionContent.trim()}\n\n明日计划：\n${tomorrowPlan.trim()}`
        : reflectionContent.trim();
      const payload: any = { dayReflection: fullReflection };
      if (phoneUsageTime.trim()) {
        const minutes = parseInt(phoneUsageTime, 10);
        if (!Number.isNaN(minutes) && minutes > 0) {
          payload.phoneUsage = minutes;
        }
      }

      await dailyAPI.updateDayReflection(payload);
      await loadTodayStatus();
      onSave?.();
      closeReflection();
    } catch (error: any) {
      console.error('保存复盘失败:', error);
      alert(error.response?.data?.message || '保存复盘失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleInjectAll = async () => {
    if (studySlots.length === 0) return;
    try {
      setStudyLoading(true);
      await studyPlanAPI.injectToday();
      setStudyMode('all');
      await loadTodayStudySlots();
    } catch (error) {
      console.error('注入今日学习任务失败:', error);
      alert('注入今日学习任务失败，请重试');
    } finally {
      setStudyLoading(false);
    }
  };

  const handleInjectSelected = async () => {
    const targets = studySlots.filter((slot) => selectedSlots.has(slot.id));
    if (targets.length === 0) return;

    try {
      setStudyLoading(true);
      await Promise.all(
        targets
          .filter((slot) => slot.planId)
          .map((slot) => studyPlanAPI.injectSlot(slot.planId, slot.id)),
      );
      setStudyMode('all');
      setSelectedSlots(new Set());
      await loadTodayStudySlots();
    } catch (error) {
      console.error('注入选中学习任务失败:', error);
      alert('注入选中学习任务失败，请重试');
    } finally {
      setStudyLoading(false);
    }
  };

  const handleSkipTodayStudy = async () => {
    const pendingSlots = studySlots.filter((slot) => slot.status === 'pending' || slot.status === 'injected');
    if (pendingSlots.length === 0) {
      setStudyMode('skip');
      return;
    }

    try {
      setStudyLoading(true);
      await Promise.all(
        pendingSlots
          .filter((slot) => slot.planId)
          .map((slot) => studyPlanAPI.skipSlot(slot.planId, slot.id)),
      );
      setStudyMode('skip');
      setSelectedSlots(new Set());
      await loadTodayStudySlots();
    } catch (error) {
      console.error('跳过今日学习计划失败:', error);
      alert('跳过今日学习计划失败，请重试');
    } finally {
      setStudyLoading(false);
    }
  };

  const toggleSelectedSlot = (slotId: string) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        next.add(slotId);
      }
      return next;
    });
  };

  return (
    <>
      {showStartModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalCardStyle, maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sunrise size={24} style={{ color: '#4299e1' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>开启今天</h3>
              </div>
              <button onClick={closeStart} style={closeBtnStyle}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>今天的重点</label>
              <textarea
                value={startContent}
                onChange={(e) => setStartContent(e.target.value)}
                placeholder="写下今天最重要的目标与执行重点..."
                style={textareaStyle}
                rows={4}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>起床时间（可选）</label>
              <input type="time" value={wakeUpTime} onChange={(e) => setWakeUpTime(e.target.value)} style={inputStyle} />
            </div>

            {studySlots.length > 0 && (
              <div style={studyPlanWrapStyle}>
                <div style={studyPlanHeaderStyle}>
                  <BookOpen size={16} style={{ color: '#4299e1' }} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                    今日学习计划（{studySlots.length} 项）
                  </span>
                  {studyMode === 'all' && <span style={statusTextSuccess}>已全部加入任务</span>}
                  {studyMode === 'skip' && <span style={statusTextMuted}>已跳过并顺延</span>}
                </div>

                <div style={{ padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                    <button type="button" disabled={studyLoading} onClick={handleInjectAll} style={primaryMiniBtnStyle}>
                      <PlusCircle size={12} />
                      全部加入
                    </button>
                    <button type="button" disabled={studyLoading} onClick={() => setStudyMode('select')} style={secondaryMiniBtnStyle}>
                      选择加入
                    </button>
                    <button type="button" disabled={studyLoading} onClick={handleSkipTodayStudy} style={secondaryMiniBtnStyle}>
                      <SkipForward size={12} />
                      今天跳过
                    </button>
                  </div>

                  {studyMode !== 'skip' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {studySlots.map((slot) => (
                        <div
                          key={slot.id}
                          onClick={() => studyMode === 'select' && toggleSelectedSlot(slot.id)}
                          style={{
                            ...slotRowStyle,
                            cursor: studyMode === 'select' ? 'pointer' : 'default',
                            borderColor:
                              studyMode === 'select' && selectedSlots.has(slot.id)
                                ? 'color-mix(in srgb, #4299e1 30%, transparent 70%)'
                                : 'var(--border-color)',
                          }}
                        >
                          {studyMode === 'select' && (
                            <input
                              type="checkbox"
                              checked={selectedSlots.has(slot.id)}
                              onChange={() => toggleSelectedSlot(slot.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {slot.subjectName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {slot.chapterTitle}
                            </div>
                          </div>
                          <span style={slotHourStyle}>{slot.plannedHours}h</span>
                        </div>
                      ))}

                      {studyMode === 'select' && selectedCount > 0 && (
                        <button type="button" disabled={studyLoading} onClick={handleInjectSelected} style={primaryBlockBtnStyle}>
                          加入已选 {selectedCount} 项
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={closeStart} style={cancelBtnStyle}>取消</button>
              <button onClick={handleStartDay} disabled={!startContent.trim() || loading} style={confirmBtnStyle}>
                <CheckCircle size={16} />
                {loading ? '保存中...' : '确认开启今天'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReflectionModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalCardStyle, maxWidth: '620px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Moon size={24} style={{ color: '#ed8936' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>今日复盘</h3>
              </div>
              <button onClick={closeReflection} style={closeBtnStyle}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>今日复盘总结</label>
              <textarea
                value={reflectionContent}
                onChange={(e) => setReflectionContent(e.target.value)}
                placeholder="记录今天的执行情况、问题和改进点..."
                style={textareaStyle}
                rows={4}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>手机使用时长（分钟，可选）</label>
              <input
                type="number"
                value={phoneUsageTime}
                onChange={(e) => setPhoneUsageTime(e.target.value)}
                placeholder="例如 120"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>明日计划（可选）</label>
              <textarea
                value={tomorrowPlan}
                onChange={(e) => setTomorrowPlan(e.target.value)}
                placeholder="写下明天最重要的安排..."
                style={textareaStyle}
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={closeReflection} style={cancelBtnStyle}>取消</button>
              <button onClick={handleReflection} disabled={!reflectionContent.trim() || loading} style={reviewConfirmBtnStyle}>
                <CheckCircle size={16} />
                {loading ? '保存中...' : '完成复盘'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 500,
  color: 'var(--text-primary)',
  marginBottom: '0.5rem',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: '96px',
  lineHeight: 1.5,
  resize: 'vertical',
};

const closeBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '0.45rem',
  borderRadius: '10px',
  backgroundColor: 'color-mix(in srgb, var(--bg-tertiary) 78%, white 22%)',
};

const cancelBtnStyle: CSSProperties = {
  padding: '0.75rem 1.5rem',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const confirmBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#4299e1',
  color: 'white',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const reviewConfirmBtnStyle: CSSProperties = {
  ...confirmBtnStyle,
  backgroundColor: '#ed8936',
};

const studyPlanWrapStyle: CSSProperties = {
  marginBottom: '1.2rem',
  border: '1px solid color-mix(in srgb, var(--border-color) 60%, transparent 40%)',
  borderRadius: '12px',
  overflow: 'hidden',
};

const studyPlanHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  backgroundColor: 'color-mix(in srgb, #4299e1 8%, var(--bg-tertiary) 92%)',
};

const statusTextSuccess: CSSProperties = {
  fontSize: '0.75rem',
  color: '#48bb78',
  fontWeight: 500,
};

const statusTextMuted: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
};

const primaryMiniBtnStyle: CSSProperties = {
  padding: '0.32rem 0.66rem',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#4299e1',
  color: 'white',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
};

const secondaryMiniBtnStyle: CSSProperties = {
  ...primaryMiniBtnStyle,
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
};

const slotRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
};

const slotHourStyle: CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-secondary)',
  backgroundColor: 'var(--bg-tertiary)',
  padding: '0.2rem 0.5rem',
  borderRadius: '4px',
  flexShrink: 0,
};

const primaryBlockBtnStyle: CSSProperties = {
  marginTop: '0.3rem',
  padding: '0.5rem',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#4299e1',
  color: 'white',
  fontSize: '0.82rem',
  fontWeight: 500,
  cursor: 'pointer',
};
