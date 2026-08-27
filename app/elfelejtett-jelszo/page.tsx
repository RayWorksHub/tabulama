import Link from 'next/link'

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-md items-center px-4 py-12">
      <div className="w-full rounded-3xl border border-border bg-card p-7 shadow-lg sm:p-9">
        <h1 className="text-2xl font-bold">Elfelejtett jelszó</h1>
        {sent ? (
          <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Ha az e-mail-címhez aktív fiók tartozik, elküldtük a jelszó-visszaállító linket.</p>
        ) : (
          <><p className="mt-3 text-sm text-muted-foreground">Add meg a fiókodhoz tartozó e-mail-címet.</p><form action="/api/auth/password-reset/request" method="post" className="mt-7 space-y-5"><label className="block text-sm font-semibold">E-mail-cím<input name="email" type="email" required autoComplete="email" className="mt-2 min-h-12 w-full rounded-xl border border-border px-4 outline-none focus:border-primary" /></label><button className="min-h-12 w-full rounded-xl bg-[#1b2430] px-5 font-bold text-white" type="submit">Visszaállító link kérése</button></form></>
        )}
        <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-primary hover:underline">Vissza a bejelentkezéshez</Link>
      </div>
    </div>
  )
}
