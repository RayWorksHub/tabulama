import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const errors: Record<string, string> = {
  invalid: 'Hibás e-mail-cím vagy jelszó.',
  inactive: 'A fiók még nincs aktiválva vagy inaktív.',
  unconfigured: 'A bejelentkezés jelenleg nem elérhető.',
  database: 'A bejelentkezés most nem elérhető. Próbáld újra később.',
  'rate-limit': 'Túl sok próbálkozás. Kérjük, várj néhány percet.',
}

const successes: Record<string, string> = {
  activated: 'A fiókod aktív. Most már bejelentkezhetsz.',
  'password-reset': 'Az új jelszavad elkészült. Bejelentkezhetsz.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const session = await getAuthSession()
  if (session) redirect(session.role === 'student' ? '/portal' : '/admin')
  const feedback = await searchParams

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <div className="w-full rounded-3xl border border-border bg-card p-7 shadow-xl shadow-slate-900/5 sm:p-9">
        <div className="flex items-center gap-3">
          <Image src="/tabulama/tabulama-mark.webp" alt="" width={52} height={52} priority />
          <div><p className="text-sm font-semibold text-primary">TabuLama</p><h1 className="text-2xl font-bold tracking-tight">Bejelentkezés</h1></div>
        </div>
        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Adminok és diákok ugyanitt léphetnek be e-mail-címmel és jelszóval.</p>
        {feedback.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{errors[feedback.error] ?? errors.invalid}</p> : null}
        {feedback.success ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{successes[feedback.success]}</p> : null}
        <form action="/api/session" method="post" className="mt-7 space-y-5">
          <label className="block text-sm font-semibold">E-mail-cím<input type="email" name="email" autoComplete="username" required className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" /></label>
          <label className="block text-sm font-semibold">Jelszó<input type="password" name="password" autoComplete="current-password" required maxLength={128} className="mt-2 min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15" /></label>
          <button type="submit" className="min-h-12 w-full rounded-xl bg-[#1b2430] px-5 font-bold text-white transition hover:bg-[#263445]">Bejelentkezés</button>
        </form>
        <Link href="/elfelejtett-jelszo" className="mt-5 block text-center text-sm font-semibold text-primary hover:underline">Elfelejtetted a jelszavad?</Link>
      </div>
    </div>
  )
}
