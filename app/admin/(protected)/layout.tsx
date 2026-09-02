import { AdminWorkspaceShell } from '@/components/admin/admin-workspace-shell'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin('/admin')

  return <AdminWorkspaceShell email={session.email}>{children}</AdminWorkspaceShell>
}
