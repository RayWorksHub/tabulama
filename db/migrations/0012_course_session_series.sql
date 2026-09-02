BEGIN;

CREATE TABLE course_session_series (
  id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  note text,
  start_time time NOT NULL,
  end_time time NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  interval_value integer NOT NULL DEFAULT 1 CHECK (interval_value BETWEEN 1 AND 52),
  weekdays smallint[] NOT NULL DEFAULT '{}',
  starts_on date NOT NULL,
  ends_on date,
  occurrence_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (ends_on IS NOT NULL OR occurrence_count IS NOT NULL),
  CHECK (occurrence_count IS NULL OR occurrence_count BETWEEN 1 AND 240)
);

ALTER TABLE course_sessions
  ADD COLUMN series_id text REFERENCES course_session_series(id) ON DELETE SET NULL,
  ADD COLUMN series_position integer;

CREATE INDEX course_session_series_course_idx
  ON course_session_series(course_id, starts_on);

CREATE INDEX course_sessions_series_idx
  ON course_sessions(series_id, session_date, start_time);

COMMIT;
