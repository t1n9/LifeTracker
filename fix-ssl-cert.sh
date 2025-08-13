#!/bin/bash

# SSL证书修复脚本
set -e

echo "🔒 修复SSL证书配置..."

DOMAIN_NAME="t1n9.xyz"

# 停止nginx
sudo systemctl stop nginx || true

# 移除所有nginx配置
sudo rm -f /etc/nginx/sites-enabled/*
sudo rm -f /etc/nginx/sites-available/lifetracker*

# 创建临时HTTP配置用于获取证书
echo "📝 创建临时HTTP配置..."
sudo tee /etc/nginx/sites-available/temp-http > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};
    
    location / {
        root /var/www/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
EOF

# 启用临时配置
sudo ln -sf /etc/nginx/sites-available/temp-http /etc/nginx/sites-enabled/

# 恢复默认nginx.conf
sudo cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf 2>/dev/null || {
    echo "创建标准nginx.conf..."
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
}

# 测试配置
if sudo nginx -t; then
    echo "✅ Nginx配置测试通过"
else
    echo "❌ Nginx配置测试失败"
    exit 1
fi

# 启动nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# 等待nginx启动
sleep 5

# 获取Let's Encrypt证书
echo "🔒 获取Let's Encrypt证书..."
sudo certbot certonly --webroot -w /var/www/html -d ${DOMAIN_NAME} -d www.${DOMAIN_NAME} --non-interactive --agree-tos --email admin@${DOMAIN_NAME}

# 检查证书是否获取成功
CERT_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/fullchain.pem"
KEY_PATH="/etc/letsencrypt/live/${DOMAIN_NAME}/privkey.pem"

if [ -f "$CERT_PATH" ] && [ -f "$KEY_PATH" ]; then
    echo "✅ Let's Encrypt证书获取成功"
    
    # 创建最终的HTTPS配置
    echo "📝 创建HTTPS配置..."
    sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80 default_server;
    server_name _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl default_server;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};
    
    # Let's Encrypt SSL配置
    ssl_certificate $CERT_PATH;
    ssl_certificate_key $KEY_PATH;
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

    # 移除临时配置，启用最终配置
    sudo rm -f /etc/nginx/sites-enabled/temp-http
    sudo ln -sf /etc/nginx/sites-available/lifetracker /etc/nginx/sites-enabled/
    
    # 测试最终配置
    if sudo nginx -t; then
        echo "✅ 最终配置测试通过"
        sudo systemctl reload nginx
        echo "🎉 SSL证书配置完成！"
    else
        echo "❌ 最终配置测试失败"
        exit 1
    fi
    
else
    echo "❌ Let's Encrypt证书获取失败"
    exit 1
fi

echo ""
echo "🎉 SSL证书修复完成！"
echo "🌐 网站地址: https://${DOMAIN_NAME}"
echo "🔒 证书路径: $CERT_PATH"
