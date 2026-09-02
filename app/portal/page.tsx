import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  PlayCircle,
  ReceiptText,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { getStudentDashboard, type ModuleProgressStatus } from '@/lib/student-repository'
import { listStudentSessionsForWeek } from '@/lib/course-session-repository'
import { StudentWeeklySessions } from '@/components/portal/student-weekly-sessions'
import { formatHUF, formatHuDate } from '@/lib/tabulama-config'
import { COURSE_STATUS_LABELS, type CourseStatus } from '@/lib/course-repository'

export const dynamic = 'force-dynamic'

const progressLabels: Record<ModuleProgressStatus, string> = {
  upcoming: 'Következik',
  in_progress: 'Folyamatban',
  completed: 'Teljesítve',
}

const paymentLabels: Record<string, string> = {
  pending: 'Fizetésre vár', partially_paid: 'Részben fizetve', paid: 'Fizetve',
  overdue: 'Lejárt', cancelled: 'Törölve',
}

const views = [
  { id: 'overview', label: 'Áttekintés', icon: LayoutDashboard },
  { id: 'courses', label: 'Kurzusok', icon: GraduationCap },
  { id: 'progress', label: 'Előrehaladás', icon: TrendingUp },
  { id: 'sessions', label: 'Órák', icon: CalendarDays },
  { id: 'materials', label: 'Tananyagok', icon: BookOpen },
  { id: 'tasks', label: 'Feladatok', icon: ClipboardList },
  { id: 'finance', label: 'Pénzügyek', icon: ReceiptText },
  { id: 'profile', label: 'Saját adatok', icon: UserRound },
] as const

type ViewId = (typeof views)[number]['id']

function ProgressIcon({ status }: { status: ModuleProgressStatus }) {
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />
  if (status === 'in_progress') return <PlayCircle className="h-5 w-5 text-primary" />
  return <Circle className="h-5 w-5 text-muted-foreground" />
}

