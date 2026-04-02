# 开发环境 vs 生产环境配置指南

本文档说明如何在本地开发和服务器生产环境中分别配置独立的数据库和环境。

## 📊 环境对比

| 项目 | 本地开发环境 | 服务器生产环境 |
|------|------------|-------------|
| **地点** | 本地计算机 | 服务器 (120.25.232.54) |
| **数据库** | PostgreSQL 本地实例 | PostgreSQL 服务器实例 |
| **Node.js 环境** | development | production |
| **后端端口** | 3002 | 3002 (systemd 服务) |
| **前端端口** | 3000 (Next.js dev) | Nginx 静态文件 |
| **API URL** | http://localhost:3002 | https://t1n9.xyz/api |
| **数据隔离** | ✅ 完全独立 | ✅ 完全独立 |

## 🚀 本地开发环境设置

### 1️⃣ 安装 PostgreSQL（如果还没安装）

#### **Windows**
```bash
# 使用 Chocolatey
choco install postgresql

# 或从官网下载：https://www.postgresql.org/download/windows/
# 安装时记住密码和端口（默认 5432）
```

#### **macOS**
```bash
# 使用 Homebrew
brew install postgresql@15

# 启动服务
brew services start postgresql@15
```

#### **Linux（Ubuntu/Debian）**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# 启动服务
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2️⃣ 创建本地数据库和用户

```bash
# 连接到 PostgreSQL（会提示输入密码）
psql -U postgres

# 在 PostgreSQL 中执行以下命令
CREATE USER lifetracker WITH PASSWORD 'local-dev-password';
CREATE DATABASE lifetracker OWNER lifetracker;
ALTER USER lifetracker CREATEDB;

# 验证创建成功
\du  # 列出所有用户
\l   # 列出所有数据库

# 退出
\q
```

### 3️⃣ 配置本地后端环境变量

```bash
# 进入后端目录
cd backend

# 复制示例文件
cp .env.example .env

# 编辑 .env 文件
# Windows：用记事本或 VS Code 打开
# Linux/macOS：nano .env
```

**修改以下内容：**
```env
# 数据库配置 - 指向本地数据库
DATABASE_URL="postgresql://lifetracker:local-dev-password@localhost:5432/lifetracker"

# Redis（本地开发可选）
REDIS_URL="redis://localhost:6379"

# JWT 配置（开发用）
JWT_SECRET="dev-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"

# 应用配置
NODE_ENV="development"
PORT=3002

# CORS 配置（允许本地前端访问）
CORS_ORIGIN="http://localhost:3000"

# 邮箱配置（可选，开发环境可留空）
EMAIL_PROVIDER=qq
EMAIL_USER=your-email@qq.com
EMAIL_PASSWORD=your-auth-code

# 其他配置保持默认
```

### 4️⃣ 初始化本地数据库

```bash
# 在 backend 目录中
cd backend

# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移（创建表结构）
npx prisma migrate dev

# 可选：添加示例数据
npx prisma db seed
```

### 5️⃣ 配置本地前端环境变量

```bash
# 进入前端目录
cd frontend

# 复制示例文件
cp .env.example .env.local
```

**修改以下内容：**
```env
# API 基础 URL - 指向本地后端
NEXT_PUBLIC_API_URL=http://localhost:3002/api

# 其他配置
NEXT_PUBLIC_APP_NAME=LifeTracker
NEXT_PUBLIC_DEBUG=true  # 开发环境可启用调试
```

### 6️⃣ 启动本地开发服务器

```bash
# 项目根目录
npm run dev

# 或分别启动
npm run dev:frontend  # 前端: http://localhost:3000
npm run dev:backend   # 后端: http://localhost:3002
```

### 7️⃣ 验证本地连接

```bash
# 测试后端健康检查
curl http://localhost:3002/api/health

# 测试前端是否可访问
curl http://localhost:3000

# 测试前后端通信
# 在前端访问 http://localhost:3000，观察请求是否正确指向 http://localhost:3002/api
```

---

## 🏭 服务器生产环境配置

### 1️⃣ 服务器数据库验证

服务器 PostgreSQL 应已安装。验证状态：

```bash
# SSH 到服务器
ssh root@120.25.232.54

# 检查 PostgreSQL 服务
systemctl status postgresql

# 检查数据库是否存在
sudo -u postgres psql -l | grep lifetracker

# 检查数据库用户权限
sudo -u postgres psql -c "\du" | grep lifetracker
```

### 2️⃣ 配置生产环境变量

在服务器上编辑 `.env` 文件：

```bash
# 进入项目目录
cd /opt/lifetracker

# 编辑环境变量（如果文件不存在会创建）
nano .env
```

