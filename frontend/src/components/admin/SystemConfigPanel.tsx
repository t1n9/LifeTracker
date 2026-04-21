'use client';

import { useEffect, useState } from 'react';
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

const CONFIG_LABELS: Record<string, string> = {
  registration_enabled: '用户注册开关',
  site_name: '网站名称',
  site_description: '网站描述',
};

const getConfigLabel = (key: string) => CONFIG_LABELS[key] || key;

export default function SystemConfigPanel() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const updateConfig = async (key: string, value: string, description?: string, isPublic?: boolean) => {
    try {
      setSaving(key);
      await systemConfigAPI.updateConfig(key, { value, description, isPublic });
      setMessage({ type: 'success', text: '配置更新成功' });
      await loadConfigs();
    } catch (error: any) {
      console.error('更新配置失败:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || '更新配置失败' });
    } finally {
      setSaving(null);
    }
  };

  const toggleBooleanConfig = async (config: SystemConfig) => {
    const newValue = config.value === 'true' ? 'false' : 'true';
    await updateConfig(config.key, newValue, config.description, config.isPublic);
  };

  useEffect(() => {
    void loadConfigs();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        加载配置中...
      </div>
    );
  }

  return (
    <div style={{ padding: '0.25rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          系统配置管理
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          管理系统关键配置项，修改后会立即生效。
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: '0.72rem 0.9rem',
            marginBottom: '1rem',
            borderRadius: '12px',
            border: message.type === 'success'
              ? '1px solid color-mix(in srgb, var(--success-color) 34%, transparent 66%)'
              : '1px solid color-mix(in srgb, var(--error-color) 34%, transparent 66%)',
            background: message.type === 'success'
              ? 'color-mix(in srgb, var(--success-color) 12%, transparent 88%)'
              : 'color-mix(in srgb, var(--error-color) 10%, transparent 90%)',
            color: message.type === 'success' ? 'var(--success-color)' : 'var(--error-color)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.9rem' }}>
        {configs.map((config) => {
          const isBooleanSwitch = config.key === 'registration_enabled';
          const isSaving = saving === config.key;

          return (
            <div
              key={config.key}
              style={{
                padding: '1rem',
                borderRadius: '16px',
                border: '1px solid color-mix(in srgb, var(--border-color) 76%, transparent 24%)',
                background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
                boxShadow: '0 12px 28px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '0.8rem',
                  marginBottom: '0.8rem',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    {getConfigLabel(config.key)}
                  </h3>
                  {config.description && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.6 }}>
                      {config.description}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '999px',
                    fontWeight: 700,
                    border: '1px solid',
                    borderColor: config.isPublic
                      ? 'color-mix(in srgb, var(--success-color) 36%, transparent 64%)'
                      : 'color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
                    background: config.isPublic
                      ? 'color-mix(in srgb, var(--success-color) 14%, transparent 86%)'
                      : 'color-mix(in srgb, var(--bg-tertiary) 88%, white 12%)',
                    color: config.isPublic ? 'var(--success-color)' : 'var(--text-muted)',
                  }}
                >
                  {config.isPublic ? '公开' : '私有'}
                </span>
              </div>

              {isBooleanSwitch ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.7rem' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
                    当前状态：{config.value === 'true' ? '已开启' : '已关闭'}
                  </span>
                  <button
                    onClick={() => void toggleBooleanConfig(config)}
                    disabled={isSaving}
                    style={{
                      border: '1px solid transparent',
                      borderRadius: '10px',
                      padding: '0.48rem 0.78rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#fff',
                      background: config.value === 'true'
                        ? 'color-mix(in srgb, var(--error-color) 92%, black 8%)'
                        : 'color-mix(in srgb, var(--success-color) 92%, black 8%)',
                      opacity: isSaving ? 0.6 : 1,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSaving ? '更新中...' : config.value === 'true' ? '关闭注册' : '开启注册'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.7rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>当前值</span>
                  <input
                    type="text"
                    value={config.value}
                    onChange={(e) => {
                      const next = configs.map((item) => (
                        item.key === config.key ? { ...item, value: e.target.value } : item
                      ));
                      setConfigs(next);
                    }}
                    onBlur={(e) => {
                      if (e.target.value !== config.value) {
                        void updateConfig(config.key, e.target.value, config.description, config.isPublic);
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      borderRadius: '10px',
                      border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
                      background: 'color-mix(in srgb, var(--bg-primary) 90%, white 10%)',
                      color: 'var(--text-primary)',
                      padding: '0.52rem 0.72rem',
                      fontSize: '0.86rem',
                    }}
                  />
                </div>
              )}

              <div style={{ marginTop: '0.7rem', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                更新时间：{new Date(config.updatedAt).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <button
          onClick={() => void loadConfigs()}
          disabled={loading}
          style={{
            padding: '0.62rem 1rem',
            borderRadius: '12px',
            border: '1px solid color-mix(in srgb, var(--border-color) 78%, transparent 22%)',
            background: 'color-mix(in srgb, var(--bg-secondary) 90%, white 10%)',
            color: 'var(--text-primary)',
            fontSize: '0.84rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '刷新中...' : '刷新配置'}
        </button>
      </div>
    </div>
  );
}
