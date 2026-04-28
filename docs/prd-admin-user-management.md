# PRD：管理员用户管理系统

## 1. 概述

为 LifeTracker 构建一个面向管理员的用户管理后台，支持查看所有注册用户、调整用户角色/权限、管理订阅状态、封禁/解封等操作。当前系统仅有一个 `isAdmin` 布尔字段区分管理员，缺少细粒度的用户治理能力。

## 2. 现状分析

### 2.1 已有基础

| 层 | 现状 |
|---|---|
| 数据模型 | `User.isAdmin`（Boolean）、`User.isActive`（Boolean）、`UserSubscription`（plan/status）、`UserEntitlement`（key/value） |
| 后端 API | 仅有 `GET/PATCH /users/profile`、`PATCH /users/theme`、`GET/PATCH /users/settings`，无列表/管理接口 |
| 鉴权 | `JwtAuthGuard` 统一鉴权，无 AdminGuard，JWT payload 不含角色信息 |
| 前端 | Profile 页面有 admin 标签页（SystemConfigPanel + SuggestionManagement），通过 `isAdmin` 控制可见性 |

### 2.2 缺口

- 没有用户列表接口，管理员无法查看所有用户
- 没有角色体系，`isAdmin` 是孤立的布尔值
- 没有封禁/解封能力
- 订阅管理只能用户自助操作，管理员无干预手段
- 缺乏操作审计日志

## 3. 目标

1. 管理员可以查看、搜索、筛选全部注册用户
2. 管理员可以调整用户角色（普通用户 ↔ 管理员）
3. 管理员可以封禁/解封用户
4. 管理员可以管理用户订阅（升级会员、取消会员、调整到期时间）
5. 管理员可以查看用户概要统计（注册时间、最近活跃、任务/番茄数）
6. 所有管理操作记录审计日志
7. 前端提供清晰的管理界面，复用现有 Profile 页的 admin 标签页布局

## 4. 数据模型设计

### 4.1 User 表新增字段

```prisma
model User {
  // ... 现有字段保留 ...

  role        UserRole  @default(USER)        // 替代 isAdmin
  bannedAt    DateTime? @map("banned_at") @db.Timestamptz(6)
  banReason   String?   @map("ban_reason")
  lastLoginAt DateTime? @map("last_login_at") @db.Timestamptz(6)

  @@map("users")
}
```

### 4.2 新增枚举

```prisma
enum UserRole {
  USER      // 普通用户
  MEMBER    // 付费会员
  MODERATOR // 协管（可选，后期扩展）
  ADMIN     // 管理员
}
```

### 4.3 审计日志表

```prisma
model AdminAuditLog {
  id         String   @id @default(uuid())
  adminId    String   @map("admin_id")
  targetId   String?  @map("target_id")      // 被操作的用户 ID
  action     String                          // e.g. "user.ban", "user.role_change", "subscription.update"
  detail     Json     @default("{}")         // 变更详情（before/after）
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([adminId])
  @@index([targetId])
  @@index([action])
  @@index([createdAt])
  @@map("admin_audit_logs")
}
```

### 4.4 迁移策略

- `isAdmin` → `role`：迁移脚本将 `isAdmin = true` 映射为 `role = 'ADMIN'`，其余为 `'USER'`
- `isActive` 保留：封禁用户设置 `isActive = false` + 记录 `bannedAt` / `banReason`
- 会员状态由 `UserSubscription.plan` 承载：`free` / `pro` / `enterprise`；同时 `role` 可额外设为 `MEMBER` 作为双重标记

## 5. 后端 API 设计

所有管理接口挂载在 `/admin/users` 下，统一由 `AdminGuard` 保护。

### 5.1 AdminGuard

```typescript
// 从 JWT payload 中读取 role，仅 ADMIN 可通行
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user?.role === 'ADMIN';
  }
}
```

JWT payload 需同步扩展：签发 token 时写入 `role` 字段。

### 5.2 接口清单

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/admin/users` | 用户列表（分页、搜索、筛选） |
| `GET` | `/admin/users/:id` | 用户详情（含订阅、统计数据） |
| `PATCH` | `/admin/users/:id/role` | 修改用户角色 |
| `POST` | `/admin/users/:id/ban` | 封禁用户 |
| `POST` | `/admin/users/:id/unban` | 解封用户 |
| `PATCH` | `/admin/users/:id/subscription` | 修改订阅（plan/到期时间） |
| `GET` | `/admin/audit-logs` | 审计日志列表 |

### 5.3 DTO 示例

```typescript
// admin/dto/update-role.dto.ts
class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

// admin/dto/ban-user.dto.ts
class BanUserDto {
  @IsString()
  @IsOptional()
  reason?: string;  // 封禁原因
}

// admin/dto/update-subscription.dto.ts
class UpdateSubscriptionDto {
  @IsString()
  plan: string;           // "free" | "pro" | "enterprise"

  @IsDateString()
  @IsOptional()
  currentPeriodEnd?: string;

