import 'server-only'

import { randomUUID } from 'node:crypto'
import { getSql } from '@/lib/database'
import {
  addDaysIso,
  generateCourseSessionSeriesDates,
  type CourseSessionFrequency,
  type CourseSessionStatus,
} from '@/lib/course-session-repository'

export const SESSION_MUTATION_SCOPES = ['single', 'future', 'series'] as const
export type CourseSessionMutationScope = (typeof SESSION_MUTATION_SCOPES)[number]

export interface CourseSessionSeriesManagementDetails {
  id: string
  title: string
  note: string | null
  startTime: string
  endTime: string
  frequency: CourseSessionFrequency
  interval: number
  weekdays: number[]
  startsOn: string
  endsOn: string | null
  occurrenceCount: number | null
  totalOccurrences: number
  remainingOccurrences: number
}

export interface CourseSessionManagementDetails {
  sessionId: string
  courseId: string
  seriesId: string | null
  seriesPosition: number | null
  sessionDate: string
  startTime: string
  endTime: string
  title: string
  note: string | null
  status: CourseSessionStatus
  sessionHasHistory: boolean
  remainingHasHistory: boolean
  seriesHasHistory: boolean
  series: CourseSessionSeriesManagementDetails | null
}

export interface CourseSessionRecurrenceInput {
  frequency: CourseSessionFrequency
  interval: number
  weekdays: number[]
  endsOn: string | null
  occurrenceCount: number | null
}

export interface UpdateManagedCourseSessionInput {
  courseId: string
  sessionId: string
  scope: CourseSessionMutationScope
  sessionDate: string
  startTime: string
  endTime: string
  title: string
  note: string | null
  recurrence: CourseSessionRecurrenceInput | null
}

export interface DeleteManagedCourseSessionInput {
  courseId: string
  sessionId: string
  scope: CourseSessionMutationScope
  confirmHistory: boolean
}

type MutableSessionRow = {
  id: string
  seriesId: string | null
  seriesPosition: number | null
  sessionDate: string
  status: CourseSessionStatus
  attendanceCount: number
}

type MutationContext = {
  target: MutableSessionRow
  sessions: MutableSessionRow[]
}

function dateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return value.slice(0, 10)
}

function timeOnly(value: string): string {
  return value.slice(0, 5)
}

