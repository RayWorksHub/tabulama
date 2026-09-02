BEGIN;

CREATE TABLE course_sessions (
  id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  title text NOT NULL DEFAULT 'Kurzusóra',
  note text,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  UNIQUE (course_id, session_date, start_time)
);

CREATE TABLE course_session_attendance (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES course_sessions(id) ON DELETE CASCADE,
  enrollment_id text NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
  status text NOT NULL
    CHECK (status IN ('present', 'late', 'excused', 'absent')),
  note text,
  marked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, enrollment_id)
);

CREATE INDEX course_sessions_course_date_idx
  ON course_sessions (course_id, session_date, start_time);

CREATE INDEX course_session_attendance_enrollment_idx
  ON course_session_attendance (enrollment_id, session_id);

COMMIT;
