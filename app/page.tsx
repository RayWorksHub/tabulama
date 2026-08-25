import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Users,
  Rocket,
  Code2,
  Target,
  GraduationCap,
  CheckCircle2,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Reveal } from '@/components/tabulama/reveal'

const facts = [
  { icon: Clock, label: 'Időtartam', value: '12 hét' },
  {
    icon: CalendarDays,
    label: 'Alkalmak',
    value: 'Heti 3 · H / Sze / P · 17:00–18:30',
  },
  { icon: Users, label: 'Csoportlétszám', value: '10–15 fő' },
  { icon: Rocket, label: 'Indulás', value: '2026. augusztus 24.' },
]

const highlights = [
  {
    icon: Code2,
    title: 'Python az alapoktól',
    description:
      'Változók, ciklusok, elágazások, listák és függvények – stabil programozói alapok gyakorlati példákon keresztül.',
  },
  {
    icon: Target,
    title: 'Célzott vizsgafelkészítés',
    description:
      'A második szakaszban ágazati alapvizsgára vagy digitális kultúra érettségire specializálódsz.',
  },
  {
    icon: GraduationCap,
    title: 'Próba vizsga a végén',
    description:
      'A képzést próba vizsga zárja, ahol felméred a tudásod és megtapasztalod a valódi vizsgahelyzetet.',
  },
]

const forWhom = [
  'Középiskolásoknak, akik szeretnék megérteni a programozást',
  'Ágazati alapvizsgára készülőknek',
  'Digitális kultúra érettségire készülőknek',
  'Kezdőknek, akik nulláról indulnának',
]

export default function TabuLamaHomePage() {
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
              Python programozás középiskolásoknak
            </span>
            <h1 className="mt-5 text-balance font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
              Tanulj meg programozni – érthetően, lépésről lépésre.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-navy-foreground/75">
              A TabuLama Programozó Akadémia 12 hetes intenzív képzése az
              alapoktól épít fel: programozói gondolkodás, gyakorlati tudás és
              célzott vizsgafelkészítés egy csomagban.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/jelentkezes"
                className={buttonVariants({ size: 'lg' })}
              >
                Jelentkezem
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/tanfolyamok"
                className={buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                })}
              >
                Tanfolyam részletei
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

      {/* Facts */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((f, i) => (
            <Reveal
              key={f.label}
              delay={i * 80}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {f.label}
              </p>
              <p className="mt-1 font-heading text-base font-bold text-foreground">
                {f.value}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Highlights */}
      <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
            Mit viszel haza a képzésről?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Nem magolás, hanem valódi megértés – hogy önállóan is meg tudd oldani
            a feladatokat.
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
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 rounded-3xl border border-border bg-secondary/50 p-8 sm:p-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
              Kinek szól a képzés?
            </h2>
            <p className="mt-3 text-muted-foreground">
              A kurzus felépítése a középiskolás korosztály igényeire szabott,
              legyen szó teljesen kezdőkről vagy vizsgára készülőkről.
            </p>
            <Link
              href="/tanfolyamok"
              className={`${buttonVariants({ size: 'lg' })} mt-6`}
            >
              Nézd meg a tematikát
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

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <Reveal className="overflow-hidden rounded-3xl bg-navy px-6 py-14 text-center text-navy-foreground sm:px-12">
          <h2 className="mx-auto max-w-2xl text-balance font-heading text-3xl font-extrabold tracking-tight">
            Készen állsz, hogy elkezdd a programozást?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-navy-foreground/75">
            A helyek korlátozottak – maximum 15 fős csoportban dolgozunk, hogy
            mindenki személyes figyelmet kapjon.
          </p>
          <Link
            href="/jelentkezes"
            className={`${buttonVariants({ size: 'lg' })} mt-8`}
          >
            Jelentkezem most
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Reveal>
      </section>
    </>
  )
}
