# 🔧 故障排除指南

本指南包含了 LifeTracker 常见问题的解决方案。

## 🚨 安装问题

### Node.js 版本不兼容
**问题**: `Error: Node.js version 16.x is not supported`

**解决方案**:
```bash
# 检查当前版本
node --version

# 升级到 Node.js 18+
# 使用 nvm (推荐)
nvm install 18
nvm use 18

# 或直接从官网下载安装
# https://nodejs.org/
```

### 依赖安装失败
**问题**: `npm install` 失败或依赖冲突

**解决方案**:
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
rm -rf backend/node_modules backend/package-lock.json

# 重新安装
npm run setup
```

### 权限问题 (Linux/macOS)
**问题**: `Permission denied` 错误

**解决方案**:
```bash
# 修复 npm 权限
sudo chown -R $(whoami) ~/.npm

# 或使用 nvm 管理 Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

## 🗄️ 数据库问题

### PostgreSQL 连接失败
**问题**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**解决方案**:
```bash
# 检查 PostgreSQL 服务状态
sudo systemctl status postgresql

# 启动 PostgreSQL 服务
sudo systemctl start postgresql

# 检查端口是否被占用
netstat -an | grep 5432

# 验证数据库连接
psql -h localhost -p 5432 -U your_username -d your_database
```

### Prisma 迁移失败
**问题**: `Migration failed` 或数据库结构不匹配

**解决方案**:
```bash
cd backend

# 重置数据库 (⚠️ 会删除所有数据)
npx prisma migrate reset

# 重新生成客户端
npx prisma generate

# 推送数据库结构
npx prisma db push

# 查看数据库状态
npx prisma studio
```

### 数据库权限问题
**问题**: `permission denied for database`

**解决方案**:
```sql
-- 连接到 PostgreSQL
sudo -u postgres psql

-- 创建用户和数据库
CREATE USER lifetracker WITH PASSWORD 'your_password';
CREATE DATABASE lifetracker OWNER lifetracker;
GRANT ALL PRIVILEGES ON DATABASE lifetracker TO lifetracker;
```

## 🌐 服务启动问题

### 端口被占用
**问题**: `Error: listen EADDRINUSE :::3000`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000
lsof -i :3002

# 终止进程
kill -9 <PID>

# 或修改端口配置
# frontend/.env.local
PORT=3001

# backend/.env
PORT=3003
```

### 前端构建失败
**问题**: Next.js 构建错误

**解决方案**:
```bash
cd frontend

# 清理构建缓存
rm -rf .next

# 重新构建
npm run build

# 检查 TypeScript 错误
npm run type-check

# 检查 ESLint 错误
npm run lint
```

### 后端服务无法启动
**问题**: NestJS 启动失败

**解决方案**:
```bash
cd backend

# 检查环境变量
cat .env

# 重新生成 Prisma 客户端
npx prisma generate

# 启动开发模式查看详细错误
npm run start:dev

# 检查日志
tail -f logs/app.log
```

## 🐳 Docker 问题

### Docker 容器启动失败
**问题**: `docker-compose up` 失败

**解决方案**:
```bash
# 查看详细日志
docker-compose logs

# 重新构建镜像
docker-compose build --no-cache

# 清理 Docker 资源
docker system prune -a

# 检查 Docker 服务状态
sudo systemctl status docker
```

### 数据库容器连接问题
**问题**: 应用无法连接到 Docker 数据库

**解决方案**:
```bash
# 检查容器网络
docker network ls
docker network inspect lifetracker_default

# 检查容器状态
docker-compose ps

# 进入数据库容器
docker-compose exec postgres psql -U lifetracker -d lifetracker
```

## 🔐 认证问题

### JWT 令牌无效
**问题**: `Unauthorized` 或令牌过期

**解决方案**:
```bash
# 检查 JWT_SECRET 配置
grep JWT_SECRET backend/.env

# 清理浏览器缓存和 localStorage
# 在浏览器开发者工具中执行:
localStorage.clear()
sessionStorage.clear()

# 重新登录
```

### 用户注册失败
**问题**: 注册时出现验证错误

**解决方案**:
```bash
# 检查邮箱格式
# 确保密码符合要求 (至少6位)

# 检查数据库用户表
cd backend
npx prisma studio

# 查看后端日志
npm run start:dev
```

## 🎨 前端问题

### 页面样式异常
**问题**: CSS 样式不生效或布局错乱

**解决方案**:
```bash
cd frontend

# 重新构建 Tailwind CSS
npm run build:css

# 清理 Next.js 缓存
rm -rf .next

# 检查 Tailwind 配置
npx tailwindcss --help

# 重新启动开发服务器
npm run dev
```

### API 请求失败
**问题**: 前端无法连接后端 API

**解决方案**:
```bash
# 检查 API 基础 URL 配置
cat frontend/.env.local

# 检查后端服务状态
curl http://localhost:3002/api/health

# 检查网络代理配置
# frontend/next.config.js 中的 rewrites 配置
```

## 📊 性能问题

### 应用响应缓慢
**问题**: 页面加载或 API 响应慢

**解决方案**:
```bash
# 检查数据库查询性能
cd backend
npx prisma studio

# 查看数据库慢查询日志
# 在 PostgreSQL 中启用慢查询日志

# 检查内存使用
free -h
top

# 优化数据库索引
# 查看 backend/prisma/schema.prisma
```

### 内存占用过高
**问题**: 应用占用大量内存

**解决方案**:
```bash
# 检查 Node.js 内存使用
node --max-old-space-size=4096 app.js

# 检查内存泄漏
npm install -g clinic
clinic doctor -- node app.js

# 优化 Docker 内存限制
# 在 docker-compose.yml 中添加:
# mem_limit: 512m
```

## 🔍 调试技巧

### 启用详细日志
```bash
# 后端调试模式
cd backend
DEBUG=* npm run start:dev

# 前端调试模式
cd frontend
NEXT_PUBLIC_DEBUG=true npm run dev
```

### 数据库调试
```bash
# 查看 Prisma 查询日志
cd backend
npx prisma studio

# 启用 SQL 查询日志
# 在 schema.prisma 中添加:
# log = ["query", "info", "warn", "error"]
```

## 🆘 获取帮助

如果以上解决方案都无法解决您的问题：

1. **搜索已知问题**
   - 查看 [GitHub Issues](https://github.com/your-username/LifeTracker/issues)
   - 搜索相关关键词

2. **提交新问题**
   - 创建新的 [Issue](https://github.com/your-username/LifeTracker/issues/new)
   - 提供详细的错误信息和环境信息

3. **参与讨论**
   - 加入 [GitHub Discussions](https://github.com/your-username/LifeTracker/discussions)
   - 与社区成员交流

4. **环境信息模板**
   ```
   操作系统: Ubuntu 20.04
   Node.js 版本: 18.17.0
   npm 版本: 9.6.7
   Docker 版本: 20.10.21
   错误信息: [粘贴完整错误信息]
   复现步骤: [详细描述操作步骤]
   ```

---

**记住**: 大多数问题都有解决方案，保持耐心！ 🚀
