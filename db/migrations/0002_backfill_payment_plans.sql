BEGIN;

INSERT INTO payment_plans (
  id,
  application_id,
  total_amount_huf,
  installment_count,
  status,
  created_at,
  updated_at
)
SELECT
  concat('plan-', a.id),
  a.id,
  a.total_amount_huf,
  CASE WHEN a.payment_type = 'installment' THEN 3 ELSE 1 END,
  'pending',
  a.created_at,
  a.created_at
FROM applications a
ON CONFLICT (application_id) DO NOTHING;

INSERT INTO payment_items (
  id,
  payment_plan_id,
  position,
  amount_huf,
  due_at,
  status,
  created_at,
  updated_at
)
SELECT
  concat('item-', a.id, '-', installment.position),
  pp.id,
  installment.position,
  CASE
    WHEN installment.position = pp.installment_count
      THEN pp.total_amount_huf - (installment.regular_amount_huf * (pp.installment_count - 1))
    ELSE installment.regular_amount_huf
  END,
  CASE
    WHEN installment.position <> 1 THEN NULL
    WHEN a.package_key = 'early-bird' THEN timestamptz '2026-08-10 23:59:59+02'
    WHEN a.package_key = 'installment' THEN timestamptz '2026-08-24 23:59:59+02'
    ELSE NULL
  END,
  'pending',
  a.created_at,
  a.created_at
FROM applications a
JOIN payment_plans pp ON pp.application_id = a.id
CROSS JOIN LATERAL (
  SELECT
    position,
    floor(pp.total_amount_huf::numeric / pp.installment_count)::int AS regular_amount_huf
  FROM generate_series(1, pp.installment_count) AS position
) AS installment
ON CONFLICT (payment_plan_id, position) DO NOTHING;

COMMIT;