**配置内容：**
```env
# ========== 数据库配置 ==========
# 服务器数据库连接（从 HANDOFF.md 获取）
DATABASE_URL="postgresql://lifetracker:<password>@localhost:5432/lifetracker"

# Redis 配置
REDIS_URL="redis://localhost:6379"

# ========== 应用配置 ==========
NODE_ENV="production"
PORT=3002
DOMAIN_NAME="t1n9.xyz"

# ========== JWT 配置 ==========
JWT_SECRET="<your-secure-jwt-secret>"
JWT_EXPIRES_IN="7d"

# ========== CORS 配置 ==========
CORS_ORIGIN="https://t1n9.xyz"

# ========== 邮箱配置 ==========
EMAIL_PROVIDER=qq
EMAIL_USER=your-email@qq.com
EMAIL_PASSWORD=your-auth-code

# ========== 其他配置 ==========
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
MAX_FILE_SIZE=5242880
BCRYPT_ROUNDS=12
BACKUP_ENABLED=true
BACKUP_INTERVAL="0 2 * * *"
BACKUP_RETENTION_DAYS=30
```

### 3️⃣ 初始化服务器数据库（仅首次）

```bash
# SSH 到服务器
ssh root@120.25.232.54

# 进入后端目录
cd /opt/lifetracker/backend

# 生成 Prisma 客户端
npx prisma generate

# 运行迁移
npx prisma migrate dev

# 可选：添加示例数据
npx prisma db seed
```

### 4️⃣ 验证生产连接

```bash
# 检查后端是否正在运行
systemctl status lifetracker-backend

# 测试后端 API
curl https://t1n9.xyz/api/health

# 测试前端是否可访问
curl https://t1n9.xyz

# 查看后端日志
journalctl -u lifetracker-backend -f
```

---

## 🔄 工作流程

### 本地开发流程

```
1. 修改代码（前端或后端）
   ↓
2. 本地 npm run dev 实时看到效果
   ↓
3. 使用本地数据库测试
   ↓
4. 确认无误
   ↓
5. git push origin main
   ↓
6. GitHub Actions 自动部署到服务器
   ↓
7. 服务器使用服务器数据库运行生产环境
```

### 数据库迁移流程

如果修改了 `backend/prisma/schema.prisma`：

```bash
# 在本地开发环境
cd backend

# 创建新的迁移
npx prisma migrate dev --name add_new_field

# 测试通过后，push 代码
git add prisma/migrations
git commit -m "feat: add new database field"
git push origin main

# 服务器在 GitHub Actions 自动部署时会自动运行迁移
# 确保 deploy.yml 中包含 npx prisma migrate deploy（已包含）
```

---

## 📋 环境变量快速参考

### 本地开发必需

```bash
DATABASE_URL=postgresql://lifetracker:local-dev-password@localhost:5432/lifetracker
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=dev-secret-key
```

### 生产环境必需

```bash
DATABASE_URL=postgresql://lifetracker:<password>@localhost:5432/lifetracker
NODE_ENV=production
CORS_ORIGIN=https://t1n9.xyz
JWT_SECRET=<secure-secret>
DOMAIN_NAME=t1n9.xyz
```

---

## 🐛 常见问题

### Q: 本地数据库连接失败

**症状：** `error: connect ECONNREFUSED 127.0.0.1:5432`

**解决方案：**
```bash
# 1. 检查 PostgreSQL 是否运行
# Windows: 检查服务
# Linux/macOS: systemctl status postgresql
# macOS: brew services list

# 2. 检查数据库用户密码
psql -U lifetracker -d lifetracker -h localhost

# 3. 检查连接字符串
# 格式：postgresql://用户名:密码@主机:端口/数据库名
```

### Q: 本地和生产数据不同步怎么办？

**答：** 这是正常的！本地和生产是完全独立的环境，用途不同：
- **本地**：用于开发和测试新功能
- **生产**：用于用户使用的真实数据

如果需要从生产同步数据到本地测试，参考 [数据库备份指南](./数据库备份事无巨细.md)。

### Q: 如何在不影响生产的情况下测试数据库变更？

**答：**
1. 在本地环境完全测试数据库迁移
2. 在本地验证 Prisma schema 修改正确
3. 提交到 GitHub
4. 部署到生产时自动执行迁移
5. 监控生产日志确保迁移成功

### Q: 能否在本地连接生产数据库？

**不建议。** 原因：
- ❌ 生产数据安全风险
- ❌ 本地开发可能意外修改真实数据
- ❌ 网络延迟影响开发体验

如需测试生产数据：
1. 使用生产数据库的备份副本
2. 在本地导入备份
3. 使用本地数据库开发

---

## ✅ 完整检查清单

- [ ] 本地 PostgreSQL 已安装并运行
- [ ] 本地数据库 `lifetracker` 已创建
- [ ] 本地数据库用户 `lifetracker` 已创建
- [ ] 后端 `.env` 已配置（开发环境）
- [ ] 前端 `.env.local` 已配置（开发环境）
- [ ] 本地数据库迁移已运行 (`npx prisma migrate dev`)
- [ ] `npm run dev` 能够成功启动前后端
- [ ] 前端能够访问：http://localhost:3000
- [ ] 后端能够访问：http://localhost:3002/api/health
- [ ] 服务器 `.env` 已配置（生产环境）
- [ ] 服务器 systemd 服务正在运行
- [ ] 能访问生产前端：https://t1n9.xyz
- [ ] 能访问生产 API：https://t1n9.xyz/api/health

---

**现在你已经有了完全隔离的开发和生产环境！** 🎉
