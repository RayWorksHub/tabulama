BEGIN;

CREATE TABLE application_email_deliveries (
  id text PRIMARY KEY,
  application_id text NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event text NOT NULL
    CHECK (event IN ('received', 'accepted', 'awaiting_payment', 'payment_recorded', 'enrolled', 'course_completed')),
  recipient text,
  status text NOT NULL
    CHECK (status IN ('sent', 'skipped', 'error')),
  detail text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX application_email_deliveries_application_idx
  ON application_email_deliveries (application_id, attempted_at DESC);

COMMIT;
