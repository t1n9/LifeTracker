#!/bin/bash

# 紧急修复脚本 - 直接启动后端服务
set -e

echo "🚨 紧急修复 - 启动后端服务"

# 进入项目目录
cd /opt/lifetracker

# 停止现有进程
echo "🛑 停止现有后端进程..."
sudo pkill -f "node.*main.js" || true
sudo pkill -f "npm.*start" || true

# 检查后端目录
if [ ! -d "backend" ]; then
    echo "❌ 后端目录不存在"
    exit 1
fi

cd backend

# 检查环境变量
if [ -f "../.env" ]; then
    source ../.env
    echo "✅ 环境变量已加载"
else
    echo "❌ 环境变量文件不存在"
    exit 1
fi

# 设置数据库URL
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
export NODE_ENV=production

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm ci
fi

# 检查构建
if [ ! -d "dist" ]; then
    echo "🔨 构建项目..."
    npm run build
fi

# 生成Prisma客户端
echo "🔧 生成Prisma客户端..."
npx prisma generate

# 启动服务
echo "🚀 启动后端服务..."
nohup npm run start:prod > ../backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../backend.pid

cd ..

echo "✅ 后端服务已启动，PID: $BACKEND_PID"

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 15

# 健康检查
echo "🏥 执行健康检查..."
for i in {1..6}; do
    if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
        echo "✅ 后端服务健康检查通过！"
        echo "🌐 本地服务: http://localhost:3002"
        echo "🌐 外部访问: https://${DOMAIN_NAME}"
        echo "📊 API文档: https://${DOMAIN_NAME}/api/docs"
        exit 0
    else
        echo "⏳ 等待服务启动... ($i/6)"
        sleep 10
    fi
done

echo "⚠️ 健康检查失败，查看日志:"
tail -20 backend.log

echo "🔍 检查进程:"
ps aux | grep node

exit 1
