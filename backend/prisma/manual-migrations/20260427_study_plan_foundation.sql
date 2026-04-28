-- Study plan foundation schema
-- Safe to run repeatedly in PostgreSQL.

CREATE TABLE IF NOT EXISTS "study_plans" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "exam_type" TEXT NOT NULL,
  "exam_name" TEXT NOT NULL,
  "exam_date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "employment_type" TEXT NOT NULL,
  "weekday_hours" DOUBLE PRECISION NOT NULL,
  "weekend_hours" DOUBLE PRECISION NOT NULL,
  "holiday_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "prompt_version" TEXT NULL,
  "generated_at" TIMESTAMPTZ(6) NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "study_plans_user_id_status_idx" ON "study_plans" ("user_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_plans_user_id_fkey'
  ) THEN
    ALTER TABLE "study_plans"
      ADD CONSTRAINT "study_plans_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Compatibility patch for schema evolution after foundation migration.
-- Keep this idempotent so it can be executed repeatedly.

ALTER TABLE "daily_study_slots" ADD COLUMN IF NOT EXISTS "is_injected" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "daily_study_slots" ADD COLUMN IF NOT EXISTS "is_rescheduled" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "daily_study_slots" ADD COLUMN IF NOT EXISTS "original_date" DATE NULL;

ALTER TABLE "ocr_uploads" ADD COLUMN IF NOT EXISTS "plan_id" TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ocr_uploads_plan_id_fkey'
  ) THEN
    ALTER TABLE "ocr_uploads"
      ADD CONSTRAINT "ocr_uploads_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "study_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "trusted_sources" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS "study_subjects" (
  "id" TEXT PRIMARY KEY,
  "plan_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "level" TEXT NOT NULL DEFAULT 'beginner',
  "total_hours" DOUBLE PRECISION NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "study_subjects_plan_id_idx" ON "study_subjects" ("plan_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_subjects_plan_id_fkey'
  ) THEN
    ALTER TABLE "study_subjects"
      ADD CONSTRAINT "study_subjects_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "study_chapters" (
  "id" TEXT PRIMARY KEY,
  "subject_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "estimated_hours" DOUBLE PRECISION NOT NULL,
  "actual_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "completed_at" TIMESTAMPTZ(6) NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "study_chapters_subject_id_status_idx" ON "study_chapters" ("subject_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'study_chapters_subject_id_fkey'
  ) THEN
    ALTER TABLE "study_chapters"
      ADD CONSTRAINT "study_chapters_subject_id_fkey"
      FOREIGN KEY ("subject_id") REFERENCES "study_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "weekly_plans" (
  "id" TEXT PRIMARY KEY,
  "plan_id" TEXT NOT NULL,
  "week_number" INTEGER NOT NULL,
  "week_start" DATE NOT NULL,
  "week_end" DATE NOT NULL,
  "phase" TEXT NOT NULL,
  "target_hours" DOUBLE PRECISION NOT NULL,
  "actual_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completion_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'upcoming',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_plans_plan_id_week_number_key" ON "weekly_plans" ("plan_id", "week_number");
CREATE INDEX IF NOT EXISTS "weekly_plans_plan_id_week_start_idx" ON "weekly_plans" ("plan_id", "week_start");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_plans_plan_id_fkey'
  ) THEN
    ALTER TABLE "weekly_plans"
      ADD CONSTRAINT "weekly_plans_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "daily_study_slots" (
  "id" TEXT PRIMARY KEY,
  "weekly_plan_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "chapter_id" TEXT NULL,
  "date" DATE NOT NULL,
  "subject_name" TEXT NOT NULL,
  "chapter_title" TEXT NOT NULL,
  "planned_hours" DOUBLE PRECISION NOT NULL,
  "actual_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "task_id" TEXT NULL,
  "injected_at" TIMESTAMPTZ(6) NULL,
  "completed_at" TIMESTAMPTZ(6) NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "daily_study_slots_user_id_date_idx" ON "daily_study_slots" ("user_id", "date");
CREATE INDEX IF NOT EXISTS "daily_study_slots_plan_id_date_idx" ON "daily_study_slots" ("plan_id", "date");
CREATE INDEX IF NOT EXISTS "daily_study_slots_weekly_plan_id_idx" ON "daily_study_slots" ("weekly_plan_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_study_slots_weekly_plan_id_fkey'
  ) THEN
    ALTER TABLE "daily_study_slots"
      ADD CONSTRAINT "daily_study_slots_weekly_plan_id_fkey"
      FOREIGN KEY ("weekly_plan_id") REFERENCES "weekly_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_study_slots_plan_id_fkey'
  ) THEN
    ALTER TABLE "daily_study_slots"
      ADD CONSTRAINT "daily_study_slots_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_study_slots_user_id_fkey'
  ) THEN
    ALTER TABLE "daily_study_slots"
      ADD CONSTRAINT "daily_study_slots_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_study_slots_chapter_id_fkey'
  ) THEN
    ALTER TABLE "daily_study_slots"
      ADD CONSTRAINT "daily_study_slots_chapter_id_fkey"
      FOREIGN KEY ("chapter_id") REFERENCES "study_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_study_slots_task_id_fkey'
  ) THEN
    ALTER TABLE "daily_study_slots"
      ADD CONSTRAINT "daily_study_slots_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ocr_uploads" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "subject_id" TEXT NULL,
  "image_url" TEXT NOT NULL,
  "raw_text" TEXT NOT NULL,
  "parsed_result" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ocr_uploads_user_id_idx" ON "ocr_uploads" ("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ocr_uploads_user_id_fkey'
  ) THEN
    ALTER TABLE "ocr_uploads"
      ADD CONSTRAINT "ocr_uploads_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ocr_uploads_subject_id_fkey'
  ) THEN
    ALTER TABLE "ocr_uploads"
      ADD CONSTRAINT "ocr_uploads_subject_id_fkey"
      FOREIGN KEY ("subject_id") REFERENCES "study_subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "trusted_sources" (
  "id" TEXT PRIMARY KEY,
  "query" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NULL,
  "use_count" INTEGER NOT NULL DEFAULT 1,
  "last_confirmed_at" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "trusted_sources_query_url_key" ON "trusted_sources" ("query", "url");
CREATE INDEX IF NOT EXISTS "trusted_sources_query_status_idx" ON "trusted_sources" ("query", "status");

CREATE TABLE IF NOT EXISTS "trusted_source_confirmations" (
  "id" TEXT PRIMARY KEY,
  "source_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "trusted_source_confirmations_source_id_user_id_key" ON "trusted_source_confirmations" ("source_id", "user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trusted_source_confirmations_source_id_fkey'
  ) THEN
    ALTER TABLE "trusted_source_confirmations"
      ADD CONSTRAINT "trusted_source_confirmations_source_id_fkey"
      FOREIGN KEY ("source_id") REFERENCES "trusted_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trusted_source_confirmations_user_id_fkey'
  ) THEN
    ALTER TABLE "trusted_source_confirmations"
      ADD CONSTRAINT "trusted_source_confirmations_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
