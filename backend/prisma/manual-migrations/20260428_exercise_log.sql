-- ============================================================
-- Migration: ExerciseLog (free-form AI logging)
-- Date: 2026-04-28
-- ============================================================

-- 1. Create exercise_logs table (db push already handles this; IF NOT EXISTS makes it safe to re-run)
CREATE TABLE IF NOT EXISTS "exercise_logs" (
  "id"            TEXT             NOT NULL,
  "user_id"       TEXT             NOT NULL,
  "exercise_name" TEXT             NOT NULL,
  "emoji"         TEXT,
  "value"         DOUBLE PRECISION NOT NULL,
  "unit"          TEXT             NOT NULL,
  "note"          TEXT,
  "logged_at"     TIMESTAMPTZ      NOT NULL DEFAULT now(),
  "date"          TEXT             NOT NULL,
  CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "exercise_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "exercise_logs_user_id_date_idx"
  ON "exercise_logs"("user_id", "date");

-- 2. Migrate historical data (only when table is empty, skipped if already has rows)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "exercise_logs" LIMIT 1) THEN
    INSERT INTO "exercise_logs"
      ("id", "user_id", "exercise_name", "emoji", "value", "unit", "note", "logged_at", "date")
    SELECT
      md5(r."id"::text || r."user_id") AS id,
      r."user_id",
      t."name",
      t."icon",
      r."value",
      CASE t."unit"
        WHEN 'COUNT'    THEN '次'
        WHEN 'DISTANCE' THEN 'km'
        ELSE t."unit"
      END,
      r."notes",
      r."created_at",
      TO_CHAR(r."date", 'YYYY-MM-DD')
    FROM "exercise_records" r
    JOIN "exercise_types" t ON t."id" = r."exercise_id";
  END IF;
END $$;

-- 3. Drop show_* columns from users (if they exist)
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "show_pull_ups",
  DROP COLUMN IF EXISTS "show_squats",
  DROP COLUMN IF EXISTS "show_push_ups",
  DROP COLUMN IF EXISTS "show_running",
  DROP COLUMN IF EXISTS "show_swimming",
  DROP COLUMN IF EXISTS "show_cycling";

-- NOTE: exercise_records and exercise_types tables are intentionally kept
-- for rollback safety. They can be dropped after verifying exercise_logs data.
