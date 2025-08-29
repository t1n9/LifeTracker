#!/bin/bash

# 超简化原生部署脚本
set -e

echo "🚀 开始超简化部署..."

# 加载环境变量
if [ -f ".env" ]; then
    source .env
else
    DOMAIN_NAME="t1n9.xyz"
fi

# 停止现有服务
echo "🛑 停止现有服务..."
sudo pkill -f "node.*backend-dist/main.js" || true
sudo pkill -f "node.*main.js" || true
# 强制杀死占用3002端口的进程
sudo lsof -ti:3002 | xargs -r sudo kill -9 || true
sudo systemctl stop nginx || true

# 启动后端（直接运行，不用systemd）
echo "🔧 启动后端服务..."
cd $(dirname $0)

# 安装依赖
if [ -f "package.json" ] && [ -f "package-lock.json" ]; then
    echo "📦 安装后端依赖..."
    npm ci --only=production
elif [ -f "backend-package.json" ]; then
    echo "📦 使用npm install安装依赖..."
    cp backend-package.json package.json
    npm install --only=production
else
    echo "⚠️ 未找到package.json，跳过依赖安装"
fi

# 初始化Prisma
if [ -f "init-prisma.sh" ]; then
    echo "🔧 使用Prisma初始化脚本..."
    chmod +x init-prisma.sh
    ./init-prisma.sh || echo "⚠️ Prisma初始化失败，继续尝试..."
else
    echo "🔧 生成Prisma客户端..."
    if command -v npx &> /dev/null; then
        npx prisma generate || echo "⚠️ Prisma生成失败，继续尝试..."
    else
        echo "⚠️ npx不可用，跳过Prisma生成"
    fi
fi

# 设置环境变量并启动后端
export NODE_ENV=production
export DATABASE_URL="postgresql://lifetracker:TINGWU...123@localhost:5432/lifetracker"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-TINGWU...123"
export CORS_ORIGIN="https://${DOMAIN_NAME}"
export PORT=3002

# 后台启动后端
nohup node backend-dist/main.js > backend.log 2>&1 &
echo $! > backend.pid

echo "⏳ 等待后端启动..."
sleep 10

# 检查后端是否启动
if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "✅ 后端启动成功"
else
    echo "⚠️ 后端可能还在启动中"
fi

echo "🎉 超简化部署完成！"
export NODE_ENV=production
export DATABASE_URL="postgresql://lifetracker:TINGWU...123@localhost:5432/lifetracker"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-TINGWU...123"
export CORS_ORIGIN="https://${DOMAIN_NAME}"
export PORT=3002

# 后台启动后端
nohup node backend-dist/main.js > backend.log 2>&1 &
echo $! > backend.pid

echo "⏳ 等待后端启动..."
sleep 10

# 检查后端是否启动
if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "✅ 后端启动成功"
else
    echo "❌ 后端启动失败，查看日志："
    tail -20 backend.log
    exit 1
fi

# 配置Nginx（使用标准配置）
echo "🌐 配置Nginx..."

# 使用标准nginx配置而不是ultra-simple
echo "使用标准Nginx配置..."

# 恢复标准nginx.conf
sudo tee /etc/nginx/nginx.conf > /dev/null <<EOF
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# 移除旧的sites配置
sudo rm -f /etc/nginx/sites-enabled/*
else
    echo "创建简单的sites配置..."

    # 检查Let's Encrypt证书是否存在（支持多种命名格式）
    CERT_DIRS=(
        "/etc/letsencrypt/live/${DOMAIN_NAME}"
        "/etc/letsencrypt/live/${DOMAIN_NAME}-0001"
        "/etc/letsencrypt/live/${DOMAIN_NAME}-0002"
    )

    CERT_PATH=""
    KEY_PATH=""

    for cert_dir in "${CERT_DIRS[@]}"; do
        test_cert="${cert_dir}/fullchain.pem"
        test_key="${cert_dir}/privkey.pem"

        if [ -f "$test_cert" ] && [ -f "$test_key" ]; then
            CERT_PATH="$test_cert"
            KEY_PATH="$test_key"
            echo "✅ 找到证书: $cert_dir"
            break
        fi
    done

    if [ -n "$CERT_PATH" ] && [ -n "$KEY_PATH" ]; then
        echo "✅ 找到Let's Encrypt证书，创建HTTPS配置"
        sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;
    ssl_protocols TLSv1.2 TLSv1.3;

    # API代理
    location /api/ {
        proxy_pass http://localhost:3002/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 静态文件
    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
    else
        echo "⚠️ 未找到Let's Encrypt证书，创建HTTP配置"
        sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

    # API代理
    location /api/ {
        proxy_pass http://localhost:3002/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 静态文件
    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
    fi

# 启用站点配置
sudo ln -sf /etc/nginx/sites-available/lifetracker /etc/nginx/sites-enabled/

# 复制前端文件
echo "📁 复制前端文件..."
if [ -d "frontend-dist" ]; then
    sudo rm -rf /var/www/html/*
    sudo cp -r frontend-dist/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html
    sudo chmod -R 755 /var/www/html
    echo "✅ 前端文件复制完成"
else
    echo "⚠️ 未找到frontend-dist目录"
fi

# 启用站点
sudo ln -sf /etc/nginx/sites-available/lifetracker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 测试并启动Nginx
if sudo nginx -t; then
    sudo systemctl start nginx
    echo "✅ Nginx启动成功"
else
    echo "❌ Nginx配置错误"
    exit 1
fi

echo "✅ 简化部署完成！"
echo "🌐 网站地址: https://${DOMAIN_NAME}"
echo "📊 后端API: http://localhost:3002/api/health"

# 显示服务状态
echo "📋 服务状态："
echo "后端PID: $(cat backend.pid 2>/dev/null || echo '未知')"
sudo systemctl status nginx --no-pager -l || true