  @IsString()
  @IsOptional()
  status?: string;        // "active" | "canceled" | "past_due"
}
```

### 5.4 Service 核心逻辑

```
AdminService
├── listUsers(query)        → 分页 + 搜索(email/name) + 筛选(role/status)
├── getUserDetail(id)       → 用户信息 + 订阅 + 统计概览
├── updateUserRole(id, role)→ 更新 role，写审计日志
├── banUser(id, reason)     → isActive=false, bannedAt=now, banReason=reason, 审计日志
├── unbanUser(id)           → isActive=true, bannedAt=null, banReason=null, 审计日志
└── updateSubscription(id)  → upsert UserSubscription, 审计日志
```

## 6. 前端设计

### 6.1 页面位置

复用现有 Profile 页面的 admin 标签页体系，新增第三个子标签「用户管理」：

```
Profile 页
├── 个人信息
├── 修改密码
├── ...
└── 管理面板 (仅 isAdmin 可见)
    ├── 系统配置    (SystemConfigPanel — 已有)
    ├── 反馈管理    (SuggestionManagement — 已有)
    └── 用户管理    (UserManagement — 新增)
```

### 6.2 UserManagement 组件

```
┌─────────────────────────────────────────────────────┐
│  🔍 搜索用户（邮箱/名称）    [角色▼] [状态▼] [搜索]  │
├─────────────────────────────────────────────────────┤
│ 用户              │ 角色    │ 状态  │ 注册时间  │ 操作   │
├───────────────────┼─────────┼───────┼───────────┼────────│
│ alice@example.com │ 管理员  │ 正常  │ 2025-03-01│ [管理] │
│ bob@example.com   │ 普通用户│ 正常  │ 2025-06-15│ [管理] │
│ carol@example.com │ 会员    │ 已封禁│ 2025-01-20│ [管理] │
│ ...               │         │       │           │        │
├─────────────────────────────────────────────────────┤
│              分页: < 1 2 3 ... 10 >                │
└─────────────────────────────────────────────────────┘
```

点击「管理」弹出详情抽屉/对话框：

```
┌─ 用户详情：alice@example.com ──────────────────────┐
│                                                     │
│  基本信息                                           │
│  ├─ ID:      550e8400-...                          │
│  ├─ 邮箱:    alice@example.com                     │
│  ├─ 名称:    Alice                                 │
│  ├─ 角色:    [管理员 ▼]          [保存角色]         │
│  ├─ 状态:    ✅ 正常                               │
│  └─ 注册时间: 2025-03-01                           │
│                                                     │
│  订阅信息                                           │
│  ├─ 方案:    [Pro ▼]                               │
│  ├─ 状态:    活跃                                  │
│  ├─ 到期日:  [2026-06-01]                          │
│  └─                            [保存订阅]           │
│                                                     │
│  统计概要                                           │
│  ├─ 任务总数: 42                                   │
│  ├─ 番茄总数: 128                                  │
│  └─ 最近活跃: 2026-04-28                           │
│                                                     │
│  操作                                               │
│  ├─ [封禁用户]    [解封用户]                        │
│  └─ 封禁原因: ________________ [确认封禁]           │
│                                                     │
│  操作记录 (最近10条)                                │
│  ├─ 2026-04-20  Admin 修改角色 USER→ADMIN          │
│  └─ 2026-04-15  Admin 更新订阅 free→pro            │
└─────────────────────────────────────────────────────┘
```

### 6.3 交互细节

- 角色修改：下拉选择 → 点击「保存角色」→ 确认对话框 → 调用 API
- 封禁操作：填写原因 → 「确认封禁」→ 用户 `isActive` 置 false，前端列表状态标记为「已封禁」（红色标签）
- 解封操作：一键操作，恢复 `isActive = true`
- 订阅管理：修改 plan、到期时间 → 「保存订阅」
- 操作反馈：所有操作显示 toast 通知（成功/失败）

### 6.4 状态展示

| 状态 | 标签样式 |
|---|---|
| 正常 | 绿色标签「正常」 |
| 已封禁 | 红色标签「已封禁」 |
| 未验证邮箱 | 黄色标签「未验证」 |

| 角色 | 标签样式 |
|---|---|
| 普通用户 | 灰色标签「用户」 |
| 会员 | 蓝色标签「会员」 |
| 管理员 | 紫色标签「管理员」 |

## 7. 安全考量

- 管理员不能封禁/降级自己
- 角色修改需二次确认
- 所有管理操作写入 `AdminAuditLog`
- `GET /admin/users` 不返回 `passwordHash`
- 前端仅展示脱敏后的敏感信息（邮箱部分打码可选项）

## 8. 实施计划

### Phase 1 — 后端核心（预计 3-4h）

1. Prisma schema 迁移：新增 `UserRole` 枚举、`AdminAuditLog` 表、User 表字段
2. 编写数据迁移脚本（`isAdmin` → `role`）
3. 实现 `AdminGuard`
4. 实现 `AdminService`（listUsers / getUserDetail / updateRole / ban / unban / updateSubscription）
5. 实现 `AdminController`（6 个接口）
6. JWT payload 扩展（签发时写入 `role`）

### Phase 2 — 前端界面（预计 3-4h）

1. `UserManagement.tsx` 组件（列表 + 搜索 + 筛选 + 分页）
2. 用户详情抽屉（角色/订阅/封禁操作 + 统计 + 审计日志）
3. API 对接（`/admin/users/*` 接口）
4. Profile 页面注册新子标签
5. Toast 通知集成

### Phase 3 — 审计与打磨（预计 1-2h）

1. 审计日志查询界面
2. 操作二次确认优化
3. 批量操作（可选，视需求决定）

## 9. 附录：与现有 PRD 的关系

- 本 PRD 与 `docs/prd-ai-companion.md`（AI 主动陪伴系统）无直接耦合
- 管理后台的用户数据变更（封禁/角色调整）不影响 AI 陪伴功能的正常运行
- 建议在 AI 陪伴系统开发完成后，再进行管理员系统的前后端联调
