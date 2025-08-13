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

# 直接启动后端（无需安装依赖）
echo "🔧 启动后端服务..."
cd $(dirname $0)

# 设置环境变量
export NODE_ENV=production
export DATABASE_URL="postgresql://lifetracker:TINGWU...123@localhost:5432/lifetracker"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="your-super-secret-jwt-key-change-this-in-production-TINGWU...123"
export CORS_ORIGIN="https://${DOMAIN_NAME}"
export PORT=${BACKEND_PORT}

# 检查后端文件是否存在
if [ ! -f "backend-dist/main.js" ]; then
    echo "❌ 后端编译文件不存在: backend-dist/main.js"
    exit 1
fi

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

# 配置Nginx（最简单的配置）
echo "🌐 配置Nginx..."

# 创建最简单的Nginx配置
sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name _;
    
    # 简单的SSL配置
    ssl_certificate $(pwd)/nginx/ssl/cert.pem;
    ssl_certificate_key $(pwd)/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
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
        root $(pwd)/frontend-dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # 基本缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1d;
        }
    }
}
EOF

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
