'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '@/lib/api';
import styles from './UserManagement.module.css';

interface AuditLog {
  id: string;
  adminId: string;
  targetId: string | null;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
  admin: { id: string; email: string; name: string | null };
  target: { id: string; email: string; name: string | null } | null;
}

const ACTION_LABELS: Record<string, string> = {
  'user.role_change': '修改角色',
  'user.ban': '封禁用户',
  'user.unban': '解封用户',
  'subscription.update': '更新订阅',
};

export default function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getAuditLogs({ page: String(page), limit: String(limit) });
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatDate = (d: string | null) => {
    if (!d || typeof d !== 'string') return '-';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const getDetailText = (log: AuditLog) => {
    const d = log.detail as Record<string, unknown> | undefined;
    if (!d) return '';
    switch (log.action) {
      case 'user.role_change':
        return `${d.oldRole || '?'} → ${d.newRole || '?'}`;
      case 'user.ban':
        return d.reason ? `原因: ${d.reason}` : '';
      case 'subscription.update':
        return `方案: ${d.plan || '?'}, 状态: ${d.status || '?'}`;
      default:
        return JSON.stringify(d);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span className={styles.totalHint}>共 {total} 条操作记录</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>时间</th>
              <th>操作人</th>
              <th>操作对象</th>
              <th>动作</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className={styles.empty}>加载中...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className={styles.empty}>暂无数据</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className={styles.dateCell}>{formatDate(log.createdAt)}</td>
                  <td>
                    <span className={styles.userEmail}>{log.admin.name || log.admin.email}</span>
                  </td>
                  <td>
                    <span className={styles.userEmail}>
                      {log.target ? (log.target.name || log.target.email) : '-'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.tag}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{getDetailText(log)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      )}
    </div>
  );
}
