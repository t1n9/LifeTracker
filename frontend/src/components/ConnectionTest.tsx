'use client';

import { useState } from 'react';

export default function ConnectionTest() {
  const [status, setStatus] = useState('未测试');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setStatus('测试中...');

    try {
      const response = await fetch('http://localhost:3001/api/health');
      if (response.ok) {
        const data = await response.json();
        setStatus(`✅ 连接成功: ${data.status}`);
      } else {
        setStatus(`❌ 连接失败: ${response.status}`);
      }
    } catch (error) {
      setStatus(`❌ 网络错误: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: 'white',
      padding: '1rem',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      border: '1px solid #e5e7eb',
      zIndex: 1000
    }}>
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontWeight: 'bold' }}>
        API连接测试
      </h3>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem' }}>
        状态: {status}
      </p>
      <button
        onClick={testConnection}
        disabled={loading}
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.75rem',
          backgroundColor: loading ? '#f3f4f6' : '#2196f3',
          color: loading ? '#666' : 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '测试中...' : '测试连接'}
      </button>
    </div>
  );
}
