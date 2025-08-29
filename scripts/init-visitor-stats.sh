#!/bin/bash

# 访客统计功能初始化脚本
set -e

echo "🔧 初始化访客统计功能..."

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
    if [ -f ".env" ]; then
        source .env
        export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
    else
        echo "❌ 未找到数据库配置"
        exit 1
    fi
fi

echo "📋 数据库连接: ${DATABASE_URL}"

# 检查数据库连接
echo "🔍 检查数据库连接..."
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ 数据库连接失败"
    exit 1
fi

echo "✅ 数据库连接正常"

# 执行SQL脚本
echo "📝 执行访客统计表创建脚本..."
if [ -f "scripts/update-visitor-stats.sql" ]; then
    psql "$DATABASE_URL" -f scripts/update-visitor-stats.sql
    echo "✅ 访客统计表创建完成"
else
    echo "⚠️ SQL脚本不存在，手动创建表..."
    
    # 直接执行SQL命令
    psql "$DATABASE_URL" << 'EOF'
-- 创建设备类型枚举（如果不存在）
DO $$ BEGIN
    CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 创建访客统计表
CREATE TABLE IF NOT EXISTS "profile_visitors" (
    "id" TEXT NOT NULL,
    "profile_user_id" TEXT NOT NULL,
    "visitor_user_id" TEXT,
    "device_fingerprint" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "device_type" "DeviceType" NOT NULL,
    "browser" TEXT,
    "os" TEXT,
    "first_visit_at" TIMESTAMPTZ(6) NOT NULL,
    "last_visit_at" TIMESTAMPTZ(6) NOT NULL,
    "visit_count" INTEGER NOT NULL DEFAULT 1,
    "referrer" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_visitors_pkey" PRIMARY KEY ("id")
);

-- 创建访问日志表
CREATE TABLE IF NOT EXISTS "profile_visit_logs" (
    "id" TEXT NOT NULL,
    "profile_user_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "visited_at" TIMESTAMPTZ(6) NOT NULL,
    "duration" INTEGER,
    "page_views" INTEGER NOT NULL DEFAULT 1,
    "referrer" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_visit_logs_pkey" PRIMARY KEY ("id")
);

-- 创建唯一约束（如果不存在）
DO $$ BEGIN
    ALTER TABLE "profile_visitors" ADD CONSTRAINT "profile_visitors_profile_user_id_device_fingerprint_key" UNIQUE ("profile_user_id", "device_fingerprint");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 创建索引（如果不存在）
CREATE INDEX IF NOT EXISTS "profile_visitors_profile_user_id_last_visit_at_idx" ON "profile_visitors"("profile_user_id", "last_visit_at");
CREATE INDEX IF NOT EXISTS "profile_visitors_device_fingerprint_idx" ON "profile_visitors"("device_fingerprint");

-- 添加外键约束（如果不存在）
DO $$ BEGIN
    ALTER TABLE "profile_visitors" ADD CONSTRAINT "profile_visitors_profile_user_id_fkey" FOREIGN KEY ("profile_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "profile_visit_logs" ADD CONSTRAINT "profile_visit_logs_profile_user_id_fkey" FOREIGN KEY ("profile_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "profile_visit_logs" ADD CONSTRAINT "profile_visit_logs_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "profile_visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

SELECT 'visitor_stats_tables_created' as result;
EOF

    echo "✅ 访客统计表手动创建完成"
fi

# 验证表是否创建成功
echo "🔍 验证表创建结果..."
TABLES_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('profile_visitors', 'profile_visit_logs');")

if [ "$TABLES_COUNT" -eq 2 ]; then
    echo "✅ 访客统计表验证成功"
    echo "📊 表结构:"
    psql "$DATABASE_URL" -c "\d profile_visitors"
    psql "$DATABASE_URL" -c "\d profile_visit_logs"
else
    echo "⚠️ 表创建可能不完整，但继续执行"
fi

echo "🎉 访客统计功能初始化完成！"
