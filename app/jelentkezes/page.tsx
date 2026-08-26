import type { Metadata } from 'next'
import Link from 'next/link'
import { ApplicationFlow } from '@/components/tabulama/application/application-flow'
import { resolvePackageKey } from '@/lib/tabulama-config'
import { courseAcceptsApplications, getApplicationCourseBySlug, listPublicCourses } from '@/lib/course-repository'

export const metadata: Metadata = {
  title: 'Jelentkezés | TabuLama Programozó Akadémia',
  description:
    'Jelentkezz a TabuLama 12 hetes Python programozó tanfolyamára. Néhány perc alatt kitölthető, lépésről lépésre vezető jelentkezési űrlap.',
}

export default async function JelentkezesPage({
  searchParams,
}: {
  searchParams: Promise<{ csomag?: string; course?: string }>
}) {
  const { csomag, course: courseSlug } = await searchParams
  const course = courseSlug ? await getApplicationCourseBySlug(courseSlug) : null

  if (!course) {
    const courses = (await listPublicCourses()).filter((item) => courseAcceptsApplications(item))
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="text-center"><span className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">Jelentkezés</span><h1 className="font-heading mt-3 text-3xl font-bold sm:text-4xl">Válassz kurzust</h1><p className="mt-4 text-muted-foreground">A jelentkezés mindig a kiválasztott kurzushoz kerül.</p></div>
        {courseSlug ? <p role="alert" className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">A megadott kurzus nem található vagy már nem nyilvános.</p> : null}
        <div className="mt-8 grid gap-4">{courses.length ? courses.map((item) => <Link key={item.id} href={`/jelentkezes?course=${encodeURIComponent(item.slug)}`} className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary"><h2 className="font-heading text-lg font-bold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.summary}</p></Link>) : <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">Jelenleg nincs jelentkezhető kurzus.</p>}</div>
      </section>
    )
  }

  const requestedKey = resolvePackageKey(csomag)
  const requestedOption = requestedKey ? course.paymentOptions[requestedKey] : null
  const earlyBirdExpiredFromUrl = requestedKey === 'early-bird' && requestedOption !== null && !requestedOption.available
  const initialPackageKey = earlyBirdExpiredFromUrl ? null : requestedKey

  if (!course.acceptingApplications) {
    return <section className="mx-auto max-w-2xl px-4 py-20 text-center"><h1 className="font-heading text-3xl font-bold">{course.title}</h1><p className="mt-5 rounded-2xl border border-border bg-card p-6 text-muted-foreground">Erre a kurzusra jelenleg nem lehet jelentkezni.</p><Link href={`/kurzusok/${course.slug}`} className="mt-6 inline-flex rounded-full border border-border px-5 py-3 font-semibold">Kurzus részletei</Link></section>
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="text-center">
        <span className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
          Jelentkezés
        </span>
        <h1 className="font-heading mt-3 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          Jelentkezés: {course.shortTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty leading-relaxed text-muted-foreground">
          A jelentkezés néhány perc alatt kitölthető. Végigvezetünk a lépéseken,
          és a végén e-mailben visszaigazoljuk a jelentkezésed.
        </p>
      </div>

      <div className="mt-10">
        <ApplicationFlow
          course={course}
          initialPackageKey={initialPackageKey}
          earlyBirdExpiredFromUrl={earlyBirdExpiredFromUrl}
        />
      </div>
    </section>
  )
}
