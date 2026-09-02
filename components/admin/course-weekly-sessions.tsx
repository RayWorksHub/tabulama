import Link from 'next/link'
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Repeat2 } from 'lucide-react'
import {
  addDaysIso,
  weekDaysIso,
  type CourseSessionItem,
} from '@/lib/course-session-repository'
import {
  markAllSessionPresentAction,
  updateCourseSessionStatusAction,
} from '@/app/admin/(protected)/kurzusok/session-actions'
import { CourseSessionCreateForm } from '@/components/admin/course-session-create-form'
import { CourseSessionAttendanceEditor } from '@/components/admin/course-session-attendance-editor'

const sessionStatusLabels = {
  scheduled: 'Tervezett',
  completed: 'Megtartva',
  cancelled: 'Elmaradt',
}

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
            <p className="mt-1 text-sm text-slate-500">Az egyszeri és rendszeres órák ugyanabban a heti nézetben jelennek meg.</p>
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
                      return <Link key={session.id} href={`/admin/kurzusok/${courseId}?view=sessions&week=${weekStart}&session=${session.id}`} className={`block rounded-lg border p-3 transition ${active ? 'border-[#bd8b3c] bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}><p className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><Clock3 className="h-3.5 w-3.5" />{session.startTime}–{session.endTime}</p><div className="mt-1 flex items-start justify-between gap-2"><p className="text-sm font-bold text-slate-950">{session.title}</p>{session.seriesId ? <Repeat2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9b6e2f]" aria-label="Ismétlődő alkalom" /> : null}</div><p className="mt-2 text-[11px] leading-4 text-slate-500">{attendanceSummary(session)}</p>{session.status === 'cancelled' ? <span className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Elmaradt</span> : null}</Link>
                    })}
                    {!daySessions.length ? <p className="py-4 text-center text-xs text-slate-400">Nincs óra</p> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <CourseSessionCreateForm courseId={courseId} weekStart={weekStart} />

      {selectedSession ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kiválasztott óra</p>
                <h2 className="mt-1 text-xl font-bold">{selectedSession.sessionDate} · {selectedSession.startTime}–{selectedSession.endTime}</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedSession.title} · {sessionStatusLabels[selectedSession.status]}{selectedSession.seriesId ? ' · ismétlődő órasorozat' : ''}</p>
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
            <CourseSessionAttendanceEditor
              courseId={courseId}
              sessionId={selectedSession.id}
              weekStart={weekStart}
              students={selectedSession.attendance}
              disabled={selectedSession.status === 'cancelled'}
            />
          ) : <div className="p-6 text-sm text-slate-500">Ehhez a kurzushoz nincs jelenleg nyilvántartott tanuló.</div>}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Ezen a héten még nincs felvett óra. Hozz létre egy alkalmat vagy órasorozatot a jelenlét adminisztrálásához.</section>
      )}
    </div>
  )
}
