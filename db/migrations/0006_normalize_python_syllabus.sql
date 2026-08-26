BEGIN;

UPDATE courses
SET syllabus = replace(syllabus, E'\\n', E'\n')
WHERE id = 'course-python-2026';

COMMIT;
