#!/bin/bash

# 修复403错误脚本
set -e

echo "🔧 修复403错误..."

# 检查前端文件
echo "📁 检查前端文件..."
if [ -d "frontend-dist" ]; then
    echo "✅ 找到frontend-dist目录"
    ls -la frontend-dist/ | head -10
else
    echo "❌ 未找到frontend-dist目录"
    echo "当前目录内容："
    ls -la
    exit 1
fi

# 复制前端文件到正确位置
echo "📁 复制前端文件到/var/www/html..."
sudo mkdir -p /var/www/html
sudo rm -rf /var/www/html/*
sudo cp -r frontend-dist/* /var/www/html/

# 设置正确的权限
echo "🔐 设置文件权限..."
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
sudo find /var/www/html -type f -exec chmod 644 {} \;

# 检查文件是否存在
echo "🔍 检查关键文件..."
if [ -f "/var/www/html/index.html" ]; then
    echo "✅ index.html存在"
    ls -la /var/www/html/index.html
else
    echo "❌ index.html不存在，创建默认页面..."
    sudo tee /var/www/html/index.html > /dev/null <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>LifeTracker</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>🎉 LifeTracker is Running!</h1>
    <p>Welcome to LifeTracker!</p>
    <p>Backend API: <a href="/api/health">/api/health</a></p>
    <script>
        // 测试API连接
        fetch('/api/health')
            .then(response => response.json())
            .then(data => {
                document.body.innerHTML += '<p>✅ Backend API is working: ' + JSON.stringify(data) + '</p>';
            })
            .catch(error => {
                document.body.innerHTML += '<p>❌ Backend API error: ' + error + '</p>';
            });
    </script>
</body>
</html>
EOF
    sudo chown www-data:www-data /var/www/html/index.html
    sudo chmod 644 /var/www/html/index.html
fi

# 检查Nginx配置
echo "🔍 检查Nginx配置..."
if sudo nginx -t; then
    echo "✅ Nginx配置正确"
else
    echo "❌ Nginx配置错误"
    exit 1
fi

# 重启Nginx
echo "🔄 重启Nginx..."
if sudo systemctl restart nginx; then
    echo "✅ Nginx重启成功"
else
    echo "❌ Nginx重启失败"
    exit 1
fi

# 检查Nginx状态
echo "📊 检查Nginx状态..."
sudo systemctl status nginx --no-pager -l

# 测试本地访问
echo "🧪 测试本地访问..."
if curl -f http://localhost/ > /dev/null 2>&1; then
    echo "✅ 本地HTTP访问正常"
else
    echo "❌ 本地HTTP访问失败"
fi

if curl -f -k https://localhost/ > /dev/null 2>&1; then
    echo "✅ 本地HTTPS访问正常"
else
    echo "❌ 本地HTTPS访问失败"
fi

echo "🎉 403错误修复完成！"
echo "📋 文件权限："
ls -la /var/www/html/ | head -5
