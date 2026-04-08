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
- **📊 AI 智能分析**: 集成 LLM 的学习分析，提供健康分数、洞察和建议
- **🤖 AI 工具箱**: 模块化 AI 功能菜单（学习分析、计划制定等）
- **🔐 用户系统**: 安全的用户认证和数据隔离

### 🛠️ 技术特性

- **📱 响应式设计**: 支持桌面和移动设备
- **🐳 Docker 部署**: 一键部署，环境隔离
- **🔄 自动部署**: GitHub Actions CI/CD
- **🔒 SSL 支持**: 自动 HTTPS 证书配置
- **📈 性能优化**: 数据库索引、缓存策略

## 🛠️ 技术栈

### 前端

- **框架**: Next.js 15 + TypeScript
- **样式**: CSS Variables + Inline Styles
- **状态管理**: Zustand
- **数据请求**: TanStack Query
- **图表**: Recharts

### 后端

- **框架**: NestJS + TypeScript
- **数据库**: PostgreSQL 12 + Prisma ORM
- **缓存**: Redis 7
- **认证**: JWT + Passport
- **API文档**: Swagger

### 部署

- **前端**: Next.js 静态导出 + Nginx
- **后端**: Node.js + systemd 服务
- **CI/CD**: GitHub Actions (自动部署)
- **Web服务器**: Nginx 反向代理
- **SSL**: Let's Encrypt 自动证书

## 🚀 生产部署

### 部署方式

本项目使用 **GitHub Actions 自动部署** + **服务器直接编译运行**：

```
本地开发
  ↓ git push main
GitHub Actions
  ↓ SSH 连接服务器
服务器 git pull → npm build
  ↓
更新编译产物 + 重启服务
```

### ⚡ 自动部署流程

1. **推送代码到 main 分支**
   ```bash
   git push origin main
   ```

2. **GitHub Actions 自动触发**
   - SSH 连接到服务器
   - git pull 拉取最新代码
   - 后端：`npm ci` → `npm run build` → 更新运行目录
   - 前端：`npm ci` → `npm run build` → 复制静态文件到 Nginx
   - 重启后端 systemd 服务

3. **验证部署**
   ```bash
   # 检查后端运行状态
   systemctl status lifetracker-backend

   # 测试 API
   curl https://t1n9.xyz/api/health
   ```

### 📋 部署配置

需要在 GitHub 仓库的 **Settings > Secrets and variables > Actions** 中配置：

| Secret 名 | 说明 |
|---|---|
| `SERVER_HOST` | 服务器 IP 地址 |
| `SERVER_USER` | SSH 用户名（通常 root） |
| `SSH_PRIVATE_KEY` | SSH 私钥 |
| `DOMAIN_NAME` | 域名 |

环境变量（`DB_PASSWORD`、`JWT_SECRET` 等）**直接在服务器** `/opt/lifetracker/.env` 文件中管理，不需要在 GitHub Secrets 中配置。

详见 [部署指南](./docs/HANDOFF.md)

## 📦 本地开发

### 🔧 环境要求

- **Node.js**: >= 18.0.0 ([下载](https://nodejs.org/))
- **npm**: >= 9.0.0
- **PostgreSQL**: >= 12.0 (本地或 Docker)
- **Git**: 版本控制

### ⚡ 快速开始

```bash
# 1. 克隆项目
git clone https://github.com/t1n9/LifeTracker.git
cd LifeTracker

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 4. 启动数据库 (如果使用 Docker)
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=lifetracker \
  -p 5432:5432 \
  postgres:12

# 5. 初始化数据库
cd backend
npx prisma migrate dev
cd ..

# 6. 启动开发服务器
npm run dev
```

### 访问应用

- **前端**: http://localhost:3000
- **后端**: http://localhost:3002
- **API 文档**: http://localhost:3002/api/docs

## 📁 项目结构

```
LifeTracker/
├── frontend/              # Next.js 15 前端应用
├── backend/               # NestJS 后端应用
├── nginx/                 # Nginx 配置
├── scripts/               # 部署和维护脚本
├── docs/                  # 文档
│   ├── HANDOFF.md        # 部署指南（必读！）
│   ├── quick-start.md    # 5分钟快速开始
│   ├── api.md            # API 文档
│   └── ...
├── .github/workflows/     # GitHub Actions CI/CD
│   └── deploy.yml        # 自动部署脚本
├── docker-compose.yml    # Docker Compose 配置
├── package.json          # 根目录依赖管理
└── README.md            # 项目说明
```

## 📚 更多资源

- ⚡ [快速开始 (5分钟体验)](./docs/quick-start.md)
- 📖 [完整文档](./docs/)
- 🔧 [故障排除](./docs/troubleshooting.md)
- 📡 [API 文档](./docs/api.md)
- 🏗️ [系统架构](./docs/architecture.md)


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


## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！
