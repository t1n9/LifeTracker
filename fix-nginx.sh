#!/bin/bash

# 快速修复Nginx配置脚本
set -e

echo "🔧 修复Nginx配置..."

DOMAIN_NAME=${1:-t1n9.xyz}

# 创建正确的Nginx配置
sudo tee /etc/nginx/sites-available/lifetracker > /dev/null <<EOF
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name ${DOMAIN_NAME} www.${DOMAIN_NAME} _;
    
    # SSL配置
    ssl_certificate $(pwd)/nginx/ssl/cert.pem;
    ssl_certificate_key $(pwd)/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # HTTP重定向到HTTPS
    if (\$scheme != "https") {
        return 301 https://\$host\$request_uri;
    }
    
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
        root $(pwd)/frontend-dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # 基本缓存
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1d;
        }
    }
}
EOF

# 启用站点
sudo rm -f /etc/nginx/sites-enabled/default
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
