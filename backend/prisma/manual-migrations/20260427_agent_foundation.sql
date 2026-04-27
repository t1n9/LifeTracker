-- LifeTracker Agent foundation migration
-- Safe incremental migration: only creates new tables, indexes, and foreign keys.

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "input" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "model" TEXT,
  "prompt_version" TEXT,
  "toolset_version" TEXT,
  "confirm_mode" BOOLEAN NOT NULL DEFAULT true,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  "latency_ms" INTEGER,
  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_run_steps" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'success',
  "input" JSONB,
  "output" JSONB,
  "error" JSONB,
  "duration_ms" INTEGER,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_run_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_confirmations" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "tool_name" TEXT NOT NULL,
  "args" JSONB NOT NULL,
  "summary" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "result" JSONB,
  "error" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "executed_at" TIMESTAMPTZ(6),
  CONSTRAINT "agent_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_memories" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "data" JSONB,
  "source" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'active',
  "last_used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_agent_profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "summary" TEXT,
  "goals" JSONB NOT NULL DEFAULT '[]',
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "routines" JSONB NOT NULL DEFAULT '{}',
  "constraints" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "user_agent_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "status" TEXT NOT NULL DEFAULT 'active',
  "source" TEXT,
  "current_period_start" TIMESTAMPTZ(6),
  "current_period_end" TIMESTAMPTZ(6),
  "trial_ends_at" TIMESTAMPTZ(6),
  "canceled_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_entitlements" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL DEFAULT '{}',
  "source" TEXT,
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "user_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_runs_user_id_started_at_idx" ON "agent_runs"("user_id", "started_at");
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs"("status");

CREATE INDEX IF NOT EXISTS "agent_run_steps_run_id_created_at_idx" ON "agent_run_steps"("run_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_run_steps_user_id_created_at_idx" ON "agent_run_steps"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_run_steps_type_idx" ON "agent_run_steps"("type");

CREATE INDEX IF NOT EXISTS "agent_confirmations_user_id_status_created_at_idx" ON "agent_confirmations"("user_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "agent_confirmations_run_id_idx" ON "agent_confirmations"("run_id");

CREATE INDEX IF NOT EXISTS "agent_memories_user_id_type_status_idx" ON "agent_memories"("user_id", "type", "status");
CREATE INDEX IF NOT EXISTS "agent_memories_user_id_last_used_at_idx" ON "agent_memories"("user_id", "last_used_at");

CREATE UNIQUE INDEX IF NOT EXISTS "user_agent_profiles_user_id_key" ON "user_agent_profiles"("user_id");

CREATE UNIQUE INDEX IF NOT EXISTS "user_subscriptions_user_id_key" ON "user_subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "user_subscriptions_plan_status_idx" ON "user_subscriptions"("plan", "status");
CREATE INDEX IF NOT EXISTS "user_subscriptions_current_period_end_idx" ON "user_subscriptions"("current_period_end");

CREATE UNIQUE INDEX IF NOT EXISTS "user_entitlements_user_id_key_key" ON "user_entitlements"("user_id", "key");
CREATE INDEX IF NOT EXISTS "user_entitlements_user_id_expires_at_idx" ON "user_entitlements"("user_id", "expires_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_user_id_fkey') THEN
    ALTER TABLE "agent_runs"
      ADD CONSTRAINT "agent_runs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_run_steps_run_id_fkey') THEN
    ALTER TABLE "agent_run_steps"
      ADD CONSTRAINT "agent_run_steps_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_run_steps_user_id_fkey') THEN
    ALTER TABLE "agent_run_steps"
      ADD CONSTRAINT "agent_run_steps_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_confirmations_run_id_fkey') THEN
    ALTER TABLE "agent_confirmations"
      ADD CONSTRAINT "agent_confirmations_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_confirmations_user_id_fkey') THEN
    ALTER TABLE "agent_confirmations"
      ADD CONSTRAINT "agent_confirmations_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_memories_user_id_fkey') THEN
    ALTER TABLE "agent_memories"
      ADD CONSTRAINT "agent_memories_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_agent_profiles_user_id_fkey') THEN
    ALTER TABLE "user_agent_profiles"
      ADD CONSTRAINT "user_agent_profiles_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_user_id_fkey') THEN
    ALTER TABLE "user_subscriptions"
      ADD CONSTRAINT "user_subscriptions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_entitlements_user_id_fkey') THEN
    ALTER TABLE "user_entitlements"
      ADD CONSTRAINT "user_entitlements_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
