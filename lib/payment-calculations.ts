export type PaymentItemState = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
export type PaymentPlanState = PaymentItemState

export interface PaymentDueItem {
  remainingAmountHuf: number
  dueAt: string | null
}

export function canRecordPayment(amountHuf: number, remainingAmountHuf: number): boolean {
  return Number.isInteger(amountHuf) && amountHuf > 0 && amountHuf <= remainingAmountHuf
}

export function paymentItemState(input: {
  amountHuf: number
  paidAmountHuf: number
  dueAt: string | null
  currentStatus?: string
  now?: Date
}): PaymentItemState {
  if (input.currentStatus === 'cancelled') return 'cancelled'
  if (input.paidAmountHuf >= input.amountHuf) return 'paid'
  if (input.dueAt && new Date(input.dueAt).getTime() < (input.now ?? new Date()).getTime()) {
    return 'overdue'
  }
  return input.paidAmountHuf > 0 ? 'partially_paid' : 'pending'
}

export function paymentPlanState(input: {
  totalAmountHuf: number
  paidAmountHuf: number
  itemStatuses: string[]
  currentStatus?: string
}): PaymentPlanState {
  if (input.currentStatus === 'cancelled') return 'cancelled'
  if (input.paidAmountHuf >= input.totalAmountHuf) return 'paid'
  if (input.itemStatuses.includes('overdue')) return 'overdue'
  return input.paidAmountHuf > 0 ? 'partially_paid' : 'pending'
}

export function nextPaymentDueAt(items: PaymentDueItem[]): string | null {
  return items
    .filter((item): item is PaymentDueItem & { dueAt: string } =>
      item.remainingAmountHuf > 0 && Boolean(item.dueAt),
    )
    .sort((left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime())[0]
    ?.dueAt ?? null
}
