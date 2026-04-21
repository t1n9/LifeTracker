'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, FileText, PencilLine, Save, Sparkles, X } from 'lucide-react';
import { importantInfoAPI } from '@/lib/api';
import {
  AGENT_DATA_CHANGED_EVENT,
  eventAffectsDomains,
} from '@/lib/agent-events';
import styles from './ImportantInfo.module.css';

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

const templateContent = `考试时间：2026 年 12 月 20 日
考试地点：待确认
准考证打印：考前一周
目标院校：待补充
重点复习：数学、英语、政治、专业课
注意事项：身份证、准考证、文具`;

const ImportantInfo: React.FC<ImportantInfoProps> = () => {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadCurrentInfo = async () => {
    try {
      setLoading(true);
      const response = await importantInfoAPI.getCurrentInfo();
      const data = response.data.data;

      setContent(data?.content || '');

      if (data?.lastUpdated) {
        const parsedDate = new Date(data.lastUpdated);
        setLastUpdated(Number.isNaN(parsedDate.getTime()) ? null : parsedDate);
      } else {
        setLastUpdated(null);
      }
    } catch (error) {
      console.error('加载重要信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveInfo = async () => {
    try {
      setLoading(true);
      const response = await importantInfoAPI.updateInfo(tempContent);
      const data = response.data.data;

      if (data?.updated) {
        setContent(data.content || '');

        if (data.lastUpdated) {
          const parsedDate = new Date(data.lastUpdated);
          setLastUpdated(Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate);
        } else {
          setLastUpdated(new Date());
        }
      }

      setIsEditing(false);
      setTempContent('');
    } catch (error) {
      console.error('保存重要信息失败:', error);
      alert(`保存失败：${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = () => {
    setTempContent(content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setTempContent('');
    setIsEditing(false);
  };

  useEffect(() => {
    loadCurrentInfo();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      if (eventAffectsDomains(event, ['importantInfo'])) {
        loadCurrentInfo();
      }
    };

    window.addEventListener(AGENT_DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(AGENT_DATA_CHANGED_EVENT, handler);
  }, []);

  const formatLastUpdated = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) {
      return '';
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '刚刚更新';
    if (minutes < 60) return `${minutes} 分钟前更新`;
    if (hours < 24) return `${hours} 小时前更新`;
    if (days < 7) return `${days} 天前更新`;
    return date.toLocaleDateString();
  };

  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titleWrap}>
          <div className={styles.iconWrap}>
            <AlertCircle size={18} />
          </div>
          <div>
            <h3 className={styles.title}>重要信息</h3>
            <p className={styles.subtitle}>把考试、节点、提醒和临时事项集中放在这里。</p>
          </div>
        </div>

        {!isEditing ? (
          <button
            className={styles.secondaryButton}
            onClick={startEdit}
            disabled={loading}
          >
            <PencilLine size={16} />
            编辑
          </button>
        ) : (
          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              onClick={saveInfo}
              disabled={loading}
            >
              <Save size={16} />
              {loading ? '保存中...' : '保存'}
            </button>
            <button
              className={styles.secondaryButton}
              onClick={cancelEdit}
              disabled={loading}
            >
              <X size={16} />
              取消
            </button>
          </div>
        )}
      </header>

      {lastUpdated && <div className={styles.timestamp}>{formatLastUpdated(lastUpdated)}</div>}

      {isEditing ? (
        <div className={styles.editorWrap}>
          <textarea
            value={tempContent}
            onChange={(e) => setTempContent(e.target.value)}
            placeholder="输入需要长期记住的重要信息..."
            className={styles.textarea}
            disabled={loading}
          />
          <div className={styles.hint}>支持换行。保存后会覆盖当前展示内容。</div>
        </div>
      ) : content ? (
        <div className={styles.content}>{content}</div>
      ) : (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <FileText size={20} />
          </div>
          <p className={styles.emptyTitle}>还没有重要信息</p>
          <p className={styles.emptyText}>把最近必须记住的事项放在这里，首页会更像一个真正的工作台。</p>
        </div>
      )}

      {isEditing && !tempContent.trim() && (
        <div className={styles.template}>
          <div className={styles.templateTitle}>
            <Sparkles size={16} />
            建议模板
          </div>
          <div className={styles.templateContent}>{templateContent}</div>
          <button
            onClick={() => setTempContent(templateContent)}
            className={styles.secondaryButton}
            disabled={loading}
          >
            使用模板
          </button>
        </div>
      )}
    </section>
  );
};

export default ImportantInfo;
