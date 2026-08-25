import type { Metadata } from 'next'
import { ApplicationFlow } from '@/components/tabulama/application/application-flow'
import { resolvePackageKey, isEarlyBirdAvailable } from '@/lib/tabulama-config'

export const metadata: Metadata = {
  title: 'Jelentkezés | TabuLama Programozó Akadémia',
  description:
    'Jelentkezz a TabuLama 12 hetes Python programozó tanfolyamára. Néhány perc alatt kitölthető, lépésről lépésre vezető jelentkezési űrlap.',
}

export default async function JelentkezesPage({
  searchParams,
}: {
  searchParams: Promise<{ csomag?: string }>
}) {
  const { csomag } = await searchParams
  const requestedKey = resolvePackageKey(csomag)
  const earlyBirdOpen = isEarlyBirdAvailable()

  // Ha lejárt early-birdöt kértek az URL-ben, ne preszelektáljuk, de jelezzük.
  const earlyBirdExpiredFromUrl = requestedKey === 'early-bird' && !earlyBirdOpen
  const initialPackageKey = earlyBirdExpiredFromUrl ? null : requestedKey

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="text-center">
        <span className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
          Jelentkezés
        </span>
        <h1 className="font-heading mt-3 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          Foglald le a helyed a TabuLama tanfolyamon
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
          A jelentkezés néhány perc alatt kitölthető. Végigvezetünk a lépéseken,
          és a végén e-mailben visszaigazoljuk a jelentkezésed.
        </p>
      </div>

      <div className="mt-10">
        <ApplicationFlow
          initialPackageKey={initialPackageKey}
          earlyBirdExpiredFromUrl={earlyBirdExpiredFromUrl}
        />
      </div>
    </section>
  )
}
