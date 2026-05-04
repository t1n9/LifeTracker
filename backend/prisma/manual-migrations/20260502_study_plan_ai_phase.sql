-- Study Plan AI phase planning foundation
-- Adds phase plans and draft/phase linkage for daily study slots.

CREATE TABLE IF NOT EXISTS "phase_plans" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "phase_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "phase_plans_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "study_plans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "phase_plans_plan_id_sort_order_idx"
  ON "phase_plans"("plan_id", "sort_order");

ALTER TABLE "daily_study_slots"
  ADD COLUMN IF NOT EXISTS "phase_id" TEXT,
  ADD COLUMN IF NOT EXISTS "is_draft" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "time_segment" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "daily_study_slots_phase_id_idx"
  ON "daily_study_slots"("phase_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_study_slots_phase_id_fkey'
  ) THEN
    ALTER TABLE "daily_study_slots"
      ADD CONSTRAINT "daily_study_slots_phase_id_fkey"
      FOREIGN KEY ("phase_id") REFERENCES "phase_plans"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
