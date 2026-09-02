'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { bulkUpdateCourseProgress } from '@/lib/course-progress-repository'
import { assignStudentToCourse } from '@/lib/student-enrollment-repository'
import { sendStudentActivationEmail } from '@/lib/tabulama-email'
import { publicAppUrl } from '@/lib/public-app-url'
import {
  createActivationForStudent,
  MODULE_PROGRESS_STATUSES,
  recordAuthTokenEmailResult,
  updateModuleProgress,
} from '@/lib/student-repository'

const id = z.string().trim().min(1).max(120)
const guidedOperation = z.enum(['advance', 'complete_current', 'set_current'])

export async function assignStudentCourseAction(formData: FormData): Promise<void> {
  const parsed = z.object({ studentId: id, courseId: id }).safeParse({
    studentId: formData.get('studentId'),
    courseId: formData.get('courseId'),
  })
  const returnTo = parsed.success ? `/admin/diakok/${parsed.data.studentId}?view=courses` : '/admin/diakok'
  await requireAdmin(returnTo)
  if (!parsed.success) redirect(`${returnTo}?error=invalid_form`)

  try {
    const enrollmentId = await assignStudentToCourse(parsed.data.studentId, parsed.data.courseId)
    revalidatePath(`/admin/diakok/${parsed.data.studentId}`)
    revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
    revalidatePath('/admin/kurzusok')
    revalidatePath('/portal')
    redirect(`${returnTo}&success=course_assigned&course=${enrollmentId}`)
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error
    const code = error instanceof Error && error.message === 'course_full' ? 'course_full' : 'course_assign_failed'
    redirect(`${returnTo}&error=${code}`)
  }
}

export async function adjustStudentProgressAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    studentId: id,
    enrollmentId: id,
    courseId: id,
    operation: guidedOperation,
    targetModuleId: z.string().trim().max(120).optional(),
  }).safeParse({
    studentId: formData.get('studentId'),
    enrollmentId: formData.get('enrollmentId'),
    courseId: formData.get('courseId'),
    operation: formData.get('operation'),
    targetModuleId: String(formData.get('targetModuleId') ?? ''),
  })
  const returnTo = parsed.success
    ? `/admin/diakok/${parsed.data.studentId}?view=progress&course=${parsed.data.enrollmentId}`
    : '/admin/diakok'
  await requireAdmin(returnTo)
  if (!parsed.success || (parsed.data.operation === 'set_current' && !parsed.data.targetModuleId)) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=invalid_form`)
  }

  try {
    await bulkUpdateCourseProgress({
      courseId: parsed.data.courseId,
      enrollmentIds: [parsed.data.enrollmentId],
      operation: parsed.data.operation,
      targetModuleId: parsed.data.targetModuleId || null,
    })
  } catch {
    redirect(`${returnTo}&error=save_failed`)
  }
  revalidatePath(`/admin/diakok/${parsed.data.studentId}`)
  revalidatePath(`/admin/kurzusok/${parsed.data.courseId}`)
  revalidatePath('/portal')
  redirect(`${returnTo}&success=progress_updated`)
}

export async function updateStudentProgressAction(formData: FormData): Promise<void> {
  const parsed = z.object({
    studentId: id,
    enrollmentId: id,
    moduleId: id,
    status: z.enum(MODULE_PROGRESS_STATUSES),
  }).safeParse({
    studentId: formData.get('studentId'),
    enrollmentId: formData.get('enrollmentId'),
    moduleId: formData.get('moduleId'),
    status: formData.get('status'),
  })
  const studentPath = parsed.success ? `/admin/diakok/${parsed.data.studentId}` : '/admin/diakok'
  const returnTo = parsed.success ? `${studentPath}?view=progress&course=${parsed.data.enrollmentId}` : studentPath
  await requireAdmin(returnTo)
  if (!parsed.success) redirect(`${returnTo}?error=invalid_form`)
  try {
    await updateModuleProgress(parsed.data.enrollmentId, parsed.data.moduleId, parsed.data.status)
  } catch {
    redirect(`${returnTo}&error=save_failed`)
  }
  revalidatePath(studentPath)
  revalidatePath('/portal')
  redirect(`${returnTo}&success=progress_updated`)
}

export async function resendStudentActivationAction(formData: FormData): Promise<void> {
  const studentId = id.safeParse(formData.get('studentId'))
  const returnTo = studentId.success ? `/admin/diakok/${studentId.data}` : '/admin/diakok'
  await requireAdmin(returnTo)
  if (!studentId.success) redirect(`${returnTo}?error=invalid_form`)
  try {
    const provision = await createActivationForStudent(studentId.data)
    if (!provision?.activation) redirect(`${returnTo}?error=activation_unavailable`)
    const activationUrl = publicAppUrl(`/portal/aktivalas/${provision.activation.rawToken}`)
    const result = await sendStudentActivationEmail({
      recipient: provision.email,
      studentName: provision.participantName,
      studentNumber: provision.studentNumber,
      courseTitle: provision.courseTitle,
      activationUrl,
      expiresAt: provision.activation.expiresAt,
    })
    await recordAuthTokenEmailResult(provision.activation.tokenHash, result)
    if (result.status !== 'sent') redirect(`${returnTo}?error=activation_failed`)
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) throw error
    redirect(`${returnTo}?error=activation_failed`)
  }
  revalidatePath(returnTo)
  redirect(`${returnTo}?success=activation_sent`)
}
