'use client';

import { useState, useEffect } from 'react';
import { systemConfigAPI } from '@/lib/api';

interface SystemConfig {
  id: number;
  key: string;
  value: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SystemConfigPanel() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 加载配置
  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await systemConfigAPI.getAllConfigs();
      setConfigs(response.data);
    } catch (error: any) {
      console.error('加载配置失败:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || '加载配置失败' });
    } finally {
      setLoading(false);
    }
  };

  // 更新配置
  const updateConfig = async (key: string, value: string, description?: string, isPublic?: boolean) => {
    try {
      setSaving(key);
      await systemConfigAPI.updateConfig(key, { value, description, isPublic });
      setMessage({ type: 'success', text: '配置更新成功' });
      await loadConfigs(); // 重新加载配置
    } catch (error: any) {
      console.error('更新配置失败:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || '更新配置失败' });
    } finally {
      setSaving(null);
    }
  };

  // 切换布尔值配置
  const toggleBooleanConfig = async (config: SystemConfig) => {
    const newValue = config.value === 'true' ? 'false' : 'true';
    await updateConfig(config.key, newValue, config.description, config.isPublic);
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  // 清除消息
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>加载配置中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: 'var(--text-primary)',
          marginBottom: '0.5rem'
        }}>
          系统配置管理
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          管理系统的各项配置设置
        </p>
      </div>

      {/* 消息提示 */}
      {message && (
        <div style={{
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          borderRadius: '8px',
          backgroundColor: message.type === 'success' ? '#dcfce7' : '#fef2f2',
          border: `1px solid ${message.type === 'success' ? '#16a34a' : '#dc2626'}`,
          color: message.type === 'success' ? '#15803d' : '#dc2626',
          fontSize: '0.875rem'
        }}>
          {message.text}
        </div>
      )}

      {/* 配置列表 */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {configs.map((config) => (
          <div key={config.key} style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  fontSize: '1.125rem', 
                  fontWeight: '600', 
                  color: 'var(--text-primary)',
                  marginBottom: '0.25rem'
                }}>
                  {config.key === 'registration_enabled' ? '用户注册开关' :
                   config.key === 'site_name' ? '网站名称' :
                   config.key === 'site_description' ? '网站描述' :
                   config.key}
                </h3>
                {config.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    {config.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '4px',
                    backgroundColor: config.isPublic ? '#dcfce7' : '#f3f4f6',
                    color: config.isPublic ? '#15803d' : '#6b7280'
                  }}>
                    {config.isPublic ? '公开' : '私有'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    更新时间: {new Date(config.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 配置值控制 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {config.key === 'registration_enabled' ? (
                // 注册开关
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                    注册功能: {config.value === 'true' ? '已开启' : '已关闭'}
                  </span>
                  <button
                    onClick={() => toggleBooleanConfig(config)}
                    disabled={saving === config.key}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: config.value === 'true' ? '#dc2626' : '#16a34a',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: saving === config.key ? 'not-allowed' : 'pointer',
                      opacity: saving === config.key ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {saving === config.key ? '更新中...' : 
                     config.value === 'true' ? '关闭注册' : '开启注册'}
                  </button>
                </div>
              ) : (
                // 文本配置
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '500', minWidth: '60px' }}>
                    当前值:
                  </span>
                  <input
                    type="text"
                    value={config.value}
                    onChange={(e) => {
                      const newConfigs = configs.map(c => 
                        c.key === config.key ? { ...c, value: e.target.value } : c
                      );
                      setConfigs(newConfigs);
                    }}
                    onBlur={(e) => {
                      if (e.target.value !== config.value) {
                        updateConfig(config.key, e.target.value, config.description, config.isPublic);
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 刷新按钮 */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button
          onClick={loadConfigs}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          {loading ? '刷新中...' : '刷新配置'}
        </button>
      </div>
    </div>
  );
}
