'use client'

import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  LoaderCircle,
  Save,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  decodeCourseSessionConflictSummary,
  type CourseSessionConflictRelation,
  type CourseSessionConflictSummary,
} from '@/lib/course-session-conflict'

type StandardFeedbackKind = 'dirty' | 'saving' | 'success' | 'error'

type FeedbackState = {
  kind: StandardFeedbackKind
  message: string
  detail?: string
} | {
  kind: 'conflict'
  message: string
  detail: string
  summary: CourseSessionConflictSummary
} | null

const feedbackStyle: Record<StandardFeedbackKind, string> = {
  dirty: 'border-amber-200 bg-amber-50 text-amber-950',
  saving: 'border-slate-300 bg-white text-slate-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  error: 'border-red-200 bg-red-50 text-red-950',
}

const relationLabels: Record<CourseSessionConflictRelation, string> = {
  exact: 'Azonos időpont',
  inside_existing: 'A tervezett óra a meglévő időtartamába esik',
  contains_existing: 'A tervezett óra lefedi a meglévő alkalmat',
  partial_overlap: 'Részleges időbeli átfedés',
}

function FeedbackIcon({ kind }: { kind: StandardFeedbackKind }) {
  if (kind === 'success') return <CheckCircle2 className="h-5 w-5 text-emerald-700" />
  if (kind === 'error') return <AlertTriangle className="h-5 w-5 text-red-700" />
  if (kind === 'saving') return <LoaderCircle className="h-5 w-5 animate-spin text-slate-700" />
  return <Save className="h-5 w-5 text-amber-700" />
}

