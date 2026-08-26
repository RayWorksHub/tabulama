'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import {
  ApplicationMutationError,
  getApplicationById,
  recordApplicationPayment,
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
  type ApplicationWorkflowEmailEvent,
} from '@/lib/tabulama-email'

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
): Promise<void> {
  try {
    const application = await getApplicationById(applicationId)
    if (!application) return
    await sendApplicationWorkflowEmail(event, {
      applicationId: application.id,
      participantName: application.participantName,
      recipient: application.contactEmail,
      courseTitle: application.courseTitle,
      totalAmountHuf: application.totalAmountHuf,
      paidAmountHuf: application.payment?.paidAmountHuf ?? 0,
      remainingAmountHuf: application.payment?.remainingAmountHuf ?? application.totalAmountHuf,
      nextDueAt: application.payment?.nextDueAt ?? null,
      isTest: application.isTest,
    })
  } catch {
    console.error(`[TabuLama] Folyamatértesítés nem küldhető (${applicationId}, ${event}).`)
  }
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
  try {
    statusChanged = await updateApplicationStatus(
      parsed.data.applicationId,
      parsed.data.status,
      parsed.data.note || null,
    )
  } catch (error) {
    errorKey = mutationErrorKey(error)
  }

  if (errorKey) redirect(`${returnTo}?error=${errorKey}`)
  const workflowEvent = workflowEventByStatus[parsed.data.status]
  if (statusChanged && workflowEvent) {
    await notifyApplication(parsed.data.applicationId, workflowEvent)
  }
  revalidatePath(returnTo)
  redirect(`${returnTo}?success=status_updated`)
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
