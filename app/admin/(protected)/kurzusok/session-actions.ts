'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import {
  ATTENDANCE_STATUSES,
  SESSION_STATUSES,
  createCourseSession,
  createCourseSessionSeries,
  markAllSessionPresent,
  saveSessionAttendance,
  updateCourseSessionStatus,
  weekStartIso,
  type AttendanceStatus,
} from '@/lib/course-session-repository'

const id = z.string().trim().min(1).max(120)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^\d{2}:\d{2}$/)
const recurrenceFrequency = z.enum(['none', 'daily', 'weekly', 'monthly'])
const recurrenceEndMode = z.enum(['until', 'count'])

function courseSessionsPath(courseId: string, week?: string | null): string {
  const normalizedWeek = weekStartIso(week)
  return `/admin/kurzusok/${encodeURIComponent(courseId)}?view=sessions&week=${normalizedWeek}`
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
      await createCourseSession({
        courseId: parsed.data.courseId,
        sessionDate: parsed.data.sessionDate,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        title: parsed.data.title,
        note: parsed.data.note || null,
      })
    } else {
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
        endsOn: parsed.data.endMode === 'until' ? parsed.data.untilDate ?? null : null,
        occurrenceCount: parsed.data.endMode === 'count' ? parsed.data.occurrenceCount ?? null : null,
      })
    }
  } catch {
    redirect(`${returnTo}&error=session_save_failed`)
  }

  revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
  revalidatePath('/portal')
  redirect(`${returnTo}&success=${parsed.data.frequency === 'none' ? 'session_saved' : 'session_series_saved'}`)
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
