'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Eye, CheckCircle, XCircle, Clock, AlertTriangle, User, Calendar, Tag, Flag } from 'lucide-react';
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

  // 导出建议数据
  const exportSuggestions = async () => {
    try {
      setLoading(true);
      const response = await suggestionsAPI.exportAllSuggestions();
      const allSuggestions = response.data;

      const dataToExport = allSuggestions.map((suggestion: any) => ({
        '建议ID': suggestion.id,
        '标题': suggestion.title,
        '内容': suggestion.content,
        '状态': getStatusText(suggestion.status),
        '优先级': getPriorityText(suggestion.priority),
        '分类': getCategoryText(suggestion.category),
        '提交者': suggestion.user.name,
        '提交者邮箱': suggestion.user.email,
        '提交时间': new Date(suggestion.createdAt).toLocaleString('zh-CN'),
        '管理员回复': suggestion.adminReply || '无',
        '审核时间': suggestion.reviewedAt ? new Date(suggestion.reviewedAt).toLocaleString('zh-CN') : '未审核',
        '审核者': suggestion.reviewer?.name || '无'
      }));

      // 转换为CSV格式
      const headers = Object.keys(dataToExport[0] || {});
      const csvContent = [
        headers.join(','),
        ...dataToExport.map((row: any) =>
          headers.map(header => `"${String(row[header]).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');

      // 下载文件
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `系统建议_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log(`✅ 已导出 ${allSuggestions.length} 条建议`);
    } catch (error) {
      console.error('导出建议失败:', error);
      alert('导出失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
    loadStats();
  }, []);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const response = await suggestionsAPI.getSuggestions(true); // 管理员查看所有建议
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

      // 重新加载数据
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="text-yellow-500" />;
      case 'reviewed': return <Eye size={16} className="text-blue-500" />;
      case 'implemented': return <CheckCircle size={16} className="text-green-500" />;
      case 'rejected': return <XCircle size={16} className="text-red-500" />;
      default: return <Clock size={16} className="text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待处理';
      case 'reviewed': return '已审核';
      case 'implemented': return '已实现';
      case 'rejected': return '已拒绝';
      default: return '未知';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertTriangle size={16} className="text-red-500" />;
      case 'high': return <Flag size={16} className="text-orange-500" />;
      case 'normal': return <Flag size={16} className="text-blue-500" />;
      case 'low': return <Flag size={16} className="text-gray-500" />;
      default: return <Flag size={16} className="text-gray-500" />;
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'urgent': return '紧急';
      case 'high': return '高';
      case 'normal': return '普通';
      case 'low': return '低';
      default: return '未知';
    }
  };

  const getCategoryText = (category: string | null) => {
    switch (category) {
      case 'bug': return '问题反馈';
      case 'feature': return '功能建议';
      case 'improvement': return '体验改进';
      case 'other': return '其他';
      default: return '未分类';
    }
  };

  const filteredSuggestions = suggestions.filter(suggestion => {
    if (filter === 'all') return true;
    return suggestion.status === filter;
  });

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <MessageSquare size={24} />
              系统建议管理
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              管理用户提交的系统建议和反馈
            </p>
          </div>
          <button
            onClick={exportSuggestions}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: suggestions.length === 0 ? 'not-allowed' : 'pointer',
              opacity: suggestions.length === 0 ? 0.5 : 1,
              fontSize: '0.875rem',
              fontWeight: '500',
            }}
            disabled={suggestions.length === 0}
          >
            导出所有建议 ({suggestions.length})
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              总建议数
            </div>
          </div>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#f59e0b' }}>
              {stats.pending}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              待处理
            </div>
          </div>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#10b981' }}>
              {stats.implemented}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              已实现
            </div>
          </div>
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '2rem', fontWeight: '600', color: '#ef4444' }}>
              {stats.rejected}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              已拒绝
            </div>
          </div>
        </div>
      )}

      {/* 筛选器 */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                padding: '0.5rem 1rem',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                backgroundColor: filter === key ? 'var(--primary-color)' : 'var(--bg-secondary)',
                color: filter === key ? 'white' : 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 建议列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredSuggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => handleViewDetail(suggestion)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-color)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  margin: '0 0 0.5rem 0',
                }}>
                  {suggestion.title}
                </h3>
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  margin: '0 0 1rem 0',
                  lineHeight: '1.5',
                }}>
                  {suggestion.content.length > 150 
                    ? suggestion.content.substring(0, 150) + '...' 
                    : suggestion.content}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {getStatusIcon(suggestion.status)}
                {getPriorityIcon(suggestion.priority)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <User size={12} />
                  {suggestion.user.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Tag size={12} />
                  {getCategoryText(suggestion.category)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Calendar size={12} />
                  {new Date(suggestion.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{getStatusText(suggestion.status)}</span>
                <span>·</span>
                <span>{getPriorityText(suggestion.priority)}</span>
              </div>
            </div>
          </div>
        ))}

        {filteredSuggestions.length === 0 && (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}>
            <MessageSquare size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>暂无{filter === 'all' ? '' : getStatusText(filter)}建议</p>
          </div>
        )}
      </div>

      {/* 详情模态框 */}
      {showDetailModal && selectedSuggestion && (
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
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: 'var(--text-primary)',
                margin: '0 0 1rem 0',
              }}>
                {selectedSuggestion.title}
              </h3>
              
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <div>提交者: {selectedSuggestion.user.name}</div>
                <div>分类: {getCategoryText(selectedSuggestion.category)}</div>
                <div>优先级: {getPriorityText(selectedSuggestion.priority)}</div>
                <div>状态: {getStatusText(selectedSuggestion.status)}</div>
              </div>

              <div style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '6px',
                marginBottom: '1.5rem',
              }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>详细内容：</h4>
                <p style={{ lineHeight: '1.6', margin: 0 }}>{selectedSuggestion.content}</p>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}>
                  状态
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="pending">待处理</option>
                  <option value="reviewed">已审核</option>
                  <option value="implemented">已实现</option>
                  <option value="rejected">已拒绝</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}>
                  管理员回复
                </label>
                <textarea
                  value={adminReply}
                  onChange={(e) => setAdminReply(e.target.value)}
                  placeholder="回复用户的建议..."
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '0.75rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    resize: 'vertical',
                  }}
                  rows={4}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={handleUpdateSuggestion}
                disabled={updating}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: updating ? 'var(--text-muted)' : 'var(--primary-color)',
                  color: 'white',
                  fontSize: '0.875rem',
                  cursor: updating ? 'not-allowed' : 'pointer',
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
