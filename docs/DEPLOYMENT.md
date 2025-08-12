# 🚀 部署指南

本文档详细介绍如何部署 LifeTracker 到生产环境。

## 📋 部署方式

### 1. 一键部署脚本（推荐）
### 2. Docker Compose 部署
### 3. GitHub Actions 自动部署

## 🔧 一键部署

### 准备工作

1. **服务器要求**
   - Ubuntu 20.04+ / CentOS 8+
   - 2GB+ RAM, 20GB+ 存储
   - Docker & Docker Compose
   - 域名（可选）

2. **克隆项目**
   ```bash
   git clone https://github.com/your-username/LifeTracker.git
   cd LifeTracker
   ```

3. **配置部署参数**
   ```bash
   cp deploy.config.example.sh deploy.config.sh
   nano deploy.config.sh
   ```

### 配置说明

编辑 `deploy.config.sh` 文件：

```bash
# 服务器配置
export SERVER_HOST="your-server-ip"        # 服务器IP地址
export SERVER_USER="root"                  # SSH用户名
export DOMAIN_NAME="yourdomain.com"        # 域名

# 数据库配置
export DB_PASSWORD="your-secure-password"  # 数据库密码
export DB_NAME="lifetracker"              # 数据库名
export DB_USER="lifetracker"              # 数据库用户

# JWT配置
export JWT_SECRET="your-jwt-secret"        # JWT密钥

# SSL配置
export SSL_EMAIL="your-email@example.com"  # Let's Encrypt邮箱
export USE_LETSENCRYPT="true"              # 是否使用Let's Encrypt
```

### 执行部署

```bash
chmod +x deploy.sh
./deploy.sh
```

## 🐳 Docker Compose 部署

### 环境变量配置

创建 `.env` 文件：

```bash
# 域名配置
DOMAIN_NAME=yourdomain.com

# 数据库配置
DB_NAME=lifetracker
DB_USER=lifetracker
DB_PASSWORD=your-secure-password

# JWT配置
JWT_SECRET=your-super-secret-jwt-key

# 环境
NODE_ENV=production
```

### 启动服务

```bash
# 构建并启动
docker-compose up --build -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

## 🔄 GitHub Actions 自动部署

### 配置 Secrets

在 GitHub 仓库设置中添加以下 Secrets：

| Secret 名称 | 描述 | 示例值 |
|------------|------|--------|
| `SSH_PRIVATE_KEY` | SSH私钥 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_HOST` | 服务器IP | `120.25.232.54` |
| `SERVER_USER` | SSH用户名 | `root` |
| `DOMAIN_NAME` | 域名 | `yourdomain.com` |

### 生成SSH密钥

```bash
# 在本地生成SSH密钥对
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/id_rsa.pub user@server-ip

# 将私钥内容添加到GitHub Secrets
cat ~/.ssh/id_rsa
```

### 触发部署

推送代码到 `main` 分支即可自动触发部署：

```bash
git push origin main
```

## 🔒 SSL 证书配置

### Let's Encrypt（推荐）

自动配置，需要：
- 有效域名
- 域名解析到服务器IP
- 邮箱地址

### 自签名证书

用于测试环境：

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem \
  -subj "/C=CN/ST=State/L=City/O=Org/CN=yourdomain.com"
```

## 🔧 服务管理

### 常用命令

```bash
# 查看服务状态
docker-compose ps

# 重启服务
docker-compose restart

# 更新代码
git pull origin main
docker-compose up --build -d

# 查看日志
docker-compose logs -f [service-name]

# 进入容器
docker-compose exec backend bash
docker-compose exec frontend bash
```

### 数据库管理

```bash
# 数据库备份
docker-compose exec postgres pg_dump -U lifetracker lifetracker > backup.sql

# 数据库恢复
docker-compose exec -T postgres psql -U lifetracker lifetracker < backup.sql

# 查看数据库
docker-compose exec postgres psql -U lifetracker lifetracker
```

## 📊 监控和维护

### 日志管理

```bash
# 查看应用日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 查看Nginx日志
docker-compose logs -f nginx

# 清理日志
docker system prune -f
```

### 性能监控

- 使用 `htop` 监控系统资源
- 使用 `docker stats` 监控容器资源
- 配置日志轮转避免磁盘空间不足

### 安全建议

1. **定期更新**
   - 更新系统包
   - 更新Docker镜像
   - 更新应用依赖

2. **备份策略**
   - 定期备份数据库
   - 备份配置文件
   - 测试恢复流程

3. **访问控制**
   - 使用强密码
   - 配置防火墙
   - 限制SSH访问

## 🆘 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   netstat -tlnp | grep :80
   netstat -tlnp | grep :443
   ```

2. **SSL证书问题**
   ```bash
   # 检查证书有效性
   openssl x509 -in nginx/ssl/cert.pem -text -noout
   ```

3. **数据库连接问题**
   ```bash
   # 检查数据库状态
   docker-compose exec postgres pg_isready
   ```

### 获取帮助

- 查看项目 [Issues](https://github.com/your-username/LifeTracker/issues)
- 提交新的问题报告
- 参考项目文档

---

如有问题，请随时在 GitHub 上提出 Issue！
