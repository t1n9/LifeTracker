#!/bin/bash

# 修复nginx配置脚本
set -e

echo "🔧 修复nginx配置..."

DOMAIN_NAME="t1n9.xyz"

# 停止nginx
sudo systemctl stop nginx || true

# 备份当前配置
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.$(date +%Y%m%d_%H%M%S) || true

# 移除所有sites配置
sudo rm -f /etc/nginx/sites-enabled/*
sudo rm -f /etc/nginx/sites-available/lifetracker*

# 检查证书是否存在
CERT_DIRS=(
    "/etc/letsencrypt/live/${DOMAIN_NAME}"
    "/etc/letsencrypt/live/${DOMAIN_NAME}-0001"
    "/etc/letsencrypt/live/${DOMAIN_NAME}-0002"
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

# 创建正确的站点配置
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
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};
    
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
    echo "⚠️ 创建HTTP配置"
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
sudo ln -sf /etc/nginx/sites-available/lifetracker /etc/nginx/sites-enabled/

# 测试配置
if sudo nginx -t; then
    echo "✅ Nginx配置测试通过"
    sudo systemctl start nginx
    sudo systemctl enable nginx
    echo "✅ Nginx启动成功"
    
    if [ -n "$SSL_CERT" ]; then
        echo "🔒 HTTPS配置完成: https://${DOMAIN_NAME}"
    else
        echo "🌐 HTTP配置完成: http://${DOMAIN_NAME}"
    fi
else
    echo "❌ Nginx配置测试失败"
    sudo nginx -t
    exit 1
fi

echo ""
echo "🎉 Nginx配置修复完成！"
echo "证书状态: $([ -n "$SSL_CERT" ] && echo "HTTPS启用" || echo "HTTP模式")"
echo "网站地址: $([ -n "$SSL_CERT" ] && echo "https://${DOMAIN_NAME}" || echo "http://${DOMAIN_NAME}")"
