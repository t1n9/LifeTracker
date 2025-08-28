# 🏗️ 系统架构

本文档详细介绍 LifeTracker 的系统架构设计。

## 📋 架构概览

LifeTracker 采用现代化的前后端分离架构，具有以下特点：

- **前端**: Next.js 14 + TypeScript + Tailwind CSS
- **后端**: NestJS + TypeScript + Prisma ORM
- **数据库**: PostgreSQL
- **部署**: Docker + Nginx + GitHub Actions

## 🎯 设计原则

### 1. 模块化设计
- 前后端完全分离
- 功能模块独立
- 组件可复用

### 2. 可扩展性
- 微服务友好架构
- 数据库分片支持
- 水平扩展能力

### 3. 安全性
- JWT 认证机制
- 数据加密传输
- 输入验证和清理

### 4. 性能优化
- 数据库索引优化
- 前端代码分割
- 静态资源 CDN

## 🏢 整体架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   用户浏览器     │    │     CDN/静态     │    │   监控告警       │
│                │    │     资源服务     │    │                │
└─────────┬───────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          │ HTTPS                 │                       │
          │                       │                       │
┌─────────▼───────────────────────▼───────────────────────▼─────┐
│                        Nginx 反向代理                        │
│                    (负载均衡 + SSL终端)                      │
└─────────┬───────────────────────────────────────────────────┘
          │
          │ HTTP
          │
┌─────────▼─────────┐              ┌─────────────────────────────┐
│   Next.js 前端    │              │        NestJS 后端          │
│                  │              │                            │
│ • React 组件      │   HTTP/API   │ • RESTful API              │
│ • 状态管理        │◄────────────►│ • JWT 认证                 │
│ • 路由管理        │              │ • 业务逻辑                  │
│ • UI 交互         │              │ • 数据验证                  │
└───────────────────┘              └─────────┬───────────────────┘
                                            │
                                            │ Prisma ORM
                                            │
                                  ┌─────────▼─────────┐
                                  │   PostgreSQL      │
                                  │                  │
                                  │ • 用户数据        │
                                  │ • 任务数据        │
                                  │ • 学习记录        │
                                  │ • 统计数据        │
                                  └───────────────────┘
```

## 🎨 前端架构

### 技术栈
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **状态管理**: React Hooks + Context
- **HTTP客户端**: Fetch API
- **图表**: Recharts

### 目录结构
```
frontend/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/         # 认证相关页面
│   │   ├── dashboard/      # 仪表板页面
│   │   ├── tasks/          # 任务管理页面
│   │   └── layout.tsx      # 根布局
│   ├── components/         # 可复用组件
│   │   ├── ui/            # 基础UI组件
│   │   ├── forms/         # 表单组件
│   │   └── charts/        # 图表组件
│   ├── hooks/             # 自定义Hooks
│   ├── lib/               # 工具库
│   ├── services/          # API服务
│   └── types/             # TypeScript类型定义
├── public/                # 静态资源
└── styles/               # 全局样式
```

### 组件架构
```
App
├── Layout (导航 + 侧边栏)
├── Pages
│   ├── Dashboard (仪表板)
│   ├── Tasks (任务管理)
│   │   ├── TaskList
│   │   ├── TaskItem
│   │   └── TaskForm
│   ├── Pomodoro (番茄钟)
│   └── Statistics (统计)
└── Providers (状态管理)
```

## ⚙️ 后端架构

### 技术栈
- **框架**: NestJS
- **语言**: TypeScript
- **ORM**: Prisma
- **数据库**: PostgreSQL
- **认证**: JWT + Passport
- **验证**: class-validator
- **文档**: Swagger

### 目录结构
```
backend/
├── src/
│   ├── auth/              # 认证模块
│   ├── users/             # 用户管理
│   ├── tasks/             # 任务管理
│   ├── pomodoro/          # 番茄钟功能
│   ├── study-records/     # 学习记录
│   ├── statistics/        # 数据统计
│   ├── common/            # 公共模块
│   │   ├── guards/        # 守卫
│   │   ├── decorators/    # 装饰器
│   │   └── filters/       # 异常过滤器
│   └── main.ts           # 应用入口
├── prisma/               # 数据库模式
└── test/                 # 测试文件
```

### 模块架构
```
AppModule
├── AuthModule (认证)
├── UsersModule (用户)
├── TasksModule (任务)
├── PomodoroModule (番茄钟)
├── StudyRecordsModule (学习记录)
├── StatisticsModule (统计)
└── CommonModule (公共)
```

## 🗄️ 数据库设计

### 核心实体关系
```
User (用户)
├── Tasks (任务) [1:N]
├── StudyRecords (学习记录) [1:N]
├── PomodoroSessions (番茄钟会话) [1:N]
└── ExerciseRecords (运动记录) [1:N]

