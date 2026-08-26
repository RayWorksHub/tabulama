'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { COURSE_STATUSES, createCourse, updateCourse, updateCourseStatus } from '@/lib/course-repository'
import { courseFormSchema, parseInstallmentDueDates } from '@/lib/course-form-schema'

const idSchema = z.string().trim().min(1).max(120)

function coursePath(id?: string): string {
  return id ? `/admin/kurzusok/${encodeURIComponent(id)}` : '/admin/kurzusok/uj'
}

function coursePayload(formData: FormData) {
  const countRaw = String(formData.get('installmentCount') ?? '')
  const count = countRaw ? Number(countRaw) : null
  return {
    title: formData.get('title'), shortTitle: formData.get('shortTitle'), slug: formData.get('slug'),
    description: formData.get('description'), summary: formData.get('summary'), category: formData.get('category'),
    imageUrl: formData.get('imageUrl'), startDate: formData.get('startDate'), endDate: formData.get('endDate'),
    applicationDeadline: formData.get('applicationDeadline'), weeklySchedule: formData.get('weeklySchedule'),
    maxCapacity: formData.get('maxCapacity'), priceHuf: formData.get('priceHuf'),
    discountedPriceHuf: formData.get('discountedPriceHuf'), discountedPaymentDeadline: formData.get('discountedPaymentDeadline'),
    installmentEnabled: formData.get('installmentEnabled') === 'on', installmentCount: countRaw,
    installmentAmountHuf: formData.get('installmentAmountHuf'),
    installmentDueDates: parseInstallmentDueDates(String(formData.get('installmentDueDates') ?? ''), Number.isInteger(count) ? count : null),
    status: formData.get('status'), instructorName: formData.get('instructorName'),
    targetAudience: formData.get('targetAudience'), prerequisites: formData.get('prerequisites'), syllabus: formData.get('syllabus'),
    applicationsEnabled: formData.get('applicationsEnabled') === 'on',
  }
}

export async function saveCourseAction(formData: FormData): Promise<void> {
  const rawId = String(formData.get('courseId') ?? '')
  const id = rawId ? idSchema.safeParse(rawId) : null
  const returnTo = coursePath(id?.success ? id.data : undefined)
  await requireAdmin(returnTo)
  const parsed = courseFormSchema.safeParse(coursePayload(formData))
  if (!parsed.success || (id && !id.success)) redirect(`${returnTo}?error=invalid_form`)

  let savedId = id?.success ? id.data : ''
  try {
    if (savedId) await updateCourse(savedId, parsed.data)
    else savedId = await createCourse(parsed.data)
  } catch {
    console.error('[TabuLama] A kurzus mentése sikertelen.')
    redirect(`${returnTo}?error=save_failed`)
  }
  revalidatePath('/', 'layout')
  revalidatePath('/admin/kurzusok')
  redirect(`${coursePath(savedId)}?success=saved`)
}

export async function updateCourseStatusAction(formData: FormData): Promise<void> {
  await requireAdmin('/admin/kurzusok')
  const parsed = z.object({ courseId: idSchema, status: z.enum(COURSE_STATUSES) }).safeParse({
    courseId: formData.get('courseId'), status: formData.get('status'),
  })
  if (!parsed.success) redirect('/admin/kurzusok?error=invalid_form')
  try { await updateCourseStatus(parsed.data.courseId, parsed.data.status) }
  catch { redirect('/admin/kurzusok?error=save_failed') }
  revalidatePath('/', 'layout')
  revalidatePath('/admin/kurzusok')
  redirect('/admin/kurzusok?success=status_updated')
}

export async function archiveCourseAction(formData: FormData): Promise<void> {
  await requireAdmin('/admin/kurzusok')
  const parsed = idSchema.safeParse(formData.get('courseId'))
  if (!parsed.success) redirect('/admin/kurzusok?error=invalid_form')
  try { await updateCourseStatus(parsed.data, 'archived') }
  catch { redirect('/admin/kurzusok?error=save_failed') }
  revalidatePath('/', 'layout')
  revalidatePath('/admin/kurzusok')
  redirect('/admin/kurzusok?success=archived')
}
