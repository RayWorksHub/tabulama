import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getAdminSession, sanitizeReturnTo } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin belépés',
  robots: { index: false, follow: false },
}

const errorMessages: Record<string, string> = {
  invalid: 'A megadott e-mail-cím vagy jelszó hibás.',
  'rate-limit': 'Túl sok sikertelen próbálkozás. Próbáld újra 10 perc múlva.',
  database: 'Az adatbázis-kapcsolat még nincs beállítva vagy nem érhető el.',
  config: 'Az admin belépés környezeti változói még nincsenek beállítva.',
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const session = await getAdminSession()
  if (session) redirect('/admin')

  const { error, next } = await searchParams
  const returnTo = sanitizeReturnTo(next)

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        <div className="flex items-center gap-3">
          <Image
            src="/tabulama/tabulama-mark.webp"
            alt=""
            width={52}
            height={52}
            priority
          />
          <div>
            <p className="text-sm font-semibold text-[#bd8b3c]">TabuLama</p>
            <h1 className="text-2xl font-bold tracking-tight">Admin belépés</h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          A jelentkezők és az ügyintézés csak hitelesített admin számára érhető el.
        </p>

        {error ? (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMessages[error] ?? 'A belépés nem sikerült.'}
          </div>
        ) : null}

        <form action="/api/admin/session" method="post" className="mt-7 space-y-5">
          <input type="hidden" name="next" value={returnTo} />
          <label className="block text-sm font-semibold text-slate-700">
            E-mail-cím
            <input
              type="email"
              name="email"
              autoComplete="username"
              required
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none transition focus:border-[#bd8b3c] focus:ring-4 focus:ring-[#bd8b3c]/15"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Jelszó
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none transition focus:border-[#bd8b3c] focus:ring-4 focus:ring-[#bd8b3c]/15"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 w-full rounded-xl bg-[#1b2430] px-5 font-bold text-white transition hover:bg-[#263445] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#bd8b3c]/30"
          >
            Belépés
          </button>
        </form>
      </div>
    </main>
  )
}
