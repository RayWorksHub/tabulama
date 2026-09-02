'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, ChevronDown, Pencil, Repeat2, Save, Trash2 } from 'lucide-react'
import {
  deleteManagedCourseSessionAction,
  updateManagedCourseSessionAction,
} from '@/app/admin/(protected)/kurzusok/session-actions'
import type {
  CourseSessionManagementDetails,
  CourseSessionMutationScope,
} from '@/lib/course-session-management-repository'
import type { CourseSessionFrequency } from '@/lib/course-session-repository'

const inputClass = 'mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0f6cbd]'
const weekdays = [
  { value: 1, label: 'H' },
  { value: 2, label: 'K' },
  { value: 3, label: 'Sze' },
  { value: 4, label: 'Cs' },
  { value: 5, label: 'P' },
  { value: 6, label: 'Szo' },
  { value: 7, label: 'V' },
]

const scopeLabels: Record<CourseSessionMutationScope, string> = {
  single: 'Csak ezt az alkalmat',
  future: 'Ezt és a következő alkalmakat',
  series: 'A teljes órasorozatot',
}

type EndMode = 'until' | 'count'

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekdayOf(dateIso: string): number {
  const day = new Date(`${dateIso}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

export function CourseSessionManagementPanel({
  details,
  weekStart,
}: {
  details: CourseSessionManagementDetails
  weekStart: string
}) {
  const series = details.series
  const [scope, setScope] = useState<CourseSessionMutationScope>('single')
  const [sessionDate, setSessionDate] = useState(details.sessionDate)
  const [startTime, setStartTime] = useState(details.startTime)
  const [endTime, setEndTime] = useState(details.endTime)
  const [title, setTitle] = useState(details.title)
  const [note, setNote] = useState(details.note ?? '')
  const [frequency, setFrequency] = useState<CourseSessionFrequency>(series?.frequency ?? 'weekly')
  const [interval, setInterval] = useState(series?.interval ?? 1)
  const [selectedDays, setSelectedDays] = useState<number[]>(
    series?.weekdays.length ? series.weekdays : [weekdayOf(details.sessionDate)],
  )
  const [endMode, setEndMode] = useState<EndMode>(series?.endsOn ? 'until' : 'count')
  const [untilDate, setUntilDate] = useState(series?.endsOn ?? addDays(details.sessionDate, 84))
  const [count, setCount] = useState(series?.remainingOccurrences || 12)
  const [confirmHistory, setConfirmHistory] = useState(false)

  const showRecurrence = Boolean(series && scope !== 'single')
  const historyForScope = scope === 'single'
    ? details.sessionHasHistory
    : scope === 'future'
      ? details.remainingHasHistory
      : details.seriesHasHistory

  const recurrenceSummary = useMemo(() => {
    if (!showRecurrence) return null
    const unit = frequency === 'daily' ? 'nap' : frequency === 'weekly' ? 'hét' : 'hónap'
    const days = frequency === 'weekly'
      ? ` · ${weekdays.filter((day) => selectedDays.includes(day.value)).map((day) => day.label).join(', ')}`
      : ''
    const ending = endMode === 'until' ? ` · ${untilDate}-ig` : ` · ${count} alkalom`
    return `Minden ${interval}. ${unit}${days}${ending}`
  }, [showRecurrence, frequency, interval, selectedDays, endMode, untilDate, count])

  function changeScope(next: CourseSessionMutationScope) {
    setScope(next)
    setConfirmHistory(false)
    if (!series) return

    if (next === 'series') {
      setSessionDate(series.startsOn)
      setStartTime(series.startTime)
      setEndTime(series.endTime)
      setTitle(series.title)
      setNote(series.note ?? '')
      setCount(series.totalOccurrences || 1)
      setUntilDate(series.endsOn ?? addDays(series.startsOn, 84))
      return
    }

    setSessionDate(details.sessionDate)
    setStartTime(details.startTime)
    setEndTime(details.endTime)
    setTitle(details.title)
    setNote(details.note ?? '')
    setCount(series.remainingOccurrences || 1)
    setUntilDate(series.endsOn ?? addDays(details.sessionDate, 84))
  }

  function toggleDay(value: number) {
    setSelectedDays((current) => {
      if (current.includes(value)) return current.length === 1 ? current : current.filter((day) => day !== value)
      return [...current, value].sort((a, b) => a - b)
    })
  }

  const deleteDescription = scope === 'single'
    ? 'A kiválasztott alkalom véglegesen törlődik.'
    : scope === 'future'
      ? `A kiválasztott és az utána következő ${series?.remainingOccurrences ?? 1} alkalom törlődik.`
      : `A teljes, ${series?.totalOccurrences ?? 1} alkalomból álló órasorozat törlődik.`

  return (
    <details className="group border-b border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        <span className="flex items-center gap-2"><Pencil className="h-4 w-4 text-[#0f6cbd]" />Óra szerkesztése vagy törlése</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-slate-200 bg-slate-50/60 p-5">
        <form action={updateManagedCourseSessionAction} className="space-y-5">
          <input type="hidden" name="courseId" value={details.courseId} />
          <input type="hidden" name="sessionId" value={details.sessionId} />
          <input type="hidden" name="week" value={weekStart} />
          <input type="hidden" name="scope" value={scope} />

          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-950"><CalendarClock className="h-4 w-4 text-[#0f6cbd]" />Alkalom adatainak módosítása</h3>
              <p className="mt-1 text-sm text-slate-500">A mentés hatóköre az alábbi beállítással szabályozható.</p>
            </div>
            {series ? (
              <label className="w-full text-sm font-semibold lg:max-w-sm">Módosítás hatóköre
                <select className={inputClass} value={scope} onChange={(event) => changeScope(event.target.value as CourseSessionMutationScope)}>
                  <option value="single">Csak ezt az alkalmat</option>
                  <option value="future">Ezt és a következőket</option>
                  <option value="series">A teljes sorozatot</option>
                </select>
              </label>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.05fr_0.75fr_0.75fr_1.2fr_1.4fr]">
            <label className="text-sm font-semibold">{scope === 'series' ? 'Sorozat kezdete' : 'Dátum'}
              <input className={inputClass} type="date" name="sessionDate" required value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} />
            </label>
            <label className="text-sm font-semibold">Kezdés
              <input className={inputClass} type="time" name="startTime" required value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            <label className="text-sm font-semibold">Vége
              <input className={inputClass} type="time" name="endTime" required value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
            <label className="text-sm font-semibold">Megnevezés
              <input className={inputClass} name="title" required value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="text-sm font-semibold">Megjegyzés
              <input className={inputClass} name="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="opcionális" />
            </label>
          </div>

          {showRecurrence ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2"><Repeat2 className="h-4 w-4 text-[#0f6cbd]" /><h4 className="text-sm font-bold">Ismétlődési szabály</h4></div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
                <label className="text-sm font-semibold">Ismétlődés
                  <select className={inputClass} name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as CourseSessionFrequency)}>
                    <option value="daily">Naponta</option>
                    <option value="weekly">Hetente</option>
                    <option value="monthly">Havonta</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">Gyakoriság
                  <div className="mt-1.5 flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
                    <span className="text-sm text-slate-500">Minden</span>
                    <input name="interval" type="number" min="1" max="52" value={interval} onChange={(event) => setInterval(Math.max(1, Math.min(52, Number(event.target.value) || 1)))} className="w-14 border-0 bg-transparent text-center font-bold outline-none" />
                    <span className="text-sm text-slate-500">{frequency === 'daily' ? 'nap' : frequency === 'weekly' ? 'hét' : 'hónap'}</span>
                  </div>
                </label>
                <label className="text-sm font-semibold">Befejezés
                  <select className={inputClass} name="endMode" value={endMode} onChange={(event) => setEndMode(event.target.value as EndMode)}>
                    <option value="until">Adott dátumig</option>
                    <option value="count">Adott alkalomszám után</option>
                  </select>
                </label>
                {endMode === 'until' ? (
                  <label className="text-sm font-semibold">Utolsó lehetséges nap
                    <input className={inputClass} type="date" name="untilDate" min={sessionDate} value={untilDate} onChange={(event) => setUntilDate(event.target.value)} />
                  </label>
                ) : (
                  <label className="text-sm font-semibold">Alkalmak száma
                    <input className={inputClass} type="number" name="occurrenceCount" min="1" max="240" value={count} onChange={(event) => setCount(Math.max(1, Math.min(240, Number(event.target.value) || 1)))} />
                  </label>
                )}
              </div>

              {frequency === 'weekly' ? (
                <fieldset className="mt-4">
                  <legend className="text-sm font-semibold">Mely napokon legyen óra?</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {weekdays.map((day) => {
                      const active = selectedDays.includes(day.value)
                      return (
                        <label key={day.value} className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-bold transition ${active ? 'border-[#0f6cbd] bg-[#e5f1fb] text-[#0f548c]' : 'border-slate-300 bg-white text-slate-600'}`}>
                          <input type="checkbox" className="sr-only" name="weekday" value={day.value} checked={active} onChange={() => toggleDay(day.value)} />
                          {day.label}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ) : null}

              <p className="mt-4 text-sm font-semibold text-slate-600">{recurrenceSummary}</p>
              {(scope === 'future' ? details.remainingHasHistory : details.seriesHasHistory) ? (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  A kijelölt körben már van megtartott, elmaradt vagy jelenléttel rendelkező alkalom. Ezek adatai megőrződnek; olyan ismétlődési átrendezés nem menthető, amely törölné a történeti adatokat.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1b2430] px-5 text-sm font-bold text-white">
              <Save className="h-4 w-4" />{scopeLabels[scope]} mentése
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <h3 className="flex items-center gap-2 font-bold text-red-900"><Trash2 className="h-4 w-4" />Törlés</h3>
                <p className="mt-1 text-sm text-red-800">{deleteDescription}</p>
                {historyForScope ? <p className="mt-2 text-xs leading-5 text-red-800">A törlendő körben már van rögzített állapot vagy jelenlét. A művelet ezeket az adatokat is véglegesen eltávolítja.</p> : null}
              </div>

              <form
                action={deleteManagedCourseSessionAction}
                data-feedback="off"
                className="flex flex-col items-start gap-3 sm:items-end"
                onSubmit={(event) => {
                  const message = `${scopeLabels[scope]} törlése nem vonható vissza. Biztosan folytatod?`
                  if (!window.confirm(message)) event.preventDefault()
                }}
              >
                <input type="hidden" name="courseId" value={details.courseId} />
                <input type="hidden" name="sessionId" value={details.sessionId} />
                <input type="hidden" name="week" value={weekStart} />
                <input type="hidden" name="scope" value={scope} />
                {historyForScope ? (
                  <label className="flex items-start gap-2 text-xs font-semibold text-red-900">
                    <input type="checkbox" name="confirmHistory" checked={confirmHistory} onChange={(event) => setConfirmHistory(event.target.checked)} required className="mt-0.5 h-4 w-4" />
                    Tudomásul veszem a korábbi állapot- és jelenléti adatok törlését.
                  </label>
                ) : null}
                <button type="submit" disabled={historyForScope && !confirmHistory} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-4 text-sm font-bold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 className="h-4 w-4" />{scopeLabels[scope]} törlése
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </details>
  )
}
