import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, CalendarDays, LayoutDashboard, Settings2, TrendingUp, UsersRound } from 'lucide-react'
import { CourseForm } from '@/components/admin/course-form'
import { CourseModules } from '@/components/admin/course-modules'
import { CourseStudentProgress } from '@/components/admin/course-student-progress'
import { CourseWeeklySessions } from '@/components/admin/course-weekly-sessions'
import { COURSE_STATUS_LABELS, getCourseById } from '@/lib/course-repository'
import { getCourseProgressWorkspace } from '@/lib/course-progress-repository'
import { listCourseSessionsForWeek } from '@/lib/course-session-repository'
import { getCourseSessionManagementDetails } from '@/lib/course-session-management-repository'
import { listCourseModules } from '@/lib/student-repository'

export const dynamic = 'force-dynamic'

const views = [
  { id: 'overview', label: 'Áttekintés', icon: LayoutDashboard },
  { id: 'students', label: 'Tanulók / Csoport', icon: UsersRound },
  { id: 'content', label: 'Tananyag', icon: BookOpen },
  { id: 'progress', label: 'Haladás', icon: TrendingUp },
  { id: 'sessions', label: 'Órák', icon: CalendarDays },
  { id: 'admin', label: 'Adminisztráció', icon: Settings2 },
] as const

type ViewId = (typeof views)[number]['id']

const successMessages: Record<string, string> = {
  saved: 'A kurzus adatai elmentve.',
  module_saved: 'A kurzusmodul elmentve.',
  progress_updated: 'A kijelölt tanulók haladása frissült.',
  session_saved: 'Az óra adatai elmentve.',
  session_series_saved: 'Az ismétlődő órasorozat elkészült.',
  session_updated: 'A kiválasztott óra módosításai elmentve.',
  session_series_updated: 'Az órasorozat kijelölt része frissült.',
  session_deleted: 'A kiválasztott óra törölve.',
  session_future_deleted: 'A kiválasztott és az azt követő alkalmak törölve.',
  session_series_deleted: 'A teljes órasorozat törölve.',
  attendance_saved: 'A jelenléti adatok elmentve.',
}

const errorMessages: Record<string, string> = {
  invalid_form: 'A kurzus nem menthető. Ellenőrizd a mezőket.',
  save_failed: 'A kurzus nem menthető.',
  module_invalid: 'A modul nem menthető. Ellenőrizd a mezőket.',
  module_save_failed: 'A modul mentése sikertelen.',
  progress_invalid: 'Jelölj ki legalább egy tanulót és válassz érvényes műveletet.',
  progress_target_required: 'Konkrét tananyagegység beállításához válassz egy modult.',
  progress_save_failed: 'A csoportos haladás módosítása sikertelen.',
  session_invalid: 'Az óra adatai hibásak. Ellenőrizd a dátumot és az időpontot.',
  session_recurrence_invalid: 'Az ismétlődés beállításai hibásak. Ellenőrizd a gyakoriságot és a befejezést.',
  session_series_history_locked: 'Az ismétlődési rend nem alakítható át, mert a kijelölt körben már van megtartott, elmaradt vagy jelenléttel rendelkező óra. Az egyes alkalmak adatai ettől még külön módosíthatók.',
  session_history_confirmation_required: 'A művelet korábbi állapot- vagy jelenléti adatokat is törölne. Erősítsd meg ezt a törlési panelen.',
  session_not_found: 'A kiválasztott óra már nem található. Frissítsd a heti nézetet.',
  session_save_failed: 'Az óra vagy órasorozat mentése sikertelen. Ellenőrizd, nincs-e ugyanarra az időpontra már másik óra.',
  attendance_invalid: 'A jelenléti adatok nem értelmezhetők.',
  attendance_save_failed: 'A jelenléti adatok mentése sikertelen.',
}

