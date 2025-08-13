#!/bin/bash

# 原生部署脚本 - 不依赖Docker镜像拉取
set -e

echo "🚀 开始原生部署..."

# 检查必要的软件
echo "🔍 检查系统环境..."

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "📦 安装Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 检查Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 安装Nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
fi

# 检查PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "📦 安装PostgreSQL..."
    sudo apt-get install -y postgresql postgresql-contrib
fi

# 检查Redis
if ! command -v redis-server &> /dev/null; then
    echo "📦 安装Redis..."
    sudo apt-get install -y redis-server
fi

# 生成环境变量文件
if [ ! -f ".env" ]; then
    echo "📝 生成环境变量文件..."
    cat > .env << EOF
DOMAIN_NAME=t1n9.xyz
DB_NAME=lifetracker
DB_USER=lifetracker
DB_PASSWORD=TINGWU...123
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-TINGWU...123
NODE_ENV=production
EOF
fi

# 加载环境变量
source .env

# 创建SSL证书
mkdir -p nginx/ssl
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo "🔒 创建自签名SSL证书..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=CN/ST=State/L=City/O=LifeTracker/CN=${DOMAIN_NAME}"
fi

# 设置PostgreSQL
echo "🗄️ 配置PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 创建数据库用户和数据库
sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" || echo "用户已存在"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" || echo "数据库已存在"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" || echo "权限已设置"

# 设置Redis
echo "📦 配置Redis..."
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 停止现有的Node.js进程
echo "🛑 停止现有服务..."
sudo pkill -f "node.*backend-dist/main.js" || true
sudo systemctl stop nginx || true

# 安装后端依赖并启动
echo "🔧 启动后端服务..."
cd backend-dist/..
npm ci --only=production

# 创建systemd服务文件
sudo tee /etc/systemd/system/lifetracker-backend.service > /dev/null <<EOF
[Unit]
Description=LifeTracker Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
Environment=REDIS_URL=redis://localhost:6379
Environment=JWT_SECRET=${JWT_SECRET}
Environment=CORS_ORIGIN=https://${DOMAIN_NAME}
Environment=PORT=3002
ExecStart=/usr/bin/node backend-dist/main.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启动后端服务
sudo systemctl daemon-reload
sudo systemctl enable lifetracker-backend
sudo systemctl start lifetracker-backend

# 配置Nginx
echo "🌐 配置Nginx..."
sudo cp nginx/nginx.simple.conf /etc/nginx/nginx.conf

# 复制前端文件到Nginx目录
sudo rm -rf /var/www/html/*
sudo cp -r frontend-dist/* /var/www/html/

# 启动Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

echo "✅ 原生部署完成！"
echo "🌐 网站地址: https://${DOMAIN_NAME}"
echo "📊 后端API: https://${DOMAIN_NAME}/api/health"

# 检查服务状态
echo "📋 服务状态："
sudo systemctl status lifetracker-backend --no-pager -l
sudo systemctl status nginx --no-pager -l
