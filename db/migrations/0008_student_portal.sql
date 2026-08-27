BEGIN;

CREATE SEQUENCE student_number_sequence START 1;

CREATE OR REPLACE FUNCTION next_student_number()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT 'TBL-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('student_number_sequence')::text, 6, '0')
$$;

ALTER TABLE users
  ADD COLUMN password_hash text,
  ADD COLUMN account_status text NOT NULL DEFAULT 'pending'
    CHECK (account_status IN ('pending', 'active', 'disabled'));

UPDATE users SET account_status = 'active' WHERE role IN ('admin', 'instructor');

ALTER TABLE student_profiles
  ADD COLUMN student_number text DEFAULT next_student_number();

UPDATE student_profiles
SET student_number = next_student_number()
WHERE student_number IS NULL;

ALTER TABLE student_profiles
  ALTER COLUMN student_number SET NOT NULL;

ALTER TABLE student_profiles
  ADD CONSTRAINT student_profiles_student_number_key UNIQUE (student_number);

ALTER TABLE course_modules
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

CREATE TABLE auth_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type text NOT NULL CHECK (token_type IN ('activation', 'password_reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  email_status text NOT NULL DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'skipped', 'error')),
  email_detail text,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_tokens_lookup_idx
  ON auth_tokens (token_hash, token_type, expires_at)
  WHERE used_at IS NULL;

CREATE INDEX auth_tokens_user_idx
  ON auth_tokens (user_id, token_type, created_at DESC);

CREATE TABLE student_module_progress (
  id text PRIMARY KEY,
  enrollment_id text NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'in_progress', 'completed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, module_id)
);

CREATE INDEX student_module_progress_enrollment_idx
  ON student_module_progress (enrollment_id, status);

INSERT INTO course_modules (
  id, course_id, title, position, description, topic, status, is_active
)
SELECT seed.id, c.id, seed.title, seed.position, seed.description, seed.topic, 'planned', true
FROM courses c
CROSS JOIN (VALUES
  ('module-python-2026-01', 1, 'Python alapok', 'Fejlesztői környezet, első programok és Python szintaxis.', 'Alapok'),
  ('module-python-2026-02', 2, 'Elágazások és ciklusok', 'Logikus gondolkodás és vezérlési szerkezetek.', 'Vezérlés'),
  ('module-python-2026-03', 3, 'Függvények és adatszerkezetek', 'Függvények, listák és szótárak gyakorlati feladatokkal.', 'Adatkezelés'),
  ('module-python-2026-04', 4, 'Vizsgaspecializáció', 'Ágazati alapvizsga- vagy digitális kultúra érettségi felkészítés.', 'Vizsgafelkészítés'),
  ('module-python-2026-05', 5, 'Önálló záróprojekt', 'Saját projekt megtervezése és megépítése.', 'Projekt'),
  ('module-python-2026-06', 6, 'Próbavizsga', 'Valós vizsgahelyzet és személyre szabott visszajelzés.', 'Értékelés')
) AS seed(id, position, title, description, topic)
WHERE c.id = 'course-python-2026'
ON CONFLICT (course_id, position) DO NOTHING;

COMMIT;
