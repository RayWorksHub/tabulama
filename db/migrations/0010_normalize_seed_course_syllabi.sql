BEGIN;

UPDATE courses
SET syllabus = replace(syllabus, E'\\n', E'\n'),
    updated_at = now()
WHERE id IN (
  'course-javascript-2026',
  'course-csharp-2026',
  'course-java-2027',
  'course-rust-2027',
  'course-typescript-2027',
  'course-php-2027',
  'course-cpp-2027',
  'course-kotlin-2027',
  'course-go-2027'
);

COMMIT;
