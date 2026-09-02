import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  PlayCircle,
  ReceiptText,
  Settings2,
  TrendingUp,
} from 'lucide-react'
import { formatAdminDay } from '@/lib/admin-display'
import { listCourses } from '@/lib/course-repository'
import { formatHUF } from '@/lib/tabulama-config'
import { getAdminStudentById, MODULE_PROGRESS_STATUSES, type ModuleProgressStatus } from '@/lib/student-repository'
import {
  adjustStudentProgressAction,
  assignStudentCourseAction,
  resendStudentActivationAction,
  updateStudentProgressAction,
} from '../actions'

export const dynamic = 'force-dynamic'

const accountLabels = { pending: 'Nincs aktiválva', active: 'Aktív', disabled: 'Inaktív' }
const progressLabels: Record<ModuleProgressStatus, string> = { upcoming: 'Következik', in_progress: 'Folyamatban', completed: 'Teljesítve' }
const enrollmentLabels: Record<string, string> = { pending: 'Függőben', active: 'Aktív', completed: 'Befejezett', withdrawn: 'Kilépett' }
const successMessages: Record<string, string> = {
  progress_updated: 'A haladás frissült.',
  activation_sent: 'Az aktiváló e-mail elküldve.',
  course_assigned: 'A diák hozzá lett rendelve a kurzushoz.',
}
const errorMessages: Record<string, string> = {
  invalid_form: 'Hibás adatok.',
  save_failed: 'A módosítás nem menthető.',
  activation_unavailable: 'Aktív fiókhoz nincs szükség új aktiváló linkre.',
  activation_failed: 'Az aktiváló e-mail nem küldhető el.',
  course_full: 'A kiválasztott kurzus betelt.',
  course_assign_failed: 'A kurzus-hozzárendelés nem sikerült.',
}

const views = [
  { id: 'overview', label: 'Áttekintés', icon: LayoutDashboard },
  { id: 'courses', label: 'Kurzusok', icon: GraduationCap },
  { id: 'progress', label: 'Előrehaladás', icon: TrendingUp },
  { id: 'sessions', label: 'Órák / alkalmak', icon: CalendarDays },
  { id: 'materials', label: 'Tananyagok', icon: BookOpen },
  { id: 'tasks', label: 'Feladatok', icon: ClipboardList },
  { id: 'admin', label: 'Adminisztráció', icon: Settings2 },
  { id: 'finance', label: 'Pénzügyek', icon: ReceiptText },
  { id: 'documents', label: 'Dokumentumok / megjegyzések', icon: FileText },
] as const

type ViewId = (typeof views)[number]['id']

function ProgressIcon({ status }: { status: ModuleProgressStatus }) {
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-emerald-600" />
  if (status === 'in_progress') return <PlayCircle className="h-5 w-5 text-[#9b6e2f]" />
  return <Circle className="h-5 w-5 text-slate-400" />
}