export default async function StudentPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; course?: string; week?: string }>
}) {
  const [session, query] = await Promise.all([requireStudent('/portal'), searchParams])
  const [student, weeklySessions] = await Promise.all([
    getStudentDashboard(session.userId),
    listStudentSessionsForWeek(session.userId, query.week),
  ])
  if (!student) redirect('/login?error=inactive')

  const requestedView = query.view as ViewId | undefined
  const view: ViewId = views.some((item) => item.id === requestedView) ? requestedView! : 'overview'
  const selectedEnrollment = student.enrollments.find((item) => item.id === query.course) ?? student.enrollments[0] ?? null
  const activeEnrollments = student.enrollments.filter((item) => item.status === 'active')
  const averageProgress = student.enrollments.length
    ? Math.round(student.enrollments.reduce((sum, item) => sum + item.progressPercent, 0) / student.enrollments.length)
    : 0
  const outstanding = student.enrollments.reduce((sum, item) => sum + (item.payment?.remainingAmountHuf ?? 0), 0)

  return (
    <div className="bg-muted/35 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Diákportál</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Szia, {student.fullName}!</h1><p className="mt-2 font-mono text-sm text-muted-foreground">{student.studentNumber}</p></div>
          <form action="/api/session/logout" method="post"><button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-accent"><LogOut className="h-4 w-4" />Kijelentkezés</button></form>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="self-start rounded-2xl border border-border bg-card p-2 shadow-sm lg:sticky lg:top-6">
            <nav aria-label="Diákportál funkciók" className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
              {views.map((item) => {
                const active = item.id === view
                return <Link key={item.id} href={`/portal?view=${item.id}`} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-[#1b2430] text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}><item.icon className="h-4 w-4" />{item.label}</Link>
              })}
            </nav>
          </aside>

          <main className="min-w-0">
            {view === 'overview' ? (
              <div className="space-y-6">
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Aktív kurzusok</p><p className="mt-2 text-3xl font-extrabold">{activeEnrollments.length}</p></div>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Átlagos haladás</p><p className="mt-2 text-3xl font-extrabold">{averageProgress}%</p></div>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Fennmaradó összeg</p><p className="mt-2 text-2xl font-extrabold">{formatHUF(outstanding)}</p></div>
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Következő tananyag</p><p className="mt-2 font-bold">{activeEnrollments[0]?.nextModule?.title ?? activeEnrollments[0]?.currentModule?.title ?? '—'}</p></div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Aktuális kurzusok</h2><p className="mt-1 text-sm text-muted-foreground">A legfontosabb állapotok egy helyen.</p></div><Link href="/portal?view=courses" className="text-sm font-bold text-primary hover:underline">Összes kurzus</Link></div>
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">{activeEnrollments.slice(0, 4).map((enrollment) => <div key={enrollment.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-bold">{enrollment.course.shortTitle}</p><p className="mt-1 text-sm text-muted-foreground">{enrollment.currentModule?.title ?? 'Még nem kezdődött el'}</p></div><strong>{enrollment.progressPercent}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${enrollment.progressPercent}%` }} /></div></div>)}</div>
                  {!activeEnrollments.length ? <p className="mt-4 text-sm text-muted-foreground">Jelenleg nincs aktív kurzusod.</p> : null}
                </section>
              </div>
            ) : null}

            {view === 'courses' ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {student.enrollments.map((enrollment) => <article key={enrollment.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">{COURSE_STATUS_LABELS[enrollment.course.status as CourseStatus] ?? enrollment.course.status}</p><h2 className="mt-2 text-lg font-bold">{enrollment.course.title}</h2>{enrollment.course.startDate ? <p className="mt-2 text-sm text-muted-foreground">{formatHuDate(enrollment.course.startDate)}{enrollment.course.endDate ? ` – ${formatHuDate(enrollment.course.endDate)}` : ''}</p> : null}</div><strong className="text-lg">{enrollment.progressPercent}%</strong></div><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${enrollment.progressPercent}%` }} /></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Aktuális tananyag</dt><dd className="font-semibold">{enrollment.currentModule?.title ?? 'Még nem kezdődött el'}</dd></div><div><dt className="text-muted-foreground">Következő</dt><dd className="font-semibold">{enrollment.nextModule?.title ?? '—'}</dd></div></dl><div className="mt-5 flex flex-wrap gap-4"><Link href={`/portal?view=progress&course=${enrollment.id}`} className="text-sm font-bold text-primary hover:underline">Részletes haladás</Link><Link href={`/kurzusok/${enrollment.course.slug}`} className="text-sm font-semibold text-muted-foreground hover:underline">Kurzusoldal</Link></div></article>)}
                {!student.enrollments.length ? <p className="text-sm text-muted-foreground">Még nincs kurzusod.</p> : null}
              </div>
            ) : null}

            {view === 'progress' ? (
              <div className="space-y-5">
                <section className="rounded-2xl border border-border bg-card p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Kurzus kiválasztása</p><div className="mt-3 flex flex-wrap gap-2">{student.enrollments.map((enrollment) => <Link key={enrollment.id} href={`/portal?view=progress&course=${enrollment.id}`} className={`rounded-lg px-3 py-2 text-sm font-bold ${selectedEnrollment?.id === enrollment.id ? 'bg-[#1b2430] text-white' : 'bg-muted text-foreground hover:bg-accent'}`}>{enrollment.course.shortTitle}</Link>)}</div></section>
                {selectedEnrollment ? <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{selectedEnrollment.course.title}</h2><p className="mt-1 text-sm text-muted-foreground">Aktuális: {selectedEnrollment.currentModule?.title ?? 'még nincs'} · Következő: {selectedEnrollment.nextModule?.title ?? 'nincs'}</p></div><strong className="text-lg">{selectedEnrollment.progressPercent}%</strong></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${selectedEnrollment.progressPercent}%` }} /></div><ol className="mt-6 space-y-3">{selectedEnrollment.modules.map((module) => <li key={module.id} className="flex items-start gap-3 rounded-xl border border-border p-4"><ProgressIcon status={module.progressStatus} /><div><p className="font-semibold">{module.position}. {module.title}</p><p className="mt-1 text-sm text-muted-foreground">{progressLabels[module.progressStatus]}{module.topic ? ` · ${module.topic}` : ''}</p></div></li>)}</ol></section> : <section className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">Nincs kiválasztható kurzus.</section>}
              </div>
            ) : null}

            {view === 'sessions' ? <StudentWeeklySessions weekStart={weeklySessions.weekStart} sessions={weeklySessions.sessions} /> : null}

            {view === 'materials' ? <div className="grid gap-4 xl:grid-cols-2">{student.enrollments.map((enrollment) => <section key={enrollment.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="font-bold">{enrollment.course.shortTitle}</h2><p className="mt-3 text-sm text-muted-foreground">Aktuális tananyagegység</p><p className="mt-1 font-semibold">{enrollment.currentModule?.title ?? 'Még nincs aktuális tananyag'}</p><p className="mt-3 text-sm text-muted-foreground">A későbbi leckék, videók, gyakorlóanyagok és GitHub-anyagok ehhez a haladási ponthoz kapcsolódhatnak.</p></section>)}</div> : null}

            {view === 'tasks' ? <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">Feladatok</h2><p className="mt-2 text-sm text-muted-foreground">Itt jelennek majd meg a kurzusodhoz és az aktuális tananyagegységhez kapcsolódó feladatok. A rendszer most nem épít külön teljes LMS-t.</p></section> : null}

            {view === 'finance' ? <div className="space-y-5">{student.enrollments.map((enrollment) => <section key={enrollment.id} className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="text-lg font-bold">{enrollment.course.shortTitle}</h2>{enrollment.payment ? <><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4"><div><dt className="text-muted-foreground">Konstrukció</dt><dd className="font-semibold">{enrollment.payment.packageName}</dd></div><div><dt className="text-muted-foreground">Teljes díj</dt><dd className="font-bold">{formatHUF(enrollment.payment.totalAmountHuf)}</dd></div><div><dt className="text-muted-foreground">Befizetve</dt><dd className="font-bold text-emerald-700">{formatHUF(enrollment.payment.paidAmountHuf)}</dd></div><div><dt className="text-muted-foreground">Hátralék</dt><dd className="font-bold text-orange-700">{formatHUF(enrollment.payment.remainingAmountHuf)}</dd></div></dl><ol className="mt-5 space-y-2">{enrollment.payment.items.map((item) => <li key={item.id} className="rounded-xl border border-border px-4 py-3 text-sm"><div className="flex justify-between gap-3"><strong>{enrollment.payment!.installmentCount === 1 ? 'Egyösszegű díj' : `${item.position}. részlet`}</strong><span>{paymentLabels[item.status] ?? item.status}</span></div><p className="mt-1 text-muted-foreground">{formatHUF(item.amountHuf)} · befizetve {formatHUF(item.paidAmountHuf)}{item.dueAt ? ` · ${formatHuDate(item.dueAt)}` : ''}</p></li>)}</ol></> : <p className="mt-3 text-sm text-muted-foreground">Ehhez a kurzushoz nincs fizetési terv.</p>}</section>)}</div> : null}

            {view === 'profile' ? <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="text-xl font-bold">Saját adatok</h2><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Név</dt><dd className="font-semibold">{student.fullName}</dd></div><div><dt className="text-muted-foreground">Diákazonosító</dt><dd className="font-mono font-semibold">{student.studentNumber}</dd></div><div><dt className="text-muted-foreground">E-mail</dt><dd className="font-semibold">{student.email}</dd></div><div><dt className="text-muted-foreground">Telefon</dt><dd className="font-semibold">{student.phone ?? '—'}</dd></div></dl></section> : null}
          </main>
        </div>
      </div>
    </div>
  )
}
