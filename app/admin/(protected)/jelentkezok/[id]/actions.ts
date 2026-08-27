'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import {
  ApplicationMutationError,
  getApplicationById,
  recordApplicationPayment,
  recordApplicationEmailDelivery,
  updateApplicationStatus,
  updatePaymentItemDueDate,
} from '@/lib/application-repository'
import {
  APPLICATION_STATUSES,
  PAYMENT_METHODS,
  type ApplicationStatus,
} from '@/lib/admin-display'
import {
  sendApplicationWorkflowEmail,
  sendStudentActivationEmail,
  type EmailResult,
  type ApplicationWorkflowEmailEvent,
} from '@/lib/tabulama-email'
import { packages, provider } from '@/lib/tabulama-config'
import {
  completeStudentEnrollment,
  recordAuthTokenEmailResult,
} from '@/lib/student-repository'

const applicationIdSchema = z.string().trim().min(1).max(80)

const statusFormSchema = z.object({
  applicationId: applicationIdSchema,
  status: z.enum(APPLICATION_STATUSES),
  note: z.string().trim().max(500).optional(),
})

const paymentDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T12:00:00.000Z`)))

const paymentFormSchema = z.object({
  applicationId: applicationIdSchema,
  paymentItemId: z.string().trim().min(1).max(120),
  amountHuf: z.coerce.number().int().positive().max(10_000_000),
  paidAt: paymentDateSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  note: z.string().trim().max(500).optional(),
})

const dueDateFormSchema = z.object({
  applicationId: applicationIdSchema,
  paymentItemId: z.string().trim().min(1).max(120),
  dueAt: z.union([paymentDateSchema, z.literal('')]),
})

const workflowEventByStatus: Partial<Record<ApplicationStatus, ApplicationWorkflowEmailEvent>> = {
  accepted: 'accepted',
  awaiting_payment: 'awaiting_payment',
  enrolled: 'enrolled',
}

const resendEventSchema = z.enum([
  'received',
  'accepted',
  'awaiting_payment',
  'payment_recorded',
  'enrolled',
])

function applicationPath(id: string): string {
  return `/admin/jelentkezok/${encodeURIComponent(id)}`
}

function mutationErrorKey(error: unknown): string {
  if (error instanceof ApplicationMutationError) return error.code
  console.error('[TabuLama] Admin módosítás mentése sikertelen.')
  return 'save_failed'
}

async function notifyApplication(
  applicationId: string,
  event: ApplicationWorkflowEmailEvent,
): Promise<EmailResult> {
  try {
    const application = await getApplicationById(applicationId)
    if (!application) {
      return { status: 'error', detail: 'A jelentkezés nem található.' }
    }
    const recipientName = application.guardianEmail === application.contactEmail
      ? application.guardianName ?? application.participantName
      : application.participantName
    const installmentCount = application.payment?.installmentCount ?? null
    const installmentAmountHuf = installmentCount && installmentCount > 1
      ? application.payment?.items[0]?.amountHuf ?? null
      : null
    const result = await sendApplicationWorkflowEmail(event, {
      applicationId: application.id,
      participantName: application.participantName,
      recipientName,
      recipient: application.contactEmail,
      courseTitle: application.courseTitle,
      packageName: packages[application.packageKey].name,
      paymentType: application.paymentType,
      installmentCount,
      installmentAmountHuf,
      totalAmountHuf: application.totalAmountHuf,
      paidAmountHuf: application.payment?.paidAmountHuf ?? 0,
      remainingAmountHuf: application.payment?.remainingAmountHuf ?? application.totalAmountHuf,
      nextDueAt: application.payment?.nextDueAt ?? null,
      receivedAt: application.createdAt,
      isTest: application.isTest,
    })
    try {
      await recordApplicationEmailDelivery({
        applicationId,
        event,
        recipient: application.contactEmail,
        result,
      })
    } catch {
      console.error(`[TabuLama] E-mail státusz mentése sikertelen (${applicationId}, ${event}).`)
    }
    return result
  } catch {
    console.error(`[TabuLama] Folyamatértesítés nem küldhető (${applicationId}, ${event}).`)
    return { status: 'error', detail: 'A folyamatértesítő kézbesítése nem sikerült.' }
  }
}

export async function resendApplicationEmailAction(formData: FormData): Promise<void> {
  const rawApplicationId = String(formData.get('applicationId') ?? '')
  const returnTo = applicationIdSchema.safeParse(rawApplicationId).success
    ? applicationPath(rawApplicationId)
    : '/admin/jelentkezok'
  await requireAdmin(returnTo)

  const event = resendEventSchema.safeParse(formData.get('event'))
  if (!event.success) redirect(`${returnTo}?error=invalid_form`)

  const result = await notifyApplication(rawApplicationId, event.data)
  revalidatePath(returnTo)
  redirect(`${returnTo}?${result.status === 'sent' ? 'success=email_resent' : 'error=email_send_failed'}`)
}

export async function updateApplicationStatusAction(formData: FormData): Promise<void> {
  const rawApplicationId = String(formData.get('applicationId') ?? '')
  const returnTo = applicationIdSchema.safeParse(rawApplicationId).success
    ? applicationPath(rawApplicationId)
    : '/admin/jelentkezok'
  await requireAdmin(returnTo)

  const parsed = statusFormSchema.safeParse({
    applicationId: rawApplicationId,
    status: formData.get('status'),
    note: formData.get('note'),
  })
  if (!parsed.success) redirect(`${returnTo}?error=invalid_form`)

  let errorKey: string | null = null
  let statusChanged = false
  let activationEmailFailed = false
  try {
    if (parsed.data.status === 'enrolled') {
      const provision = await completeStudentEnrollment(
        parsed.data.applicationId,
        parsed.data.note || null,
      )
      statusChanged = provision.statusChanged
      if (provision.activation) {
        const activationUrl = new URL(
          `/portal/aktivalas/${provision.activation.rawToken}`,
          provider.website,
        ).toString()
        const activationResult = await sendStudentActivationEmail({
          recipient: provision.email,
          studentName: provision.participantName,
          studentNumber: provision.studentNumber,
          courseTitle: provision.courseTitle,
          activationUrl,
          expiresAt: provision.activation.expiresAt,
        })
        await recordAuthTokenEmailResult(provision.activation.tokenHash, activationResult)
        activationEmailFailed = activationResult.status !== 'sent'
      }
    } else {
      statusChanged = await updateApplicationStatus(
        parsed.data.applicationId,
        parsed.data.status,
        parsed.data.note || null,
      )
    }
  } catch (error) {
    errorKey = mutationErrorKey(error)
  }

  if (errorKey) redirect(`${returnTo}?error=${errorKey}`)
  const workflowEvent = workflowEventByStatus[parsed.data.status]
  if (statusChanged && workflowEvent) {
    await notifyApplication(parsed.data.applicationId, workflowEvent)
  }
  revalidatePath(returnTo)
  revalidatePath('/admin/diakok')
  redirect(`${returnTo}?success=status_updated${activationEmailFailed ? '&error=activation_email_failed' : ''}`)
}

export async function recordApplicationPaymentAction(formData: FormData): Promise<void> {
  const rawApplicationId = String(formData.get('applicationId') ?? '')
  const returnTo = applicationIdSchema.safeParse(rawApplicationId).success
    ? applicationPath(rawApplicationId)
    : '/admin/jelentkezok'
  await requireAdmin(returnTo)

  const parsed = paymentFormSchema.safeParse({
    applicationId: rawApplicationId,
    paymentItemId: formData.get('paymentItemId'),
    amountHuf: formData.get('amountHuf'),
    paidAt: formData.get('paidAt'),
    paymentMethod: formData.get('paymentMethod'),
    note: formData.get('note'),
  })
  if (!parsed.success) redirect(`${returnTo}?error=invalid_form`)

  let errorKey: string | null = null
  try {
    await recordApplicationPayment({
      ...parsed.data,
      paidAt: `${parsed.data.paidAt}T12:00:00.000Z`,
      note: parsed.data.note || null,
    })
  } catch (error) {
    errorKey = mutationErrorKey(error)
  }

  if (errorKey) redirect(`${returnTo}?error=${errorKey}`)
  await notifyApplication(parsed.data.applicationId, 'payment_recorded')
  revalidatePath(returnTo)
  revalidatePath('/admin')
  revalidatePath('/admin/jelentkezok')
  redirect(`${returnTo}?success=payment_recorded`)
}

export async function updatePaymentItemDueDateAction(formData: FormData): Promise<void> {
  const rawApplicationId = String(formData.get('applicationId') ?? '')
  const returnTo = applicationIdSchema.safeParse(rawApplicationId).success
    ? applicationPath(rawApplicationId)
    : '/admin/jelentkezok'
  await requireAdmin(returnTo)

  const parsed = dueDateFormSchema.safeParse({
    applicationId: rawApplicationId,
    paymentItemId: formData.get('paymentItemId'),
    dueAt: formData.get('dueAt'),
  })
  if (!parsed.success) redirect(`${returnTo}?error=invalid_form`)

  let errorKey: string | null = null
  try {
    await updatePaymentItemDueDate({
      applicationId: parsed.data.applicationId,
      paymentItemId: parsed.data.paymentItemId,
      dueAt: parsed.data.dueAt ? `${parsed.data.dueAt}T12:00:00.000Z` : null,
    })
  } catch (error) {
    errorKey = mutationErrorKey(error)
  }

  if (errorKey) redirect(`${returnTo}?error=${errorKey}`)
  revalidatePath(returnTo)
  revalidatePath('/admin')
  redirect(`${returnTo}?success=due_date_updated`)
}
