#!/bin/bash

# LifeTracker 部署配置文件
# 复制此文件为 deploy.config.sh 并修改相应配置

# 服务器配置
export SERVER_HOST="your-server-ip"
export SERVER_USER="root"
export SERVER_PORT="22"

# 域名配置
export DOMAIN_NAME="yourdomain.com"

# 数据库配置
export DB_PASSWORD="your-secure-password"
export DB_NAME="lifetracker"
export DB_USER="lifetracker"

# JWT配置
export JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# 邮箱配置（可选）
export SMTP_HOST=""
export SMTP_PORT="587"
export SMTP_USER=""
export SMTP_PASS=""

# SSL证书配置
export SSL_EMAIL="your-email@example.com"
export USE_LETSENCRYPT="true"  # 设置为 false 使用自签名证书

# 项目配置
export PROJECT_NAME="lifetracker"
export DEPLOY_PATH="/opt/lifetracker"

# GitHub配置（用于自动部署）
export GITHUB_REPO="your-username/LifeTracker"

# 备份配置
export BACKUP_ENABLED="true"
export BACKUP_RETENTION_DAYS="30"
