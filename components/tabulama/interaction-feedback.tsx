'use client'

import { AlertTriangle, CheckCircle2, CircleDot, LoaderCircle, Save } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type FeedbackKind = 'dirty' | 'saving' | 'success' | 'error'

type FeedbackState = {
  kind: FeedbackKind
  message: string
  detail?: string
} | null

const feedbackStyle: Record<FeedbackKind, string> = {
  dirty: 'border-amber-200 bg-amber-50 text-amber-950',
  saving: 'border-slate-300 bg-white text-slate-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  error: 'border-red-200 bg-red-50 text-red-950',
}

function FeedbackIcon({ kind }: { kind: FeedbackKind }) {
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
  if (target instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset'].includes(target.type)) return false
  return true
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

      if (element === error) {
        show({ kind: 'error', message: error!.innerText.trim(), detail: 'A módosítás nem került mentésre.' }, 6500)
        haptic([24, 30, 24])
        return
      }

      show({ kind: 'success', message: success!.innerText.trim(), detail: 'A változtatások elmentve.' }, 4000)
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
        message: 'Nem mentett módosítások',
        detail: 'A változtatások mentésre várnak.',
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
      show({ kind: 'saving', message: 'Mentés folyamatban…', detail: 'Kérlek, várj egy pillanatot.' })
      haptic(10)
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

    const initialTimer = window.setTimeout(showPageFeedback, 120)

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

  if (!feedback) return null

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
