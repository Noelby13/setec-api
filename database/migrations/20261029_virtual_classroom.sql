CREATE TABLE IF NOT EXISTS virtual_classroom_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_type TEXT NOT NULL CHECK (person_type IN ('user','applicant','teacher')),
  person_id UUID NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE CHECK (length(btrim(username)) > 0),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID NOT NULL REFERENCES usuarios(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(person_type,person_id)
);

CREATE TABLE IF NOT EXISTS virtual_classroom_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL UNIQUE REFERENCES programacion_componentes_cohorte(id) ON DELETE CASCADE,
  shortname VARCHAR(100) NOT NULL UNIQUE CHECK (length(btrim(shortname)) > 0),
  category VARCHAR(120) NOT NULL CHECK (length(btrim(category)) > 0),
  teacher_role VARCHAR(60) NOT NULL CHECK (length(btrim(teacher_role)) > 0),
  updated_by UUID NOT NULL REFERENCES usuarios(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS virtual_classroom_accounts_username_ci_idx
  ON virtual_classroom_accounts (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS virtual_classroom_courses_shortname_ci_idx
  ON virtual_classroom_courses (lower(shortname));

CREATE TABLE IF NOT EXISTS virtual_classroom_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES usuarios(id),
  format VARCHAR(20) NOT NULL CHECK (format IN ('xlsx','users_csv','courses_csv')),
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  content_bytes BYTEA NOT NULL,
  content_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS virtual_classroom_grade_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES programacion_componentes_cohorte(id),
  actor_id UUID NOT NULL REFERENCES usuarios(id),
  source_filename VARCHAR(255) NOT NULL,
  source_bytes BYTEA NOT NULL,
  preview_rows JSONB NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS virtual_classroom_preview_actor_idx
  ON virtual_classroom_grade_previews(actor_id,expires_at) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS virtual_classroom_exports_actor_idx
  ON virtual_classroom_exports(created_by,created_at DESC);
