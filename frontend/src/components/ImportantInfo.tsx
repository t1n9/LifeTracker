'use client';

import React, { useState, useEffect } from 'react';
import { importantInfoAPI } from '@/lib/api';
import {
  AGENT_DATA_CHANGED_EVENT,
  eventAffectsDomains,
} from '@/lib/agent-events';

interface ImportantInfoProps {
  theme?: 'light' | 'dark';
}

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null) {
    const errorWithMessage = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };

    return errorWithMessage.response?.data?.message || errorWithMessage.message || '未知错误';
  }

  return '未知错误';
};

const ImportantInfo: React.FC<ImportantInfoProps> = ({ theme = 'light' }) => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 加载当前重要信息
  const loadCurrentInfo = async () => {
    try {
      setLoading(true);
      const response = await importantInfoAPI.getCurrentInfo();
      // 后端返回格式: { data: { content: '...', lastUpdated: '...' } }
      const data = response.data.data;

      setContent(data?.content || '');

      // 安全地解析时间
      if (data?.lastUpdated) {
        try {
          const parsedDate = new Date(data.lastUpdated);
          // 检查日期是否有效
          if (!isNaN(parsedDate.getTime())) {
            setLastUpdated(parsedDate);
          } else {
            console.warn('Invalid date format:', data.lastUpdated);
            setLastUpdated(null);
          }
        } catch (error) {
          console.warn('Failed to parse date:', data.lastUpdated, error);
          setLastUpdated(null);
        }
      } else {
        setLastUpdated(null);
      }
    } catch (error) {
      console.error('❌ 加载重要信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存重要信息
  const saveInfo = async () => {
    try {
      setLoading(true);
      const response = await importantInfoAPI.updateInfo(tempContent);
      // 后端返回格式: { data: { content: '...', updated: true }, message: '...' }
      const data = response.data.data;

      if (data?.updated) {
        setContent(data.content);

        // 使用后端返回的更新时间，如果没有则使用当前时间
        if (data.lastUpdated) {
          try {
            const parsedDate = new Date(data.lastUpdated);
            if (!isNaN(parsedDate.getTime())) {
              setLastUpdated(parsedDate);
            } else {
              setLastUpdated(new Date());
            }
          } catch (error) {
            console.warn('Failed to parse lastUpdated from save response:', error);
            setLastUpdated(new Date());
          }
        } else {
          setLastUpdated(new Date());
        }
      }

      setIsEditing(false);
      setTempContent('');
    } catch (error) {
      console.error('保存重要信息失败:', error);
      alert(`保存失败: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 开始编辑
  const startEdit = () => {
    setTempContent(content);
    setIsEditing(true);
  };

  // 取消编辑
  const cancelEdit = () => {
    setTempContent('');
    setIsEditing(false);
  };

  // 组件加载时获取数据
  useEffect(() => {
    loadCurrentInfo();
  }, []);

  // Agent 操作后刷新
  useEffect(() => {
    const handler = (event: Event) => {
      if (eventAffectsDomains(event, ['importantInfo'])) {
        loadCurrentInfo();
      }
    };
    window.addEventListener(AGENT_DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler);
  }, []);

  // 格式化最后更新时间
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return '';

    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      console.warn('Invalid date in formatLastUpdated:', date);
      return '';
    }

    try {
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (minutes < 1) return '刚刚更新';
      if (minutes < 60) return `${minutes}分钟前更新`;
      if (hours < 24) return `${hours}小时前更新`;
      if (days < 7) return `${days}天前更新`;
      return date.toLocaleDateString();
    } catch (error) {
      console.warn('Error formatting date:', error);
      return '';
    }
  };

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            重要信息
          </h3>
          {lastUpdated && (
            <span className="text-xs opacity-60" style={{ color: 'var(--text-muted)' }}>
              {formatLastUpdated(lastUpdated)}
            </span>
          )}
        </div>
        
        {!isEditing ? (
          <button 
            className="btn btn-secondary btn-sm"
            onClick={startEdit}
            disabled={loading}
          >
            ✏️ 编辑
          </button>
        ) : (
          <div className="flex gap-2">
            <button 
              className="btn btn-primary btn-sm"
              onClick={saveInfo}
              disabled={loading}
            >
              {loading ? '保存中...' : '💾 保存'}
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={cancelEdit}
              disabled={loading}
            >
              ❌ 取消
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div>
          <textarea
            value={tempContent}
            onChange={(e) => setTempContent(e.target.value)}
            placeholder="输入重要信息..."
            className="w-full h-32 p-3 border rounded-lg resize-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              lineHeight: '1.5',
            }}
            disabled={loading}
          />
          <div className="mt-2 text-xs opacity-60" style={{ color: 'var(--text-muted)' }}>
            支持换行，保存后会自动记录历史版本
          </div>
        </div>
      ) : (
        <div>
          {content ? (
            <div style={{
              fontSize: '0.875rem',
              lineHeight: '1.5',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-line', // 保持换行格式
              wordBreak: 'break-word',
            }}>
              {content}
            </div>
          ) : (
            <div className="text-center py-8 opacity-60">
              <div className="text-2xl mb-2">📝</div>
              <p className="mb-2">还没有设置重要信息</p>
              <p className="text-xs opacity-75" style={{ color: 'var(--text-muted)' }}>点击右上角编辑按钮开始设置</p>
            </div>
          )}
        </div>
      )}

      {/* 预设模板建议 */}
      {isEditing && !tempContent && (
        <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <h4 className="font-medium mb-2 text-sm">建议内容：</h4>
          <div className="space-y-2 text-sm opacity-75">
            <div>📅 考试时间：2024年12月20日</div>
            <div>📍 考试地点：待确认</div>
            <div>📋 准考证打印：考前一周</div>
            <div>🎯 目标院校：XXX大学</div>
            <div>📚 重点复习：数学、英语、政治、专业课</div>
            <div>⚠️ 注意事项：身份证、准考证、文具</div>
          </div>
          <button
            onClick={() => setTempContent(`📅 考试时间：2024年12月20日
📍 考试地点：待确认
📋 准考证打印：考前一周
🎯 目标院校：XXX大学
📚 重点复习：数学、英语、政治、专业课
⚠️ 注意事项：身份证、准考证、文具`)}
            className="btn btn-sm btn-secondary mt-2"
            disabled={loading}
          >
            使用模板
          </button>
        </div>
      )}
    </div>
  );
};

export default ImportantInfo;
