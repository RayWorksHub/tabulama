'use client'

import { useMemo, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { createCourseSessionAction } from '@/app/admin/(protected)/kurzusok/session-actions'

const inputClass = 'mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#9b6e2f]'
const weekdays = [
  { value: 1, label: 'H' },
  { value: 2, label: 'K' },
  { value: 3, label: 'Sze' },
  { value: 4, label: 'Cs' },
  { value: 5, label: 'P' },
  { value: 6, label: 'Szo' },
  { value: 7, label: 'V' },
]

type Frequency = 'none' | 'daily' | 'weekly' | 'monthly'
type EndMode = 'until' | 'count'

function weekdayOf(dateIso: string): number {
  const day = new Date(`${dateIso}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function CourseSessionCreateForm({ courseId, weekStart }: { courseId: string; weekStart: string }) {
  const [sessionDate, setSessionDate] = useState(weekStart)
  const [frequency, setFrequency] = useState<Frequency>('none')
  const [interval, setInterval] = useState(1)
  const [selectedDays, setSelectedDays] = useState<number[]>([weekdayOf(weekStart)])
  const [endMode, setEndMode] = useState<EndMode>('until')
  const [untilDate, setUntilDate] = useState(addDays(weekStart, 84))
  const [count, setCount] = useState(12)

  const recurrenceSummary = useMemo(() => {
    if (frequency === 'none') return 'Egyszeri alkalom'
    const unit = frequency === 'daily' ? 'nap' : frequency === 'weekly' ? 'hét' : 'hónap'
    const days = frequency === 'weekly'
      ? ` · ${weekdays.filter((day) => selectedDays.includes(day.value)).map((day) => day.label).join(', ') || 'a kezdőnap'}`
      : ''
    const end = endMode === 'until' ? ` · ${untilDate}-ig` : ` · ${count} alkalom`
    return `Minden ${interval}. ${unit}${days}${end}`
  }, [frequency, interval, selectedDays, endMode, untilDate, count])

  function changeFrequency(value: Frequency) {
    setFrequency(value)
    if (value === 'weekly' && selectedDays.length === 0) setSelectedDays([weekdayOf(sessionDate)])
  }

  function toggleDay(value: number) {
    setSelectedDays((current) => current.includes(value) ? current.filter((day) => day !== value) : [...current, value].sort())
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2"><CalendarPlus className="h-5 w-5 text-[#9b6e2f]" /><h2 className="font-bold">Új óra / órasorozat</h2></div>
      <form action={createCourseSessionAction} className="mt-5 space-y-5">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="week" value={weekStart} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.1fr_0.8fr_0.8fr_1.2fr_1.4fr]">
          <label className="text-sm font-semibold">Kezdő dátum<input className={inputClass} type="date" name="sessionDate" required value={sessionDate} onChange={(event) => { const value = event.target.value; setSessionDate(value); if (frequency === 'weekly' && selectedDays.length <= 1) setSelectedDays([weekdayOf(value)]) }} /></label>
          <label className="text-sm font-semibold">Kezdés<input className={inputClass} type="time" name="startTime" required defaultValue="17:00" /></label>
          <label className="text-sm font-semibold">Vége<input className={inputClass} type="time" name="endTime" required defaultValue="18:30" /></label>
          <label className="text-sm font-semibold">Megnevezés<input className={inputClass} name="title" required defaultValue="Kurzusóra" /></label>
          <label className="text-sm font-semibold">Megjegyzés<input className={inputClass} name="note" placeholder="opcionális" /></label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
            <label className="text-sm font-semibold">Ismétlődés
              <select className={inputClass} name="frequency" value={frequency} onChange={(event) => changeFrequency(event.target.value as Frequency)}>
                <option value="none">Nem ismétlődik</option>
                <option value="daily">Naponta</option>
                <option value="weekly">Hetente</option>
                <option value="monthly">Havonta</option>
              </select>
            </label>

            {frequency !== 'none' ? <label className="text-sm font-semibold">Gyakoriság
              <div className="mt-1.5 flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3">
                <span className="text-sm text-slate-500">Minden</span>
                <input name="interval" type="number" min="1" max="52" value={interval} onChange={(event) => setInterval(Math.max(1, Math.min(52, Number(event.target.value) || 1)))} className="w-14 border-0 bg-transparent text-center font-bold outline-none" />
                <span className="text-sm text-slate-500">{frequency === 'daily' ? 'nap' : frequency === 'weekly' ? 'hét' : 'hónap'}</span>
              </div>
            </label> : null}

            {frequency !== 'none' ? <label className="text-sm font-semibold">Befejezés
              <select className={inputClass} name="endMode" value={endMode} onChange={(event) => setEndMode(event.target.value as EndMode)}>
                <option value="until">Adott dátumig</option>
                <option value="count">Adott alkalomszám után</option>
              </select>
            </label> : null}

            {frequency !== 'none' && endMode === 'until' ? <label className="text-sm font-semibold">Utolsó lehetséges nap<input className={inputClass} type="date" name="untilDate" min={sessionDate} value={untilDate} onChange={(event) => setUntilDate(event.target.value)} /></label> : null}
            {frequency !== 'none' && endMode === 'count' ? <label className="text-sm font-semibold">Alkalmak száma<input className={inputClass} type="number" name="occurrenceCount" min="1" max="240" value={count} onChange={(event) => setCount(Math.max(1, Math.min(240, Number(event.target.value) || 1)))} /></label> : null}
          </div>

          {frequency === 'weekly' ? (
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">Mely napokon legyen óra?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {weekdays.map((day) => {
                  const active = selectedDays.includes(day.value)
                  return <label key={day.value} className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-bold transition ${active ? 'border-[#bd8b3c] bg-amber-50 text-slate-950' : 'border-slate-300 bg-white text-slate-600'}`}><input type="checkbox" className="sr-only" name="weekday" value={day.value} checked={active} onChange={() => toggleDay(day.value)} />{day.label}</label>
                })}
              </div>
            </fieldset>
          ) : null}

          <p className="mt-4 text-sm font-semibold text-slate-600">{recurrenceSummary}</p>
        </div>

        <div className="flex justify-end"><button type="submit" className="min-h-10 rounded-lg bg-[#1b2430] px-5 text-sm font-bold text-white">{frequency === 'none' ? 'Óra hozzáadása' : 'Órasorozat létrehozása'}</button></div>
      </form>
    </section>
  )
}
