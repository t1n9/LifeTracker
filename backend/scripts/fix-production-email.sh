#!/bin/bash

# 生产环境邮件问题快速修复脚本

echo "🔧 LifeTracker 生产环境邮件修复工具"
echo "====================================="

# 检查当前目录
echo "📍 当前目录: $(pwd)"

# 检查环境变量
echo ""
echo "📋 当前环境变量:"
echo "  NODE_ENV: ${NODE_ENV:-'未设置'}"
echo "  EMAIL_PROVIDER: ${EMAIL_PROVIDER:-'未设置'}"
echo "  EMAIL_USER: ${EMAIL_USER:-'未设置'}"
echo "  EMAIL_PASSWORD: ${EMAIL_PASSWORD:+'已设置'}"

# 检查.env文件
if [ -f ".env" ]; then
    echo ""
    echo "📄 .env文件内容:"
    echo "=================="
    # 显示.env文件内容，但隐藏密码
    while IFS= read -r line; do
        if [[ $line == EMAIL_PASSWORD=* ]]; then
            echo "EMAIL_PASSWORD=***已设置***"
        elif [[ $line == *PASSWORD* ]] || [[ $line == *SECRET* ]]; then
            key=$(echo "$line" | cut -d'=' -f1)
            echo "${key}=***已设置***"
        else
            echo "$line"
        fi
    done < .env
    echo "=================="
else
    echo ""
    echo "❌ 未找到.env文件"
    
    # 提示创建.env文件
    echo ""
    echo "💡 是否要创建.env文件? (y/n)"
    read -r create_env
    
    if [ "$create_env" = "y" ] || [ "$create_env" = "Y" ]; then
        echo ""
        echo "📝 请输入邮件配置信息:"
        
        echo -n "邮件提供商 (qq/gmail/163) [qq]: "
        read -r email_provider
        email_provider=${email_provider:-qq}
        
        echo -n "邮箱账号: "
        read -r email_user
        
        echo -n "邮箱授权码: "
        read -s email_password
        echo ""
        
        # 创建.env文件
        cat > .env << EOF
# 应用环境
NODE_ENV=production

# 邮件服务配置
EMAIL_PROVIDER=${email_provider}
EMAIL_USER=${email_user}
EMAIL_PASSWORD=${email_password}

# 其他配置（如果需要）
# DATABASE_URL=postgresql://...
# JWT_SECRET=...
EOF
        
        echo "✅ .env文件已创建"
        
        # 重新加载环境变量
        set -a
        source .env
        set +a
        
        echo "✅ 环境变量已重新加载"
    fi
fi

# 检查Node.js和npm
echo ""
echo "🔍 检查运行环境:"
echo "  Node.js: $(node --version 2>/dev/null || echo '未安装')"
echo "  NPM: $(npm --version 2>/dev/null || echo '未安装')"

# 检查依赖
echo ""
echo "📦 检查依赖:"
if [ -d "node_modules" ]; then
    echo "  ✅ node_modules 目录存在"
    
    # 检查关键依赖
    if [ -d "node_modules/@nestjs/core" ]; then
        echo "  ✅ NestJS 核心模块已安装"
    else
        echo "  ❌ NestJS 核心模块缺失"
    fi
    
    if [ -d "node_modules/nodemailer" ]; then
        echo "  ✅ nodemailer 模块已安装"
    else
        echo "  ❌ nodemailer 模块缺失"
        echo "  💡 尝试安装依赖..."
        if [ -f "package.json" ]; then
            npm install --only=production
        fi
    fi
else
    echo "  ❌ node_modules 目录不存在"
    echo "  💡 尝试安装依赖..."
    
    if [ -f "package.json" ]; then
        npm install --only=production
    elif [ -f "backend-package.json" ]; then
        cp backend-package.json package.json
        npm install --only=production
    else
        echo "  ❌ 未找到package.json文件"
    fi
fi

# 运行邮件配置检查
echo ""
echo "📧 运行邮件配置检查..."
if [ -f "scripts/check-email-simple.js" ]; then
    node scripts/check-email-simple.js
elif [ -f "check-email-simple.js" ]; then
    node check-email-simple.js
else
    echo "❌ 未找到邮件检查脚本"
fi

# 检查应用进程
echo ""
echo "🔍 检查应用进程:"
if pgrep -f "node.*main.js" > /dev/null; then
    echo "  ✅ 后端进程正在运行"
    echo "  PID: $(pgrep -f 'node.*main.js')"
else
    echo "  ❌ 后端进程未运行"
    
    # 尝试启动后端
    if [ -f "backend-dist/main.js" ]; then
        echo "  💡 尝试启动后端..."
        nohup node backend-dist/main.js > backend.log 2>&1 &
        echo "  ✅ 后端启动命令已执行，PID: $!"
        echo "  📝 日志文件: $(pwd)/backend.log"
    else
        echo "  ❌ 未找到后端文件: backend-dist/main.js"
    fi
fi

# 测试API健康状态
echo ""
echo "🏥 测试API健康状态:"
if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
    echo "  ✅ API健康检查通过"
    
    # 测试邮件健康状态
    echo "  📧 测试邮件服务健康状态:"
    if curl -f http://localhost:3002/api/email/health 2>/dev/null; then
        echo "  ✅ 邮件服务健康检查通过"
    else
        echo "  ❌ 邮件服务健康检查失败"
    fi
else
    echo "  ❌ API健康检查失败"
    echo "  💡 请检查后端是否正常启动"
    
    if [ -f "backend.log" ]; then
        echo "  📝 最近的后端日志:"
        tail -20 backend.log
    fi
fi

echo ""
echo "🎯 修复建议:"
echo "1. 确保.env文件包含正确的邮件配置"
echo "2. 确保使用邮箱授权码而不是登录密码"
echo "3. 重启应用以加载新的环境变量"
echo "4. 检查防火墙是否允许SMTP端口"
echo ""
echo "📞 如需进一步帮助，请检查:"
echo "- 应用日志: tail -f backend.log"
echo "- 系统日志: journalctl -f"
echo "- Nginx状态: systemctl status nginx"
