'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { bulkUpdateCourseProgress } from '@/lib/course-progress-repository'

const idSchema = z.string().trim().min(1).max(120)
const operationSchema = z.enum(['advance', 'complete_current', 'set_current'])

export async function bulkCourseProgressAction(formData: FormData): Promise<void> {
  const courseId = idSchema.safeParse(formData.get('courseId'))
  const operation = operationSchema.safeParse(formData.get('operation'))
  const enrollmentIds = formData.getAll('enrollmentId').map(String)
  const targetModuleRaw = String(formData.get('targetModuleId') ?? '').trim()
  const returnTo = courseId.success
    ? `/admin/kurzusok/${encodeURIComponent(courseId.data)}?view=students`
    : '/admin/kurzusok'

  await requireAdmin(returnTo)

  const targetModuleId = targetModuleRaw ? idSchema.safeParse(targetModuleRaw) : null
  if (!courseId.success || !operation.success || !enrollmentIds.length) {
    redirect(`${returnTo}&error=progress_invalid`)
  }
  if (operation.data === 'set_current' && (!targetModuleId || !targetModuleId.success)) {
    redirect(`${returnTo}&error=progress_target_required`)
  }

  try {
    await bulkUpdateCourseProgress({
      courseId: courseId.data,
      enrollmentIds,
      operation: operation.data,
      targetModuleId: targetModuleId?.success ? targetModuleId.data : null,
    })
  } catch {
    redirect(`${returnTo}&error=progress_save_failed`)
  }

  revalidatePath(`/admin/kurzusok/${courseId.data}`)
  revalidatePath('/admin/diakok')
  revalidatePath('/portal')
  redirect(`${returnTo}&success=progress_updated`)
}