function numberOrNull(value: number | string | null): number | null {
  if (value === null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeWeekdays(frequency: CourseSessionFrequency, weekdays: number[], startsOn: string): number[] {
  if (frequency !== 'weekly') return []
  const normalized = [...new Set(weekdays.filter((value) => Number.isInteger(value) && value >= 1 && value <= 7))]
    .sort((a, b) => a - b)
  if (normalized.length) return normalized
  const weekday = new Date(`${startsOn}T00:00:00Z`).getUTCDay()
  return [weekday === 0 ? 7 : weekday]
}

function sameDateSequence(rows: MutableSessionRow[], dates: string[]): boolean {
  return rows.length === dates.length && rows.every((row, index) => row.sessionDate === dates[index])
}

function hasProtectedHistory(rows: MutableSessionRow[]): boolean {
  return rows.some((row) => row.status !== 'scheduled' || row.attendanceCount > 0)
}

async function loadMutationContext(courseId: string, sessionId: string): Promise<MutationContext> {
  const sql = getSql()
  const targetRows = await sql.query(
    `SELECT cs.id, cs.series_id, cs.series_position, cs.session_date,
            cs.status,
            COALESCE((SELECT COUNT(*)::int FROM course_session_attendance csa WHERE csa.session_id = cs.id), 0) AS attendance_count
     FROM course_sessions cs
     WHERE cs.id = $1 AND cs.course_id = $2
     LIMIT 1`,
    [sessionId, courseId],
  ) as Array<{
    id: string
    series_id: string | null
    series_position: number | string | null
    session_date: string | Date
    status: CourseSessionStatus
    attendance_count: number | string
  }>

  if (!targetRows.length) throw new Error('session_not_found')

  const target: MutableSessionRow = {
    id: targetRows[0].id,
    seriesId: targetRows[0].series_id,
    seriesPosition: numberOrNull(targetRows[0].series_position),
    sessionDate: dateOnly(targetRows[0].session_date),
    status: targetRows[0].status,
    attendanceCount: Number(targetRows[0].attendance_count),
  }

  if (!target.seriesId) return { target, sessions: [target] }

  const rows = await sql.query(
    `SELECT cs.id, cs.series_id, cs.series_position, cs.session_date,
            cs.status,
            COALESCE((SELECT COUNT(*)::int FROM course_session_attendance csa WHERE csa.session_id = cs.id), 0) AS attendance_count
     FROM course_sessions cs
     WHERE cs.course_id = $1 AND cs.series_id = $2
     ORDER BY cs.series_position ASC NULLS LAST, cs.session_date ASC, cs.start_time ASC`,
    [courseId, target.seriesId],
  ) as Array<{
    id: string
    series_id: string | null
    series_position: number | string | null
    session_date: string | Date
    status: CourseSessionStatus
    attendance_count: number | string
  }>

  return {
    target,
    sessions: rows.map((row) => ({
      id: row.id,
      seriesId: row.series_id,
      seriesPosition: numberOrNull(row.series_position),
      sessionDate: dateOnly(row.session_date),
      status: row.status,
      attendanceCount: Number(row.attendance_count),
    })),
  }
}

export async function getCourseSessionManagementDetails(
  courseId: string,
  sessionId: string,
): Promise<CourseSessionManagementDetails | null> {
  const rows = await getSql().query(
    `SELECT cs.id AS session_id, cs.course_id, cs.series_id, cs.series_position,
            cs.session_date, cs.start_time::text, cs.end_time::text,
            cs.title, cs.note, cs.status,
            css.title AS series_title, css.note AS series_note,
            css.start_time::text AS series_start_time, css.end_time::text AS series_end_time,
            css.frequency, css.interval_value, css.weekdays,
            css.starts_on, css.ends_on, css.occurrence_count,
            COALESCE((SELECT COUNT(*)::int FROM course_sessions s2 WHERE s2.series_id = css.id), 0) AS total_occurrences,
            COALESCE((SELECT COUNT(*)::int FROM course_sessions s2 WHERE s2.series_id = css.id AND s2.series_position >= cs.series_position), 0) AS remaining_occurrences,
            (cs.status <> 'scheduled' OR EXISTS (
              SELECT 1 FROM course_session_attendance a WHERE a.session_id = cs.id
            )) AS session_has_history,
            CASE WHEN css.id IS NULL THEN
              (cs.status <> 'scheduled' OR EXISTS (SELECT 1 FROM course_session_attendance a WHERE a.session_id = cs.id))
            ELSE EXISTS (
              SELECT 1 FROM course_sessions s2
              WHERE s2.series_id = css.id AND s2.series_position >= cs.series_position
                AND (s2.status <> 'scheduled' OR EXISTS (
                  SELECT 1 FROM course_session_attendance a2 WHERE a2.session_id = s2.id
                ))
            ) END AS remaining_has_history,
            CASE WHEN css.id IS NULL THEN
              (cs.status <> 'scheduled' OR EXISTS (SELECT 1 FROM course_session_attendance a WHERE a.session_id = cs.id))
            ELSE EXISTS (
              SELECT 1 FROM course_sessions s2
              WHERE s2.series_id = css.id
                AND (s2.status <> 'scheduled' OR EXISTS (
                  SELECT 1 FROM course_session_attendance a2 WHERE a2.session_id = s2.id
                ))
            ) END AS series_has_history
     FROM course_sessions cs
     LEFT JOIN course_session_series css ON css.id = cs.series_id
     WHERE cs.id = $1 AND cs.course_id = $2
     LIMIT 1`,
    [sessionId, courseId],
  ) as Array<{
    session_id: string
    course_id: string
    series_id: string | null
    series_position: number | string | null
    session_date: string | Date
    start_time: string
    end_time: string
    title: string
    note: string | null
    status: CourseSessionStatus
    series_title: string | null
    series_note: string | null
    series_start_time: string | null
    series_end_time: string | null
    frequency: CourseSessionFrequency | null
    interval_value: number | string | null
    weekdays: number[] | null
    starts_on: string | Date | null
    ends_on: string | Date | null
    occurrence_count: number | string | null
    total_occurrences: number | string
    remaining_occurrences: number | string
    session_has_history: boolean
    remaining_has_history: boolean
    series_has_history: boolean
  }>

  if (!rows.length) return null
  const row = rows[0]
  const series = row.series_id && row.frequency && row.starts_on && row.series_start_time && row.series_end_time
    ? {
        id: row.series_id,
        title: row.series_title ?? row.title,
        note: row.series_note,
        startTime: timeOnly(row.series_start_time),
        endTime: timeOnly(row.series_end_time),
        frequency: row.frequency,
        interval: Number(row.interval_value ?? 1),
        weekdays: row.weekdays ?? [],
        startsOn: dateOnly(row.starts_on),
        endsOn: row.ends_on ? dateOnly(row.ends_on) : null,
        occurrenceCount: numberOrNull(row.occurrence_count),
        totalOccurrences: Number(row.total_occurrences),
        remainingOccurrences: Number(row.remaining_occurrences),
      }
    : null

  return {
    sessionId: row.session_id,
    courseId: row.course_id,
    seriesId: row.series_id,
    seriesPosition: numberOrNull(row.series_position),
    sessionDate: dateOnly(row.session_date),
    startTime: timeOnly(row.start_time),
    endTime: timeOnly(row.end_time),
    title: row.title,
    note: row.note,
    status: row.status,
    sessionHasHistory: row.session_has_history,
    remainingHasHistory: row.remaining_has_history,
    seriesHasHistory: row.series_has_history,
    series,
  }
}

export async function updateManagedCourseSession(input: UpdateManagedCourseSessionInput): Promise<void> {
  const context = await loadMutationContext(input.courseId, input.sessionId)
  const sql = getSql()

  if (!context.target.seriesId || input.scope === 'single') {
    const updated = await sql.query(
      `UPDATE course_sessions
       SET session_date = $3::date, start_time = $4::time, end_time = $5::time,
           title = $6, note = $7, updated_at = now()
       WHERE id = $1 AND course_id = $2
       RETURNING id`,
      [input.sessionId, input.courseId, input.sessionDate, input.startTime, input.endTime, input.title, input.note],
    ) as Array<{ id: string }>
    if (!updated.length) throw new Error('session_not_found')
    return
  }

  if (!input.recurrence) throw new Error('session_recurrence_invalid')
  if (context.target.seriesPosition === null) throw new Error('session_series_invalid')

  const weekdays = normalizeWeekdays(input.recurrence.frequency, input.recurrence.weekdays, input.sessionDate)
  const dates = generateCourseSessionSeriesDates({
    startsOn: input.sessionDate,
    frequency: input.recurrence.frequency,
    interval: input.recurrence.interval,
    weekdays,
    endsOn: input.recurrence.endsOn,
    occurrenceCount: input.recurrence.occurrenceCount,
  })

  const updateSeriesMetadata = (seriesId: string) => sql.query(
    `UPDATE course_session_series
     SET title = $3, note = $4, start_time = $5::time, end_time = $6::time,
         frequency = $7, interval_value = $8, weekdays = $9::smallint[],
         starts_on = $10::date, ends_on = $11::date, occurrence_count = $12,
         updated_at = now()
     WHERE id = $1 AND course_id = $2`,
    [seriesId, input.courseId, input.title, input.note, input.startTime, input.endTime,
      input.recurrence!.frequency, input.recurrence!.interval, weekdays,
      input.sessionDate, input.recurrence!.endsOn, input.recurrence!.occurrenceCount],
  )

  const insertSessions = (seriesId: string) => dates.map((sessionDate, index) => sql.query(
    `INSERT INTO course_sessions
       (id, course_id, series_id, series_position, session_date, start_time, end_time, title, note)
     VALUES ($1, $2, $3, $4, $5::date, $6::time, $7::time, $8, $9)`,
    [randomUUID(), input.courseId, seriesId, index + 1, sessionDate, input.startTime, input.endTime, input.title, input.note],
  ))

  const updateWholeSeries = async (seriesId: string, rows: MutableSessionRow[]) => {
    const unchangedDates = sameDateSequence(rows, dates)
    if (!unchangedDates && hasProtectedHistory(rows)) throw new Error('session_series_history_locked')

    const queries = [updateSeriesMetadata(seriesId)]
    if (unchangedDates) {
      queries.push(...rows.map((row, index) => sql.query(
        `UPDATE course_sessions
         SET series_position = $3, session_date = $4::date,
             start_time = $5::time, end_time = $6::time,
             title = $7, note = $8, updated_at = now()
         WHERE id = $1 AND course_id = $2`,
        [row.id, input.courseId, index + 1, dates[index], input.startTime, input.endTime, input.title, input.note],
      )))
    } else {
      queries.push(sql.query(
        `DELETE FROM course_sessions WHERE course_id = $1 AND series_id = $2`,
        [input.courseId, seriesId],
      ))
      queries.push(...insertSessions(seriesId))
    }
    await sql.transaction(queries)
  }

  if (input.scope === 'series') {
    await updateWholeSeries(context.target.seriesId, context.sessions)
    return
  }

  const previous = context.sessions.filter((row) => (row.seriesPosition ?? 0) < context.target.seriesPosition!)
  const affected = context.sessions.filter((row) => (row.seriesPosition ?? 0) >= context.target.seriesPosition!)

  if (!previous.length) {
    await updateWholeSeries(context.target.seriesId, context.sessions)
    return
  }

  const unchangedDates = sameDateSequence(affected, dates)
  if (!unchangedDates && hasProtectedHistory(affected)) throw new Error('session_series_history_locked')

  const newSeriesId = randomUUID()
  const previousLastDate = previous[previous.length - 1].sessionDate
  const queries = [
    sql.query(
      `UPDATE course_session_series
       SET ends_on = $3::date, occurrence_count = $4, updated_at = now()
       WHERE id = $1 AND course_id = $2`,
      [context.target.seriesId, input.courseId, previousLastDate, previous.length],
    ),
    sql.query(
      `INSERT INTO course_session_series
         (id, course_id, title, note, start_time, end_time, frequency,
          interval_value, weekdays, starts_on, ends_on, occurrence_count)
       VALUES ($1, $2, $3, $4, $5::time, $6::time, $7, $8, $9::smallint[], $10::date, $11::date, $12)`,
      [newSeriesId, input.courseId, input.title, input.note, input.startTime, input.endTime,
        input.recurrence.frequency, input.recurrence.interval, weekdays,
        input.sessionDate, input.recurrence.endsOn, input.recurrence.occurrenceCount],
    ),
  ]

  if (unchangedDates) {
    queries.push(...affected.map((row, index) => sql.query(
      `UPDATE course_sessions
       SET series_id = $3, series_position = $4, session_date = $5::date,
           start_time = $6::time, end_time = $7::time,
           title = $8, note = $9, updated_at = now()
       WHERE id = $1 AND course_id = $2`,
      [row.id, input.courseId, newSeriesId, index + 1, dates[index],
        input.startTime, input.endTime, input.title, input.note],
    )))
  } else {
    queries.push(sql.query(
      `DELETE FROM course_sessions
       WHERE course_id = $1 AND id = ANY($2::text[])`,
      [input.courseId, affected.map((row) => row.id)],
    ))
    queries.push(...insertSessions(newSeriesId))
  }

  await sql.transaction(queries)
}

export async function deleteManagedCourseSession(input: DeleteManagedCourseSessionInput): Promise<void> {
  const context = await loadMutationContext(input.courseId, input.sessionId)
  const sql = getSql()

  if (!context.target.seriesId || input.scope === 'single') {
    if (hasProtectedHistory([context.target]) && !input.confirmHistory) {
      throw new Error('session_history_confirmation_required')
    }
    await sql.query(
      `DELETE FROM course_sessions WHERE id = $1 AND course_id = $2`,
      [input.sessionId, input.courseId],
    )
    return
  }

  if (context.target.seriesPosition === null) throw new Error('session_series_invalid')
  const affected = input.scope === 'series'
    ? context.sessions
    : context.sessions.filter((row) => (row.seriesPosition ?? 0) >= context.target.seriesPosition!)

  if (hasProtectedHistory(affected) && !input.confirmHistory) {
    throw new Error('session_history_confirmation_required')
  }

  if (input.scope === 'series') {
    await sql.transaction([
      sql.query(
        `DELETE FROM course_sessions WHERE course_id = $1 AND series_id = $2`,
        [input.courseId, context.target.seriesId],
      ),
      sql.query(
        `DELETE FROM course_session_series WHERE id = $1 AND course_id = $2`,
        [context.target.seriesId, input.courseId],
      ),
    ])
    return
  }

  const previous = context.sessions.filter((row) => (row.seriesPosition ?? 0) < context.target.seriesPosition!)
  if (!previous.length) {
    await sql.transaction([
      sql.query(
        `DELETE FROM course_sessions WHERE course_id = $1 AND series_id = $2`,
        [input.courseId, context.target.seriesId],
      ),
      sql.query(
        `DELETE FROM course_session_series WHERE id = $1 AND course_id = $2`,
        [context.target.seriesId, input.courseId],
      ),
    ])
    return
  }

  await sql.transaction([
    sql.query(
      `DELETE FROM course_sessions
       WHERE course_id = $1 AND id = ANY($2::text[])`,
      [input.courseId, affected.map((row) => row.id)],
    ),
    sql.query(
      `UPDATE course_session_series
       SET ends_on = $3::date, occurrence_count = $4, updated_at = now()
       WHERE id = $1 AND course_id = $2`,
      [context.target.seriesId, input.courseId, previous[previous.length - 1].sessionDate, previous.length],
    ),
  ])
}

export function defaultSeriesEndDate(startDate: string): string {
  return addDaysIso(startDate, 84)
}
