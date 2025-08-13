#!/bin/bash

# 部署测试脚本
set -e

echo "🧪 开始部署测试..."

DOMAIN=${1:-t1n9.xyz}

echo "🔍 测试域名: $DOMAIN"

# 测试HTTP连接
echo "📡 测试HTTP连接..."
if curl -f -s http://$DOMAIN/health > /dev/null; then
    echo "✅ HTTP连接正常"
else
    echo "❌ HTTP连接失败"
fi

# 测试HTTPS连接
echo "🔒 测试HTTPS连接..."
if curl -f -s -k https://$DOMAIN/health > /dev/null; then
    echo "✅ HTTPS连接正常"
else
    echo "❌ HTTPS连接失败"
fi

# 测试API健康检查
echo "🏥 测试API健康检查..."
if curl -f -s -k https://$DOMAIN/api/health > /dev/null; then
    echo "✅ API健康检查正常"
    curl -s -k https://$DOMAIN/api/health | jq . || echo "API响应正常但不是JSON格式"
else
    echo "❌ API健康检查失败"
fi

# 测试前端页面
echo "🎨 测试前端页面..."
if curl -f -s -k https://$DOMAIN/ | grep -q "LifeTracker" > /dev/null; then
    echo "✅ 前端页面正常"
else
    echo "❌ 前端页面异常"
fi

echo "🎯 测试完成！"
