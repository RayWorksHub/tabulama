import Link from 'next/link'
import { ArrowRight, Banknote, BookOpen, Clock3, UserCheck, Users } from 'lucide-react'
import { getAdminDashboardStats, listApplications } from '@/lib/application-repository'
import { formatHUF } from '@/lib/tabulama-config'
import { formatAdminDate } from '@/lib/admin-display'
import { StatusBadge } from '@/components/admin/status-badge'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const [stats, applications] = await Promise.all([
    getAdminDashboardStats(),
    listApplications(6),
  ])

  const cards = [
    { label: 'Aktív kurzusok', value: stats.activeCourses, icon: BookOpen },
    { label: 'Összes jelentkező', value: stats.applications, icon: Users },
    { label: 'Új jelentkezések', value: stats.newApplications, icon: Clock3 },
    { label: 'Aktív diákok', value: stats.activeStudents, icon: UserCheck },
    { label: 'Fizetésre vár', value: stats.awaitingPayment, icon: Banknote },
    { label: 'Közelgő kurzusok', value: stats.upcomingCourses, icon: BookOpen },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9b6e2f]">Adminisztráció</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Áttekintés</h1>
        <p className="mt-2 text-slate-600">A kurzusok és jelentkezések aktuális állapota egy helyen.</p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Fő mutatók">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{card.value}</p>
              </div>
              <div className="rounded-xl bg-[#f7f2ea] p-3 text-[#9b6e2f]">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Beérkezett összeg</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatHUF(stats.receivedAmountHuf)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Nyilvántartott hátralék</p>
          <p className="mt-2 text-2xl font-bold text-orange-700">{formatHUF(stats.outstandingAmountHuf)}</p>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Legújabb jelentkezések</h2>
            <p className="mt-1 text-sm text-slate-500">A legutóbb beérkezett adatok.</p>
          </div>
          <Link href="/admin/jelentkezok" className="inline-flex items-center gap-2 text-sm font-bold text-[#8b6128] hover:underline">
            Összes
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {applications.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Még nincs jelentkezés.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.map((application) => (
              <Link key={application.id} href={`/admin/jelentkezok/${application.id}`} className="grid gap-2 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-5">
                <div>
                  <p className="font-semibold">{application.participantName}</p>
                  <p className="mt-1 text-sm text-slate-500">{application.courseTitle}</p>
                </div>
                <StatusBadge status={application.status} />
                <time className="text-sm text-slate-500">{formatAdminDate(application.createdAt)}</time>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
