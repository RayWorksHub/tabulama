import Link from 'next/link'
import { CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock3, UsersRound } from 'lucide-react'
import {
  ATTENDANCE_STATUSES,
  addDaysIso,
  weekDaysIso,
  type AttendanceStatus,
  type CourseSessionItem,
} from '@/lib/course-session-repository'
import {
  createCourseSessionAction,
  markAllSessionPresentAction,
  saveSessionAttendanceAction,
  updateCourseSessionStatusAction,
} from '@/app/admin/(protected)/kurzusok/session-actions'

const attendanceLabels: Record<AttendanceStatus, string> = {
  unmarked: 'Nincs jelölve',
  present: 'Jelen',
  late: 'Késett',
  excused: 'Igazolt hiányzás',
  absent: 'Hiányzott',
}

const sessionStatusLabels = {
  scheduled: 'Tervezett',
  completed: 'Megtartva',
  cancelled: 'Elmaradt',
}

const inputClass = 'mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#9b6e2f]'

function formatDay(dateIso: string): { weekday: string; date: string } {
  const date = new Date(`${dateIso}T00:00:00Z`)
  return {
    weekday: new Intl.DateTimeFormat('hu-HU', { weekday: 'short', timeZone: 'UTC' }).format(date),
    date: new Intl.DateTimeFormat('hu-HU', { month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date),
  }
}

function attendanceSummary(session: CourseSessionItem): string {
  if (!session.attendance.length) return 'Nincs résztvevő'
  const marked = session.attendance.filter((student) => student.status !== 'unmarked').length
  const present = session.attendance.filter((student) => student.status === 'present' || student.status === 'late').length
  return `${present} jelen · ${marked}/${session.attendance.length} jelölve`
}

export function CourseWeeklySessions({
  courseId,
  weekStart,
  sessions,
  selectedSessionId,
}: {
  courseId: string
  weekStart: string
  sessions: CourseSessionItem[]
  selectedSessionId?: string | null
}) {
  const days = weekDaysIso(weekStart)
  const previousWeek = addDaysIso(weekStart, -7)
  const nextWeek = addDaysIso(weekStart, 7)
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold">Heti órarend és jelenlét</h2>
            <p className="mt-1 text-sm text-slate-500">Az órák külön alkalmak, a jelenlét pedig tanulónként ehhez az alkalomhoz kötődik.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/kurzusok/${courseId}?view=sessions&week=${previousWeek}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" />Előző hét</Link>
            <Link href={`/admin/kurzusok/${courseId}?view=sessions`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Aktuális hét</Link>
            <Link href={`/admin/kurzusok/${courseId}?view=sessions&week=${nextWeek}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Következő hét<ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto pb-1">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {days.map((day) => {
              const label = formatDay(day)
              const daySessions = sessions.filter((session) => session.sessionDate === day)
              return (
                <div key={day} className="min-h-44 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="border-b border-slate-200 pb-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label.weekday}</p>
                    <p className="mt-0.5 font-bold">{label.date}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {daySessions.map((session) => {
                      const active = selectedSession?.id === session.id
                      return <Link key={session.id} href={`/admin/kurzusok/${courseId}?view=sessions&week=${weekStart}&session=${session.id}`} className={`block rounded-lg border p-3 transition ${active ? 'border-[#bd8b3c] bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}><p className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><Clock3 className="h-3.5 w-3.5" />{session.startTime}–{session.endTime}</p><p className="mt-1 text-sm font-bold text-slate-950">{session.title}</p><p className="mt-2 text-[11px] leading-4 text-slate-500">{attendanceSummary(session)}</p>{session.status === 'cancelled' ? <span className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Elmaradt</span> : null}</Link>
                    })}
                    {!daySessions.length ? <p className="py-4 text-center text-xs text-slate-400">Nincs óra</p> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-[#9b6e2f]" /><h2 className="font-bold">Új óra felvétele</h2></div>
        <form action={createCourseSessionAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.1fr_0.8fr_0.7fr_0.7fr_1.3fr_auto] xl:items-end">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="week" value={weekStart} />
          <label className="text-sm font-semibold">Dátum<input className={inputClass} type="date" name="sessionDate" required defaultValue={weekStart} /></label>
          <label className="text-sm font-semibold">Kezdés<input className={inputClass} type="time" name="startTime" required defaultValue="17:00" /></label>
          <label className="text-sm font-semibold">Vége<input className={inputClass} type="time" name="endTime" required defaultValue="18:30" /></label>
          <label className="text-sm font-semibold md:col-span-2 xl:col-span-1">Megnevezés<input className={inputClass} name="title" required defaultValue="Kurzusóra" /></label>
          <label className="text-sm font-semibold md:col-span-2 xl:col-span-1">Megjegyzés<input className={inputClass} name="note" placeholder="opcionális" /></label>
          <button type="submit" className="min-h-10 rounded-lg bg-[#1b2430] px-4 text-sm font-bold text-white">Óra hozzáadása</button>
        </form>
      </section>

      {selectedSession ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kiválasztott óra</p>
                <h2 className="mt-1 text-xl font-bold">{selectedSession.sessionDate} · {selectedSession.startTime}–{selectedSession.endTime}</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedSession.title} · {sessionStatusLabels[selectedSession.status]}</p>
                {selectedSession.note ? <p className="mt-2 text-sm text-slate-500">{selectedSession.note}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={markAllSessionPresentAction}><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="sessionId" value={selectedSession.id} /><input type="hidden" name="week" value={weekStart} /><button type="submit" disabled={selectedSession.status === 'cancelled'} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 disabled:opacity-40"><CheckCircle2 className="h-4 w-4" />Mindenki jelen</button></form>
                <form action={updateCourseSessionStatusAction}><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="sessionId" value={selectedSession.id} /><input type="hidden" name="week" value={weekStart} /><input type="hidden" name="status" value={selectedSession.status === 'cancelled' ? 'scheduled' : 'cancelled'} /><button type="submit" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700">{selectedSession.status === 'cancelled' ? 'Visszaállítás tervezettre' : 'Óra elmaradt'}</button></form>
                {selectedSession.status !== 'cancelled' && selectedSession.status !== 'completed' ? <form action={updateCourseSessionStatusAction}><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="sessionId" value={selectedSession.id} /><input type="hidden" name="week" value={weekStart} /><input type="hidden" name="status" value="completed" /><button type="submit" className="min-h-10 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white">Megtartva</button></form> : null}
              </div>
            </div>
          </div>

          {selectedSession.attendance.length ? (
            <form action={saveSessionAttendanceAction}>
              <input type="hidden" name="courseId" value={courseId} />
              <input type="hidden" name="sessionId" value={selectedSession.id} />
              <input type="hidden" name="week" value={weekStart} />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Tanuló</th><th className="px-5 py-3">Jelenlét</th><th className="px-5 py-3">Megjegyzés</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSession.attendance.map((student) => <tr key={student.enrollmentId}><td className="px-5 py-4"><input type="hidden" name="enrollmentId" value={student.enrollmentId} /><p className="font-bold">{student.fullName}</p><p className="mt-1 font-mono text-xs text-slate-500">{student.studentNumber}</p></td><td className="px-5 py-4"><select name={`status:${student.enrollmentId}`} defaultValue={student.status} disabled={selectedSession.status === 'cancelled'} className="min-h-10 w-full max-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100">{ATTENDANCE_STATUSES.map((status) => <option key={status} value={status}>{attendanceLabels[status]}</option>)}</select></td><td className="px-5 py-4"><input name={`note:${student.enrollmentId}`} defaultValue={student.note ?? ''} disabled={selectedSession.status === 'cancelled'} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100" placeholder="pl. 10 perc késés" /></td></tr>)}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4"><p className="flex items-center gap-2 text-sm text-slate-500"><UsersRound className="h-4 w-4" />{selectedSession.attendance.length} tanuló</p><button type="submit" disabled={selectedSession.status === 'cancelled'} className="min-h-10 rounded-lg bg-[#1b2430] px-4 text-sm font-bold text-white disabled:opacity-40">Jelenlét mentése</button></div>
            </form>
          ) : <div className="p-6 text-sm text-slate-500">Ehhez a kurzushoz nincs jelenleg nyilvántartott tanuló.</div>}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Ezen a héten még nincs felvett óra. Hozz létre egy alkalmat a jelenlét adminisztrálásához.</section>
      )}
    </div>
  )
}
