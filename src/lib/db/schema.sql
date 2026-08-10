-- Applied on every server boot; every statement must be idempotent.

-- One row per successful ingest. The dashboard is always read from the newest
-- row, so a failed 42 API call simply leaves the previous row in place and the
-- board keeps showing the last good data instead of an error.
CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  campus_id   INTEGER     NOT NULL,
  payload     JSONB       NOT NULL
);

CREATE INDEX IF NOT EXISTS dashboard_snapshots_captured_at_idx
  ON dashboard_snapshots (captured_at DESC);

-- Job bookkeeping: what ran, when, and whether it worked. Also how the
-- scheduler decides what is due after a restart.
CREATE TABLE IF NOT EXISTS job_runs (
  id          BIGSERIAL PRIMARY KEY,
  job         TEXT        NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status      TEXT        NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  detail      JSONB
);

CREATE INDEX IF NOT EXISTS job_runs_job_started_idx
  ON job_runs (job, started_at DESC);

-- Host sessions, kept for ~10 weeks. This is the history the attendance
-- forecast is fitted on; `id` is the 42 location id so re-fetching a window
-- updates open sessions instead of duplicating them.
CREATE TABLE IF NOT EXISTS location_sessions (
  id         BIGINT      PRIMARY KEY,
  campus_id  INTEGER     NOT NULL,
  user_login TEXT        NOT NULL,
  host       TEXT,
  begin_at   TIMESTAMPTZ NOT NULL,
  end_at     TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_sessions_begin_at_idx
  ON location_sessions (begin_at DESC);

-- One row per (day the forecast was computed, day being forecast). Written once
-- per day by the midnight job, so the numbers on the wall never move mid-day.
CREATE TABLE IF NOT EXISTS attendance_forecasts (
  computed_for      DATE    NOT NULL,
  target_date       DATE    NOT NULL,
  expected_students INTEGER NOT NULL,
  low_students      INTEGER NOT NULL,
  high_students     INTEGER NOT NULL,
  peak_hour         INTEGER,
  peak_students     INTEGER,
  sample_days       INTEGER NOT NULL,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (computed_for, target_date)
);

-- "Looking for a teammate" entries, written by students themselves after a 42
-- login (the QR code on the presence screen). This is the only table on the
-- board that students write to.
--
-- The profile fields are copied in rather than joined at read time: the wall
-- renders from a stored snapshot and must not depend on the 42 API being up to
-- know what somebody looks like. Unique on (user, project) so tapping "add"
-- twice is idempotent rather than a duplicate row.
CREATE TABLE IF NOT EXISTS teammate_requests (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      INTEGER     NOT NULL,
  login        TEXT        NOT NULL,
  display_name TEXT        NOT NULL,
  image_url    TEXT,
  project_id   INTEGER     NOT NULL,
  project_name TEXT        NOT NULL,
  project_slug TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS teammate_requests_created_idx
  ON teammate_requests (created_at DESC);

-- Campus events from /v2/campus/:id/events, refreshed by the ingest job.
-- Stored rather than kept in the snapshot payload so the events screen can be
-- queried by date range without unpacking JSON.
CREATE TABLE IF NOT EXISTS campus_events (
  id          BIGINT      PRIMARY KEY,
  campus_id   INTEGER     NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  kind        TEXT,
  location    TEXT,
  begin_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  max_people  INTEGER,
  subscribers INTEGER,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campus_events_begin_at_idx
  ON campus_events (begin_at);

-- Images bocal uploads to appear in the board rotation.
--
-- The bytes live in Postgres rather than on a volume so there is still exactly
-- one thing to back up, and an upload survives `docker:clean` like every other
-- piece of state. Slides are a handful of posters, not a media library — the
-- route that accepts them caps the size.
CREATE TABLE IF NOT EXISTS slides (
  id           BIGSERIAL   PRIMARY KEY,
  title        TEXT        NOT NULL,
  content_type TEXT        NOT NULL,
  bytes        BYTEA       NOT NULL,
  byte_size    INTEGER     NOT NULL,
  active       BOOLEAN     NOT NULL DEFAULT true,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  uploaded_by  TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slides_active_order_idx
  ON slides (active, sort_order, created_at);
