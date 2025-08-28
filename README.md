# 🎯 LifeTracker - 生活记录系统

<div align="center">

![LifeTracker Logo](https://img.shields.io/badge/LifeTracker-生活记录系统-blue?style=for-the-badge)

一个为学生设计的全栈Web应用，集成倒计时、学习计划、时间管理功能。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-支持-blue.svg)](https://www.docker.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-自动部署-green.svg)](https://github.com/features/actions)

[🚀 快速开始](#-快速开始) • [📖 文档](#-文档) • [🛠️ 技术栈](#️-技术栈) • [🤝 贡献](#-贡献) • [📸 截图](#-截图)

</div>

## ✨ 功能特性

### 🎯 核心功能

- **📅 倒计时功能**: 考研日期倒计时，自定义重要日期提醒
- **🍅 番茄钟**: 可配置的专注时间管理工具
- **📚 学习记录**: 任务管理、学习时长统计、进度追踪
- **🏃 运动记录**: 跑步、健身等运动数据追踪
- **💰 消费记录**: 日常开支管理和统计
- **📊 数据分析**: 学习趋势分析、科目分布统计
- **🔐 用户系统**: 安全的用户认证和数据隔离

### 🛠️ 技术特性

- **📱 响应式设计**: 支持桌面和移动设备
- **🐳 Docker 部署**: 一键部署，环境隔离
- **🔄 自动部署**: GitHub Actions CI/CD
- **🔒 SSL 支持**: 自动 HTTPS 证书配置
- **📈 性能优化**: 数据库索引、缓存策略

## 🛠️ 技术栈

### 前端

- **框架**: Next.js 14 + TypeScript
- **UI库**: Chakra UI
- **状态管理**: Zustand
- **数据请求**: TanStack Query
- **图表**: Recharts

### 后端

- **框架**: NestJS + TypeScript
- **数据库**: MySQL + Prisma ORM
- **缓存**: Redis
- **认证**: JWT + Passport
- **API文档**: Swagger

### DevOps

- **容器化**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **代码质量**: ESLint + Prettier
- **监控**: Sentry + Winston

## 🚀 快速部署

### 📋 系统要求

- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / macOS / Windows
- **内存**: 2GB+ RAM
- **存储**: 20GB+ 可用空间
- **软件**: Docker & Docker Compose

### ⚡ 一键部署

1. **克隆项目**

   ```bash
   git clone https://github.com/your-username/LifeTracker.git
   cd LifeTracker
   ```
2. **配置部署参数**

   ```bash
   # 复制配置文件模板
   cp deploy.config.example.sh deploy.config.sh

   # 编辑配置文件
   nano deploy.config.sh
   ```
3. **执行部署**

   ```bash
   # 一键部署
   chmod +x deploy.sh
   ./deploy.sh

   # 或指定配置文件
   ./deploy.sh --config my-config.sh
   ```

### 🐳 Docker 部署

```bash
# 使用 Docker Compose
docker-compose up --build -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

## 📦 本地开发

### 🔧 环境要求

- **Node.js**: >= 18.0.0 ([下载地址](https://nodejs.org/))
- **npm**: >= 9.0.0
- **PostgreSQL**: >= 12.0 或 Docker
- **Git**: 用于版本控制

### ⚡ 一键初始化

```bash
# Windows 用户
scripts\init-project.bat

# Linux/macOS 用户
./scripts/init-project.sh
```

### 📋 手动安装

```bash
# 1. 克隆项目
git clone https://github.com/your-username/LifeTracker.git
cd LifeTracker

# 2. 安装依赖
npm run setup

# 3. 配置环境变量
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 4. 初始化数据库
cd backend
npx prisma migrate dev
npm run db:seed

# 5. 启动开发服务器
cd ..
npm run dev
```

### 环境配置

```bash
# 复制环境变量模板
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 编辑环境变量
# 配置数据库连接、JWT密钥等
```

### 启动开发服务器

```bash
# 同时启动前后端开发服务器
npm run dev

# 或分别启动
npm run dev:frontend  # 前端: http://localhost:3000
npm run dev:backend   # 后端: http://localhost:3001
```

### 使用Docker (推荐)

```bash
# 构建并启动所有服务
npm run docker:up

# 查看日志
npm run docker:logs

# 停止服务
npm run docker:down
```

## 📁 项目结构

```
LifeTracker/
├── frontend/          # Next.js 前端应用
├── backend/           # NestJS 后端应用
├── docker-compose.yml # Docker 编排文件
├── package.json       # 根目录依赖管理
└── README.md         # 项目说明
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行前端测试
npm run test:frontend

# 运行后端测试
npm run test:backend
```

## 📝 代码规范

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format
```

## 🚀 部署

### 生产环境构建

```bash
npm run build
```

### Docker部署

```bash
# 生产环境部署
docker-compose -f docker-compose.prod.yml up -d
```

## 📖 文档

- 📚 [完整文档](./docs/README.md) - 文档中心
- ⚡ [快速开始](./docs/quick-start.md) - 5分钟快速体验
- 📦 [安装指南](./docs/installation.md) - 详细安装步骤
- 🔧 [故障排除](./docs/troubleshooting.md) - 常见问题解决
- 📡 [API 文档](./docs/api.md) - 完整API说明
- 🏗️ [系统架构](./docs/architecture.md) - 架构设计文档

### 在线文档

- **Swagger API**: http://localhost:3002/api/docs (启动后端后访问)

## 📸 截图

### 主界面

![主界面](./docs/images/dashboard.png)

### 任务管理

![任务管理](./docs/images/tasks.png)

### 番茄钟

![番茄钟](./docs/images/pomodoro.png)

### 数据统计

![数据统计](./docs/images/statistics.png)

> 📝 **注意**: 截图将在项目完善后添加

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看 [贡献指南](./CONTRIBUTING.md) 了解详细信息。

### 快速贡献

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

- 项目链接: [https://github.com/your-username/LifeTracker](https://github.com/your-username/LifeTracker)
- 问题反馈: [Issues](https://github.com/your-username/LifeTracker/issues)

## 🚀 一键部署

### 生产环境部署

1. **服务器要求**

   - Ubuntu 20.04+ / CentOS 8+
   - Docker & Docker Compose
   - 2GB+ RAM, 20GB+ 存储空间
   - 域名和服务器（请配置您自己的服务器）
2. **自动部署**

   ```bash
   # 推送代码到GitHub主分支即可自动部署
   git push origin main
   ```
3. **手动部署**

   ```bash
   # 一键部署脚本
   ./deploy.sh

   # 或使用Docker Compose
   docker-compose up --build -d
   ```

### 🔧 管理命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f [service_name]

# 重启服务
docker-compose restart [service_name]

# 停止所有服务
docker-compose down

# 数据库操作
docker-compose exec backend npx prisma db push
```

### 👤 初始账户

首次部署后，请使用管理员账户登录：

- **邮箱**: admin@example.com
- **密码**: 请在首次启动时设置

> ⚠️ 首次登录后请立即修改密码和邮箱

### 📊 服务端口

- **前端**: 3001
- **后端**: 3002
- **数据库**: 5432
- **网站**: https://your-domain.com

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！
