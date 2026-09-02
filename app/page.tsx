import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Code2,
  Target,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Reveal } from '@/components/tabulama/reveal'
import { CourseCard } from '@/components/tabulama/course-card'
import { listPublicCourses } from '@/lib/course-repository'

const highlights = [
  {
    icon: Code2,
    title: 'Programozási alapok',
    description:
      'Változók, elágazások, ciklusok, adatszerkezetek és függvények gyakorlati feladatokban.',
  },
  {
    icon: Target,
    title: 'Vizsgafelkészítés',
    description:
      'Külön kurzusok az ágazati alapvizsga és a digitális kultúra érettségi programozási feladataira.',
  },
  {
    icon: GraduationCap,
    title: 'Gyakorlás és visszajelzés',
    description:
      'Önálló feladatmegoldás, megoldáselemzés és követhető előrehaladás a kurzus céljához igazítva.',
  },
]

const forWhom = [
  'Középiskolásoknak, akik az alapoktól tanulnának programozni',
  'Ágazati alapvizsgára készülőknek',
  'Digitális kultúra érettségire készülőknek',
  'Azoknak, akik célzott gyakorlást és tanári visszajelzést szeretnének',
]

export const dynamic = 'force-dynamic'

export default async function TabuLamaHomePage() {
  const upcomingCourses = (await listPublicCourses())
    .filter((course) => ['coming_soon', 'open', 'full'].includes(course.status))
    .slice(0, 3)
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy text-navy-foreground">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[420px] w-[420px] rounded-full bg-brand/25 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-32 h-[380px] w-[380px] rounded-full bg-brand/15 blur-[120px]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24 lg:px-8">
          <div>
            <span className="inline-block rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-sm font-semibold text-brand">
              Programozási kurzusok középiskolásoknak
            </span>
            <h1 className="mt-5 text-balance font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
              Programozási alapok és vizsgafelkészítés, érthetően.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-navy-foreground/75">
              A TabuLama programozási alapozó kurzusokat, Python-képzéseket,
              valamint ágazati alapvizsga- és érettségi felkészítést szervez
              középiskolásoknak.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/kurzusok"
                className={buttonVariants({ size: 'lg' })}
              >
                Kurzusok megtekintése
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="#modszertan"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                })}
              >
                Hogyan tanítunk?
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <Image
                src="/tabulama/tabulama-logo.webp"
                alt="TabuLama Programozó Akadémia"
                width={360}
                height={360}
                className="h-auto w-64 rounded-2xl bg-white sm:w-80"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section id="modszertan" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
            Miben segít a TabuLama?
          </h2>
          <p className="mt-3 text-muted-foreground">
            A kurzusok célja az önálló feladatmegoldás és a vizsgán is
            használható programozási tudás.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {highlights.map((h, i) => (
            <Reveal
              key={h.title}
              delay={i * 100}
              className="rounded-2xl border border-border bg-card p-7"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <h.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-heading text-lg font-bold text-foreground">
                {h.title}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {h.description}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* For whom */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <div className="grid items-center gap-10 rounded-3xl border border-border bg-secondary/50 p-8 sm:p-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
              Kinek szólnak a kurzusok?
            </h2>
            <p className="mt-3 text-muted-foreground">
              A meghirdetett képzések között alapozó és vizsgára felkészítő
              kurzusok is helyet kapnak.
            </p>
            <Link
              href="/kurzusok"
              className={`${buttonVariants({ size: 'lg' })} mt-6`}
            >
              Aktuális kurzusok
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal delay={120}>
            <ul className="space-y-3">
              {forWhom.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="bg-muted/50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><span className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">Aktuális kínálat</span><h2 className="font-heading mt-3 text-3xl font-extrabold tracking-tight">Közelgő kurzusok</h2></div>
            <Link href="/kurzusok" className="font-bold text-primary hover:underline">Összes kurzus</Link>
          </div>
          {upcomingCourses.length ? <div className="mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{upcomingCourses.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <p className="mt-9 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">A következő kurzusok hamarosan megjelennek.</p>}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal className="overflow-hidden rounded-3xl bg-navy px-6 py-14 text-center text-navy-foreground sm:px-12">
          <h2 className="mx-auto max-w-2xl text-balance font-heading text-3xl font-extrabold tracking-tight">
            Válassz az aktuális kurzusok közül
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-navy-foreground/75">
            Az időpont, a tematika, az ár és a férőhely minden kurzusnál külön
            látható.
          </p>
          <Link
            href="/kurzusok"
            className={`${buttonVariants({ size: 'lg' })} mt-8`}
          >
            Kurzusok megtekintése
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Reveal>
      </section>
    </>
  )
}
