'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Flag,
  MessageSquare,
  Tag,
  User,
  XCircle,
} from 'lucide-react';
import { suggestionsAPI } from '@/lib/api';

interface Suggestion {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: 'bug' | 'feature' | 'improvement' | 'other' | null;
  adminReply: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
  reviewer: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface SuggestionStats {
  total: number;
  pending: number;
  reviewed: number;
  implemented: number;
  rejected: number;
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'pending':
      return '待处理';
    case 'reviewed':
      return '已审核';
    case 'implemented':
      return '已实现';
    case 'rejected':
      return '已拒绝';
    default:
      return '未知';
  }
};

const getPriorityText = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return '紧急';
    case 'high':
      return '高';
    case 'normal':
      return '普通';
    case 'low':
      return '低';
    default:
      return '未知';
  }
};

const getCategoryText = (category: string | null) => {
  switch (category) {
    case 'bug':
      return '问题反馈';
    case 'feature':
      return '功能建议';
    case 'improvement':
      return '体验改进';
    case 'other':
      return '其他';
    default:
      return '未分类';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock size={16} color="#f59e0b" />;
    case 'reviewed':
      return <Eye size={16} color="#3b82f6" />;
    case 'implemented':
      return <CheckCircle size={16} color="#10b981" />;
    case 'rejected':
      return <XCircle size={16} color="#ef4444" />;
    default:
      return <Clock size={16} color="#9ca3af" />;
  }
};

const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return <AlertTriangle size={16} color="#ef4444" />;
    case 'high':
      return <Flag size={16} color="#f97316" />;
    case 'normal':
      return <Flag size={16} color="#3b82f6" />;
    case 'low':
      return <Flag size={16} color="#9ca3af" />;
    default:
      return <Flag size={16} color="#9ca3af" />;
  }
};

