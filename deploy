#!/bin/bash

# LifeTracker 一键部署脚本
# 使用方法: ./deploy.sh [--config config-file]

set -e

# 默认配置
DEFAULT_CONFIG="scripts/deployment/deploy.config.sh"
CONFIG_FILE=""

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --config)
      CONFIG_FILE="$2"
      shift 2
      ;;
    -h|--help)
      echo "使用方法: $0 [--config config-file]"
      echo "  --config: 指定配置文件 (默认: deploy.config.sh)"
      echo "  --help:   显示此帮助信息"
      exit 0
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

# 加载配置文件
if [[ -n "$CONFIG_FILE" ]]; then
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
        echo "✅ 已加载配置文件: $CONFIG_FILE"
    else
        echo "❌ 配置文件不存在: $CONFIG_FILE"
        exit 1
    fi
elif [[ -f "$DEFAULT_CONFIG" ]]; then
    source "$DEFAULT_CONFIG"
    echo "✅ 已加载默认配置文件: $DEFAULT_CONFIG"
else
    echo "⚠️  未找到配置文件，使用默认配置"
    echo "💡 建议复制 deploy.config.example.sh 为 deploy.config.sh 并修改配置"
fi

echo "🚀 开始部署 LifeTracker..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# SSL证书配置
setup_ssl() {
    mkdir -p nginx/ssl

    if [[ "${USE_LETSENCRYPT:-true}" == "true" ]] && [[ -n "${DOMAIN_NAME}" ]] && [[ -n "${SSL_EMAIL}" ]]; then
        echo "🔒 配置 Let's Encrypt SSL 证书..."

        # 检查是否已安装 certbot
        if ! command -v certbot &> /dev/null; then
            echo "📦 安装 Certbot..."
            apt update
            apt install -y certbot python3-certbot-nginx
        fi

        # 获取SSL证书
        certbot --nginx -d "${DOMAIN_NAME}" -d "www.${DOMAIN_NAME}" \
            --email "${SSL_EMAIL}" \
            --agree-tos \
            --non-interactive \
            --redirect || {
            echo "⚠️  Let's Encrypt 证书获取失败，使用自签名证书"
            create_self_signed_cert
        }
    else
        echo "🔒 创建自签名SSL证书..."
        create_self_signed_cert
    fi
}

create_self_signed_cert() {
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=CN/ST=State/L=City/O=Organization/CN=${DOMAIN_NAME:-localhost}"
    echo "✅ 自签名证书已创建"
}

# 检查SSL证书
if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
    setup_ssl
else
    echo "✅ SSL证书已存在"
fi

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose down --remove-orphans

# 清理旧镜像（可选）
echo "🧹 清理旧镜像..."
docker system prune -f

# 生成环境变量文件
echo "📝 生成环境变量文件..."
cat > .env << EOF
# 自动生成的环境变量文件
DOMAIN_NAME=${DOMAIN_NAME:-localhost}
DB_NAME=${DB_NAME:-lifetracker}
DB_USER=${DB_USER:-lifetracker}
DB_PASSWORD=${DB_PASSWORD:-your-secure-password}
JWT_SECRET=${JWT_SECRET:-your-super-secret-jwt-key-change-in-production}
NODE_ENV=${NODE_ENV:-production}
EOF

# 构建并启动服务
echo "🔨 构建并启动服务..."
docker-compose up --build -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 检查服务状态
echo "🔍 检查服务状态..."
docker-compose ps

# 检查数据库连接
echo "🗄️  检查数据库连接..."
docker-compose exec -T backend npx prisma db push || echo "⚠️  数据库同步可能需要手动执行"

# 显示部署结果
echo ""
echo "🎉 部署完成！"
echo ""
echo "📊 服务状态:"
echo "  - 前端: http://localhost:3001"
echo "  - 后端: http://localhost:3002"
echo "  - 数据库: localhost:5432"
echo "  - 网站: https://t1n9.xyz (需要配置域名解析)"
echo ""
echo "📝 查看日志:"
echo "  docker-compose logs -f [service_name]"
echo ""
echo "🔧 管理命令:"
echo "  启动: docker-compose up -d"
echo "  停止: docker-compose down"
echo "  重启: docker-compose restart"
echo "  查看状态: docker-compose ps"
echo ""

# 检查服务健康状态
echo "🏥 检查服务健康状态..."
for i in {1..10}; do
    if curl -f http://localhost:3002/api/health &>/dev/null; then
        echo "✅ 后端服务正常"
        break
    else
        echo "⏳ 等待后端服务启动... ($i/10)"
        sleep 5
    fi
done

for i in {1..10}; do
    if curl -f http://localhost:3001 &>/dev/null; then
        echo "✅ 前端服务正常"
        break
    else
        echo "⏳ 等待前端服务启动... ($i/10)"
        sleep 5
    fi
done

echo ""
echo ""
echo "🎯 部署完成！"
echo "🌐 网站地址: https://${DOMAIN_NAME:-localhost}"
echo "📧 默认登录: 1378006836@qq.com / 123456"
echo ""
echo "📚 更多信息:"
echo "  - 项目文档: https://github.com/${GITHUB_REPO:-your-username/LifeTracker}"
echo "  - 问题反馈: https://github.com/${GITHUB_REPO:-your-username/LifeTracker}/issues"
echo ""
echo "⚠️  重要提醒:"
echo "  1. 请及时修改默认密码"
echo "  2. 定期备份数据库"
echo "  3. 监控服务器资源使用情况"
