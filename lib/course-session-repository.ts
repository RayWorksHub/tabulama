import 'server-only'

import { randomUUID } from 'node:crypto'
import { getSql } from '@/lib/database'

export const ATTENDANCE_STATUSES = ['unmarked', 'present', 'late', 'excused', 'absent'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]
export type StoredAttendanceStatus = Exclude<AttendanceStatus, 'unmarked'>

export const SESSION_STATUSES = ['scheduled', 'completed', 'cancelled'] as const
export type CourseSessionStatus = (typeof SESSION_STATUSES)[number]

export interface CourseSessionAttendanceStudent {
  enrollmentId: string
  studentId: string
  studentNumber: string
  fullName: string
  status: AttendanceStatus
  note: string | null
}

export interface CourseSessionItem {
  id: string
  courseId: string
  sessionDate: string
  startTime: string
  endTime: string
  title: string
  note: string | null
  status: CourseSessionStatus
  attendance: CourseSessionAttendanceStudent[]
}

export interface StudentSessionItem {
  sessionId: string
  enrollmentId: string
  courseId: string
  courseTitle: string
  courseShortTitle: string
  sessionDate: string
  startTime: string
  endTime: string
  title: string
  sessionStatus: CourseSessionStatus
  attendanceStatus: AttendanceStatus
  attendanceNote: string | null
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function timeOnly(value: string): string {
  return value.slice(0, 5)
}

function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, month, day }
}

export function weekStartIso(input?: string | null): string {
  const parsed = input ? parseDateParts(input) : null
  const now = new Date()
  const base = parsed
    ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = base.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  base.setUTCDate(base.getUTCDate() + offset)
  return base.toISOString().slice(0, 10)
}

export function addDaysIso(dateIso: string, days: number): string {
  const parsed = parseDateParts(dateIso)
  if (!parsed) throw new Error('invalid_date')
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return date.toISOString().slice(0, 10)
}

export function weekDaysIso(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDaysIso(weekStart, index))
}

export async function listCourseSessionsForWeek(courseId: string, requestedWeek?: string | null): Promise<{
  weekStart: string
  sessions: CourseSessionItem[]
}> {
  const weekStart = weekStartIso(requestedWeek)
  const weekEnd = addDaysIso(weekStart, 7)
  const sql = getSql()
  const [sessionRows, attendanceRows] = await Promise.all([
    sql.query(
      `SELECT id, course_id, session_date, start_time::text, end_time::text, title, note, status
       FROM course_sessions
       WHERE course_id = $1 AND session_date >= $2::date AND session_date < $3::date
       ORDER BY session_date ASC, start_time ASC`,
      [courseId, weekStart, weekEnd],
    ),
    sql.query(
      `SELECT cs.id AS session_id, ce.id AS enrollment_id, sp.id AS student_id,
              sp.student_number, u.full_name, csa.status, csa.note
       FROM course_sessions cs
       JOIN course_enrollments ce
         ON ce.course_id = cs.course_id AND ce.status IN ('pending', 'active', 'completed')
       JOIN student_profiles sp ON sp.id = ce.student_profile_id
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN course_session_attendance csa
         ON csa.session_id = cs.id AND csa.enrollment_id = ce.id
       WHERE cs.course_id = $1 AND cs.session_date >= $2::date AND cs.session_date < $3::date
       ORDER BY cs.session_date ASC, cs.start_time ASC, u.full_name ASC`,
      [courseId, weekStart, weekEnd],
    ),
  ])

  const attendanceBySession = new Map<string, CourseSessionAttendanceStudent[]>()
  for (const row of attendanceRows as Array<{
    session_id: string
    enrollment_id: string
    student_id: string
    student_number: string
    full_name: string
    status: StoredAttendanceStatus | null
    note: string | null
  }>) {
    const students = attendanceBySession.get(row.session_id) ?? []
    students.push({
      enrollmentId: row.enrollment_id,
      studentId: row.student_id,
      studentNumber: row.student_number,
      fullName: row.full_name,
      status: row.status ?? 'unmarked',
      note: row.note,
    })
    attendanceBySession.set(row.session_id, students)
  }

  const sessions = (sessionRows as Array<{
    id: string
    course_id: string
    session_date: string | Date
    start_time: string
    end_time: string
    title: string
    note: string | null
    status: CourseSessionStatus
  }>).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    sessionDate: dateOnly(row.session_date),
    startTime: timeOnly(row.start_time),
    endTime: timeOnly(row.end_time),
    title: row.title,
    note: row.note,
    status: row.status,
    attendance: attendanceBySession.get(row.id) ?? [],
  }))

  return { weekStart, sessions }
}

export async function createCourseSession(input: {
  courseId: string
  sessionDate: string
  startTime: string
  endTime: string
  title: string
  note: string | null
}): Promise<void> {
  await getSql().query(
    `INSERT INTO course_sessions (id, course_id, session_date, start_time, end_time, title, note)
     VALUES ($1, $2, $3::date, $4::time, $5::time, $6, $7)`,
    [randomUUID(), input.courseId, input.sessionDate, input.startTime, input.endTime, input.title, input.note],
  )
}