Task (任务)
├── StudyRecords (学习记录) [1:N]
└── PomodoroSessions (番茄钟会话) [1:N]
```

### 主要数据表
```sql
-- 用户表
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  password_hash VARCHAR,
  name VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- 任务表
tasks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR,
  description TEXT,
  priority INTEGER,
  is_completed BOOLEAN,
  sort_order INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- 学习记录表
study_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  task_id UUID REFERENCES tasks(id),
  subject VARCHAR,
  duration INTEGER,
  content TEXT,
  created_at TIMESTAMP
)

-- 番茄钟会话表
pomodoro_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  task_id UUID REFERENCES tasks(id),
  duration INTEGER,
  actual_duration INTEGER,
  status VARCHAR,
  type VARCHAR,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
)
```

## 🔐 安全架构

### 认证流程
```
1. 用户登录 → 验证凭据
2. 生成 JWT Token → 包含用户信息
3. 前端存储 Token → localStorage/sessionStorage
4. API 请求携带 Token → Authorization Header
5. 后端验证 Token → JWT Guard
6. 返回用户数据 → 授权访问
```

### 安全措施
- **密码加密**: bcrypt 哈希
- **JWT 签名**: 安全密钥签名
- **HTTPS 传输**: SSL/TLS 加密
- **输入验证**: class-validator 验证
- **SQL 注入防护**: Prisma ORM 参数化查询
- **XSS 防护**: 输入清理和转义
- **CSRF 防护**: SameSite Cookie

## 🚀 部署架构

### 容器化部署
```
Docker Compose
├── nginx (反向代理)
├── frontend (Next.js 静态文件)
├── backend (NestJS 应用)
└── postgres (数据库)
```

### CI/CD 流程
```
GitHub Push
    ↓
GitHub Actions
    ↓
Build & Test
    ↓
Docker Build
    ↓
Deploy to Server
    ↓
Health Check
```

### 生产环境架构
```
Internet
    ↓
Cloudflare (CDN + DDoS防护)
    ↓
Load Balancer (负载均衡)
    ↓
Nginx (反向代理 + SSL)
    ↓
Application Servers (多实例)
    ↓
Database Cluster (主从复制)
```

## 📊 性能优化

### 前端优化
- **代码分割**: Next.js 自动分割
- **图片优化**: Next.js Image 组件
- **缓存策略**: 浏览器缓存 + CDN
- **懒加载**: React.lazy + Suspense

### 后端优化
- **数据库索引**: 关键字段索引
- **查询优化**: Prisma 查询优化
- **缓存机制**: Redis 缓存
- **连接池**: 数据库连接池

### 数据库优化
- **索引策略**: 复合索引优化
- **分区表**: 大表分区
- **读写分离**: 主从数据库
- **查询缓存**: 结果集缓存

## 🔍 监控和日志

### 应用监控
- **性能监控**: 响应时间、吞吐量
- **错误监控**: 异常捕获和报告
- **资源监控**: CPU、内存、磁盘
- **业务监控**: 用户行为分析

### 日志系统
- **结构化日志**: JSON 格式
- **日志级别**: ERROR、WARN、INFO、DEBUG
- **日志聚合**: 集中式日志管理
- **日志分析**: 实时日志分析

## 🔄 扩展性设计

### 水平扩展
- **无状态设计**: 应用服务器无状态
- **负载均衡**: 多实例负载分担
- **数据库分片**: 水平分库分表
- **缓存集群**: Redis 集群

### 微服务演进
- **服务拆分**: 按业务域拆分
- **API 网关**: 统一入口管理
- **服务发现**: 自动服务注册
- **配置中心**: 集中配置管理

---

**架构持续演进中...** 🚀
