import Link from 'next/link'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CircleHelp, XCircle } from 'lucide-react'
import { addDaysIso, weekDaysIso, type AttendanceStatus, type StudentSessionItem } from '@/lib/course-session-repository'

const attendanceLabels: Record<AttendanceStatus, string> = {
  unmarked: 'Még nincs jelölve',
  present: 'Jelen voltál',
  late: 'Késtél',
  excused: 'Igazolt hiányzás',
  absent: 'Hiányoztál',
}

function formatDay(dateIso: string): { weekday: string; date: string } {
  const date = new Date(`${dateIso}T00:00:00Z`)
  return {
    weekday: new Intl.DateTimeFormat('hu-HU', { weekday: 'short', timeZone: 'UTC' }).format(date),
    date: new Intl.DateTimeFormat('hu-HU', { month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date),
  }
}

function attendanceClass(status: AttendanceStatus): string {
  if (status === 'present') return 'bg-emerald-50 text-emerald-700'
  if (status === 'late') return 'bg-amber-50 text-amber-800'
  if (status === 'absent') return 'bg-red-50 text-red-700'
  if (status === 'excused') return 'bg-blue-50 text-blue-700'
  return 'bg-muted text-muted-foreground'
}

function AttendanceIcon({ status }: { status: AttendanceStatus }) {
  if (status === 'present' || status === 'late') return <CheckCircle2 className="h-4 w-4" />
  if (status === 'absent') return <XCircle className="h-4 w-4" />
  return <CircleHelp className="h-4 w-4" />
}

export function StudentWeeklySessions({ weekStart, sessions }: { weekStart: string; sessions: StudentSessionItem[] }) {
  const days = weekDaysIso(weekStart)
  const previousWeek = addDaysIso(weekStart, -7)
  const nextWeek = addDaysIso(weekStart, 7)
  const marked = sessions.filter((session) => session.sessionStatus !== 'cancelled' && session.attendanceStatus !== 'unmarked')
  const attended = marked.filter((session) => session.attendanceStatus === 'present' || session.attendanceStatus === 'late').length
  const absent = marked.filter((session) => session.attendanceStatus === 'absent').length
  const excused = marked.filter((session) => session.attendanceStatus === 'excused').length
  const attendanceRate = marked.length ? Math.round(attended * 100 / marked.length) : null

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Heti órák</p><p className="mt-2 text-3xl font-extrabold">{sessions.filter((session) => session.sessionStatus !== 'cancelled').length}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Jelenléti arány</p><p className="mt-2 text-3xl font-extrabold">{attendanceRate === null ? '—' : `${attendanceRate}%`}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Hiányzás</p><p className="mt-2 text-3xl font-extrabold">{absent}</p></div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-sm font-semibold text-muted-foreground">Igazolt hiányzás</p><p className="mt-2 text-3xl font-extrabold">{excused}</p></div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="flex items-center gap-2 text-xl font-bold"><CalendarDays className="h-5 w-5 text-primary" />Heti órarend</h2><p className="mt-1 text-sm text-muted-foreground">Itt követheted az óráidat és azt is, hogyan lett rögzítve a jelenléted.</p></div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/portal?view=sessions&week=${previousWeek}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-bold hover:bg-muted"><ChevronLeft className="h-4 w-4" />Előző hét</Link>
            <Link href="/portal?view=sessions" className="inline-flex min-h-10 items-center rounded-lg border border-border bg-background px-3 text-sm font-bold hover:bg-muted">Aktuális hét</Link>
            <Link href={`/portal?view=sessions&week=${nextWeek}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-bold hover:bg-muted">Következő hét<ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto pb-1">
          <div className="grid min-w-[980px] grid-cols-7 gap-3">
            {days.map((day) => {
              const label = formatDay(day)
              const daySessions = sessions.filter((session) => session.sessionDate === day)
              return <div key={day} className="min-h-44 rounded-xl border border-border bg-muted/35 p-3"><div className="border-b border-border pb-2"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label.weekday}</p><p className="mt-0.5 font-bold">{label.date}</p></div><div className="mt-3 space-y-2">{daySessions.map((session) => <article key={`${session.sessionId}:${session.enrollmentId}`} className={`rounded-lg border border-border bg-card p-3 ${session.sessionStatus === 'cancelled' ? 'opacity-65' : ''}`}><p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{session.startTime}–{session.endTime}</p><p className="mt-1 text-sm font-bold">{session.courseShortTitle}</p><p className="mt-0.5 text-xs text-muted-foreground">{session.title}</p>{session.sessionStatus === 'cancelled' ? <span className="mt-2 inline-flex rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Az óra elmarad</span> : <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold ${attendanceClass(session.attendanceStatus)}`}><AttendanceIcon status={session.attendanceStatus} />{attendanceLabels[session.attendanceStatus]}</span>}{session.attendanceNote ? <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Megjegyzés: {session.attendanceNote}</p> : null}</article>)}{!daySessions.length ? <p className="py-4 text-center text-xs text-muted-foreground">Nincs óra</p> : null}</div></div>
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
