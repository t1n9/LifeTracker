#!/bin/bash

# 简化部署脚本 - 用于测试
set -e

echo "🚀 开始简化部署..."

# 确保环境变量文件存在
if [ ! -f ".env" ]; then
    echo "📝 创建环境变量文件..."
    cat > .env << 'EOF'
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
docker-compose down --remove-orphans || true

# 清理
echo "🧹 清理旧镜像..."
docker system prune -f || true

# 先只启动数据库和Redis
echo "🗄️ 启动数据库服务..."
docker-compose up -d postgres redis

# 等待数据库启动
echo "⏳ 等待数据库启动..."
sleep 30

# 检查数据库状态
echo "🔍 检查数据库状态..."
docker-compose ps

# 启动后端
echo "🔧 启动后端服务..."
docker-compose up -d --build backend

# 等待后端启动
echo "⏳ 等待后端启动..."
sleep 30

# 启动前端
echo "🎨 启动前端服务..."
docker-compose up -d --build frontend

# 等待前端启动
echo "⏳ 等待前端启动..."
sleep 30

# 最后启动Nginx
echo "🌐 启动Nginx..."
docker-compose up -d nginx

echo "✅ 部署完成！"
echo "🔍 服务状态："
docker-compose ps

echo ""
echo "🌐 访问地址: https://t1n9.xyz"
echo "📊 健康检查: https://t1n9.xyz/api/health"
