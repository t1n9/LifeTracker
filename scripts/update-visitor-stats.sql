-- 访客统计功能数据库更新脚本
-- 安全地添加访客统计表，不影响现有数据

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
CREATE INDEX IF NOT EXISTS "profile_visitors_ip_address_user_agent_idx" ON "profile_visitors"("ip_address", "user_agent");
CREATE INDEX IF NOT EXISTS "profile_visit_logs_profile_user_id_visited_at_idx" ON "profile_visit_logs"("profile_user_id", "visited_at");
CREATE INDEX IF NOT EXISTS "profile_visit_logs_visitor_id_idx" ON "profile_visit_logs"("visitor_id");

-- 添加外键约束（如果不存在）
DO $$ BEGIN
    ALTER TABLE "profile_visitors" ADD CONSTRAINT "profile_visitors_profile_user_id_fkey" FOREIGN KEY ("profile_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "profile_visitors" ADD CONSTRAINT "profile_visitors_visitor_user_id_fkey" FOREIGN KEY ("visitor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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

-- 输出成功信息
DO $$ BEGIN
    RAISE NOTICE '访客统计表创建完成！';
    RAISE NOTICE '- profile_visitors: 访客基础信息表';
    RAISE NOTICE '- profile_visit_logs: 访问记录表';
    RAISE NOTICE '所有约束和索引已创建';
END $$;
