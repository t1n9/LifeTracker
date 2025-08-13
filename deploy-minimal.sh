#!/bin/bash

# 最小化部署脚本 - 完全无外部依赖
set -e

echo "🚀 开始最小化部署..."

# 设置基本变量
DOMAIN_NAME="t1n9.xyz"
BACKEND_PORT=3002

# 停止现有服务
echo "🛑 停止现有服务..."
sudo pkill -f "node.*backend-dist/main.js" || true
sudo systemctl stop nginx || true

# 检查Node.js是否可用
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，无法继续"
    exit 1
fi

echo "✅ Node.js版本: $(node --version)"

# 启动后端服务（检查依赖）
echo "🔧 启动后端服务..."
cd $(dirname $0)

# 检查后端文件是否存在
if [ ! -f "backend-dist/main.js" ]; then
    echo "❌ 后端编译文件不存在: backend-dist/main.js"
    exit 1
fi

# 检查是否需要安装依赖
if [ ! -d "node_modules" ] || [ ! -f "node_modules/@nestjs/core/package.json" ]; then
    echo "📦 检测到缺少依赖，安装生产依赖..."
    if [ -f "package.json" ] && [ -f "package-lock.json" ]; then
        npm ci --only=production
    elif [ -f "backend-package.json" ]; then
        cp backend-package.json package.json
        npm install --only=production
    else
        echo "❌ 未找到package.json文件"
        exit 1
    fi
fi

# 生成Prisma客户端
if [ ! -d "node_modules/.prisma" ]; then
    echo "🔧 生成Prisma客户端..."
    npx prisma generate || echo "⚠️ Prisma生成失败，继续尝试..."
fi

# 设置环境变量
export NODE_ENV=production
export DATABASE_URL="postgresql://lifetracker:TINGWU...123@localhost:5432/lifetracker"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-TINGWU...123"
export CORS_ORIGIN="https://${DOMAIN_NAME}"
export PORT=${BACKEND_PORT}

# 后台启动后端（无依赖）
echo "🚀 启动后端进程..."
nohup node backend-dist/main.js > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid

echo "⏳ 等待后端启动..."
sleep 15

# 检查后端是否启动成功
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ 后端进程运行中 (PID: $BACKEND_PID)"
    
    # 测试后端API
    for i in {1..10}; do
        if curl -f http://localhost:${BACKEND_PORT}/api/health > /dev/null 2>&1; then
            echo "✅ 后端API响应正常"
            break
        else
            echo "⏳ 等待后端API启动... ($i/10)"
            sleep 3
        fi
    done
else
    echo "❌ 后端进程启动失败"
    cat backend.log
    exit 1
fi

# 配置Nginx（使用Let's Encrypt证书）
echo "🌐 配置Nginx..."

# 检查Let's Encrypt证书是否存在
CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem"

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo "✅ 找到Let's Encrypt证书，使用正式SSL证书"
    SSL_CERT="$CERT_PATH"
    SSL_KEY="$KEY_PATH"