export default function SuggestionManagement() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<SuggestionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [adminReply, setAdminReply] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const response = await suggestionsAPI.getSuggestions(true);
      setSuggestions(response.data);
    } catch (error) {
      console.error('加载建议失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await suggestionsAPI.getSuggestionStats();
      setStats(response.data);
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  };

  const exportSuggestions = async () => {
    try {
      setLoading(true);
      const response = await suggestionsAPI.exportAllSuggestions();
      const allSuggestions = response.data;
      const dataToExport = allSuggestions.map((item: any) => ({
        建议ID: item.id,
        标题: item.title,
        内容: item.content,
        状态: getStatusText(item.status),
        优先级: getPriorityText(item.priority),
        分类: getCategoryText(item.category),
        提交者: item.user.name,
        提交者邮箱: item.user.email,
        提交时间: new Date(item.createdAt).toLocaleString('zh-CN'),
        管理员回复: item.adminReply || '无',
        审核时间: item.reviewedAt ? new Date(item.reviewedAt).toLocaleString('zh-CN') : '未审核',
        审核者: item.reviewer?.name || '无',
      }));
      const headers = Object.keys(dataToExport[0] || {});
      const csv = [
        headers.join(','),
        ...dataToExport.map((row: any) => headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `系统建议_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('导出建议失败:', error);
      alert('导出失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion);
    setAdminReply(suggestion.adminReply || '');
    setNewStatus(suggestion.status);
    setShowDetailModal(true);
  };

  const handleUpdateSuggestion = async () => {
    if (!selectedSuggestion) return;
    try {
      setUpdating(true);
      await suggestionsAPI.updateSuggestion(selectedSuggestion.id, {
        status: newStatus,
        adminReply: adminReply.trim() || undefined,
      });
      await loadSuggestions();
      await loadStats();
      setShowDetailModal(false);
      setSelectedSuggestion(null);
    } catch (error: any) {
      console.error('更新建议失败:', error);
      alert(error.response?.data?.message || '更新失败，请重试');
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    void loadSuggestions();
    void loadStats();
  }, []);

  const filteredSuggestions = useMemo(() => (
    suggestions.filter((s) => (filter === 'all' ? true : s.status === filter))
  ), [filter, suggestions]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ padding: '0.25rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', gap: '0.8rem', flexWrap: 'wrap' }}>
        <div>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <MessageSquare size={22} />
            系统建议管理
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            统一查看与处理用户反馈建议。
          </p>
        </div>
        <button
          onClick={() => void exportSuggestions()}
          disabled={suggestions.length === 0}
          style={{
            padding: '0.56rem 0.95rem',
            background: 'color-mix(in srgb, var(--success-color) 88%, black 12%)',
            color: '#fff',
            border: '1px solid color-mix(in srgb, var(--success-color) 34%, transparent 66%)',
            borderRadius: '10px',
            cursor: suggestions.length === 0 ? 'not-allowed' : 'pointer',
            opacity: suggestions.length === 0 ? 0.55 : 1,
            fontSize: '0.84rem',
            fontWeight: 700,
          }}
        >
          导出所有建议 ({suggestions.length})
        </button>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
          {[
            { label: '总建议数', value: stats.total, color: 'var(--text-primary)' },
            { label: '待处理', value: stats.pending, color: '#f59e0b' },
            { label: '已实现', value: stats.implemented, color: '#10b981' },
            { label: '已拒绝', value: stats.rejected, color: '#ef4444' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: '0.95rem',
                borderRadius: '14px',
                border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
                background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
              }}
            >
              <div style={{ fontSize: '1.7rem', fontWeight: 700, color: item.color, lineHeight: 1 }}>{item.value}</div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '0.9rem', display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        {[
          { key: 'all', label: '全部' },
          { key: 'pending', label: '待处理' },
          { key: 'reviewed', label: '已审核' },
          { key: 'implemented', label: '已实现' },
          { key: 'rejected', label: '已拒绝' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '999px',
              border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
              background: filter === key
                ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                : 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
              color: filter === key ? '#fff' : 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '0.8rem' }}>
        {filteredSuggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => handleViewDetail(suggestion)}
            style={{
              textAlign: 'left',
              padding: '1rem',
              borderRadius: '14px',
              border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
              background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.7rem', marginBottom: '0.65rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.32rem' }}>
                  {suggestion.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: 1.6 }}>
                  {suggestion.content.length > 140 ? `${suggestion.content.slice(0, 140)}...` : suggestion.content}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                {getStatusIcon(suggestion.status)}
                {getPriorityIcon(suggestion.priority)}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <User size={12} />
                {suggestion.user.name}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <Tag size={12} />
                {getCategoryText(suggestion.category)}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <Calendar size={12} />
                {new Date(suggestion.createdAt).toLocaleDateString()}
              </span>
              <span>{getStatusText(suggestion.status)} · {getPriorityText(suggestion.priority)}</span>
            </div>
          </button>
        ))}

        {filteredSuggestions.length === 0 && (
          <div
            style={{
              padding: '2.2rem',
              textAlign: 'center',
              color: 'var(--text-secondary)',
              borderRadius: '14px',
              border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
              background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
            }}
          >
            <MessageSquare size={42} style={{ margin: '0 auto 0.6rem', opacity: 0.45 }} />
            暂无{filter === 'all' ? '' : getStatusText(filter)}建议
          </div>
        )}
      </div>

      {showDetailModal && selectedSuggestion && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: 'min(760px, 100%)',
              maxHeight: '88vh',
              overflow: 'auto',
              borderRadius: '18px',
              border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
              background: 'color-mix(in srgb, var(--bg-primary) 94%, white 6%)',
              boxShadow: '0 26px 56px rgba(15, 23, 42, 0.22)',
              padding: '1rem',
            }}
          >
            <h3 style={{ fontSize: '1.06rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.8rem' }}>
              {selectedSuggestion.title}
            </h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.7rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>提交者：{selectedSuggestion.user.name}</span>
              <span>分类：{getCategoryText(selectedSuggestion.category)}</span>
              <span>优先级：{getPriorityText(selectedSuggestion.priority)}</span>
              <span>状态：{getStatusText(selectedSuggestion.status)}</span>
            </div>

            <div
              style={{
                padding: '0.8rem',
                borderRadius: '12px',
                border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
                background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                marginBottom: '0.8rem',
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            >
              {selectedSuggestion.content}
            </div>

            <div style={{ marginBottom: '0.8rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700 }}>
                状态
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '10px',
                  border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
                  background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                }}
              >
                <option value="pending">待处理</option>
                <option value="reviewed">已审核</option>
                <option value="implemented">已实现</option>
                <option value="rejected">已拒绝</option>
              </select>
            </div>

            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', marginBottom: '0.35rem', color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700 }}>
                管理员回复
              </label>
              <textarea
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                placeholder="回复用户的建议..."
                rows={4}
                style={{
                  width: '100%',
                  borderRadius: '10px',
                  border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
                  background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                  color: 'var(--text-primary)',
                  fontSize: '0.84rem',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  padding: '0.6rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem' }}>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  padding: '0.56rem 0.9rem',
                  borderRadius: '10px',
                  border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
                  background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={() => void handleUpdateSuggestion()}
                disabled={updating}
                style={{
                  padding: '0.56rem 0.9rem',
                  borderRadius: '10px',
                  border: '1px solid color-mix(in srgb, var(--accent-primary) 32%, transparent 68%)',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: updating ? 'not-allowed' : 'pointer',
                  opacity: updating ? 0.65 : 1,
                }}
              >
                {updating ? '更新中...' : '更新建议'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
