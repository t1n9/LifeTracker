#!/bin/bash

# 生产环境部署脚本 - 使用预编译文件
set -e

echo "🚀 开始生产环境部署..."

# 环境变量文件应该已经由GitHub Actions生成
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

# 创建SSL证书目录
mkdir -p nginx/ssl

# 检查SSL证书
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    echo "🔒 创建自签名SSL证书..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=CN/ST=State/L=City/O=LifeTracker/CN=t1n9.xyz"
fi

# 停止现有服务
echo "🛑 停止现有服务..."
docker-compose -f docker-compose.prod.yml down --remove-orphans || true

# 清理旧容器
echo "🧹 清理旧容器..."
docker container prune -f || true

# 启动数据库服务
echo "🗄️ 启动数据库服务..."
docker-compose -f docker-compose.prod.yml up -d postgres redis

# 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 30

# 检查数据库连接
echo "🔍 检查数据库连接..."
docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U lifetracker || echo "数据库未就绪，继续..."

# 启动后端服务
echo "🔧 启动后端服务..."
docker-compose -f docker-compose.prod.yml up -d backend

# 等待后端启动
echo "⏳ 等待后端启动..."
sleep 30

# 启动前端服务
echo "🎨 启动前端服务..."
docker-compose -f docker-compose.prod.yml up -d frontend

# 等待前端启动
echo "⏳ 等待前端启动..."
sleep 30

# 启动Nginx
echo "🌐 启动Nginx..."
docker-compose -f docker-compose.prod.yml up -d nginx

# 最终检查
echo "🔍 检查服务状态..."
docker-compose -f docker-compose.prod.yml ps

echo ""
echo "✅ 部署完成！"
echo "🌐 网站地址: https://t1n9.xyz"
echo "📊 健康检查: https://t1n9.xyz/api/health"
echo ""
echo "📋 服务状态："
docker-compose -f docker-compose.prod.yml ps
