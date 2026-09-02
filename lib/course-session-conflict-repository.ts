import 'server-only'

import { getSql } from '@/lib/database'
import {
  CourseSessionConflictError,
  type CourseSessionConflictItem,
  type CourseSessionConflictRelation,
  type CourseSessionConflictSummary,
} from '@/lib/course-session-conflict'
import {
  generateCourseSessionSeriesDates,
  type CourseSessionFrequency,
} from '@/lib/course-session-repository'

export interface ProposedCourseSessionSlot {
  sessionDate: string
  startTime: string
  endTime: string
}

export interface CourseSessionAvailabilityInput {
  courseId: string
  slots: ProposedCourseSessionSlot[]
  excludeSessionIds?: string[]
}

export interface ManagedCourseSessionAvailabilityInput {
  courseId: string
  sessionId: string
  scope: 'single' | 'future' | 'series'
  sessionDate: string
  startTime: string
  endTime: string
  recurrence: {
    frequency: CourseSessionFrequency
    interval: number
    weekdays: number[]
    endsOn: string | null
    occurrenceCount: number | null
  } | null
}

type ConflictRow = {
  proposed_session_date: string | Date
  proposed_start_time: string
  proposed_end_time: string
  existing_session_id: string
  existing_course_id: string
  existing_course_title: string
  existing_course_short_title: string
  existing_session_title: string
  existing_session_date: string | Date
  existing_start_time: string
  existing_end_time: string
  existing_status: 'scheduled' | 'completed'
  relation: CourseSessionConflictRelation
  total_count: number | string
}

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10)
}

function timeOnly(value: string): string {
  return value.slice(0, 5)
}

function uniqueSlots(slots: ProposedCourseSessionSlot[]): ProposedCourseSessionSlot[] {
  const unique = new Map<string, ProposedCourseSessionSlot>()
  for (const slot of slots) {
    if (slot.endTime <= slot.startTime) throw new Error('session_invalid')
    unique.set(`${slot.sessionDate}|${slot.startTime}|${slot.endTime}`, slot)
  }
  return [...unique.values()]
}

export async function findCourseSessionConflicts(
  input: CourseSessionAvailabilityInput,
): Promise<CourseSessionConflictSummary | null> {
  const slots = uniqueSlots(input.slots)
  if (!slots.length) return null

  const rows = await getSql().query(
    `WITH proposed AS (
       SELECT p.session_date, p.start_time, p.end_time, p.slot_index
       FROM unnest($1::date[], $2::time[], $3::time[])
         WITH ORDINALITY AS p(session_date, start_time, end_time, slot_index)
     )
     SELECT proposed.session_date AS proposed_session_date,
            proposed.start_time::text AS proposed_start_time,
            proposed.end_time::text AS proposed_end_time,
            cs.id AS existing_session_id,
            cs.course_id AS existing_course_id,
            c.title AS existing_course_title,
            c.short_title AS existing_course_short_title,
            cs.title AS existing_session_title,
            cs.session_date AS existing_session_date,
            cs.start_time::text AS existing_start_time,
            cs.end_time::text AS existing_end_time,
            cs.status AS existing_status,
            CASE
              WHEN cs.start_time = proposed.start_time AND cs.end_time = proposed.end_time THEN 'exact'
              WHEN cs.start_time <= proposed.start_time AND cs.end_time >= proposed.end_time THEN 'inside_existing'
              WHEN cs.start_time >= proposed.start_time AND cs.end_time <= proposed.end_time THEN 'contains_existing'
              ELSE 'partial_overlap'
            END AS relation,
            COUNT(*) OVER()::int AS total_count
     FROM proposed
     JOIN course_sessions cs
       ON cs.session_date = proposed.session_date
      AND cs.status <> 'cancelled'
      AND cs.start_time < proposed.end_time
      AND cs.end_time > proposed.start_time
     JOIN courses c ON c.id = cs.course_id
     WHERE NOT (cs.id = ANY($4::text[]))
     ORDER BY proposed.session_date ASC, proposed.start_time ASC,
              cs.start_time ASC, c.short_title ASC, cs.title ASC
     LIMIT 8`,
    [
      slots.map((slot) => slot.sessionDate),
      slots.map((slot) => slot.startTime),
      slots.map((slot) => slot.endTime),
      [...new Set(input.excludeSessionIds ?? [])],
    ],
  ) as ConflictRow[]

  if (!rows.length) return null

  const conflicts: CourseSessionConflictItem[] = rows.map((row) => ({
    proposedSessionDate: dateOnly(row.proposed_session_date),
    proposedStartTime: timeOnly(row.proposed_start_time),
    proposedEndTime: timeOnly(row.proposed_end_time),
    existingSessionId: row.existing_session_id,
    existingCourseId: row.existing_course_id,
    existingCourseTitle: row.existing_course_title,
    existingCourseShortTitle: row.existing_course_short_title,
    existingSessionTitle: row.existing_session_title,
    existingSessionDate: dateOnly(row.existing_session_date),
    existingStartTime: timeOnly(row.existing_start_time),
    existingEndTime: timeOnly(row.existing_end_time),
    existingStatus: row.existing_status,
    relation: row.relation,
  }))

  return {
    requestedCourseId: input.courseId,
    totalCount: Number(rows[0].total_count),
    conflicts,
  }
}