export async function updateCourseSessionStatus(
  courseId: string,
  sessionId: string,
  status: CourseSessionStatus,
): Promise<void> {
  const rows = await getSql().query(
    `UPDATE course_sessions SET status = $3, updated_at = now()
     WHERE id = $1 AND course_id = $2
     RETURNING id`,
    [sessionId, courseId, status],
  ) as Array<{ id: string }>
  if (!rows.length) throw new Error('session_not_found')
}

export async function saveSessionAttendance(input: {
  courseId: string
  sessionId: string
  entries: Array<{ enrollmentId: string; status: AttendanceStatus; note: string | null }>
}): Promise<void> {
  const sql = getSql()
  const uniqueEntries = [...new Map(input.entries.map((entry) => [entry.enrollmentId, entry])).values()]
  if (!uniqueEntries.length) return

  const queries = uniqueEntries.map((entry) => {
    if (entry.status === 'unmarked') {
      return sql.query(
        `DELETE FROM course_session_attendance csa
         USING course_sessions cs, course_enrollments ce
         WHERE csa.session_id = $1 AND csa.enrollment_id = $2
           AND cs.id = csa.session_id AND cs.course_id = $3
           AND ce.id = csa.enrollment_id AND ce.course_id = cs.course_id`,
        [input.sessionId, entry.enrollmentId, input.courseId],
      )
    }
    return sql.query(
      `INSERT INTO course_session_attendance (id, session_id, enrollment_id, status, note)
       SELECT $1, cs.id, ce.id, $4, $5
       FROM course_sessions cs
       JOIN course_enrollments ce ON ce.course_id = cs.course_id
       WHERE cs.id = $2 AND ce.id = $3 AND cs.course_id = $6
       ON CONFLICT (session_id, enrollment_id)
       DO UPDATE SET status = excluded.status, note = excluded.note,
                     marked_at = now(), updated_at = now()`,
      [randomUUID(), input.sessionId, entry.enrollmentId, entry.status, entry.note, input.courseId],
    )
  })

  await sql.transaction(queries)
}

export async function markAllSessionPresent(courseId: string, sessionId: string): Promise<void> {
  await getSql().query(
    `INSERT INTO course_session_attendance (id, session_id, enrollment_id, status)
     SELECT gen_random_uuid()::text, cs.id, ce.id, 'present'
     FROM course_sessions cs
     JOIN course_enrollments ce
       ON ce.course_id = cs.course_id AND ce.status IN ('pending', 'active', 'completed')
     WHERE cs.id = $1 AND cs.course_id = $2
     ON CONFLICT (session_id, enrollment_id)
     DO UPDATE SET status = 'present', note = NULL, marked_at = now(), updated_at = now()`,
    [sessionId, courseId],
  )
}

export async function listStudentSessionsForWeek(userId: string, requestedWeek?: string | null): Promise<{
  weekStart: string
  sessions: StudentSessionItem[]
}> {
  const weekStart = weekStartIso(requestedWeek)
  const weekEnd = addDaysIso(weekStart, 7)
  const rows = await getSql().query(
    `SELECT cs.id AS session_id, ce.id AS enrollment_id, c.id AS course_id,
            c.title AS course_title, c.short_title AS course_short_title,
            cs.session_date, cs.start_time::text, cs.end_time::text,
            cs.title, cs.status AS session_status,
            csa.status AS attendance_status, csa.note AS attendance_note
     FROM student_profiles sp
     JOIN course_enrollments ce ON ce.student_profile_id = sp.id
     JOIN courses c ON c.id = ce.course_id
     JOIN course_sessions cs ON cs.course_id = ce.course_id
     LEFT JOIN course_session_attendance csa
       ON csa.session_id = cs.id AND csa.enrollment_id = ce.id
     WHERE sp.user_id = $1
       AND ce.status IN ('pending', 'active', 'completed')
       AND cs.session_date >= $2::date AND cs.session_date < $3::date
     ORDER BY cs.session_date ASC, cs.start_time ASC, c.short_title ASC`,
    [userId, weekStart, weekEnd],
  ) as Array<{
    session_id: string
    enrollment_id: string
    course_id: string
    course_title: string
    course_short_title: string
    session_date: string | Date
    start_time: string
    end_time: string
    title: string
    session_status: CourseSessionStatus
    attendance_status: StoredAttendanceStatus | null
    attendance_note: string | null
  }>

  return {
    weekStart,
    sessions: rows.map((row) => ({
      sessionId: row.session_id,
      enrollmentId: row.enrollment_id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseShortTitle: row.course_short_title,
      sessionDate: dateOnly(row.session_date),
      startTime: timeOnly(row.start_time),
      endTime: timeOnly(row.end_time),
      title: row.title,
      sessionStatus: row.session_status,
      attendanceStatus: row.attendance_status ?? 'unmarked',
      attendanceNote: row.attendance_note,
    })),
  }
}
