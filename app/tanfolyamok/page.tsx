import type { Metadata } from "next"
import Link from "next/link"
import {
  Code2,
  Calendar,
  Clock,
  Users,
  Target,
  GraduationCap,
  CheckCircle2,
  BookOpen,
  Trophy,
  MessageCircleQuestion,
  ArrowRight,
  Check,
  Star,
  TrendingDown,
  Gift,
} from "lucide-react"
import { Reveal } from "@/components/tabulama/reveal"
import { Countdown } from "@/components/tabulama/countdown"

export const metadata: Metadata = {
  title: "Tanfolyamok | TabuLama Programozó Akadémia",
  description:
    "12 hetes intenzív Python programozó tanfolyam középiskolásoknak – ágazati alapvizsga és digitális kultúra érettségi felkészítés, valós projektekkel.",
}

const EARLY_BIRD_DEADLINE = "2026-08-10T23:59:59+02:00"

const phases = [
  {
    tag: "1–6. hét",
    icon: BookOpen,
    title: "Alapozó szakasz",
    lead: "Python alapok a nulláról",
    points: [
      "Változók, adattípusok, operátorok",
      "Elágazások és ciklusok",
      "Függvények és hibakezelés",
      "Listák, szótárak, alapvető algoritmusok",
    ],
  },
  {
    tag: "7–12. hét",
    icon: Target,
    title: "Specializációs szakasz",
    lead: "Válaszd a saját célod",
    points: [
      "Ágazati alapvizsga felkészítés",
      "Digitális kultúra érettségi felkészítés",
      "Objektumorientált programozás",
      "Önálló záróprojekt megépítése",
    ],
  },
]

const details = [
  { icon: Calendar, label: "Kezdés", value: "2026. augusztus 24." },
  { icon: Clock, label: "Időpontok", value: "H / Sze / P · 17:00–18:30" },
  { icon: Users, label: "Csoportlétszám", value: "10–15 fő" },
  { icon: GraduationCap, label: "Időtartam", value: "12 hét intenzív" },
]

const curriculum = [
  {
    week: "1–2. hét",
    title: "Első lépések",
    desc: "Fejlesztői környezet, első programok, a Python szintaxis alapjai.",
  },
  {
    week: "3–4. hét",
    title: "Vezérlési szerkezetek",
    desc: "Elágazások, ciklusok és a logikus gondolkodás fejlesztése feladatokon át.",
  },
  {
    week: "5–6. hét",
    title: "Függvények és adatszerkezetek",
    desc: "Újrahasznosítható kód, listák, szótárak és az első nagyobb feladatok.",
  },
  {
    week: "7–9. hét",
    title: "Specializáció",
    desc: "A választott célnak megfelelő elmélyülés: vizsga- vagy érettségi felkészítés.",
  },
  {
    week: "10–11. hét",
    title: "Záróprojekt",
    desc: "Saját program megtervezése és megépítése mentori támogatással.",
  },
  {
    week: "12. hét",
    title: "Próbavizsga",
    desc: "Éles vizsgahelyzet szimulációja és személyre szabott visszajelzés.",
  },
]

const extras = [
  {
    icon: Trophy,
    title: "Próbavizsga a kurzus végén",
    desc: "Valós vizsgakörülmények között mérheted fel a tudásod, mielőtt élesben számít.",
  },
  {
    icon: MessageCircleQuestion,
    title: "6 ingyenes magánóra a korai jelentkezőknek",
    desc: "Aki augusztus 10-ig egy összegben fizet, 6 személyre szabott 1-az-1 magánórát kap ajándékba – ez a bónusz csak ebben a csomagban jár.",
  },
]

const sharedInclusions = [
  "Teljes 12 hetes tanfolyam",
  "Minden tananyag és feladatsor",
  "Próbavizsga a kurzus végén",
]

