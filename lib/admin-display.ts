export const applicationStatusLabels: Record<string, string> = {
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
  return applicationStatusLabels[status] ?? status
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
