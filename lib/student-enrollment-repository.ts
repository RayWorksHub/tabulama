import 'server-only'

import { randomUUID } from 'node:crypto'
import { getSql } from '@/lib/database'

export async function assignStudentToCourse(studentProfileId: string, courseId: string): Promise<string> {
  const sql = getSql()
  const existing = await sql.query(
    `SELECT id FROM course_enrollments
     WHERE student_profile_id = $1 AND course_id = $2
     LIMIT 1`,
    [studentProfileId, courseId],
  ) as Array<{ id: string }>
  if (existing[0]) return existing[0].id

  const capacity = await sql.query(
    `SELECT c.id, c.status, c.max_capacity,
            count(ce.id) FILTER (WHERE ce.status IN ('pending', 'active'))::int AS occupied
     FROM courses c
     LEFT JOIN course_enrollments ce ON ce.course_id = c.id
     WHERE c.id = $1
     GROUP BY c.id, c.status, c.max_capacity
     LIMIT 1`,
    [courseId],
  ) as Array<{ id: string; status: string; max_capacity: number | null; occupied: number }>
  const course = capacity[0]
  if (!course) throw new Error('course_not_found')
  if (course.status === 'archived') throw new Error('course_archived')
  if (course.max_capacity !== null && Number(course.occupied) >= Number(course.max_capacity)) {
    throw new Error('course_full')
  }

  const student = await sql.query(
    'SELECT id FROM student_profiles WHERE id = $1 LIMIT 1',
    [studentProfileId],
  ) as Array<{ id: string }>
  if (!student[0]) throw new Error('student_not_found')

  const enrollmentId = randomUUID()
  await sql.transaction([
    sql.query(
      `INSERT INTO course_enrollments (
         id, course_id, student_profile_id, application_id, status, progress_percent
       ) VALUES ($1, $2, $3, NULL, 'active', 0)`,
      [enrollmentId, courseId, studentProfileId],
    ),
    sql.query(
      `INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, note)
       VALUES ($1, 'enrollment', $2, NULL, 'active', 'Kézi kurzus-hozzárendelés adminból.')`,
      [randomUUID(), enrollmentId],
    ),
    sql.query('SELECT refresh_course_capacity_status($1)', [courseId]),
  ])
  return enrollmentId
}
