#!/bin/bash

# Prisma初始化脚本
set -e

echo "🔧 初始化Prisma客户端..."

# 检查Prisma schema文件
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ 未找到Prisma schema文件"
    exit 1
fi

# 检查Node.js和npm
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm未安装"
    exit 1
fi

# 安装Prisma CLI（如果需要）
if ! command -v npx &> /dev/null; then
    echo "📦 安装npx..."
    npm install -g npx
fi

# 检查是否已安装@prisma/client
if [ ! -d "node_modules/@prisma" ]; then
    echo "📦 安装Prisma客户端..."
    npm install @prisma/client
fi

# 生成Prisma客户端
echo "🔧 生成Prisma客户端..."
npx prisma generate

# 验证生成结果
if [ -d "node_modules/.prisma/client" ]; then
    echo "✅ Prisma客户端生成成功"
else
    echo "❌ Prisma客户端生成失败"
    exit 1
fi

echo "🎉 Prisma初始化完成！"
