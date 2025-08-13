#!/bin/bash

# 快速修复Nginx配置脚本
set -e

echo "🔧 修复Nginx配置..."

DOMAIN_NAME=${1:-t1n9.xyz}

# 复制前端文件到Nginx目录
echo "📁 复制前端文件..."
if [ -d "frontend-dist" ]; then
    sudo rm -rf /var/www/html/*
    sudo cp -r frontend-dist/* /var/www/html/
    sudo chown -R www-data:www-data /var/www/html
    sudo chmod -R 755 /var/www/html
    echo "✅ 前端文件复制完成"
else
    echo "⚠️ 未找到frontend-dist目录，创建默认页面..."
    sudo mkdir -p /var/www/html
    sudo tee /var/www/html/index.html > /dev/null <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>LifeTracker</title>
</head>
<body>
    <h1>LifeTracker is Running!</h1>
    <p>Backend API: <a href="/api/health">/api/health</a></p>
</body>
</html>
EOF
    sudo chown -R www-data:www-data /var/www/html
    sudo chmod -R 755 /var/www/html
fi

# 使用标准Nginx配置
echo "使用标准Nginx配置..."

# 恢复标准nginx.conf
sudo tee /etc/nginx/nginx.conf > /dev/null <<EOF
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 768;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    gzip on;

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
EOF

# 检查Let's Encrypt证书
CERT_DIRS=(
    "/etc/letsencrypt/live/t1n9.xyz"
    "/etc/letsencrypt/live/t1n9.xyz-0001"
    "/etc/letsencrypt/live/t1n9.xyz-0002"
)

SSL_CERT=""
SSL_KEY=""

for cert_dir in "${CERT_DIRS[@]}"; do
    test_cert="${cert_dir}/fullchain.pem"
    test_key="${cert_dir}/privkey.pem"

    if [ -f "$test_cert" ] && [ -f "$test_key" ]; then
        SSL_CERT="$test_cert"
        SSL_KEY="$test_key"
        echo "✅ 找到证书: $cert_dir"
        break
    fi
done

if [ -n "$SSL_CERT" ] && [ -n "$SSL_KEY" ]; then
    echo "✅ 创建HTTPS配置"
    sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name t1n9.xyz www.t1n9.xyz;

    ssl_certificate $SSL_CERT;
    ssl_certificate_key $SSL_KEY;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3002/api/;
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
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # 基本缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1d;
        }
    }
}
EOF
else
    echo "⚠️ 未找到Let's Encrypt证书，创建HTTP配置"
    sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name _;

    # API代理
    location /api/ {
        proxy_pass http://127.0.0.1:3002/api/;
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
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        # 基本缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1d;
        }
    }
}
EOF
fi

# 启用站点
sudo rm -f /etc/nginx/sites-enabled/*
sudo ln -sf /etc/nginx/sites-available/lifetracker /etc/nginx/sites-enabled/

# 测试配置
if sudo nginx -t; then
    echo "✅ Nginx配置测试通过"
    
    # 重启Nginx
    if sudo systemctl restart nginx; then
        echo "✅ Nginx重启成功"
    else
        echo "❌ Nginx重启失败"
        exit 1
    fi
else
    echo "❌ Nginx配置测试失败"
    exit 1
fi

echo "🎉 Nginx修复完成！"
echo "🌐 网站地址: https://${DOMAIN_NAME}"
echo "📊 健康检查: https://${DOMAIN_NAME}/api/health"
