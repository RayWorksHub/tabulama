import { applicationStatusLabel } from '@/lib/admin-display'
import { cn } from '@/lib/utils'

const statusClasses: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 ring-blue-200',
  accepted: 'bg-violet-50 text-violet-700 ring-violet-200',
  proforma: 'bg-amber-50 text-amber-800 ring-amber-200',
  awaiting_payment: 'bg-orange-50 text-orange-800 ring-orange-200',
  partially_paid: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  invoiced: 'bg-teal-50 text-teal-700 ring-teal-200',
  enrolled: 'bg-green-50 text-green-700 ring-green-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        statusClasses[status] ?? 'bg-slate-100 text-slate-700 ring-slate-200',
      )}
    >
      {applicationStatusLabel(status)}
    </span>
  )
}