export default function TanfolyamokPage() {
  return (
    <div className="tabulama-theme">
      {/* Hero */}
      <section className="relative overflow-hidden bg-navy px-4 pb-20 pt-16 text-navy-foreground sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Code2 className="h-4 w-4" />
              Python programozó tanfolyam
            </span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-heading mt-6 text-balance text-4xl font-bold leading-tight sm:text-5xl">
              12 hét alatt a nulláról a magabiztos programozásig
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-navy-foreground/75">
              Intenzív, gyakorlatorientált képzés középiskolásoknak – ágazati
              alapvizsgára és digitális kultúra érettségire hangolva, valós
              projektekkel és próbavizsgával.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/jelentkezes"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
              >
                Jelentkezem
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#arazas"
                className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/25 px-6 py-3 font-semibold text-navy-foreground transition-colors hover:bg-navy-foreground/10"
              >
                Árak megtekintése
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Details strip */}
      <section className="mx-auto -mt-10 max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="grid gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            {details.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <d.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {d.label}
                  </p>
                  <p className="font-medium text-foreground">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Phases */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center">
            <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
              Két szakasz, egy tiszta út
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              A képzés felénél te döntöd el, milyen célra hegyezzük ki a tudásod.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {phases.map((p, i) => (
            <Reveal key={p.title} delay={i * 120}>
              <div className="h-full rounded-3xl border border-border bg-card p-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <p.icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
                    {p.tag}
                  </span>
                </div>
                <h3 className="font-heading mt-6 text-xl font-bold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-1 text-primary">{p.lead}</p>
                <ul className="mt-5 space-y-3">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-3 text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Curriculum timeline */}
      <section className="bg-muted/50 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center">
              <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
                Heti bontás
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                Lépésről lépésre, logikusan felépített tananyag – nincs magolás,
                csak érthető, egymásra épülő tudás.
              </p>
            </div>
          </Reveal>
          <div className="mt-12 space-y-4">
            {curriculum.map((c, i) => (
              <Reveal key={c.week} delay={i * 80}>
                <div className="flex gap-5 rounded-2xl border border-border bg-card p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading font-bold text-foreground">{c.title}</h3>
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                        {c.week}
                      </span>
                    </div>
                    <p className="mt-1 leading-relaxed text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Extras */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {extras.map((e, i) => (
            <Reveal key={e.title} delay={i * 120}>
              <div className="flex h-full items-start gap-5 rounded-3xl border border-border bg-card p-8">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                  <e.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-foreground">{e.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{e.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="arazas" className="bg-navy py-20 text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">
                Árazás és fizetési lehetőségek
              </span>
              <h2 className="font-heading mt-4 text-balance text-3xl font-bold leading-tight sm:text-4xl">
                Most <span className="text-primary">80 000 Ft-tal</span> kedvezőbben
                – <span className="text-primary">6 ajándék magánórával</span>
              </h2>
              <p className="mx-auto mt-4 text-pretty leading-relaxed text-navy-foreground/75">
                Mindhárom fizetési lehetőség ugyanazt a teljes, 12 hetes képzést
                tartalmazza. A 6 ajándék magánóra kizárólag a 2026. augusztus 10-ig
                egy összegben befizetett korai ajánlathoz jár.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-5">
            {/* Highlighted early-bird offer */}
            <Reveal className="lg:col-span-3">
              <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border-2 border-primary bg-secondary p-6 text-foreground shadow-xl sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                    <Star className="h-3.5 w-3.5" />
                    Legjobb ajánlat
                  </span>
                </div>

                <h3 className="font-heading mt-5 text-2xl font-bold">
                  Korai egyösszegű befizetés
                </h3>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary">
                    <TrendingDown className="h-4 w-4" />
                    80 000 Ft megtakarítás
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-sm font-semibold text-primary">
                    <Gift className="h-4 w-4" />
                    6 ajándék magánóra
                  </span>
                </div>

                <div className="mt-6">
                  <p className="text-sm text-muted-foreground line-through decoration-muted-foreground/60">
                    Normál egyösszegű díj: 330 000 Ft
                  </p>
                  <p className="font-heading mt-1 text-5xl font-extrabold tabular-nums text-primary">
                    250 000 Ft
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground/70">
                    egyszeri befizetés
                  </p>
                </div>

                <div className="mt-6 rounded-2xl border-l-4 border-primary bg-primary/10 px-5 py-4">
                  <p className="font-medium text-foreground">
                    Kizárólag ehhez az ajánlathoz jár 6 egyéni magánóra ajándékba.
                  </p>
                </div>

                <div className="mt-6 rounded-2xl border border-primary/20 bg-card/60 p-5">
                  <p className="text-center text-sm font-semibold uppercase tracking-wide text-foreground/80">
                    A korai ajánlatból hátralévő idő
                  </p>
                  <div className="mt-4">
                    <Countdown
                      target={EARLY_BIRD_DEADLINE}
                      expiredLabel="A korai ajánlat lejárt."
                    />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-foreground/75">
                    A kedvezmény feltétele, hogy a teljes 250 000 Ft-os részvételi
                    díj legkésőbb 2026. augusztus 10-ig beérkezzen. A jelentkezés
                    önmagában nem jogosít a kedvezményes árra és a 6 ajándék
                    magánórára.
                  </p>
                </div>

                <Link
                  href="/jelentkezes?csomag=korai"
                  className="mt-8 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
                >
                  A korai ajánlatot választom
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            </Reveal>

            {/* Alternative payment methods */}
            <div className="flex flex-col gap-6 lg:col-span-2">
              <Reveal delay={120} className="h-full">
                <article className="flex h-full flex-col rounded-3xl border border-navy-foreground/15 bg-navy-foreground/5 p-6 sm:p-7">
                  <h3 className="font-heading text-lg font-bold text-navy-foreground">
                    Normál egyösszegű befizetés
                  </h3>
                  <p className="font-heading mt-3 text-3xl font-bold tabular-nums text-navy-foreground">
                    330 000 Ft
                  </p>
                  <p className="mt-1 text-sm text-navy-foreground/60">egyszeri befizetés</p>
                  <p className="mt-3 leading-relaxed text-navy-foreground/75">
                    Augusztus 10. utáni egyösszegű befizetés esetén.
                  </p>
                  <Link
                    href="/jelentkezes?csomag=normal"
                    className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-navy-foreground/25 px-5 py-2.5 font-semibold text-navy-foreground transition-colors hover:bg-navy-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                  >
                    Az egyösszegű fizetést választom
                  </Link>
                  <p className="mt-4 border-t border-navy-foreground/10 pt-4 text-sm text-navy-foreground/60">
                    A 6 ajándék magánórát nem tartalmazza.
                  </p>
                </article>
              </Reveal>

              <Reveal delay={200} className="h-full">
                <article className="flex h-full flex-col rounded-3xl border border-navy-foreground/15 bg-navy-foreground/5 p-6 sm:p-7">
                  <h3 className="font-heading text-lg font-bold text-navy-foreground">
                    Részletfizetés
                  </h3>
                  <p className="font-heading mt-3 text-3xl font-bold tabular-nums text-navy-foreground">
                    3 × 120 000 Ft
                  </p>
                  <p className="mt-1 text-sm text-navy-foreground/60 tabular-nums">
                    360 000 Ft összesen
                  </p>
                  <p className="mt-3 leading-relaxed text-navy-foreground/75">
                    Az első részlet befizetési határideje: 2026. augusztus 24.
                  </p>
                  <Link
                    href="/jelentkezes?csomag=reszlet"
                    className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-navy-foreground/25 px-5 py-2.5 font-semibold text-navy-foreground transition-colors hover:bg-navy-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
                  >
                    A részletfizetést választom
                  </Link>
                  <p className="mt-4 border-t border-navy-foreground/10 pt-4 text-sm text-navy-foreground/60">
                    A 6 ajándék magánórát nem tartalmazza.
                  </p>
                </article>
              </Reveal>
            </div>
          </div>

          {/* Shared inclusions */}
          <Reveal delay={150}>
            <div className="mt-6 rounded-3xl border border-navy-foreground/15 bg-navy-foreground/5 p-8">
              <h3 className="font-heading text-center text-lg font-bold text-navy-foreground">
                Mindhárom fizetési lehetőség tartalmazza
              </h3>
              <ul className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
                {sharedInclusions.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-2xl bg-navy-foreground/5 px-4 py-3"
                  >
                    <Check className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-navy-foreground/85">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Application call-to-action */}
      <section id="jelentkezes" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-3xl border border-border bg-card p-8 text-center sm:p-10">
            <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
              Jelentkezés a tanfolyamra
            </h2>
            <p className="mx-auto mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground">
              A jelentkezés néhány perc alatt kitölthető, lépésről lépésre
              vezető űrlapon. A végén e-mailben visszaigazoljuk. Jelentkezési
              határidő: 2026. augusztus 21. 20:00.
            </p>
            <Link
              href="/jelentkezes"
              className="mt-8 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-base font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Jelentkezem
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
