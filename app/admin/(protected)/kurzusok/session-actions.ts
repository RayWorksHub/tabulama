'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import {
  ATTENDANCE_STATUSES,
  SESSION_FREQUENCIES,
  SESSION_STATUSES,
  createCourseSession,
  createCourseSessionSeries,
  generateCourseSessionSeriesDates,
  markAllSessionPresent,
  saveSessionAttendance,
  updateCourseSessionStatus,
  weekStartIso,
  type AttendanceStatus,
} from '@/lib/course-session-repository'
import {
  SESSION_MUTATION_SCOPES,
  deleteManagedCourseSession,
  updateManagedCourseSession,
  type CourseSessionRecurrenceInput,
} from '@/lib/course-session-management-repository'
import {
  encodeCourseSessionConflictSummary,
  isCourseSessionConflictError,
} from '@/lib/course-session-conflict'
import {
  assertCourseSessionSlotsAvailable,
  assertManagedCourseSessionUpdateAvailable,
} from '@/lib/course-session-conflict-repository'

const id = z.string().trim().min(1).max(120)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^\d{2}:\d{2}$/)
const recurrenceFrequency = z.enum(['none', ...SESSION_FREQUENCIES])
const recurrenceEndMode = z.enum(['until', 'count'])

function courseSessionsPath(courseId: string, week?: string | null, sessionId?: string | null): string {
  const query = new URLSearchParams({
    view: 'sessions',
    week: weekStartIso(week),
  })
  if (sessionId) query.set('session', sessionId)
  return `/admin/kurzusok/${encodeURIComponent(courseId)}?${query.toString()}`
}

function withConflictFeedback(returnTo: string, encodedConflicts: string): string {
  const url = new URL(returnTo, 'https://tabulama.local')
  url.searchParams.set('conflicts', encodedConflicts)
  return `${url.pathname}?${url.searchParams.toString()}`
}

function mutationErrorCode(error: unknown): string {
  if (!(error instanceof Error)) return 'session_save_failed'
  if (error.message === 'session_series_history_locked') return 'session_series_history_locked'
  if (error.message === 'session_history_confirmation_required') return 'session_history_confirmation_required'
  if (error.message === 'session_recurrence_invalid' || error.message === 'session_series_invalid') return 'session_recurrence_invalid'
  if (error.message === 'session_not_found') return 'session_not_found'
  return 'session_save_failed'
}

function parseRecurrence(formData: FormData, startsOn: string): CourseSessionRecurrenceInput | null {
  const parsed = z.object({
    frequency: z.enum(SESSION_FREQUENCIES),
    interval: z.coerce.number().int().min(1).max(52),
    endMode: recurrenceEndMode,
    untilDate: date.optional(),
    occurrenceCount: z.coerce.number().int().min(1).max(240).optional(),
  }).safeParse({
    frequency: formData.get('frequency'),
    interval: formData.get('interval') || '1',
    endMode: formData.get('endMode'),
    untilDate: formData.get('untilDate') || undefined,
    occurrenceCount: formData.get('occurrenceCount') || undefined,
  })

  if (!parsed.success) return null
  if (parsed.data.endMode === 'until' && (!parsed.data.untilDate || parsed.data.untilDate < startsOn)) return null
  if (parsed.data.endMode === 'count' && !parsed.data.occurrenceCount) return null

  const weekdays = formData.getAll('weekday')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)

  return {
    frequency: parsed.data.frequency,
    interval: parsed.data.interval,
    weekdays,
    endsOn: parsed.data.endMode === 'until' ? parsed.data.untilDate ?? null : null,
    occurrenceCount: parsed.data.endMode === 'count' ? parsed.data.occurrenceCount ?? null : null,
  }
}

