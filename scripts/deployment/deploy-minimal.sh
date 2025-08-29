#!/bin/bash

# 最小化部署脚本 - Docker优先
set -e

echo "🚀 开始最小化部署..."

# 停止现有服务
echo "🛑 停止现有服务..."
sudo pkill -f "node.*main.js" || true
sudo pkill -f "npm.*start" || true
sudo systemctl stop nginx || true
docker-compose down || true

cd $(dirname $0)

# 优先使用Docker部署
if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
    echo "🐳 使用Docker Compose部署..."

    # 确保环境变量文件存在
    if [ ! -f ".env" ]; then
        echo "⚠️ 未找到.env文件，创建基础配置..."
        cat > .env << EOF
DOMAIN_NAME=t1n9.xyz
DB_NAME=lifetracker
DB_USER=lifetracker
DB_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
NODE_ENV=production
EOF
    fi

    # 构建并启动服务
    docker-compose up -d --build

    # 等待服务启动
    echo "⏳ 等待服务启动..."
    sleep 30

    # 检查服务状态
    if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
        echo "✅ Docker部署成功！"
        echo "🌐 服务地址: http://localhost:3002"
        exit 0
    else
        echo "⚠️ 服务可能还在启动中，请稍后检查"
        docker-compose logs --tail=20
        exit 0
    fi
fi

echo "❌ Docker未安装或docker-compose.yml不存在"
echo "请安装Docker或使用其他部署方式"
exit 1
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

# 从.env文件加载环境变量（如果存在）
if [ -f ".env" ]; then
    echo "📋 加载环境变量文件..."
    set -a  # 自动导出变量
    source .env
    set +a
    echo "✅ 环境变量已加载"
else
    echo "⚠️ 未找到.env文件，使用默认配置"
fi

# 显示邮件配置状态（可选）
if [ -n "$EMAIL_USER" ] && [ -n "$EMAIL_PASSWORD" ]; then
    echo "📧 邮件服务配置: ✅ 已配置"
else
    echo "📧 邮件服务配置: ⚠️ 未配置（可选功能）"
fi

# 后台启动后端
echo "🚀 启动后端进程..."
if [ -d "backend" ]; then
    # 使用源代码启动
    cd backend
    nohup npm run start:prod > ../backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
elif [ -f "backend-dist/main.js" ]; then
    # 使用编译文件启动
    nohup node backend-dist/main.js > backend.log 2>&1 &
    BACKEND_PID=$!
else
    echo "❌ 无法找到后端启动文件"
    exit 1
fi
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

# 检查Let's Encrypt证书是否存在（支持多种命名格式）
CERT_DIRS=(
    "/etc/letsencrypt/live/${DOMAIN_NAME}"
    "/etc/letsencrypt/live/${DOMAIN_NAME}-0001"
    "/etc/letsencrypt/live/${DOMAIN_NAME}-0002"
)

SSL_CERT=""
SSL_KEY=""

for cert_dir in "${CERT_DIRS[@]}"; do
    CERT_PATH="${cert_dir}/fullchain.pem"
    KEY_PATH="${cert_dir}/privkey.pem"

    if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
        echo "✅ 找到Let's Encrypt证书: $cert_dir"
        SSL_CERT="$CERT_PATH"
        SSL_KEY="$KEY_PATH"
        break
    fi
done

if [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ]; then
    echo "✅ 使用现有SSL证书: $SSL_CERT"
else
    echo "⚠️ 未找到Let's Encrypt证书"
    echo "检查的路径:"
    for cert_dir in "${CERT_DIRS[@]}"; do
        echo "  - $cert_dir"
    done

    # 列出实际存在的证书目录
    if [ -d "/etc/letsencrypt/live" ]; then
        echo "实际存在的证书目录:"
        ls -la /etc/letsencrypt/live/ || true
    fi

    echo "使用HTTP模式部署"
    SSL_CERT=""
    SSL_KEY=""
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

    # 分享页面路由
    location ~ ^/share/[^/]+/?$ {
        root /var/www/html;
        try_files /index.html =404;
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

    # 分享页面路由
    location ~ ^/share/[^/]+/?$ {
        root /var/www/html;
        try_files /index.html =404;
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
# 将 location / 由静态文件改为转发到 127.0.0.1:$PORT

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

# 可选：检查邮件服务配置
if [ -n "$EMAIL_USER" ] && [ -n "$EMAIL_PASSWORD" ]; then
    echo ""
    echo "📧 检查邮件服务配置..."
    if [ -f "scripts/check-email-simple.js" ]; then
        node scripts/check-email-simple.js || echo "⚠️ 邮件配置检查失败，但不影响应用运行"
    fi

    # 测试邮件服务健康状态
    echo "🏥 测试邮件服务..."
    if curl -f http://localhost:${BACKEND_PORT}/api/email/health > /dev/null 2>&1; then
        echo "✅ 邮件服务健康检查通过"
    else
        echo "⚠️ 邮件服务检查失败，但不影响应用运行"
    fi
else
    echo ""
    echo "📧 邮件服务未配置，跳过邮件功能检查"
fi

echo ""
echo "🎉 最小化部署完成！"
echo "🌐 网站地址: https://${DOMAIN_NAME}"
echo "📊 后端API: http://localhost:${BACKEND_PORT}/api/health"
echo "📧 邮件服务: http://localhost:${BACKEND_PORT}/api/email/health"
echo "🔍 后端PID: $BACKEND_PID"
echo ""
echo "📋 服务状态："
echo "- 后端进程: $(kill -0 $BACKEND_PID 2>/dev/null && echo '运行中' || echo '已停止')"
echo "- Nginx状态: $(sudo systemctl is-active nginx)"
echo ""
echo "📝 日志文件: $(pwd)/backend.log"
echo "🔧 邮件修复: chmod +x scripts/fix-production-email.sh && ./scripts/fix-production-email.sh"
