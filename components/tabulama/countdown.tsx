'use client'

import { useEffect, useState } from 'react'

type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(target: number): TimeLeft | null {
  const diff = target - Date.now()
  if (diff <= 0) return null
  const seconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  }
}

const units: { key: keyof TimeLeft; label: string }[] = [
  { key: 'days', label: 'Nap' },
  { key: 'hours', label: 'Óra' },
  { key: 'minutes', label: 'Perc' },
  { key: 'seconds', label: 'Mp' },
]

export function Countdown({
  target,
  expiredLabel = 'A kedvezményes időszak lezárult',
}: {
  /** Target date as ISO string. */
  target: string
  expiredLabel?: string
}) {
  const targetMs = new Date(target).getTime()
  const [time, setTime] = useState<TimeLeft | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTime(getTimeLeft(targetMs))
    const id = setInterval(() => setTime(getTimeLeft(targetMs)), 1000)
    return () => clearInterval(id)
  }, [targetMs])

  if (!mounted) {
    // Placeholder to avoid layout shift / hydration mismatch.
    return (
      <div className="flex justify-center gap-2 sm:gap-3" aria-hidden>
        {units.map((u) => (
          <div
            key={u.key}
            className="flex h-[68px] w-[64px] flex-col items-center justify-center rounded-xl border border-primary/25 bg-primary/5 sm:h-20 sm:w-20"
          >
            <span className="font-heading text-2xl font-extrabold tabular-nums text-primary sm:text-3xl">
              --
            </span>
            <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {u.label}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (!time) {
    return (
      <p className="text-center text-sm font-semibold text-muted-foreground">
        {expiredLabel}
      </p>
    )
  }

  return (
    <div
      className="flex justify-center gap-2 sm:gap-3"
      role="timer"
      aria-live="off"
    >
      {units.map((u) => (
        <div
          key={u.key}
          className="flex h-[68px] w-[64px] flex-col items-center justify-center rounded-xl border border-primary/25 bg-primary/5 shadow-sm sm:h-20 sm:w-20"
        >
          <span className="font-heading text-2xl font-extrabold tabular-nums text-primary sm:text-3xl">
            {String(time[u.key]).padStart(2, '0')}
          </span>
          <span className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  )
}
