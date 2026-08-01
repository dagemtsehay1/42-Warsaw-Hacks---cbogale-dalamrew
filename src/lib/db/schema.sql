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
