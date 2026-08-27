'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { provider } from '@/lib/tabulama-config'
import { sendStudentActivationEmail } from '@/lib/tabulama-email'
import {
  createActivationForStudent,
  MODULE_PROGRESS_STATUSES,
  recordAuthTokenEmailResult,
  updateModuleProgress,
} from '@/lib/student-repository'

const id = z.string().trim().min(1).max(120)

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
  const returnTo = parsed.success ? `/admin/diakok/${parsed.data.studentId}` : '/admin/diakok'
  await requireAdmin(returnTo)
  if (!parsed.success) redirect(`${returnTo}?error=invalid_form`)
  try {
    await updateModuleProgress(parsed.data.enrollmentId, parsed.data.moduleId, parsed.data.status)
  } catch {
    redirect(`${returnTo}?error=save_failed`)
  }
  revalidatePath(returnTo)
  revalidatePath('/portal')
  redirect(`${returnTo}?success=progress_updated`)
}

export async function resendStudentActivationAction(formData: FormData): Promise<void> {
  const studentId = id.safeParse(formData.get('studentId'))
  const returnTo = studentId.success ? `/admin/diakok/${studentId.data}` : '/admin/diakok'
  await requireAdmin(returnTo)
  if (!studentId.success) redirect(`${returnTo}?error=invalid_form`)
  try {
    const provision = await createActivationForStudent(studentId.data)
    if (!provision?.activation) redirect(`${returnTo}?error=activation_unavailable`)
    const activationUrl = new URL(
      `/portal/aktivalas/${provision.activation.rawToken}`,
      provider.website,
    ).toString()
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
