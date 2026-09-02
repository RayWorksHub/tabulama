'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import {
  ATTENDANCE_STATUSES,
  SESSION_STATUSES,
  createCourseSession,
  markAllSessionPresent,
  saveSessionAttendance,
  updateCourseSessionStatus,
  weekStartIso,
  type AttendanceStatus,
} from '@/lib/course-session-repository'

const id = z.string().trim().min(1).max(120)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const time = z.string().regex(/^\d{2}:\d{2}$/)

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
  }).safeParse({
    courseId: formData.get('courseId'),
    week: formData.get('week'),
    sessionDate: formData.get('sessionDate'),
    startTime: formData.get('startTime'),
    endTime: formData.get('endTime'),
    title: formData.get('title'),
    note: formData.get('note'),
  })

  const returnTo = parsed.success ? courseSessionsPath(parsed.data.courseId, parsed.data.week) : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!parsed.success || parsed.data.endTime <= parsed.data.startTime) redirect(`${returnTo}&error=session_invalid`)

  try {
    await createCourseSession({
      courseId: parsed.data.courseId,
      sessionDate: parsed.data.sessionDate,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      title: parsed.data.title,
      note: parsed.data.note || null,
    })
  } catch {
    redirect(`${returnTo}&error=session_save_failed`)
  }

  revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
  revalidatePath('/portal')
  redirect(`${returnTo}&success=session_saved`)
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