export default async function CourseDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string; view?: string; week?: string; session?: string }>
}) {
  const [{ id }, feedback] = await Promise.all([params, searchParams])
  const [course, modules, workspace, weeklySessions] = await Promise.all([
    getCourseById(id),
    listCourseModules(id),
    getCourseProgressWorkspace(id),
    listCourseSessionsForWeek(id, feedback.week),
  ])
  if (!course) notFound()

  const requestedView = feedback.view as ViewId | undefined
  const view: ViewId = views.some((item) => item.id === requestedView) ? requestedView! : 'overview'
  const selectedSessionId = view === 'sessions'
    ? feedback.session && weeklySessions.sessions.some((session) => session.id === feedback.session)
      ? feedback.session
      : weeklySessions.sessions[0]?.id ?? null
    : null
  const managementDetails = selectedSessionId
    ? await getCourseSessionManagementDetails(id, selectedSessionId)
    : null

  const activeModules = modules.filter((module) => module.isActive)
  const averageProgress = workspace.students.length
    ? Math.round(workspace.students.reduce((sum, student) => sum + student.progressPercent, 0) / workspace.students.length)
    : 0

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9b6e2f]">Kurzuskezelés</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{course.shortTitle}</h1>
          <p className="mt-2 text-slate-600">{COURSE_STATUS_LABELS[course.status]} · {workspace.students.length} beiratkozott tanuló</p>
        </div>
        <Link href="/admin/kurzusok" className="text-sm font-bold text-slate-600 hover:text-slate-950">Vissza a kurzusokhoz</Link>
      </div>

      {feedback.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">{errorMessages[feedback.error] ?? 'A művelet nem hajtható végre.'}</p> : null}
      {feedback.success ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{successMessages[feedback.success] ?? 'A módosítás elmentve.'}</p> : null}

      <div className="mt-7 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-6">
          <nav aria-label="Kurzus funkciók" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {views.map((item) => {
              const active = item.id === view
              return (
                <Link
                  key={item.id}
                  href={`/admin/kurzusok/${course.id}?view=${item.id}`}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? 'bg-[#1b2430] text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
                >
                  <item.icon className="h-4 w-4" />{item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {view === 'overview' ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Beiratkozott tanulók</p><p className="mt-2 text-3xl font-bold">{workspace.students.length}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Átlagos haladás</p><p className="mt-2 text-3xl font-bold">{averageProgress}%</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Aktív tananyagegységek</p><p className="mt-2 text-3xl font-bold">{activeModules.length}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Szabad hely</p><p className="mt-2 text-3xl font-bold">{course.remainingCapacity === null ? '∞' : course.remainingCapacity}</p></div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">Csoport aktuális állapota</p>
                  <h2 className="mt-2 text-xl font-bold">{workspace.groupCurrentModuleTitle ?? 'Még nincs közös aktuális tananyag'}</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {workspace.distribution.length ? workspace.distribution.map((item) => <span key={item.moduleId ?? 'completed'} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">{item.count} fő · {item.label}</span>) : <span className="text-sm text-slate-500">Még nincs haladási adat.</span>}
                  </div>
                  <Link href={`/admin/kurzusok/${course.id}?view=students`} className="mt-5 inline-flex rounded-lg bg-[#1b2430] px-4 py-2.5 text-sm font-bold text-white">Tanulók és csoport kezelése</Link>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm font-semibold text-slate-500">Kurzusinformáció</p>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Kezdés</dt><dd className="text-right font-semibold">{course.startDate?.slice(0, 10) ?? '—'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Ütemezés</dt><dd className="text-right font-semibold">{course.weeklySchedule ?? '—'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Kapacitás</dt><dd className="text-right font-semibold">{course.maxCapacity ?? 'Korlátlan'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-slate-500">Oktató</dt><dd className="text-right font-semibold">{course.instructorName ?? '—'}</dd></div>
                  </dl>
                </div>
              </section>
            </div>
          ) : null}

          {view === 'students' ? <CourseStudentProgress courseId={course.id} workspace={workspace} modules={modules} /> : null}

          {view === 'content' ? <CourseModules courseId={course.id} modules={modules} /> : null}

          {view === 'progress' ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h2 className="text-xl font-bold">Csoport haladása</h2><p className="mt-1 text-sm text-slate-500">Az összesített kép tájékoztató jellegű; a tényleges állapot tanulónként külön van nyilvántartva.</p></div>
                <Link href={`/admin/kurzusok/${course.id}?view=students`} className="text-sm font-bold text-[#8b642b] hover:underline">Egyéni és csoportos kezelés</Link>
              </div>
              <div className="mt-6 space-y-3">
                {workspace.distribution.map((item) => {
                  const percent = workspace.students.length ? Math.round(item.count * 100 / workspace.students.length) : 0
                  return <div key={item.moduleId ?? 'completed'} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-bold">{item.label}</p><p className="text-sm text-slate-500">{item.count} tanuló</p></div><strong>{percent}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#bd8b3c]" style={{ width: `${percent}%` }} /></div></div>
                })}
                {!workspace.distribution.length ? <p className="text-sm text-slate-500">Még nincs megjeleníthető haladási adat.</p> : null}
              </div>
            </section>
          ) : null}

          {view === 'sessions' ? (
            <CourseWeeklySessions
              courseId={course.id}
              weekStart={weeklySessions.weekStart}
              sessions={weeklySessions.sessions}
              selectedSessionId={selectedSessionId}
              managementDetails={managementDetails}
            />
          ) : null}

          {view === 'admin' ? <CourseForm course={course} /> : null}
        </main>
      </div>
    </div>
  )
}
