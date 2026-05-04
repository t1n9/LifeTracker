CREATE TABLE IF NOT EXISTS study_plan_references (
  id              TEXT PRIMARY KEY,
  exam_type       TEXT NOT NULL,
  name            TEXT NOT NULL,
  match_keywords  TEXT NOT NULL DEFAULT '',
  duration_days   INT  NOT NULL DEFAULT 0,
  description     TEXT,
  source_url      TEXT,
  source_title    TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_plan_references_exam_type ON study_plan_references(exam_type);
CREATE INDEX IF NOT EXISTS idx_study_plan_references_is_active ON study_plan_references(is_active);
