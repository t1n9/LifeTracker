'use client';

import React, { useState, useEffect } from 'react';
import { Sunrise, Moon, X, CheckCircle, Edit } from 'lucide-react';
import { dailyAPI } from '@/lib/api';

interface DailyStatus {
  hasStarted: boolean;
  hasReflected: boolean;
  dayStart: string | null;
  dayReflection: string | null;
  reflectionTime: string | null;
  phoneUsage: number | null;
}

interface DayReflectionProps {
  mode?: 'start' | 'reflection';
  onClose?: () => void;
  onSave?: () => void; // 保存成功后的回调
}

export default function DayReflection({ mode, onClose, onSave }: DayReflectionProps) {
  const [showStartModal, setShowStartModal] = useState(false);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [startContent, setStartContent] = useState('');
  const [reflectionContent, setReflectionContent] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [phoneUsageTime, setPhoneUsageTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<DailyStatus>({
    hasStarted: false,
    hasReflected: false,
    dayStart: null,
    dayReflection: null,
    reflectionTime: null,
    phoneUsage: null,
  });

  // 加载今日状态
  const loadTodayStatus = async () => {
    try {
      const response = await dailyAPI.getTodayStatus();
      setDailyStatus(response.data);
    } catch (error) {
      console.error('加载今日状态失败:', error);
    }
  };

  useEffect(() => {
    loadTodayStatus();
  }, []);

  // 根据传入的模式自动打开对应的模态框
  useEffect(() => {
    if (mode === 'start') {
      // 设置开启内容为已保存的内容
      setStartContent(dailyStatus.dayStart || '');
      setShowStartModal(true);
    } else if (mode === 'reflection') {
      // 设置复盘内容为已保存的内容
      if (dailyStatus.dayReflection) {
        const parts = dailyStatus.dayReflection.split('\n\n明天计划：\n');
        setReflectionContent(parts[0] || '');
        setTomorrowPlan(parts[1] || '');
      }
      // 设置手机使用时间
      setPhoneUsageTime(dailyStatus.phoneUsage ? dailyStatus.phoneUsage.toString() : '');
      setShowReflectionModal(true);
    }
  }, [mode, dailyStatus]);

  // 关闭模态框的处理函数
  const handleCloseStartModal = () => {
    setShowStartModal(false);
    onClose?.();
  };

  const handleCloseReflectionModal = () => {
    setShowReflectionModal(false);
    onClose?.();
  };

  // 解析复盘内容
  useEffect(() => {
    if (dailyStatus.dayReflection) {
      const parts = dailyStatus.dayReflection.split('\n\n明天计划：\n');
      setReflectionContent(parts[0] || '');
      setTomorrowPlan(parts[1] || '');
    } else {
      setReflectionContent('');
      setTomorrowPlan('');
    }
  }, [dailyStatus.dayReflection]);

  // 开启新的一天
  const handleStartDay = async () => {
    if (!startContent.trim()) return;

    try {
      setLoading(true);
      await dailyAPI.updateDayStart({ dayStart: startContent.trim() });
      await loadTodayStatus();
      setStartContent('');
      setShowStartModal(false);
      onSave?.(); // 触发保存回调
      onClose?.();
    } catch (error: any) {
      console.error('开启失败:', error);
      alert(error.response?.data?.message || '开启失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 完成复盘
  const handleReflection = async () => {
    if (!reflectionContent.trim()) return;

    try {
      setLoading(true);
      const fullReflection = tomorrowPlan.trim()
        ? `${reflectionContent.trim()}\n\n明天计划：\n${tomorrowPlan.trim()}`
        : reflectionContent.trim();

      const requestData: any = { dayReflection: fullReflection };

      // 如果填写了手机使用时间，添加到请求中
      if (phoneUsageTime && phoneUsageTime.trim() !== '') {
        const phoneUsageMinutes = parseInt(phoneUsageTime);
        if (!isNaN(phoneUsageMinutes) && phoneUsageMinutes > 0) {
          requestData.phoneUsage = phoneUsageMinutes;
        }
      }

      await dailyAPI.updateDayReflection(requestData);
      await loadTodayStatus();
      setShowReflectionModal(false);
      onSave?.(); // 触发保存回调
      onClose?.();
    } catch (error: any) {
      console.error('复盘失败:', error);
      alert(error.response?.data?.message || '复盘失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 打开开启模态框
  const openStartModal = () => {
    setStartContent(dailyStatus.dayStart || '');
    setShowStartModal(true);
  };

  // 打开复盘模态框
  const openReflectionModal = () => {
    if (dailyStatus.dayReflection) {
      const parts = dailyStatus.dayReflection.split('\n\n明天计划：\n');
      setReflectionContent(parts[0] || '');
      setTomorrowPlan(parts[1] || '');
    }
    setPhoneUsageTime(''); // 重置手机使用时间
    setShowReflectionModal(true);
  };

  return (
    <>

      {/* 开启模态框 */}
      {showStartModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sunrise size={24} style={{ color: '#4299e1' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                  开启新的一天
                </h3>
              </div>
              <button
                onClick={handleCloseStartModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  borderRadius: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}>
                今日目标与计划
              </label>
              <textarea
                value={startContent}
                onChange={(e) => setStartContent(e.target.value)}
                placeholder="写下今天的学习目标、重要任务或想要完成的事情..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  resize: 'vertical',
                }}
                rows={4}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseStartModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleStartDay}
                disabled={!startContent.trim() || loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#4299e1',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: !startContent.trim() || loading ? 'not-allowed' : 'pointer',
                  opacity: !startContent.trim() || loading ? 0.6 : 1,
                }}
              >
                <CheckCircle size={16} />
                {loading ? '保存中...' : '确认开启'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 复盘模态框 */}
      {showReflectionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Moon size={24} style={{ color: '#ed8936' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                  今日复盘总结
                </h3>
              </div>
              <button
                onClick={handleCloseReflectionModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  borderRadius: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}>
                今日总结与反思
              </label>
              <textarea
                value={reflectionContent}
                onChange={(e) => setReflectionContent(e.target.value)}
                placeholder="回顾今天的学习和生活，写下收获、感悟或需要改进的地方..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  resize: 'vertical',
                }}
                rows={4}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}>
                手机使用时间 (分钟，可选)
              </label>
              <input
                type="number"
                value={phoneUsageTime}
                onChange={(e) => setPhoneUsageTime(e.target.value)}
                placeholder="今日手机使用时间（分钟）"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}>
                明天计划 (可选)
              </label>
              <textarea
                value={tomorrowPlan}
                onChange={(e) => setTomorrowPlan(e.target.value)}
                placeholder="为明天制定计划和目标..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '0.75rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  resize: 'vertical',
                }}
                rows={3}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleCloseReflectionModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleReflection}
                disabled={!reflectionContent.trim() || loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#ed8936',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: !reflectionContent.trim() || loading ? 'not-allowed' : 'pointer',
                  opacity: !reflectionContent.trim() || loading ? 0.6 : 1,
                }}
              >
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