else
    echo "⚠️ 未找到Let's Encrypt证书，尝试获取..."
    # 安装certbot
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx

    # 先启动基本的HTTP服务
    sudo tee /etc/nginx/sites-available/lifetracker-temp > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    sudo rm -f /etc/nginx/sites-enabled/*
    sudo ln -sf /etc/nginx/sites-available/lifetracker-temp /etc/nginx/sites-enabled/

    # 确保nginx正在运行
    sudo systemctl start nginx || true
    sudo systemctl enable nginx || true

    # 测试nginx配置
    if sudo nginx -t; then
        sudo systemctl reload nginx
        echo "✅ Nginx配置正确，已重新加载"
    else
        echo "❌ Nginx配置错误，跳过证书获取"
        SSL_CERT=""
        SSL_KEY=""
        return
    fi

    # 等待nginx完全启动
    sleep 5

    # 检查域名解析
    echo "🔍 检查域名解析..."
    if nslookup ${DOMAIN_NAME} | grep -q "$(curl -s ifconfig.me)"; then
        echo "✅ 域名解析正确"
    else
        echo "⚠️ 域名解析可能有问题，但继续尝试获取证书"
        echo "当前服务器IP: $(curl -s ifconfig.me)"
        echo "域名解析结果:"
        nslookup ${DOMAIN_NAME} || true
    fi

    # 获取Let's Encrypt证书
    echo "🔒 尝试获取Let's Encrypt证书..."
    if sudo certbot --nginx -d ${DOMAIN_NAME} -d www.${DOMAIN_NAME} --non-interactive --agree-tos --email admin@${DOMAIN_NAME} --redirect; then
        echo "✅ certbot执行成功"
    else
        echo "⚠️ certbot执行失败，可能是域名解析问题或证书已存在"

        # 尝试使用webroot方式
        echo "🔄 尝试使用webroot方式获取证书..."
        sudo mkdir -p /var/www/html/.well-known/acme-challenge
        sudo chown -R www-data:www-data /var/www/html/.well-known

        if sudo certbot certonly --webroot -w /var/www/html -d ${DOMAIN_NAME} -d www.${DOMAIN_NAME} --non-interactive --agree-tos --email admin@${DOMAIN_NAME}; then
            echo "✅ webroot方式获取证书成功"
        else
            echo "❌ webroot方式也失败了"
        fi
    fi

    # 再次检查证书是否存在
    if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
        echo "✅ Let's Encrypt证书获取成功"
        SSL_CERT="$CERT_PATH"
        SSL_KEY="$KEY_PATH"

        # 验证证书有效性
        if sudo openssl x509 -in "$CERT_PATH" -text -noout | grep -q "${DOMAIN_NAME}"; then
            echo "✅ 证书验证成功，包含正确的域名"
        else
            echo "⚠️ 证书验证失败，可能不包含正确的域名"
        fi
    else
        echo "❌ Let's Encrypt证书获取失败，使用HTTP模式"
        echo "证书路径: $CERT_PATH"
        echo "私钥路径: $KEY_PATH"

        # 检查certbot日志
        if [ -f "/var/log/letsencrypt/letsencrypt.log" ]; then
            echo "📋 Certbot日志（最后10行）:"
            sudo tail -10 /var/log/letsencrypt/letsencrypt.log || true
        fi

        SSL_CERT=""
        SSL_KEY=""
    fi
fi

# 创建最终的Nginx配置
if [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ]; then
    echo "创建HTTPS配置..."
    sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

    # Let's Encrypt SSL配置
    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # 健康检查
    location /health {
        return 200 "OK";
        add_header Content-Type text/plain;
    }

    # 静态文件
    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # 基本缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1d;
        }
    }
}
EOF
else
    echo "创建HTTP配置..."
    sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name _;

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # 健康检查
    location /health {
        return 200 "OK";
        add_header Content-Type text/plain;
    }

    # 静态文件
    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # 基本缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1d;
        }
    }
}
EOF
fi

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

# 启用站点并移除默认站点
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/lifetracker /etc/nginx/sites-enabled/

# 测试Nginx配置
if sudo nginx -t; then
    echo "✅ Nginx配置测试通过"
else
    echo "❌ Nginx配置测试失败"
    exit 1
fi

# 启动Nginx
if sudo systemctl start nginx; then
    echo "✅ Nginx启动成功"
else
    echo "❌ Nginx启动失败"
    sudo journalctl -u nginx --no-pager -l
    exit 1
fi

echo ""
echo "🎉 最小化部署完成！"
echo "🌐 网站地址: https://${DOMAIN_NAME}"
echo "📊 后端API: http://localhost:${BACKEND_PORT}/api/health"
echo "🔍 后端PID: $BACKEND_PID"
echo ""
echo "📋 服务状态："
echo "- 后端进程: $(kill -0 $BACKEND_PID 2>/dev/null && echo '运行中' || echo '已停止')"
echo "- Nginx状态: $(sudo systemctl is-active nginx)"
echo ""
echo "📝 日志文件: $(pwd)/backend.log"