export default async function StudentDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; error?: string; view?: string; course?: string }>
}) {
  const [{ id }, feedback] = await Promise.all([params, searchParams])
  const [student, courses] = await Promise.all([getAdminStudentById(id), listCourses()])
  if (!student) notFound()

  const requestedView = feedback.view as ViewId | undefined
  const view: ViewId = views.some((item) => item.id === requestedView) ? requestedView! : 'overview'
  const selectedEnrollment = student.enrollments.find((item) => item.id === feedback.course) ?? student.enrollments[0] ?? null
  const activeEnrollments = student.enrollments.filter((item) => item.status === 'active')
  const enrolledCourseIds = new Set(student.enrollments.map((item) => item.course.id))
  const availableCourses = courses.filter((course) => course.status !== 'archived' && !enrolledCourseIds.has(course.id))
  const averageProgress = student.enrollments.length
    ? Math.round(student.enrollments.reduce((sum, item) => sum + item.progressPercent, 0) / student.enrollments.length)
    : 0
  const outstanding = student.enrollments.reduce((sum, item) => sum + (item.payment?.remainingAmountHuf ?? 0), 0)

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/admin/diakok" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"><ArrowLeft className="h-4 w-4" />Vissza a diákokhoz</Link>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">{student.fullName}</h1><p className="mt-2 font-mono text-sm text-slate-500">{student.studentNumber}</p></div>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold">{accountLabels[student.accountStatus]}</span>
      </div>

      {feedback.success ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{successMessages[feedback.success] ?? 'A módosítás elmentve.'}</p> : null}
      {feedback.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">{errorMessages[feedback.error] ?? 'A művelet nem hajtható végre.'}</p> : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-6">
          <nav aria-label="Diákprofil funkciók" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {views.map((item) => {
              const active = item.id === view
              return <Link key={item.id} href={`/admin/diakok/${student.id}?view=${item.id}`} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-[#1b2430] text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><item.icon className="h-4 w-4" />{item.label}</Link>
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {view === 'overview' ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Aktív kurzusok</p><p className="mt-2 text-3xl font-bold">{activeEnrollments.length}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Átlagos haladás</p><p className="mt-2 text-3xl font-bold">{averageProgress}%</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Fennmaradó összeg</p><p className="mt-2 text-2xl font-bold">{formatHUF(outstanding)}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Következő tananyag</p><p className="mt-2 font-bold">{activeEnrollments[0]?.nextModule?.title ?? activeEnrollments[0]?.currentModule?.title ?? '—'}</p></div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold">Aktuális kurzusok</h2><p className="mt-1 text-sm text-slate-500">Csak a döntéshez szükséges fő adatok.</p></div><Link href={`/admin/diakok/${student.id}?view=courses`} className="text-sm font-bold text-[#8b642b] hover:underline">Összes kurzus</Link></div>
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {activeEnrollments.slice(0, 4).map((enrollment) => <div key={enrollment.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-bold">{enrollment.course.shortTitle}</p><p className="mt-1 text-sm text-slate-500">{enrollment.currentModule?.title ?? 'Még nem kezdte el'}</p></div><strong>{enrollment.progressPercent}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#bd8b3c]" style={{ width: `${enrollment.progressPercent}%` }} /></div></div>)}
                  {!activeEnrollments.length ? <p className="text-sm text-slate-500">Nincs aktív kurzus.</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          {view === 'courses' ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-bold">Kurzus hozzárendelése</h2>
                <p className="mt-1 text-sm text-slate-500">A diák több kurzushoz is hozzárendelhető; minden kurzushoz külön haladás tartozik.</p>
                {availableCourses.length ? <form action={assignStudentCourseAction} className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="hidden" name="studentId" value={student.id} /><select name="courseId" required defaultValue="" className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="" disabled>Válassz kurzust…</option>{availableCourses.map((course) => <option key={course.id} value={course.id}>{course.shortTitle}</option>)}</select><button type="submit" className="rounded-lg bg-[#1b2430] px-4 py-2.5 text-sm font-bold text-white">Hozzárendelés</button></form> : <p className="mt-4 text-sm font-semibold text-slate-500">Nincs további hozzárendelhető kurzus.</p>}
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                {student.enrollments.map((enrollment) => <article key={enrollment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{enrollmentLabels[enrollment.status] ?? enrollment.status}</span><h2 className="mt-3 text-lg font-bold">{enrollment.course.title}</h2><p className="mt-1 text-sm text-slate-500">Kezdés: {enrollment.course.startDate ? formatAdminDay(enrollment.course.startDate) : '—'}</p></div><strong className="text-lg">{enrollment.progressPercent}%</strong></div><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#bd8b3c]" style={{ width: `${enrollment.progressPercent}%` }} /></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Aktuális tananyag</dt><dd className="font-semibold">{enrollment.currentModule?.title ?? 'Még nem kezdte el'}</dd></div><div><dt className="text-slate-500">Következő</dt><dd className="font-semibold">{enrollment.nextModule?.title ?? '—'}</dd></div></dl><Link href={`/admin/diakok/${student.id}?view=progress&course=${enrollment.id}`} className="mt-5 inline-flex text-sm font-bold text-[#8b642b] hover:underline">Részletes előrehaladás</Link></article>)}
                {!student.enrollments.length ? <p className="text-sm text-slate-500">A tanuló még nincs kurzushoz rendelve.</p> : null}
              </div>
            </div>
          ) : null}

          {view === 'progress' ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kurzus kiválasztása</p>
                <div className="mt-3 flex flex-wrap gap-2">{student.enrollments.map((enrollment) => <Link key={enrollment.id} href={`/admin/diakok/${student.id}?view=progress&course=${enrollment.id}`} className={`rounded-lg px-3 py-2 text-sm font-bold ${selectedEnrollment?.id === enrollment.id ? 'bg-[#1b2430] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{enrollment.course.shortTitle}</Link>)}</div>
              </section>

              {selectedEnrollment ? <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{selectedEnrollment.course.title}</h2><p className="mt-1 text-sm text-slate-500">Aktuális: {selectedEnrollment.currentModule?.title ?? 'még nincs'} · Következő: {selectedEnrollment.nextModule?.title ?? 'nincs'}</p></div><strong className="text-lg">{selectedEnrollment.progressPercent}%</strong></div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#bd8b3c]" style={{ width: `${selectedEnrollment.progressPercent}%` }} /></div>

                <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-[auto_1fr_auto] lg:items-end">
                  <form action={adjustStudentProgressAction}>
                    <input type="hidden" name="studentId" value={student.id} /><input type="hidden" name="enrollmentId" value={selectedEnrollment.id} /><input type="hidden" name="courseId" value={selectedEnrollment.course.id} /><input type="hidden" name="operation" value="advance" />
                    <button type="submit" className="w-full rounded-lg bg-[#1b2430] px-4 py-2.5 text-sm font-bold text-white">Következő tananyagegységre</button>
                  </form>
                  <form action={adjustStudentProgressAction} className="contents">
                    <input type="hidden" name="studentId" value={student.id} /><input type="hidden" name="enrollmentId" value={selectedEnrollment.id} /><input type="hidden" name="courseId" value={selectedEnrollment.course.id} /><input type="hidden" name="operation" value="set_current" />
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Aktuális tananyagegység manuális beállítása<select name="targetModuleId" required defaultValue={selectedEnrollment.currentModule?.id ?? ''} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900"><option value="" disabled>Válassz tananyagegységet…</option>{selectedEnrollment.modules.map((module) => <option key={module.id} value={module.id}>{module.position}. {module.title}</option>)}</select></label>
                    <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900">Beállítás</button>
                  </form>
                </div>

                <div className="mt-6 space-y-3">{selectedEnrollment.modules.map((module) => <form key={module.id} action={updateStudentProgressAction} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"><input type="hidden" name="studentId" value={student.id} /><input type="hidden" name="enrollmentId" value={selectedEnrollment.id} /><input type="hidden" name="moduleId" value={module.id} /><ProgressIcon status={module.progressStatus} /><div className="min-w-0 flex-1"><p className="font-semibold">{module.position}. {module.title}</p><p className="text-xs text-slate-500">{module.topic ?? progressLabels[module.progressStatus]}</p></div><select name="status" defaultValue={module.progressStatus} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{MODULE_PROGRESS_STATUSES.map((status) => <option key={status} value={status}>{progressLabels[status]}</option>)}</select><button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">Mentés</button></form>)}</div>
              </section> : <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Nincs kiválasztható kurzus.</section>}
            </div>
          ) : null}

          {view === 'sessions' ? <div className="space-y-4">{student.enrollments.map((enrollment) => <section key={enrollment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold">{enrollment.course.shortTitle}</h2><p className="mt-2 text-sm text-slate-600">Ütemezés: {enrollment.course.weeklySchedule ?? 'nincs megadva'}</p><p className="mt-2 text-sm text-slate-500">A jelenlét, hiányzás, megtartott és fennmaradó alkalmak külön itt kezelhetők majd, a kurzushaladástól függetlenül.</p></section>)}</div> : null}

          {view === 'materials' ? <div className="grid gap-4 xl:grid-cols-2">{student.enrollments.map((enrollment) => <section key={enrollment.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold">{enrollment.course.shortTitle}</h2><p className="mt-3 text-sm text-slate-500">Aktuális tananyagegység</p><p className="mt-1 font-semibold">{enrollment.currentModule?.title ?? 'Még nincs aktuális tananyag'}</p><p className="mt-3 text-sm text-slate-500">A leckék, videók, gyakorlóanyagok és GitHub-anyagok később ehhez a kurzus → modul struktúrához kapcsolhatók.</p></section>)}</div> : null}

          {view === 'tasks' ? <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Feladatok</h2><p className="mt-2 text-sm text-slate-500">A tanuló kurzusaihoz és aktuális tananyagegységeihez kapcsolódó feladatok külön ezen a nézeten jelennek majd meg. Most nem épül külön LMS-funkció.</p></section> : null}

          {view === 'admin' ? <div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-xl font-bold">Személyes és adminisztratív adatok</h2><p className="mt-1 text-sm text-slate-500">Ezek az adatok nem keverednek a kurzushaladással.</p></div>{student.accountStatus === 'pending' ? <form action={resendStudentActivationAction}><input type="hidden" name="studentId" value={student.id} /><button className="rounded-xl bg-[#1b2430] px-4 py-2.5 text-sm font-bold text-white" type="submit">Aktiváló e-mail újraküldése</button></form> : null}</div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-slate-500">E-mail</dt><dd className="font-semibold">{student.email}</dd></div><div><dt className="text-slate-500">Telefon</dt><dd className="font-semibold">{student.phone ?? '—'}</dd></div><div><dt className="text-slate-500">Születési dátum</dt><dd className="font-semibold">{student.birthDate ? formatAdminDay(student.birthDate) : '—'}</dd></div><div><dt className="text-slate-500">Törvényes képviselő</dt><dd className="font-semibold">{student.guardianName ?? '—'}</dd></div><div><dt className="text-slate-500">Képviselő e-mail</dt><dd className="font-semibold">{student.guardianEmail ?? '—'}</dd></div><div><dt className="text-slate-500">Cím</dt><dd className="font-semibold">{student.address ?? '—'}</dd></div></dl></section></div> : null}

          {view === 'finance' ? <div className="space-y-5">{student.enrollments.map((enrollment) => <section key={enrollment.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{enrollment.course.shortTitle}</h2><p className="mt-1 text-sm text-slate-500">Kurzushoz kötött pénzügyi adatok</p></div>{enrollment.payment ? <strong>{formatHUF(enrollment.payment.remainingAmountHuf)} hátralék</strong> : null}</div>{enrollment.payment ? <><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4"><div><dt className="text-slate-500">Konstrukció</dt><dd className="font-semibold">{enrollment.payment.packageName}</dd></div><div><dt className="text-slate-500">Teljes díj</dt><dd className="font-bold">{formatHUF(enrollment.payment.totalAmountHuf)}</dd></div><div><dt className="text-slate-500">Befizetve</dt><dd className="font-bold text-emerald-700">{formatHUF(enrollment.payment.paidAmountHuf)}</dd></div><div><dt className="text-slate-500">Következő esedékesség</dt><dd className="font-semibold">{enrollment.payment.nextDueAt ? formatAdminDay(enrollment.payment.nextDueAt) : '—'}</dd></div></dl><div className="mt-5 space-y-2">{enrollment.payment.items.map((item) => <div key={item.id} className="flex flex-col gap-1 rounded-xl bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold">{enrollment.payment!.installmentCount === 1 ? 'Egyösszegű díj' : `${item.position}. részlet`}</span><span>{formatHUF(item.paidAmountHuf)} / {formatHUF(item.amountHuf)}{item.dueAt ? ` · ${formatAdminDay(item.dueAt)}` : ''}</span></div>)}</div></> : <p className="mt-4 text-sm text-slate-500">Ehhez a kurzushoz nincs fizetési terv.</p>}</section>)}</div> : null}

          {view === 'documents' ? <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Dokumentumok / megjegyzések</h2><p className="mt-2 text-sm text-slate-500">A későbbi képzési dokumentumok és adminisztratív megjegyzések elkülönített helye. A kurzushaladási adatokat ez a nézet nem módosítja.</p></section> : null}
        </main>
      </div>
    </div>
  )
}
