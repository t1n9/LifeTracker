#!/bin/bash

# 安全的Docker部署脚本 - 保护数据库
set -e

echo "🚀 开始安全Docker部署..."

# 停止现有服务
echo "🛑 停止现有服务..."
sudo pkill -f "node.*main.js" || true
sudo pkill -f "npm.*start" || true
sudo systemctl stop nginx || true
docker-compose down || true

# 进入项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    cd "$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../docker-compose.yml" ]; then
    cd "$SCRIPT_DIR/.."
elif [ -f "$SCRIPT_DIR/../../docker-compose.yml" ]; then
    cd "$SCRIPT_DIR/../.."
else
    echo "❌ 未找到docker-compose.yml文件"
    exit 1
fi

echo "📁 当前工作目录: $(pwd)"

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "❌ 未找到.env文件"
    exit 1
fi

# 显示环境变量（隐藏敏感信息）
echo "📋 环境变量检查:"
echo "DOMAIN_NAME: $(grep DOMAIN_NAME .env | cut -d'=' -f2 | head -c 10)..."
echo "DB_NAME: $(grep DB_NAME .env | cut -d'=' -f2)"
echo "NODE_ENV: $(grep NODE_ENV .env | cut -d'=' -f2)"

# 检查Docker和docker-compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose未安装"
    exit 1
fi

# 清理Docker缓存（可选）
read -p "是否清理Docker缓存？这可能解决构建问题 (y/N): " clean_cache
if [[ $clean_cache =~ ^[Yy]$ ]]; then
    echo "🧹 清理Docker缓存..."
    docker system prune -f
    docker builder prune -f
fi

# 验证docker-compose.yml语法
echo "🔍 验证docker-compose.yml语法..."
if ! docker-compose config > /dev/null; then
    echo "❌ docker-compose.yml语法错误"
    echo "请检查环境变量和配置文件"
    exit 1
fi

echo "✅ docker-compose.yml语法正确"

# 构建镜像（不启动）
echo "🔨 构建Docker镜像..."
if ! docker-compose build; then
    echo "❌ Docker镜像构建失败"
    echo "常见解决方案："
    echo "1. 检查Dockerfile语法"
    echo "2. 清理Docker缓存: docker system prune -a"
    echo "3. 检查网络连接"
    exit 1
fi

echo "✅ Docker镜像构建成功"

# 启动服务
echo "🚀 启动Docker服务..."
if ! docker-compose up -d; then
    echo "❌ Docker服务启动失败"
    echo "查看日志: docker-compose logs"
    exit 1
fi

echo "✅ Docker服务启动成功"

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 检查容器状态
echo "🔍 检查容器状态..."
docker-compose ps

# 健康检查
echo "🏥 执行健康检查..."
for i in {1..10}; do
    if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
        echo "✅ 后端服务健康检查通过！"
        echo "🌐 服务地址: http://localhost:3002"
        echo "📊 API文档: http://localhost:3002/api/docs"
        
        # 检查前端
        if curl -f http://localhost:3001 > /dev/null 2>&1; then
            echo "✅ 前端服务也正常运行！"
            echo "🎨 前端地址: http://localhost:3001"
        fi
        
        echo ""
        echo "🎉 Docker部署成功！"
        echo "📋 管理命令:"
        echo "  查看日志: docker-compose logs -f"
        echo "  重启服务: docker-compose restart"
        echo "  停止服务: docker-compose down"
        exit 0
    else
        echo "⏳ 等待服务启动... ($i/10)"
        if [ $i -eq 5 ]; then
            echo "📋 查看后端日志:"
            docker-compose logs --tail=20 backend
        fi
        sleep 10
    fi
done

echo "⚠️ 健康检查失败，但服务可能仍在启动中"
echo "📋 查看所有日志:"
docker-compose logs --tail=50

echo "🔍 容器状态:"
docker-compose ps

exit 0
