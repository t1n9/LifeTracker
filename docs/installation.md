# 📦 安装指南

本指南将帮助您在本地环境中安装和运行 LifeTracker。

## 🔧 环境要求

### 必需软件
- **Node.js**: >= 18.0.0 ([下载地址](https://nodejs.org/))
- **npm**: >= 9.0.0 (随 Node.js 安装)
- **Git**: 用于克隆项目 ([下载地址](https://git-scm.com/))

### 数据库选择

#### 选项1: PostgreSQL (推荐)
- **PostgreSQL**: >= 12.0 ([下载地址](https://www.postgresql.org/download/))

#### 选项2: Docker (最简单)
- **Docker**: >= 20.0 ([下载地址](https://www.docker.com/))
- **Docker Compose**: >= 2.0

## 🚀 快速安装

### 1. 克隆项目
```bash
git clone https://github.com/your-username/LifeTracker.git
cd LifeTracker
```

### 2. 一键安装依赖
```bash
npm run setup
```

### 3. 配置环境变量

#### 后端配置
```bash
cd backend
cp .env.example .env
```

编辑 `backend/.env` 文件：
```env
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/lifetracker"

# JWT 密钥 (请生成一个安全的密钥)
JWT_SECRET="your-super-secret-jwt-key"

# 服务端口
PORT=3002

# 环境
NODE_ENV=development
```

#### 前端配置
```bash
cd frontend
cp .env.example .env.local
```

编辑 `frontend/.env.local` (开发环境通常不需要修改):
```env
# API 基础URL (开发环境留空)
NEXT_PUBLIC_API_URL=

# 应用配置
NEXT_PUBLIC_APP_NAME=LifeTracker
NEXT_PUBLIC_DEBUG=false
```

### 4. 初始化数据库

#### 使用 PostgreSQL
```bash
cd backend

# 生成 Prisma 客户端
npx prisma generate

# 运行数据库迁移
npx prisma migrate dev

# (可选) 添加示例数据
npx prisma db seed
```

#### 使用 Docker
```bash
# 启动数据库容器
docker-compose up -d postgres

# 等待数据库启动完成
sleep 10

# 运行迁移
cd backend
npx prisma migrate dev
```

### 5. 启动开发服务器
```bash
# 返回项目根目录
cd ..

# 同时启动前后端
npm run dev
```

## 🌐 访问应用

- **前端**: http://localhost:3000
- **后端API**: http://localhost:3002
- **API文档**: http://localhost:3002/api/docs

## 🔍 验证安装

### 检查服务状态
```bash
# 检查后端健康状态
curl http://localhost:3002/api/health

# 检查前端是否正常
curl http://localhost:3000
```

### 创建测试账户
1. 访问 http://localhost:3000
2. 点击"注册"按钮
3. 填写用户信息完成注册
4. 登录并开始使用

## 🐳 Docker 安装 (推荐)

如果您更喜欢使用 Docker：

```bash
# 克隆项目
git clone https://github.com/your-username/LifeTracker.git
cd LifeTracker

# 一键启动所有服务
npm run docker:up

# 查看服务状态
npm run docker:logs
```

## ❗ 常见问题

### 数据库连接失败
- 确保 PostgreSQL 服务正在运行
- 检查 `DATABASE_URL` 配置是否正确
- 确认数据库用户权限

### 端口冲突
- 前端默认端口: 3000
- 后端默认端口: 3002
- 如有冲突，可在环境变量中修改

### 依赖安装失败
```bash
# 清理缓存重新安装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 🆘 需要帮助？

- 查看 [故障排除指南](./troubleshooting.md)
- 提交 [Issue](https://github.com/your-username/LifeTracker/issues)
- 参与 [讨论](https://github.com/your-username/LifeTracker/discussions)
