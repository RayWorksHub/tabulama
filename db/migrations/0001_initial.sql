BEGIN;

CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('admin', 'instructor', 'student')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  birth_date date,
  phone text,
  address text,
  guardian_name text,
  guardian_email text,
  guardian_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  short_title text NOT NULL,
  description text NOT NULL,
  summary text NOT NULL,
  category text NOT NULL,
  image_url text,
  start_date date,
  end_date date,
  application_deadline timestamptz,
  weekly_schedule text,
  max_capacity integer CHECK (max_capacity IS NULL OR max_capacity > 0),
  price_huf integer NOT NULL CHECK (price_huf >= 0),
  discounted_price_huf integer CHECK (discounted_price_huf IS NULL OR discounted_price_huf >= 0),
  installment_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'coming_soon', 'open', 'full', 'in_progress', 'completed', 'archived')),
  instructor_id text REFERENCES users(id) ON DELETE SET NULL,
  target_audience text,
  prerequisites text,
  syllabus text,
  applications_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_modules (
  id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  description text,
  topic text,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'current', 'completed')),
  planned_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, position)
);

CREATE TABLE applications (
  id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  participant_name text NOT NULL,
  participant_birth_date date NOT NULL,
  participant_email text,
  participant_phone text,
  guardian_name text,
  guardian_email text,
  guardian_phone text,
  billing_name text NOT NULL,
  billing_email text NOT NULL,
  billing_address text NOT NULL,
  tax_number text,
  package_key text NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('lump-sum', 'installment')),
  total_amount_huf integer NOT NULL CHECK (total_amount_huf >= 0),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'accepted', 'proforma', 'awaiting_payment', 'partially_paid', 'paid', 'invoiced', 'enrolled', 'rejected', 'cancelled')),
  is_test boolean NOT NULL DEFAULT false,
  source text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  request_ip_hash text,
  submitted_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_enrollments (
  id text PRIMARY KEY,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  student_profile_id text NOT NULL REFERENCES student_profiles(id) ON DELETE RESTRICT,
  application_id text UNIQUE REFERENCES applications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'completed', 'withdrawn')),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (course_id, student_profile_id)
);

CREATE TABLE payment_plans (
  id text PRIMARY KEY,
  application_id text NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  total_amount_huf integer NOT NULL CHECK (total_amount_huf >= 0),
  installment_count integer NOT NULL CHECK (installment_count > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_items (
  id text PRIMARY KEY,
  payment_plan_id text NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  amount_huf integer NOT NULL CHECK (amount_huf >= 0),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  paid_at timestamptz,
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'cash')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_plan_id, position)
);

CREATE TABLE payments (
  id text PRIMARY KEY,
  payment_item_id text NOT NULL REFERENCES payment_items(id) ON DELETE RESTRICT,
  amount_huf integer NOT NULL CHECK (amount_huf > 0),
  paid_at timestamptz NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('bank_transfer', 'cash')),
  note text,
  recorded_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoice_documents (
  id text PRIMARY KEY,
  application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  payment_id text REFERENCES payments(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'billingo',
  external_document_id text,
  document_type text NOT NULL
    CHECK (document_type IN ('proforma', 'advance_invoice', 'final_invoice', 'storno')),
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'created', 'sent', 'paid', 'cancelled', 'error')),
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE status_history (
  id text PRIMARY KEY,
  entity_type text NOT NULL
    CHECK (entity_type IN ('application', 'enrollment', 'payment_plan', 'payment_item', 'course')),
  entity_id text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  note text,
  changed_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  hit_count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

CREATE INDEX applications_created_at_idx ON applications (created_at DESC);
CREATE INDEX applications_status_idx ON applications (status);
CREATE INDEX applications_course_id_idx ON applications (course_id);
CREATE INDEX status_history_entity_idx ON status_history (entity_type, entity_id, created_at);
CREATE INDEX payment_items_due_at_idx ON payment_items (due_at, status);

INSERT INTO courses (
  id, slug, title, short_title, description, summary, category,
  start_date, weekly_schedule, max_capacity, price_huf,
  installment_enabled, status, target_audience, applications_enabled
) VALUES (
  'course-python-2026',
  'python-programozo-es-vizsgafelkeszito-2026',
  '12 hetes Python programozó- és vizsgafelkészítő képzés',
  'Python vizsgafelkészítő',
  'Programozói alapok, gyakorlati tudás és célzott vizsgafelkészítés középiskolásoknak.',
  '12 hetes intenzív Python képzés középiskolásoknak.',
  'Python',
  DATE '2026-08-24',
  'Hétfő, szerda és péntek 17:00–18:30',
  15,
  330000,
  true,
  'in_progress',
  'Középiskolások',
  true
) ON CONFLICT (id) DO NOTHING;

COMMIT;
