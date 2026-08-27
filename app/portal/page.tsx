import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  LogOut,
  PlayCircle,
  ReceiptText,
  UserRound,
} from 'lucide-react'
import { requireStudent } from '@/lib/auth'
import { getStudentDashboard, type ModuleProgressStatus } from '@/lib/student-repository'
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

function ProgressIcon({ status }: { status: ModuleProgressStatus }) {
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />
  if (status === 'in_progress') return <PlayCircle className="h-5 w-5 text-primary" />
  return <Circle className="h-5 w-5 text-muted-foreground" />
}

export default async function StudentPortalPage() {
  const session = await requireStudent('/portal')
  const student = await getStudentDashboard(session.userId)
  if (!student) redirect('/login?error=inactive')

  return (
    <div className="bg-muted/35 py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Diákportál</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Szia, {student.fullName}!</h1><p className="mt-2 font-mono text-sm text-muted-foreground">{student.studentNumber}</p></div>
          <form action="/api/session/logout" method="post"><button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-bold hover:bg-accent"><LogOut className="h-4 w-4" />Kijelentkezés</button></form>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold"><UserRound className="h-5 w-5 text-primary" />Saját profil</h2><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-muted-foreground">Név</dt><dd className="font-semibold">{student.fullName}</dd></div><div><dt className="text-muted-foreground">E-mail</dt><dd className="font-semibold">{student.email}</dd></div><div><dt className="text-muted-foreground">Diákazonosító</dt><dd className="font-mono font-semibold">{student.studentNumber}</dd></div></dl></div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold"><BookOpen className="h-5 w-5 text-primary" />Kurzusaim</h2><p className="mt-4 text-3xl font-extrabold">{student.enrollments.length}</p><p className="text-sm text-muted-foreground">aktív vagy korábbi beiratkozás</p></div>
        </section>

        <div className="mt-8 space-y-8">
          {student.enrollments.map((enrollment) => (
            <article key={enrollment.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
              <div className="bg-[#1b2430] p-6 text-white sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-[#d7b16f]">{COURSE_STATUS_LABELS[enrollment.course.status as CourseStatus] ?? enrollment.course.status}</p><h2 className="mt-2 text-2xl font-bold">{enrollment.course.title}</h2><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">{enrollment.course.startDate ? <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatHuDate(enrollment.course.startDate)}{enrollment.course.endDate ? ` – ${formatHuDate(enrollment.course.endDate)}` : ''}</span> : null}{enrollment.course.weeklySchedule ? <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{enrollment.course.weeklySchedule}</span> : null}</div></div><Link href={`/kurzusok/${enrollment.course.slug}`} className="text-sm font-semibold text-[#d7b16f] hover:underline">Kurzusoldal</Link></div><div className="mt-6"><div className="flex items-center justify-between text-sm font-semibold"><span>Kurzus előrehaladás</span><span>{enrollment.progressPercent}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-white/15" aria-label={`Kurzus előrehaladás: ${enrollment.progressPercent}%`}><div className="h-full rounded-full bg-[#d7b16f]" style={{ width: `${enrollment.progressPercent}%` }} /></div></div></div>

              <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.25fr_1fr]">
                <section><h3 className="text-lg font-bold">Modulok</h3>{enrollment.modules.length ? <ol className="mt-4 space-y-3">{enrollment.modules.map((module) => <li key={module.id} className="flex items-start gap-3 rounded-xl border border-border p-4"><ProgressIcon status={module.progressStatus} /><div><p className="font-semibold">{module.position}. {module.title}</p><p className="mt-1 text-sm text-muted-foreground">{progressLabels[module.progressStatus]}{module.topic ? ` · ${module.topic}` : ''}</p></div></li>)}</ol> : <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">A kurzus moduljai hamarosan megjelennek.</p>}
                  <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-accent p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Aktuális modul</p><p className="mt-1 font-bold">{enrollment.currentModule?.title ?? 'Nincs aktuális modul'}</p></div><div className="rounded-xl bg-muted p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Következő modul</p><p className="mt-1 font-bold">{enrollment.nextModule?.title ?? 'Nincs következő modul'}</p></div></div>
                </section>

                <section><h3 className="flex items-center gap-2 text-lg font-bold"><ReceiptText className="h-5 w-5 text-primary" />Pénzügy</h3>{enrollment.payment ? <><dl className="mt-4 space-y-3 rounded-2xl bg-muted/60 p-5 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Konstrukció</dt><dd className="text-right font-semibold">{enrollment.payment.packageName}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Teljes díj</dt><dd className="font-bold">{formatHUF(enrollment.payment.totalAmountHuf)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Befizetve</dt><dd className="font-bold text-emerald-700">{formatHUF(enrollment.payment.paidAmountHuf)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Hátralék</dt><dd className="font-bold text-orange-700">{formatHUF(enrollment.payment.remainingAmountHuf)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Státusz</dt><dd className="font-semibold">{paymentLabels[enrollment.payment.status] ?? enrollment.payment.status}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Következő határidő</dt><dd className="font-semibold">{enrollment.payment.nextDueAt ? formatHuDate(enrollment.payment.nextDueAt) : 'nincs'}</dd></div></dl><ol className="mt-4 space-y-2">{enrollment.payment.items.map((item) => <li key={item.id} className="rounded-xl border border-border px-4 py-3 text-sm"><div className="flex justify-between gap-3"><strong>{enrollment.payment!.installmentCount === 1 ? 'Egyösszegű díj' : `${item.position}. részlet`}</strong><span>{paymentLabels[item.status] ?? item.status}</span></div><p className="mt-1 text-muted-foreground">{formatHUF(item.amountHuf)} · befizetve {formatHUF(item.paidAmountHuf)}{item.dueAt ? ` · ${formatHuDate(item.dueAt)}` : ''}</p></li>)}</ol></> : <p className="mt-4 text-sm text-muted-foreground">Ehhez a beiratkozáshoz nincs fizetési terv.</p>}</section>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
