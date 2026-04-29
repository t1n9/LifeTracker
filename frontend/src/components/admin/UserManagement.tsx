'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '@/lib/api';
import styles from './UserManagement.module.css';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'MEMBER' | 'ADMIN';
  isActive: boolean;
  emailVerified: boolean;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { tasks: number; pomodoroSessions: number };
}

interface UserDetail extends AdminUser {
  emailVerified: boolean;
  subscription: {
    id: string;
    plan: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    canceledAt: string | null;
    source: string | null;
  } | null;
  _count: {
    tasks: number;
    pomodoroSessions: number;
    studyRecords: number;
    dailyData: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    detail: Record<string, unknown>;
    createdAt: string;
  }>;
}

const ROLE_LABELS: Record<string, string> = {
  USER: '普通用户',
  MEMBER: '会员（旧）',
  ADMIN: '管理员',
};

const ROLE_CLASSES: Record<string, string> = {
  USER: styles.tagUser,
  MEMBER: styles.tagMember,
  ADMIN: styles.tagAdmin,
};

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editRole, setEditRole] = useState('');
  const [banReason, setBanReason] = useState('');
  const [subPlan, setSubPlan] = useState('');
  const [subEnd, setSubEnd] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    if (!actionMsg) return;
    const timer = setTimeout(() => setActionMsg(''), 3000);
    return () => clearTimeout(timer);
  }, [actionMsg]);

  const limit = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(limit),
      };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterStatus) params.status = filterStatus;

      const res = await adminAPI.listUsers(params);
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      setActionMsg('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, filterRole, filterStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openDetail = async (userId: string) => {
    setDetailLoading(true);
    setDrawerOpen(true);
    setActionMsg('');
    try {
      const res = await adminAPI.getUserDetail(userId);
      const detail: UserDetail = res.data;
      setSelectedUser(detail);
      setEditRole(detail.role);
      setBanReason('');
      setSubPlan(detail.subscription?.plan || 'free');
      const periodEnd = detail.subscription?.currentPeriodEnd;
      setSubEnd(
        typeof periodEnd === 'string'
          ? periodEnd.slice(0, 10)
          : '',
      );
    } catch {
      setActionMsg('加载用户详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDrawerOpen(false);
    setSelectedUser(null);
  };

  const handleRoleChange = async () => {
    if (!selectedUser || editRole === selectedUser.role) return;
    const targetLabel = ROLE_LABELS[editRole] || editRole;
    if (!confirm(`确定要将 ${selectedUser.email} 的角色改为「${targetLabel}」吗？`)) return;
    try {
      await adminAPI.updateUserRole(selectedUser.id, editRole);
      setActionMsg(`角色已更新为 ${targetLabel}`);
      setSelectedUser({ ...selectedUser, role: editRole as UserDetail['role'] });
      fetchUsers();
    } catch (e: any) {
      setActionMsg(e?.response?.data?.message || '角色修改失败');
    }
  };

  const handleBan = async () => {
    if (!selectedUser) return;
    try {
      await adminAPI.banUser(selectedUser.id, banReason || undefined);
      setActionMsg('用户已封禁');
      setSelectedUser({
        ...selectedUser,
        isActive: false,
        bannedAt: new Date().toISOString(),
        banReason: banReason || null,
      });
      fetchUsers();
    } catch {
      setActionMsg('封禁失败');
    }
  };

  const handleUnban = async () => {
    if (!selectedUser) return;
    try {
      await adminAPI.unbanUser(selectedUser.id);
      setActionMsg('用户已解封');
      setSelectedUser({
        ...selectedUser,
        isActive: true,
        bannedAt: null,
        banReason: null,
      });
      fetchUsers();
    } catch {
      setActionMsg('解封失败');
    }
  };

  const handleSubUpdate = async () => {
    if (!selectedUser) return;
    try {
      const data: Record<string, unknown> = { plan: subPlan };
      if (subEnd) data.currentPeriodEnd = subEnd;
      await adminAPI.updateSubscription(selectedUser.id, data);
      setActionMsg('订阅已更新');
      // Refresh detail
      openDetail(selectedUser.id);
    } catch {
      setActionMsg('订阅更新失败');
    }
  };

  const maskEmail = (email: string) => {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    if (name.length <= 3) return `${name[0]}***@${domain}`;
    return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    if (typeof d !== 'string') return '-';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className={styles.wrap}>
      {/* ── 工具栏 ── */}
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="搜索邮箱或用户名..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className={styles.filterSelect}
          value={filterRole}
          onChange={(e) => { setFilterRole(e.target.value); setPage(1); }}
        >
          <option value="">全部角色</option>
          <option value="USER">普通用户</option>
          <option value="ADMIN">管理员</option>
        </select>
        <select
          className={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
        >
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="banned">已封禁</option>
        </select>
        <span className={styles.totalHint}>共 {total} 人</span>
      </div>

      {/* ── 用户表格 ── */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>状态</th>
              <th>注册时间</th>
              <th>任务/番茄</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className={styles.empty}>加载中...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>暂无数据</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.userName}>{u.name || '未设置'}</span>
                      <span className={styles.userEmail} title={u.email}>
                        {maskEmail(u.email)}
                        {!u.emailVerified && (
                          <span className={`${styles.tag} ${styles.tagUnverified}`}>未验证</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.tag} ${ROLE_CLASSES[u.role] || ''}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td>
                    {u.bannedAt ? (
                      <span className={`${styles.tag} ${styles.tagBanned}`}>已封禁</span>
                    ) : (
                      <span className={`${styles.tag} ${styles.tagActive}`}>正常</span>
                    )}
                  </td>
                  <td className={styles.dateCell}>{formatDate(u.createdAt)}</td>
                  <td className={styles.numCell}>
                    {u._count.tasks} / {u._count.pomodoroSessions}
                  </td>
                  <td>
                    <button
                      className={styles.actionBtn}
                      onClick={() => openDetail(u.id)}
                    >
                      管理
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── 分页 ── */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
        </div>
      )}

      {/* ── 用户详情抽屉 ── */}
      {drawerOpen && (
        <div className={styles.overlay} onClick={closeDetail}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h3>用户详情</h3>
              <button className={styles.closeBtn} onClick={closeDetail}>✕</button>
            </div>

            {detailLoading ? (
              <div className={styles.loading}>加载中...</div>
            ) : selectedUser ? (
              <div className={styles.drawerBody}>
                {actionMsg && <div className={styles.msg}>{actionMsg}</div>}

                {/* 基本信息 */}
                <section className={styles.section}>
                  <h4>基本信息</h4>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>ID</span>
                    <span className={styles.fieldValue}>{selectedUser.id}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>邮箱</span>
                    <span className={styles.fieldValue}>{selectedUser.email}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>名称</span>
                    <span className={styles.fieldValue}>{selectedUser.name || '-'}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>注册时间</span>
                    <span className={styles.fieldValue}>{formatDate(selectedUser.createdAt)}</span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>邮箱验证</span>
                    <span className={styles.fieldValue}>
                      {selectedUser.emailVerified ? '已验证' : '未验证'}
                    </span>
                  </div>
                </section>

                {/* 角色管理 */}
                <section className={styles.section}>
                  <h4>角色管理</h4>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>当前角色</span>
                    <span className={`${styles.tag} ${ROLE_CLASSES[selectedUser.role] || ''}`}>
                      {ROLE_LABELS[selectedUser.role]}
                    </span>
                  </div>
                  <div className={styles.inlineAction}>
                    <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                      <option value="USER">普通用户</option>
                      <option value="ADMIN">管理员</option>
                    </select>
                    <div className={styles.fieldHint}>
                      会员身份由订阅方案决定，请在下方「订阅管理」中设置
                    </div>
                    <button onClick={handleRoleChange} disabled={editRole === selectedUser.role}>
                      保存角色
                    </button>
                  </div>
                </section>

                {/* 封禁管理 */}
                <section className={styles.section}>
                  <h4>封禁管理</h4>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>状态</span>
                    <span className={styles.fieldValue}>
                      {selectedUser.bannedAt
                        ? `已封禁 (${formatDate(selectedUser.bannedAt)})`
                        : '正常'}
                    </span>
                  </div>
                  {selectedUser.banReason && (
                    <div className={styles.fieldRow}>
                      <span className={styles.fieldLabel}>封禁原因</span>
                      <span className={styles.fieldValue}>{selectedUser.banReason}</span>
                    </div>
                  )}
                  <div className={styles.inlineAction}>
                    {selectedUser.bannedAt ? (
                      <button onClick={handleUnban}>解封用户</button>
                    ) : (
                      <>
                        <input
                          type="text"
                          placeholder="封禁原因（可选）"
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                        />
                        <button onClick={handleBan} className={styles.dangerBtn}>
                          确认封禁
                        </button>
                      </>
                    )}
                  </div>
                </section>

                {/* 订阅管理 */}
                <section className={styles.section}>
                  <h4>订阅管理（会员方案）</h4>
                  <div className={styles.fieldHint} style={{ marginBottom: 8 }}>
                    订阅方案决定用户是否为付费会员 — Free 为普通用户，Pro/Enterprise 为付费会员
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>方案</span>
                    <span className={styles.fieldValue}>
                      {selectedUser.subscription?.plan || 'free'}
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>状态</span>
                    <span className={styles.fieldValue}>
                      {selectedUser.subscription?.status || '-'}
                    </span>
                  </div>
                  <div className={styles.fieldRow}>
                    <span className={styles.fieldLabel}>到期日</span>
                    <span className={styles.fieldValue}>
                      {formatDate(selectedUser.subscription?.currentPeriodEnd || null)}
                    </span>
                  </div>
                  <div className={styles.inlineAction}>
                    <select value={subPlan} onChange={(e) => setSubPlan(e.target.value)}>
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    <input
                      type="date"
                      value={subEnd}
                      onChange={(e) => setSubEnd(e.target.value)}
                      placeholder="到期日"
                    />
                    <button onClick={handleSubUpdate}>保存订阅</button>
                  </div>
                </section>

                {/* 统计概要 */}
                <section className={styles.section}>
                  <h4>统计概要</h4>
                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <span className={styles.statNum}>{selectedUser._count.tasks}</span>
                      <span className={styles.statLabel}>任务</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statNum}>{selectedUser._count.pomodoroSessions}</span>
                      <span className={styles.statLabel}>番茄</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statNum}>{selectedUser._count.studyRecords}</span>
                      <span className={styles.statLabel}>学习记录</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statNum}>{selectedUser._count.dailyData}</span>
                      <span className={styles.statLabel}>活跃天数</span>
                    </div>
                  </div>
                </section>

                {/* 操作记录 */}
                {selectedUser.recentAuditLogs.length > 0 && (
                  <section className={styles.section}>
                    <h4>最近操作记录</h4>
                    <div className={styles.logList}>
                      {selectedUser.recentAuditLogs.map((log) => (
                        <div key={log.id} className={styles.logItem}>
                          <span className={styles.logDate}>{formatDate(log.createdAt)}</span>
                          <span className={styles.logAction}>{log.action}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
