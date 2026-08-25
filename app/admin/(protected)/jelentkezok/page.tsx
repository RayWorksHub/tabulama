import Link from 'next/link'
import { ChevronRight, FlaskConical } from 'lucide-react'
import { listApplications } from '@/lib/application-repository'
import { formatAdminDate } from '@/lib/admin-display'
import { formatHUF } from '@/lib/tabulama-config'
import { StatusBadge } from '@/components/admin/status-badge'
import { createTestApplicationAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const feedback = await searchParams
  const applications = await listApplications()

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9b6e2f]">Ügyfélkezelés</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Jelentkezők</h1>
          <p className="mt-2 text-slate-600">{applications.length} jelentkezés a központi adatbázisban.</p>
        </div>
        <form action={createTestApplicationAction}>
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-fuchsia-800">
            <FlaskConical className="h-4 w-4" />
            10 Ft-os TESZT jelentkezés
          </button>
        </form>
      </div>

      {feedback.error === 'test_create_failed' ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900" role="alert">
          A TESZT jelentkezés nem hozható létre. Próbáld újra.
        </p>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {applications.length === 0 ? (
          <p className="px-6 py-14 text-center text-slate-500">Még nincs mentett jelentkezés.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Jelentkező</th>
                  <th className="px-5 py-4 font-semibold">Kurzus</th>
                  <th className="px-5 py-4 font-semibold">Összeg</th>
                  <th className="px-5 py-4 font-semibold">Státusz</th>
                  <th className="px-5 py-4 font-semibold">Beérkezett</th>
                  <th className="w-12 px-5 py-4"><span className="sr-only">Megnyitás</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((application) => (
                  <tr key={application.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link href={`/admin/jelentkezok/${application.id}`} className="font-semibold hover:underline">
                        {application.participantName}
                      </Link>
                      {application.isTest ? <span className="ml-2 rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-bold text-fuchsia-800 ring-1 ring-fuchsia-200">TESZT</span> : null}
                      <p className="mt-1 text-slate-500">{application.contactEmail}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{application.courseTitle}</td>
                    <td className="px-5 py-4 font-semibold">{formatHUF(application.totalAmountHuf)}</td>
                    <td className="px-5 py-4"><StatusBadge status={application.status} /></td>
                    <td className="px-5 py-4 text-slate-500">{formatAdminDate(application.createdAt)}</td>
                    <td className="px-5 py-4">
                      <Link href={`/admin/jelentkezok/${application.id}`} aria-label={`${application.participantName} adatlapja`} className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
