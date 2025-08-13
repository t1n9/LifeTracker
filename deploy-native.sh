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

# 检查Let's Encrypt证书
CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem"

if [ ! -f "$CERT_PATH" ] || [ ! -f "$KEY_PATH" ]; then
    echo "🔒 获取Let's Encrypt证书..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
    sudo certbot --nginx -d ${DOMAIN_NAME} -d www.${DOMAIN_NAME} --non-interactive --agree-tos --email admin@${DOMAIN_NAME}
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
cd $(dirname $0)

# 安装依赖
if [ -f "package.json" ] && [ -f "package-lock.json" ]; then
    echo "📦 使用npm ci安装依赖..."
    npm ci --only=production
elif [ -f "backend-package.json" ]; then
    echo "📦 使用npm install安装依赖..."
    cp backend-package.json package.json
    npm install --only=production
else
    echo "⚠️ 未找到package.json，跳过依赖安装"
fi

# 生成Prisma客户端
echo "🔧 生成Prisma客户端..."
if command -v npx &> /dev/null; then
    npx prisma generate || echo "⚠️ Prisma生成失败，继续尝试..."
else
    echo "⚠️ npx不可用，跳过Prisma生成"
fi

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

if sudo systemctl start lifetracker-backend; then
    echo "✅ 后端服务启动成功"
    sleep 5
    # 检查服务状态
    if sudo systemctl is-active --quiet lifetracker-backend; then
        echo "✅ 后端服务运行正常"
    else
        echo "❌ 后端服务启动后异常，查看日志："
        sudo journalctl -u lifetracker-backend --no-pager -l
        return 1
    fi
else
    echo "❌ 后端服务启动失败，查看日志："
    sudo journalctl -u lifetracker-backend --no-pager -l
    return 1
fi

# 配置Nginx
echo "🌐 配置Nginx..."

# 使用超简化配置
if [ -f "nginx/nginx.ultra-simple.conf" ]; then
    echo "使用超简化Nginx配置..."
    sudo cp nginx/nginx.ultra-simple.conf /etc/nginx/nginx.conf
else
    echo "❌ 未找到超简化配置，创建默认配置"
    # 创建简单的默认配置
    sudo tee /etc/nginx/nginx.conf > /dev/null <<EOF
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80 default_server;
        listen 443 ssl default_server;
        server_name _;

        ssl_certificate /etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location /api/ {
            proxy_pass http://127.0.0.1:3002/api/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location / {
            root /var/www/html;
            index index.html;
            try_files \$uri \$uri/ /index.html;
        }
    }
}
EOF
fi

# 测试Nginx配置
if ! sudo nginx -t; then
    echo "❌ Nginx配置测试失败"
    sudo nginx -t
    return 1
fi

# 复制前端文件到Nginx目录
sudo rm -rf /var/www/html/*
sudo mkdir -p /var/www/html
sudo cp -r frontend-dist/* /var/www/html/ || echo "前端文件复制失败"

# 启动Nginx
sudo systemctl enable nginx
if sudo systemctl start nginx; then
    echo "✅ Nginx启动成功"
else
    echo "❌ Nginx启动失败，查看错误日志："
    sudo journalctl -u nginx --no-pager -l
    return 1
fi

echo "✅ 原生部署完成！"
echo "🌐 网站地址: https://${DOMAIN_NAME}"
echo "📊 后端API: https://${DOMAIN_NAME}/api/health"

# 检查服务状态
echo "📋 服务状态："
sudo systemctl status lifetracker-backend --no-pager -l
sudo systemctl status nginx --no-pager -l
