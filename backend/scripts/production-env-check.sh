#!/bin/bash

# 生产环境变量检查脚本
# 用于检查生产服务器上的环境变量配置

echo "🔍 检查生产环境配置..."
echo "================================"

# 检查Node.js环境
echo "📋 Node.js 环境:"
echo "  Node版本: $(node --version)"
echo "  NPM版本: $(npm --version)"
echo "  当前目录: $(pwd)"
echo ""

# 检查环境变量
echo "📋 环境变量检查:"
echo "  NODE_ENV: ${NODE_ENV:-'❌ 未设置'}"
echo "  EMAIL_PROVIDER: ${EMAIL_PROVIDER:-'❌ 未设置'}"
echo "  EMAIL_USER: ${EMAIL_USER:-'❌ 未设置'}"
echo "  EMAIL_PASSWORD: ${EMAIL_PASSWORD:+'✅ 已设置'}"
echo ""

# 检查必要的环境变量
missing_vars=()

if [ -z "$EMAIL_USER" ]; then
    missing_vars+=("EMAIL_USER")
fi

if [ -z "$EMAIL_PASSWORD" ]; then
    missing_vars+=("EMAIL_PASSWORD")
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ 缺少必要的环境变量:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "💡 解决方案:"
    echo "  1. 在服务器上设置环境变量:"
    echo "     export EMAIL_USER='your-email@qq.com'"
    echo "     export EMAIL_PASSWORD='your-auth-code'"
    echo "     export EMAIL_PROVIDER='qq'"
    echo "     export NODE_ENV='production'"
    echo ""
    echo "  2. 或者在 .env 文件中设置:"
    echo "     echo 'EMAIL_USER=your-email@qq.com' >> .env"
    echo "     echo 'EMAIL_PASSWORD=your-auth-code' >> .env"
    echo "     echo 'EMAIL_PROVIDER=qq' >> .env"
    echo "     echo 'NODE_ENV=production' >> .env"
    echo ""
    exit 1
fi

# 检查网络连接
echo "🌐 网络连接检查:"
echo "  检查 QQ SMTP 服务器连接..."
if timeout 5 bash -c "</dev/tcp/smtp.qq.com/465" 2>/dev/null; then
    echo "  ✅ smtp.qq.com:465 连接正常"
else
    echo "  ❌ smtp.qq.com:465 连接失败"
fi

echo "  检查 Gmail SMTP 服务器连接..."
if timeout 5 bash -c "</dev/tcp/smtp.gmail.com/587" 2>/dev/null; then
    echo "  ✅ smtp.gmail.com:587 连接正常"
else
    echo "  ❌ smtp.gmail.com:587 连接失败"
fi

echo "  检查 163 SMTP 服务器连接..."
if timeout 5 bash -c "</dev/tcp/smtp.163.com/587" 2>/dev/null; then
    echo "  ✅ smtp.163.com:587 连接正常"
else
    echo "  ❌ smtp.163.com:587 连接失败"
fi
echo ""

# 检查进程状态
echo "🔄 进程状态检查:"
if command -v pm2 &> /dev/null; then
    echo "  PM2 进程列表:"
    pm2 list
    echo ""
    echo "  PM2 日志 (最近10行):"
    pm2 logs --lines 10
else
    echo "  ❌ PM2 未安装或不在PATH中"
fi
echo ""

# 运行邮件配置检查
echo "📧 运行邮件配置检查..."
if [ -f "scripts/check-email-config.js" ]; then
    node scripts/check-email-config.js
else
    echo "  ❌ 找不到邮件配置检查脚本"
fi

echo ""
echo "✅ 生产环境检查完成！"
echo ""
echo "💡 如果仍有问题，请检查:"
echo "  1. 邮箱是否开启了SMTP服务"
echo "  2. 使用的是授权码而不是登录密码"
echo "  3. 服务器防火墙是否允许SMTP端口"
echo "  4. 云服务商是否有SMTP限制"
