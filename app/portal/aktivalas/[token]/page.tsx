import Link from 'next/link'
import { getAuthTokenPreview } from '@/lib/student-repository'

const errors: Record<string, string> = {
  invalid: 'Az aktiváló link lejárt vagy már felhasználták.',
  mismatch: 'A két jelszó nem egyezik.',
  password: 'A jelszó legalább 10 karakter legyen, és tartalmazzon betűt és számot.',
  save: 'Az aktiválás most nem menthető. Próbáld újra.',
}

export default async function ActivationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ token }, feedback] = await Promise.all([params, searchParams])
  const preview = /^[A-Za-z0-9_-]{40,100}$/.test(token) ? await getAuthTokenPreview(token, 'activation') : null
  if (!preview) return <div className="mx-auto max-w-lg px-4 py-20 text-center"><h1 className="text-2xl font-bold">Az aktiváló link nem érvényes</h1><p className="mt-3 text-muted-foreground">A link lejárt vagy már felhasználták.</p><Link href="/login" className="mt-6 inline-block font-semibold text-primary hover:underline">Bejelentkezés</Link></div>
  return <div className="mx-auto flex min-h-[65vh] max-w-md items-center px-4 py-12"><div className="w-full rounded-3xl border border-border bg-card p-7 shadow-lg sm:p-9"><p className="text-sm font-semibold text-primary">{preview.studentNumber}</p><h1 className="mt-2 text-2xl font-bold">Üdvözlünk, {preview.fullName}!</h1><p className="mt-3 text-sm text-muted-foreground">Állítsd be a jelszavad a diákfiók aktiválásához.</p>{feedback.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errors[feedback.error] ?? errors.invalid}</p> : null}<form action="/api/auth/activate" method="post" className="mt-7 space-y-5"><input type="hidden" name="token" value={token} /><label className="block text-sm font-semibold">Új jelszó<input type="password" name="password" required minLength={10} maxLength={128} autoComplete="new-password" className="mt-2 min-h-12 w-full rounded-xl border border-border px-4" /></label><label className="block text-sm font-semibold">Új jelszó megerősítése<input type="password" name="passwordConfirmation" required minLength={10} maxLength={128} autoComplete="new-password" className="mt-2 min-h-12 w-full rounded-xl border border-border px-4" /></label><button type="submit" className="min-h-12 w-full rounded-xl bg-[#1b2430] px-5 font-bold text-white">Fiók aktiválása</button></form></div></div>
}
