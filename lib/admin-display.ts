export const APPLICATION_STATUSES = [
  'new',
  'accepted',
  'proforma',
  'awaiting_payment',
  'partially_paid',
  'paid',
  'invoiced',
  'enrolled',
  'rejected',
  'cancelled',
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  new: 'Új jelentkezés',
  accepted: 'Elfogadva',
  proforma: 'Díjbekérő',
  awaiting_payment: 'Fizetésre vár',
  partially_paid: 'Részben fizetett',
  paid: 'Fizetett',
  invoiced: 'Számlázva',
  enrolled: 'Beiratkozva',
  rejected: 'Elutasítva',
  cancelled: 'Lemondva',
}

export function applicationStatusLabel(status: string): string {
  return status in applicationStatusLabels
    ? applicationStatusLabels[status as ApplicationStatus]
    : status
}

export const PAYMENT_METHODS = ['bank_transfer', 'cash'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: 'Banki átutalás',
  cash: 'Készpénz',
}

export const paymentStatusLabels: Record<string, string> = {
  pending: 'Fizetésre vár',
  partially_paid: 'Részben fizetett',
  paid: 'Fizetett',
  overdue: 'Lejárt',
  cancelled: 'Törölve',
}

export function paymentStatusLabel(status: string): string {
  return paymentStatusLabels[status] ?? status
}

export function formatAdminDate(value: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Budapest',
  }).format(new Date(value))
}

export function formatAdminDay(value: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Budapest',
  }).format(new Date(value))
}