function canVibrate(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.vibrate === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function haptic(pattern: number | number[]): void {
  if (!canVibrate()) return
  navigator.vibrate(pattern)
}

function isTrackableField(target: EventTarget | null): target is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return false
  if (!target.name || target.dataset.feedbackIgnore === 'true') return false
  if (target instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset'].includes(target.type)) return false
  return true
}

function formatConflictDate(value: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function conflictStatusLabel(status: 'scheduled' | 'completed' | 'cancelled'): string {
  if (status === 'completed') return 'Megtartva'
  if (status === 'cancelled') return 'Elmaradt'
  return 'Tervezett'
}

export function InteractionFeedback() {
  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const dismissTimer = useRef<number | null>(null)

  useEffect(() => {
    const seenPageFeedback = new WeakSet<Element>()

    const clearDismissTimer = () => {
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current)
      dismissTimer.current = null
    }

    const show = (next: NonNullable<FeedbackState>, duration?: number) => {
      clearDismissTimer()
      setFeedback(next)
      if (duration) dismissTimer.current = window.setTimeout(() => setFeedback(null), duration)
    }

    const showPageFeedback = () => {
      const error = document.querySelector<HTMLElement>('[role="alert"]')
      const success = document.querySelector<HTMLElement>('[role="status"]')
      const element = error?.innerText.trim() ? error : success?.innerText.trim() ? success : null
      if (!element || seenPageFeedback.has(element)) return
      seenPageFeedback.add(element)
      const message = element.dataset.feedbackMessage?.trim() || element.innerText.trim()

      if (element === error) {
        show({ kind: 'error', message, detail: 'A módosítás nem került mentésre.' }, 6500)
        haptic([24, 30, 24])
        return
      }

      show({ kind: 'success', message, detail: 'A változtatások elmentve.' }, 4000)
      haptic(18)
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button, [role="button"], a[href]') : null
      if (!target) return
      if (target instanceof HTMLButtonElement && target.disabled) return
      if (event.pointerType === 'touch') haptic(7)
    }

    const markDirty = (event: Event) => {
      if (!isTrackableField(event.target)) return
      const form = event.target.form
      if (!form || form.dataset.feedback === 'off') return
      form.dataset.formState = 'dirty'
      show({
        kind: 'dirty',
        message: form.dataset.dirtyMessage || 'Nem mentett módosítások',
        detail: form.dataset.dirtyDetail || 'A változtatások mentésre várnak.',
      })
    }

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null
      if (!form || form.dataset.feedback === 'off') return
      form.dataset.formState = 'saving'
      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null
      if (submitter) {
        submitter.dataset.pending = 'true'
        submitter.setAttribute('aria-busy', 'true')
      }
      show({
        kind: 'saving',
        message: submitter?.dataset.pendingMessage || form.dataset.pendingMessage || 'Mentés folyamatban…',
        detail: submitter?.dataset.pendingDetail || form.dataset.pendingDetail || 'Kérlek, várj egy pillanatot.',
      })
      haptic(form.dataset.operation === 'delete' ? [12, 18, 12] : 10)
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!document.querySelector('form[data-form-state="dirty"]')) return
      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.addEventListener('input', markDirty)
    document.addEventListener('change', markDirty)
    document.addEventListener('submit', onSubmit)
    window.addEventListener('beforeunload', onBeforeUnload)

    const observer = new MutationObserver(() => {
      if (document.querySelector('[role="status"], [role="alert"]')) showPageFeedback()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    const conflictSummary = decodeCourseSessionConflictSummary(
      new URL(window.location.href).searchParams.get('conflicts'),
    )
    if (conflictSummary) {
      show({
        kind: 'conflict',
        message: 'Időpontütközés',
        detail: 'A mentés nem történt meg.',
        summary: conflictSummary,
      })
      haptic([28, 35, 28])
    }

    const initialTimer = window.setTimeout(() => {
      if (!conflictSummary) showPageFeedback()
    }, 120)

    return () => {
      clearDismissTimer()
      window.clearTimeout(initialTimer)
      observer.disconnect()
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('input', markDirty)
      document.removeEventListener('change', markDirty)
      document.removeEventListener('submit', onSubmit)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  function dismissFeedback() {
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current)
    dismissTimer.current = null
    setFeedback(null)

    const url = new URL(window.location.href)
    if (url.searchParams.has('conflicts')) {
      url.searchParams.delete('conflicts')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }

  if (!feedback) return null

  if (feedback.kind === 'conflict') {
    const hiddenCount = Math.max(0, feedback.summary.totalCount - feedback.summary.conflicts.length)

    return (
      <div
        className="pointer-events-auto fixed bottom-4 right-4 z-[130] w-[min(470px,calc(100vw-2rem))]"
        role="alertdialog"
        aria-labelledby="session-conflict-title"
        aria-describedby="session-conflict-description"
      >
        <div className="tabu-feedback-toast overflow-hidden rounded-xl border border-red-200 bg-white shadow-2xl">
          <div className="flex items-start gap-3 border-b border-red-100 bg-red-50 px-4 py-4">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p id="session-conflict-title" className="font-bold text-red-950">{feedback.message}</p>
              <p id="session-conflict-description" className="mt-1 text-sm leading-5 text-red-800">
                {feedback.detail} A rendszer {feedback.summary.totalCount} ütköző alkalmat talált.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissFeedback}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-red-700 hover:bg-red-100"
              aria-label="Ütközési visszajelzés bezárása"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[52vh] space-y-2 overflow-y-auto p-3">
            {feedback.summary.conflicts.map((conflict, index) => {
              const sameCourse = conflict.existingCourseId === feedback.summary.requestedCourseId
              const targetUrl = `/admin/kurzusok/${encodeURIComponent(conflict.existingCourseId)}?view=sessions&week=${conflict.existingSessionDate}&session=${encodeURIComponent(conflict.existingSessionId)}`

              return (
                <article key={`${conflict.existingSessionId}-${conflict.proposedSessionDate}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <time className="text-xs font-bold text-slate-700">{formatConflictDate(conflict.proposedSessionDate)}</time>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${sameCourse ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800'}`}>
                      {sameCourse ? 'Ugyanez a kurzus' : 'Másik kurzus'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Tervezett idő: <strong className="text-slate-900">{conflict.proposedStartTime}–{conflict.proposedEndTime}</strong>
                  </p>
                  <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-sm font-bold text-slate-950">{conflict.existingCourseShortTitle}</p>
                    <p className="mt-0.5 text-sm text-slate-700">{conflict.existingSessionTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {conflict.existingStartTime}–{conflict.existingEndTime} · {conflictStatusLabel(conflict.existingStatus)}
                    </p>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-red-700">{relationLabels[conflict.relation]}</p>
                  <a href={targetUrl} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#0f6cbd] hover:underline">
                    Ütköző óra megnyitása
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </article>
              )
            })}
            {hiddenCount > 0 ? (
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                További {hiddenCount} ütközés is van. Módosítsd az időpontot vagy rövidítsd az órasorozatot.
              </p>
            ) : null}
          </div>

          <div className="border-t border-slate-200 bg-white px-4 py-3">
            <p className="text-[11px] leading-4 text-slate-500">
              A részleges átfedések is ütközésnek számítanak. Az egymás után közvetlenül következő órák közös határidővel engedélyezettek.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[120] w-[min(380px,calc(100vw-2.5rem))]" aria-live="polite" aria-atomic="true">
      <div className={`tabu-feedback-toast flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-xl ${feedbackStyle[feedback.kind]}`}>
        <div className="mt-0.5 shrink-0"><FeedbackIcon kind={feedback.kind} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-5">{feedback.message}</p>
          {feedback.detail ? <p className="mt-0.5 text-xs leading-5 opacity-70">{feedback.detail}</p> : null}
        </div>
        {feedback.kind === 'dirty' ? <CircleDot className="mt-1 h-4 w-4 shrink-0 text-amber-600" /> : null}
      </div>
    </div>
  )
}
