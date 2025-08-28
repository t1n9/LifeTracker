# LifeTracker 快速设置指南

## 🚀 快速开始

### 前置要求
- Node.js 18+ 
- npm 9+
- PostgreSQL 12+ (或使用Docker)

### 1. 克隆项目
```bash
git clone https://github.com/your-username/LifeTracker.git
cd LifeTracker
```

### 2. 安装依赖
```bash
npm run setup
```

### 3. 配置环境变量

#### 后端配置
```bash
cd backend
cp .env.example .env
```
编辑 `.env` 文件，配置数据库连接等信息。

#### 前端配置
```bash
cd frontend
cp .env.example .env.local
```
开发环境通常不需要修改前端环境变量。

### 4. 初始化数据库
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 5. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000 查看应用。

## 📦 部署

### Docker 部署
```bash
npm run docker:build
npm run docker:up
```

### 手动部署
1. 构建项目：`npm run build`
2. 使用提供的部署脚本
3. 配置Nginx和SSL证书

详细部署说明请参考 [部署文档](./docs/deployment.md)

## 🔧 开发

### 可用脚本
- `npm run dev` - 启动开发服务器
- `npm run build` - 构建生产版本
- `npm run test` - 运行测试
- `npm run lint` - 代码检查

### 项目结构
```
LifeTracker/
├── frontend/          # Next.js 前端
├── backend/           # NestJS 后端
├── scripts/           # 部署和维护脚本
├── nginx/             # Nginx 配置
└── docs/              # 文档
```

## 📚 更多文档
- [API 文档](./docs/api.md)
- [部署指南](./docs/deployment.md)
- [开发指南](./docs/development.md)