export async function createCourseSessionAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    courseId: id,
    week: date,
    sessionDate: date,
    startTime: time,
    endTime: time,
    title: z.string().trim().min(2).max(160),
    note: z.string().trim().max(1000).optional(),
    frequency: recurrenceFrequency,
    interval: z.coerce.number().int().min(1).max(52),
    endMode: recurrenceEndMode.optional(),
    untilDate: date.optional(),
    occurrenceCount: z.coerce.number().int().min(1).max(240).optional(),
  }).safeParse({
    courseId: formData.get('courseId'),
    week: formData.get('week'),
    sessionDate: formData.get('sessionDate'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    title: formData.get('title'),
    note: formData.get('note'),
    frequency: formData.get('frequency') ?? 'none',
    interval: formData.get('interval') || '1',
    endMode: formData.get('endMode') || undefined,
    untilDate: formData.get('untilDate') || undefined,
    occurrenceCount: formData.get('occurrenceCount') || undefined,
  })

  const returnTo = parsed.success ? courseSessionsPath(parsed.data.courseId, parsed.data.week) : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!parsed.success || parsed.data.endTime <= parsed.data.startTime) redirect(`${returnTo}&error=session_invalid`)

  const weekdays = formData.getAll('weekday')
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)

  if (parsed.data.frequency !== 'none') {
    if (!parsed.data.endMode) redirect(`${returnTo}&error=session_recurrence_invalid`)
    if (parsed.data.endMode === 'until' && (!parsed.data.untilDate || parsed.data.untilDate < parsed.data.sessionDate)) {
      redirect(`${returnTo}&error=session_recurrence_invalid`)
    }
    if (parsed.data.endMode === 'count' && !parsed.data.occurrenceCount) {
      redirect(`${returnTo}&error=session_recurrence_invalid`)
    }
  }

  try {
    if (parsed.data.frequency === 'none') {
      await assertCourseSessionSlotsAvailable({
        courseId: parsed.data.courseId,
        slots: [{
          sessionDate: parsed.data.sessionDate,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
        }],
      })
      await createCourseSession({
        courseId: parsed.data.courseId,
        sessionDate: parsed.data.sessionDate,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        title: parsed.data.title,
        note: parsed.data.note || null,
      })
    } else {
      const endsOn = parsed.data.endMode === 'until' ? parsed.data.untilDate ?? null : null
      const occurrenceCount = parsed.data.endMode === 'count' ? parsed.data.occurrenceCount ?? null : null
      const dates = generateCourseSessionSeriesDates({
        startsOn: parsed.data.sessionDate,
        frequency: parsed.data.frequency,
        interval: parsed.data.interval,
        weekdays,
        endsOn,
        occurrenceCount,
      })
      await assertCourseSessionSlotsAvailable({
        courseId: parsed.data.courseId,
        slots: dates.map((sessionDate) => ({
          sessionDate,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
        })),
      })
      await createCourseSessionSeries({
        courseId: parsed.data.courseId,
        startsOn: parsed.data.sessionDate,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        title: parsed.data.title,
        note: parsed.data.note || null,
        frequency: parsed.data.frequency,
        interval: parsed.data.interval,
        weekdays,
        endsOn,
        occurrenceCount,
      })
    }
  } catch (error) {
    if (isCourseSessionConflictError(error)) {
      redirect(withConflictFeedback(returnTo, encodeCourseSessionConflictSummary(error.summary)))
    }
    redirect(`${returnTo}&error=session_save_failed`)
  }

  revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
  revalidatePath('/portal')
  redirect(`${returnTo}&success=${parsed.data.frequency === 'none' ? 'session_saved' : 'session_series_saved'}`)
}

export async function updateManagedCourseSessionAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    courseId: id,
    sessionId: id,
    week: date,
    scope: z.enum(SESSION_MUTATION_SCOPES),
    sessionDate: date,
    startTime: time,
    endTime: time,
    title: z.string().trim().min(2).max(160),
    note: z.string().trim().max(1000).optional(),
  }).safeParse({
    courseId: formData.get('courseId'),
    sessionId: formData.get('sessionId'),
    week: formData.get('week'),
    scope: formData.get('scope'),
    sessionDate: formData.get('sessionDate'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    title: formData.get('title'),
    note: formData.get('note'),
  })

  const returnTo = parsed.success
    ? courseSessionsPath(parsed.data.courseId, parsed.data.week, parsed.data.sessionId)
    : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!parsed.success || parsed.data.endTime <= parsed.data.startTime) redirect(`${returnTo}&error=session_invalid`)

  const recurrence = parsed.data.scope === 'single' ? null : parseRecurrence(formData, parsed.data.sessionDate)
  if (parsed.data.scope !== 'single' && !recurrence) redirect(`${returnTo}&error=session_recurrence_invalid`)

  const updateInput = {
    courseId: parsed.data.courseId,
    sessionId: parsed.data.sessionId,
    scope: parsed.data.scope,
    sessionDate: parsed.data.sessionDate,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    title: parsed.data.title,
    note: parsed.data.note || null,
    recurrence,
  }

  try {
    await assertManagedCourseSessionUpdateAvailable(updateInput)
    await updateManagedCourseSession(updateInput)
  } catch (error) {
    if (isCourseSessionConflictError(error)) {
      redirect(withConflictFeedback(returnTo, encodeCourseSessionConflictSummary(error.summary)))
    }
    redirect(`${returnTo}&error=${mutationErrorCode(error)}`)
  }

  revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
  revalidatePath('/portal')
  const success = parsed.data.scope === 'single' ? 'session_updated' : 'session_series_updated'
  const selectedSession = parsed.data.scope === 'single' ? parsed.data.sessionId : null
  redirect(`${courseSessionsPath(parsed.data.courseId, parsed.data.sessionDate, selectedSession)}&success=${success}`)
}

export async function deleteManagedCourseSessionAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    courseId: id,
    sessionId: id,
    week: date,
    scope: z.enum(SESSION_MUTATION_SCOPES),
  }).safeParse({
    courseId: formData.get('courseId'),
    sessionId: formData.get('sessionId'),
    week: formData.get('week'),
    scope: formData.get('scope'),
  })

  const returnTo = parsed.success ? courseSessionsPath(parsed.data.courseId, parsed.data.week) : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!parsed.success) redirect(`${returnTo}&error=session_invalid`)

  try {
    await deleteManagedCourseSession({
      courseId: parsed.data.courseId,
      sessionId: parsed.data.sessionId,
      scope: parsed.data.scope,
      confirmHistory: formData.get('confirmHistory') === 'on',
    })
  } catch (error) {
    redirect(`${returnTo}&error=${mutationErrorCode(error)}`)
  }

  revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
  revalidatePath('/portal')
  const success = parsed.data.scope === 'single'
    ? 'session_deleted'
    : parsed.data.scope === 'future'
      ? 'session_future_deleted'
      : 'session_series_deleted'
  redirect(`${returnTo}&success=${success}`)
}

export async function updateCourseSessionStatusAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    courseId: id,
    sessionId: id,
    week: date,
    status: z.enum(SESSION_STATUSES),
  }).safeParse({
    courseId: formData.get('courseId'),
    sessionId: formData.get('sessionId'),
    week: formData.get('week'),
    status: formData.get('status'),
  })

  const returnTo = parsed.success ? courseSessionsPath(parsed.data.courseId, parsed.data.week) : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!parsed.success) redirect(`${returnTo}&error=session_invalid`)

  try {
    await updateCourseSessionStatus(parsed.data.courseId, parsed.data.sessionId, parsed.data.status)
  } catch {
    redirect(`${returnTo}&error=session_save_failed`)
  }

  revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
  revalidatePath('/portal')
  redirect(`${returnTo}&success=session_saved`)
}

export async function saveSessionAttendanceAction(formData: FormData): Promise<void> {
  const base = z.object({
    courseId: id,
    sessionId: id,
    week: date,
  }).safeParse({
    courseId: formData.get('courseId'),
    sessionId: formData.get('sessionId'),
    week: formData.get('week'),
  })

  const returnTo = base.success ? courseSessionsPath(base.data.courseId, base.data.week) : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!base.success) redirect(`${returnTo}&error=attendance_invalid`)

  const enrollmentIds = formData.getAll('enrollmentId')
    .map((value) => id.safeParse(value))
    .filter((result): result is z.ZodSafeParseSuccess<string> => result.success)
    .map((result) => result.data)

  const entries: Array<{ enrollmentId: string; status: AttendanceStatus; note: string | null }> = []
  for (const enrollmentId of enrollmentIds) {
    const statusRaw = formData.get(`status:${enrollmentId}`)
    const status = z.enum(ATTENDANCE_STATUSES).safeParse(statusRaw)
    if (!status.success) continue
    const noteRaw = String(formData.get(`note:${enrollmentId}`) ?? '').trim()
    entries.push({ enrollmentId, status: status.data, note: noteRaw ? noteRaw.slice(0, 500) : null })
  }

  if (!entries.length) redirect(`${returnTo}&error=attendance_invalid`)

  try {
    await saveSessionAttendance({ courseId: base.data.courseId, sessionId: base.data.sessionId, entries })
  } catch {
    redirect(`${returnTo}&error=attendance_save_failed`)
  }

  revalidatePath(`/admin/kurzusok/${base.data.courseId}`)
  revalidatePath('/portal')
  redirect(`${returnTo}&success=attendance_saved`)
}

export async function markAllSessionPresentAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    courseId: id,
    sessionId: id,
    week: date,
  }).safeParse({
    courseId: formData.get('courseId'),
    sessionId: formData.get('sessionId'),
    week: formData.get('week'),
  })

  const returnTo = parsed.success ? courseSessionsPath(parsed.data.courseId, parsed.data.week) : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!parsed.success) redirect(`${returnTo}&error=attendance_invalid`)

  try {
    await markAllSessionPresent(parsed.data.courseId, parsed.data.sessionId)
  } catch {
    redirect(`${returnTo}&error=attendance_save_failed`)
  }

  revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
  revalidatePath('/portal')
  redirect(`${returnTo}&success=attendance_saved`)
}
