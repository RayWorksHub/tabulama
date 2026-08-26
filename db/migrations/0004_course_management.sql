BEGIN;

ALTER TABLE courses
  ADD COLUMN instructor_name text,
  ADD COLUMN discounted_payment_deadline timestamptz,
  ADD COLUMN installment_count integer CHECK (installment_count IS NULL OR installment_count > 0),
  ADD COLUMN installment_amount_huf integer CHECK (installment_amount_huf IS NULL OR installment_amount_huf > 0),
  ADD COLUMN installment_due_dates jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(installment_due_dates) = 'array');

ALTER TABLE courses DROP CONSTRAINT courses_status_check;
UPDATE courses SET status = 'closed' WHERE status = 'completed';
ALTER TABLE courses ADD CONSTRAINT courses_status_check
  CHECK (status IN ('draft', 'coming_soon', 'open', 'full', 'in_progress', 'closed', 'archived'));

UPDATE courses
SET
  description = 'A 12 hetes intenzív képzés az alapoktól építi fel a programozói gondolkodást, majd célzottan készít fel az ágazati alapvizsga vagy a digitális kultúra érettségi Python/programozási részére. A tanulók gyakorlati feladatokon, saját projekten és próbavizsgán keresztül szereznek magabiztos tudást.',
  summary = '12 hetes, gyakorlatorientált Python programozó- és vizsgafelkészítő képzés középiskolásoknak.',
  discounted_price_huf = 250000,
  discounted_payment_deadline = '2026-08-10T23:59:59+02:00',
  installment_count = 3,
  installment_amount_huf = 120000,
  installment_due_dates = '["2026-08-24T23:59:59+02:00", null, null]'::jsonb,
  instructor_name = COALESCE(instructor_name, 'Csukárdi Rajmund'),
  prerequisites = COALESCE(prerequisites, 'Előzetes programozási tudás nem szükséges.'),
  syllabus = COALESCE(syllabus, '1–2. hét: Fejlesztői környezet, első programok, Python szintaxis\n3–4. hét: Elágazások, ciklusok és logikus gondolkodás\n5–6. hét: Függvények, listák és szótárak\n7–9. hét: Vizsga- vagy érettségi specializáció\n10–11. hét: Önálló záróprojekt\n12. hét: Próbavizsga és személyre szabott visszajelzés')
WHERE id = 'course-python-2026';

CREATE OR REPLACE FUNCTION refresh_course_capacity_status(target_course_id text)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  capacity integer;
  occupied integer;
  current_status text;
BEGIN
  SELECT max_capacity, status INTO capacity, current_status
  FROM courses
  WHERE id = target_course_id;

  IF capacity IS NULL OR current_status NOT IN ('open', 'full') THEN
    RETURN;
  END IF;

  SELECT count(*) INTO occupied
  FROM (
    SELECT 'application:' || a.id AS slot
    FROM applications a
    WHERE a.course_id = target_course_id
      AND NOT a.is_test
      AND a.status NOT IN ('rejected', 'cancelled')
    UNION
    SELECT COALESCE('application:' || e.application_id, 'enrollment:' || e.id) AS slot
    FROM course_enrollments e
    WHERE e.course_id = target_course_id
      AND e.status IN ('pending', 'active')
  ) occupancy;

  UPDATE courses
  SET status = CASE WHEN occupied >= capacity THEN 'full' ELSE 'open' END,
      updated_at = now()
  WHERE id = target_course_id
    AND status IS DISTINCT FROM CASE WHEN occupied >= capacity THEN 'full' ELSE 'open' END;
END;
$function$;

CREATE OR REPLACE FUNCTION enforce_application_course_availability()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  course_row courses%ROWTYPE;
  occupied integer;
BEGIN
  IF NEW.is_test OR NEW.status IN ('rejected', 'cancelled') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.course_id = NEW.course_id
    AND NOT OLD.is_test
    AND OLD.status NOT IN ('rejected', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO course_row FROM courses WHERE id = NEW.course_id FOR UPDATE;
  IF NOT FOUND
    OR NOT course_row.applications_enabled
    OR course_row.status <> 'open'
    OR (course_row.application_deadline IS NOT NULL AND course_row.application_deadline < now()) THEN
    RAISE EXCEPTION 'course_unavailable';
  END IF;

  IF course_row.max_capacity IS NOT NULL THEN
    SELECT count(*) INTO occupied
    FROM (
      SELECT 'application:' || a.id AS slot
      FROM applications a
      WHERE a.course_id = NEW.course_id
        AND NOT a.is_test
        AND a.status NOT IN ('rejected', 'cancelled')
      UNION
      SELECT COALESCE('application:' || e.application_id, 'enrollment:' || e.id) AS slot
      FROM course_enrollments e
      WHERE e.course_id = NEW.course_id
        AND e.status IN ('pending', 'active')
    ) occupancy;

    IF occupied >= course_row.max_capacity THEN
      PERFORM refresh_course_capacity_status(NEW.course_id);
      RAISE EXCEPTION 'course_full';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER applications_enforce_course_availability
BEFORE INSERT OR UPDATE OF course_id, status, is_test ON applications
FOR EACH ROW EXECUTE FUNCTION enforce_application_course_availability();

CREATE OR REPLACE FUNCTION refresh_application_course_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_course_capacity_status(COALESCE(NEW.course_id, OLD.course_id));
  IF TG_OP = 'UPDATE' AND OLD.course_id IS DISTINCT FROM NEW.course_id THEN
    PERFORM refresh_course_capacity_status(OLD.course_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER applications_refresh_course_capacity
AFTER INSERT OR DELETE OR UPDATE OF course_id, status, is_test ON applications
FOR EACH ROW EXECUTE FUNCTION refresh_application_course_capacity();

CREATE TRIGGER enrollments_refresh_course_capacity
AFTER INSERT OR DELETE OR UPDATE OF course_id, status, application_id ON course_enrollments
FOR EACH ROW EXECUTE FUNCTION refresh_application_course_capacity();

COMMIT;
