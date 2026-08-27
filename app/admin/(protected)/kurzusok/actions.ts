'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { COURSE_STATUSES, createCourse, updateCourse, updateCourseStatus } from '@/lib/course-repository'
import { courseFormSchema, parseInstallmentDueDates } from '@/lib/course-form-schema'
import {
  createCourseModule,
  moveCourseModule,
  updateCourseModule,
} from '@/lib/student-repository'

const idSchema = z.string().trim().min(1).max(120)
const moduleSchema = z.object({
  courseId: idSchema,
  moduleId: idSchema.optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  topic: z.string().trim().max(200).optional(),
  plannedDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]),
  isActive: z.boolean(),
})

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

export async function saveCourseModuleAction(formData: FormData): Promise<void> {
  const parsed = moduleSchema.safeParse({
    courseId: formData.get('courseId'),
    moduleId: String(formData.get('moduleId') ?? '') || undefined,
    title: formData.get('title'),
    description: formData.get('description'),
    topic: formData.get('topic'),
    plannedDate: formData.get('plannedDate'),
    isActive: formData.get('isActive') === 'on',
  })
  const returnTo = parsed.success ? coursePath(parsed.data.courseId) : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!parsed.success) redirect(`${returnTo}?error=module_invalid`)
  const input = {
    courseId: parsed.data.courseId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    topic: parsed.data.topic || null,
    plannedDate: parsed.data.plannedDate || null,
    isActive: parsed.data.isActive,
  }
  try {
    if (parsed.data.moduleId) await updateCourseModule({ id: parsed.data.moduleId, ...input })
    else await createCourseModule(input)
  } catch {
    redirect(`${returnTo}?error=module_save_failed`)
  }
  revalidatePath(returnTo)
  revalidatePath('/portal')
  redirect(`${returnTo}?success=module_saved`)
}

export async function moveCourseModuleAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    courseId: idSchema,
    moduleId: idSchema,
    direction: z.enum(['up', 'down']),
  }).safeParse({
    courseId: formData.get('courseId'),
    moduleId: formData.get('moduleId'),
    direction: formData.get('direction'),
  })
  const returnTo = parsed.success ? coursePath(parsed.data.courseId) : '/admin/kurzusok'
  await requireAdmin(returnTo)
  if (!parsed.success) redirect(`${returnTo}?error=module_invalid`)
  try {
    await moveCourseModule(parsed.data.moduleId, parsed.data.courseId, parsed.data.direction)
  } catch {
    redirect(`${returnTo}?error=module_save_failed`)
  }
  revalidatePath(returnTo)
  revalidatePath('/portal')
  redirect(`${returnTo}?success=module_saved`)
}
