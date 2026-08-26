import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CalendarDays, CheckCircle2, Clock, GraduationCap, Users } from 'lucide-react'
import { buildCoursePaymentOptions } from '@/lib/course-payment-options'
import { courseAcceptsApplications, getPublicCourseBySlug } from '@/lib/course-repository'
import { formatHUF, formatHuDate, formatHuDateTime } from '@/lib/tabulama-config'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const course = await getPublicCourseBySlug(slug)
  return course ? { title: `${course.shortTitle} | TabuLama`, description: course.summary } : { title: 'Kurzus nem található | TabuLama' }
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const course = await getPublicCourseBySlug(slug)
  if (!course) notFound()
  const accepting = courseAcceptsApplications(course)
  const options = buildCoursePaymentOptions(course)
  const paymentOptions = [options['early-bird'], options.standard, options.installment].filter((option) => option !== null)
  const syllabus = course.syllabus?.split('\n').map((item) => item.trim()).filter(Boolean) ?? []

  return <div>
    <section className="relative overflow-hidden bg-navy px-4 py-16 text-navy-foreground sm:px-6 sm:py-24"><div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(189,139,60,.22),transparent_45%)]" /><div className="relative mx-auto max-w-4xl"><span className="inline-flex rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">{course.category}</span><h1 className="font-heading mt-6 text-balance text-4xl font-extrabold sm:text-5xl">{course.title}</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-navy-foreground/75">{course.summary}</p>{accepting ? <Link href={`/jelentkezes?course=${encodeURIComponent(course.slug)}`} className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground">Jelentkezem <ArrowRight className="h-4 w-4" /></Link> : <p className="mt-8 inline-flex rounded-full border border-navy-foreground/20 px-5 py-3 font-semibold">{course.status === 'full' || course.remainingCapacity === 0 ? 'A kurzus betelt' : 'A jelentkezés jelenleg zárva'}</p>}</div></section>
    <section className="mx-auto -mt-7 max-w-5xl px-4 sm:px-6"><div className="grid gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4"><Fact icon={CalendarDays} label="Időszak" value={course.startDate ? `${formatHuDate(course.startDate)}${course.endDate ? ` – ${formatHuDate(course.endDate)}` : ''}` : 'Egyeztetés alatt'} /><Fact icon={Clock} label="Heti időpontok" value={course.weeklySchedule ?? 'Egyeztetés alatt'} /><Fact icon={Users} label="Férőhely" value={course.maxCapacity === null ? `${course.currentHeadcount} fő` : `${course.remainingCapacity} szabad / ${course.maxCapacity}`} /><Fact icon={GraduationCap} label="Oktató" value={course.instructorName ?? 'Hamarosan'} /></div></section>
    <section className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.4fr_1fr]"><div><h2 className="font-heading text-3xl font-bold">A kurzusról</h2><div className="mt-5 whitespace-pre-line leading-relaxed text-muted-foreground">{course.description}</div>{course.targetAudience ? <><h3 className="font-heading mt-9 text-xl font-bold">Kinek szól?</h3><p className="mt-3 leading-relaxed text-muted-foreground">{course.targetAudience}</p></> : null}{course.prerequisites ? <><h3 className="font-heading mt-7 text-xl font-bold">Előfeltételek</h3><p className="mt-3 leading-relaxed text-muted-foreground">{course.prerequisites}</p></> : null}</div><aside className="rounded-3xl border border-border bg-secondary/40 p-6"><h2 className="font-heading text-xl font-bold">Jelentkezési állapot</h2><p className="mt-3 text-muted-foreground">{accepting ? 'A jelentkezés nyitva.' : 'A jelentkezés jelenleg nem elérhető.'}</p>{course.applicationDeadline ? <p className="mt-3 text-sm text-muted-foreground">Határidő: {formatHuDateTime(course.applicationDeadline)}</p> : null}<p className="mt-4 font-semibold">{course.remainingCapacity === null ? 'Nincs létszámkorlát megadva.' : `${course.remainingCapacity} szabad hely maradt.`}</p></aside></section>
    {syllabus.length ? <section className="bg-muted/50 py-16"><div className="mx-auto max-w-4xl px-4 sm:px-6"><h2 className="font-heading text-center text-3xl font-bold">Tematika</h2><ol className="mt-9 grid gap-4">{syllabus.map((item, index) => <li key={`${index}-${item}`} className="flex gap-4 rounded-2xl border border-border bg-card p-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">{index + 1}</span><span className="pt-1.5 text-muted-foreground">{item}</span></li>)}</ol></div></section> : null}
    <section className="bg-navy py-16 text-navy-foreground"><div className="mx-auto max-w-5xl px-4 sm:px-6"><h2 className="font-heading text-center text-3xl font-bold">Árak és fizetési lehetőségek</h2><div className="mt-9 grid gap-5 md:grid-cols-3">{paymentOptions.map((option) => <article key={option.key} className={`rounded-3xl border p-6 ${option.available ? 'border-navy-foreground/15 bg-navy-foreground/5' : 'border-navy-foreground/10 bg-navy-foreground/[.03] opacity-60'}`}><h3 className="font-heading text-lg font-bold">{option.name}</h3><p className="font-heading mt-3 text-3xl font-extrabold text-primary">{formatHUF(option.total)}</p>{option.installmentCount && option.installmentAmount ? <p className="mt-1 text-sm text-navy-foreground/65">{option.installmentCount} × {formatHUF(option.installmentAmount)}</p> : null}<p className="mt-4 text-sm leading-relaxed text-navy-foreground/70">{option.description}</p>{option.dueDates.some(Boolean) ? <ul className="mt-4 space-y-1 text-sm text-navy-foreground/65">{option.dueDates.map((date, index) => <li key={index}>{index + 1}. határidő: {date ? formatHuDate(date) : 'egyeztetés alatt'}</li>)}</ul> : null}{accepting && option.available ? <Link href={`/jelentkezes?course=${encodeURIComponent(course.slug)}&csomag=${encodeURIComponent(option.key)}`} className="mt-6 inline-flex rounded-full border border-primary/60 px-4 py-2.5 text-sm font-bold text-primary">Ezt választom</Link> : null}</article>)}</div></div></section>
  </div>
}

function Fact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="flex gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><Icon className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div></div>
}
