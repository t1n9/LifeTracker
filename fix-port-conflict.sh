#!/bin/bash

# 临时修复端口冲突脚本
echo "🔧 修复端口冲突问题..."

# 强制停止所有占用3002端口的进程
echo "🛑 强制停止所有Node.js进程..."
sudo pkill -9 -f "node" || true

# 强制杀死占用3002端口的进程
echo "🔧 强制释放3002端口..."
sudo lsof -ti:3002 | xargs -r sudo kill -9 || true

# 等待端口释放
echo "⏳ 等待端口释放..."
sleep 5

# 检查端口是否已释放
if lsof -i:3002 > /dev/null 2>&1; then
    echo "❌ 端口3002仍被占用"
    echo "占用进程："
    lsof -i:3002
    exit 1
else
    echo "✅ 端口3002已释放"
fi

# 重新启动后端服务
echo "🚀 重新启动后端服务..."
cd /opt/lifetracker/current

# 加载环境变量
if [ -f ".env" ]; then
    source .env
fi

# 设置环境变量
export NODE_ENV=production
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="${JWT_SECRET}"
export CORS_ORIGIN="https://${DOMAIN_NAME}"
export PORT=3002

# 启动后端服务
nohup node backend-dist/main.js > backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > backend.pid

echo "✅ 后端服务已启动，PID: $BACKEND_PID"

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 15

# 健康检查
if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务健康检查通过！"
    echo "🌐 服务地址: http://localhost:3002"
    echo "📊 API文档: http://localhost:3002/api/docs"
else
    echo "❌ 健康检查失败，查看日志:"
    tail -20 backend.log
fi

echo "🎉 修复完成！"