export async function assertCourseSessionSlotsAvailable(
  input: CourseSessionAvailabilityInput,
): Promise<void> {
  const summary = await findCourseSessionConflicts(input)
  if (summary) throw new CourseSessionConflictError(summary)
}

export async function assertManagedCourseSessionUpdateAvailable(
  input: ManagedCourseSessionAvailabilityInput,
): Promise<void> {
  const targetRows = await getSql().query(
    `SELECT id, series_id, series_position
     FROM course_sessions
     WHERE id = $1 AND course_id = $2
     LIMIT 1`,
    [input.sessionId, input.courseId],
  ) as Array<{
    id: string
    series_id: string | null
    series_position: number | string | null
  }>

  if (!targetRows.length) throw new Error('session_not_found')
  const target = targetRows[0]

  if (!target.series_id || input.scope === 'single') {
    await assertCourseSessionSlotsAvailable({
      courseId: input.courseId,
      slots: [{
        sessionDate: input.sessionDate,
        startTime: input.startTime,
        endTime: input.endTime,
      }],
      excludeSessionIds: [input.sessionId],
    })
    return
  }

  if (!input.recurrence) throw new Error('session_recurrence_invalid')
  const targetPosition = Number(target.series_position)
  if (!Number.isInteger(targetPosition)) throw new Error('session_series_invalid')

  const seriesRows = await getSql().query(
    `SELECT id, series_position
     FROM course_sessions
     WHERE course_id = $1 AND series_id = $2
     ORDER BY series_position ASC NULLS LAST, session_date ASC, start_time ASC`,
    [input.courseId, target.series_id],
  ) as Array<{ id: string; series_position: number | string | null }>

  const excludedRows = input.scope === 'series'
    ? seriesRows
    : seriesRows.filter((row) => Number(row.series_position) >= targetPosition)

  const dates = generateCourseSessionSeriesDates({
    startsOn: input.sessionDate,
    frequency: input.recurrence.frequency,
    interval: input.recurrence.interval,
    weekdays: input.recurrence.weekdays,
    endsOn: input.recurrence.endsOn,
    occurrenceCount: input.recurrence.occurrenceCount,
  })

  await assertCourseSessionSlotsAvailable({
    courseId: input.courseId,
    slots: dates.map((sessionDate) => ({
      sessionDate,
      startTime: input.startTime,
      endTime: input.endTime,
    })),
    excludeSessionIds: excludedRows.map((row) => row.id),
  })
}
