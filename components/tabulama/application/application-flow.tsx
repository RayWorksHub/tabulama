'use client'

import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Gift,
  TrendingDown,
  Send,
  Loader2,
  Pencil,
  Phone,
  FileSignature,
  BadgeCheck,
} from 'lucide-react'
import {
  formatHUF,
  formatHuDate,
  legalDocuments,
  provider,
  type PackageKey,
} from '@/lib/tabulama-config'
import type { ApplicationCourse } from '@/lib/course-repository'
import type { CoursePaymentOption, CoursePaymentOptions } from '@/lib/course-payment-options'
import {
  buildApplicationSchema,
  computeAgeInfo,
  grades,
  goals,
  experiences,
  guardianRelations,
  MESSAGE_MAX,
  type PayerType,
} from '@/lib/tabulama-application-schema'
import { LegalDialog } from './legal-dialog'

type StepKey =
  | 'package'
  | 'applicant'
  | 'participant'
  | 'guardian'
  | 'payment'
  | 'declarations'
  | 'review'

interface FormState {
  courseId: string
  packageKey: PackageKey | ''
  applicantType: 'child' | 'self' | ''
  participantName: string
  participantBirthDate: string
  participantEmail: string
  participantPhone: string
  grade: string
  goal: string
  experience: string
  schoolName: string
  message: string
  guardianName: string
  guardianEmail: string
  guardianPhone: string
  guardianRelation: string
  guardianDeclaration: boolean
  payerType: PayerType | ''
  billingName: string
  billingZip: string
  billingCity: string
  billingAddress: string
  billingEmail: string
  taxNumber: string
  declPrivacy: boolean
  declNotAutomatic: boolean
  declPaymentTerms: boolean
  declTruthful: boolean
  declGuardianAuth: boolean
  source: string
  referrer: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  website: string
}

const emptyState: FormState = {
  courseId: '',
  packageKey: '',
  applicantType: '',
  participantName: '',
  participantBirthDate: '',
  participantEmail: '',
  participantPhone: '',
  grade: '',
  goal: '',
  experience: '',
  schoolName: '',
  message: '',
  guardianName: '',
  guardianEmail: '',
  guardianPhone: '',
  guardianRelation: '',
  guardianDeclaration: false,
  payerType: '',
  billingName: '',
  billingZip: '',
  billingCity: '',
  billingAddress: '',
  billingEmail: '',
  taxNumber: '',
  declPrivacy: false,
  declNotAutomatic: false,
  declPaymentTerms: false,
  declTruthful: false,
  declGuardianAuth: false,
  source: '',
  referrer: '',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  website: '',
}

const STEP_LABELS: Record<StepKey, string> = {
  package: 'Csomag',
  applicant: 'Kit jelentkeztetsz?',
  participant: 'Résztvevő adatai',
  guardian: 'Törvényes képviselő',
  payment: 'Fizetés és számlázás',
  declarations: 'Nyilatkozatok',
  review: 'Ellenőrzés',
}

const STEP_FIELDS: Record<StepKey, (keyof FormState)[]> = {
  package: ['courseId', 'packageKey'],
  applicant: ['applicantType'],
  participant: [
    'participantName',
    'participantBirthDate',
    'participantEmail',
    'participantPhone',
    'grade',
    'goal',
    'experience',
    'schoolName',
    'message',
  ],
  guardian: ['guardianName', 'guardianEmail', 'guardianPhone', 'guardianRelation', 'guardianDeclaration'],
  payment: ['payerType', 'billingName', 'billingZip', 'billingCity', 'billingAddress', 'billingEmail', 'taxNumber'],
  declarations: ['declPrivacy', 'declNotAutomatic', 'declPaymentTerms', 'declTruthful', 'declGuardianAuth'],
  review: [],
}

const PAYER_LABELS: Record<PayerType, string> = {
  participant: 'A résztvevő fizet',
  guardian: 'A törvényes képviselő fizet',
  'other-person': 'Más magánszemély fizet',
  company: 'Cég vagy más szervezet fizet',
}

const PAYER_NAME_LABELS: Record<PayerType, string> = {
  participant: 'Résztvevő neve',
  guardian: 'Törvényes képviselő neve',
  'other-person': 'Másik magánszemély neve',
  company: 'Cégnév',
}

const BILLING_FIELDS: (keyof FormState)[] = [
  'billingName',
  'billingZip',
  'billingCity',
  'billingAddress',
  'billingEmail',
  'taxNumber',
]

function stateForPayer(state: FormState, payerType: PayerType): FormState {
  if (state.payerType === payerType) return state

  const automaticData =
    payerType === 'participant'
      ? { billingName: state.participantName, billingEmail: state.participantEmail }
      : payerType === 'guardian'
        ? { billingName: state.guardianName, billingEmail: state.guardianEmail }
        : { billingName: '', billingEmail: '' }

  return {
    ...state,
    payerType,
    ...automaticData,
    billingZip: '',
    billingCity: '',
    billingAddress: '',
    taxNumber: '',
  }
}

function toPayload(s: FormState) {
  return { ...s }
}

interface Props {
  course: ApplicationCourse
  initialPackageKey: PackageKey | null
  /** Igaz, ha az URL early-bird csomagot kért, de az már lejárt. */
  earlyBirdExpiredFromUrl: boolean
}

export function ApplicationFlow({ course, initialPackageKey, earlyBirdExpiredFromUrl }: Props) {
  const [state, setState] = useState<FormState>(() => ({
    ...emptyState,
    courseId: course.id,
    packageKey:
      initialPackageKey && course.paymentOptions[initialPackageKey]?.available
        ? initialPackageKey
        : '',
  }))
  const [step, setStep] = useState<StepKey>('package')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formMessage, setFormMessage] = useState<string | null>(
    earlyBirdExpiredFromUrl
      ? 'A korai (early-bird) ajánlat már lejárt, ezért kérjük, válassz a többi csomag közül.'
      : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ applicationId: string } | null>(null)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  const submittingRef = useRef(false)

  const now = useMemo(() => new Date(), [])
  const ageInfo = state.participantBirthDate
    ? computeAgeInfo(state.participantBirthDate, now)
    : null
  const isMinor = ageInfo?.valid ? ageInfo.isMinor : false

  const visibleSteps = useMemo<StepKey[]>(() => {
    const base: StepKey[] = ['package', 'applicant', 'participant']
    if (isMinor) base.push('guardian')
    base.push('payment', 'declarations', 'review')
    return base
  }, [isMinor])

  // Ha a kiskorú/nagykorú státusz megváltozik, igazítsuk a fizető alapértékét.
  useEffect(() => {
    setState((prev) => {
      if (!prev.participantBirthDate) return prev
      if (isMinor && prev.payerType === 'participant') return stateForPayer(prev, 'guardian')
      if (!isMinor && prev.payerType === 'guardian') return stateForPayer(prev, 'participant')
      if (!prev.payerType) return stateForPayer(prev, isMinor ? 'guardian' : 'participant')
      return prev
    })
    setErrors((prev) => {
      const next = { ...prev }
      for (const field of BILLING_FIELDS) delete next[String(field)]
      return next
    })
  }, [isMinor, state.participantBirthDate])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setState((prev) => ({
      ...prev,
      source: prev.source || params.get('source') || 'website',
      referrer: prev.referrer || document.referrer.slice(0, 500),
      utmSource: prev.utmSource || params.get('utm_source') || '',
      utmMedium: prev.utmMedium || params.get('utm_medium') || '',
      utmCampaign: prev.utmCampaign || params.get('utm_campaign') || '',
    }))
  }, [])

  // Lépésváltáskor a címsor kapjon fókuszt (akadálymentesség).
  useEffect(() => {
    headingRef.current?.focus()
  }, [step, success])

  useEffect(() => {
    if (formMessage) messageRef.current?.focus()
  }, [formMessage])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => {
      const next: FormState = { ...prev, [key]: value }
      if (key === 'participantName' && prev.payerType === 'participant') {
        next.billingName = String(value)
      }
      if (key === 'participantEmail' && prev.payerType === 'participant') {
        next.billingEmail = String(value)
      }
      if (key === 'guardianName' && prev.payerType === 'guardian') {
        next.billingName = String(value)
      }
      if (key === 'guardianEmail' && prev.payerType === 'guardian') {
        next.billingEmail = String(value)
      }
      return next
    })
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key as string]
      if (key === 'participantName' && state.payerType === 'participant') delete next.billingName
      if (key === 'participantEmail' && state.payerType === 'participant') delete next.billingEmail
      if (key === 'guardianName' && state.payerType === 'guardian') delete next.billingName
      if (key === 'guardianEmail' && state.payerType === 'guardian') delete next.billingEmail
      return next
    })
  }

  function changePayerType(payerType: PayerType) {
    setState((prev) => stateForPayer(prev, payerType))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.payerType
      for (const field of BILLING_FIELDS) delete next[String(field)]
      return next
    })
    setFormMessage(null)
  }

  function collectErrors(): Record<string, string> {
    const schema = buildApplicationSchema(new Date())
    const result = schema.safeParse(toPayload(state))
    if (result.success) return {}
    const map: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_form'
      if (!map[key]) map[key] = issue.message
    }
    return map
  }

  function focusFirstError(keys: string[], map: Record<string, string>) {
    const firstKey = keys.find((k) => map[k])
    if (firstKey) {
      const el = document.getElementById(`f-${firstKey}`)
      el?.focus()
    }
  }

  function goNext() {
    const allErrors = collectErrors()
    const fields = STEP_FIELDS[step].map(String)
    const stepErrors: Record<string, string> = {}
    for (const f of fields) if (allErrors[f]) stepErrors[f] = allErrors[f]

    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors)
      focusFirstError(fields, stepErrors)
      return
    }
    setErrors({})
    const idx = visibleSteps.indexOf(step)
    if (idx < visibleSteps.length - 1) setStep(visibleSteps[idx + 1])
  }

  function goBack() {
    setErrors({})
    setFormMessage(null)
    const idx = visibleSteps.indexOf(step)
    if (idx > 0) setStep(visibleSteps[idx - 1])
  }

  function jumpTo(target: StepKey) {
    setErrors({})
    setFormMessage(null)
    setStep(target)
  }

  async function handleSubmit() {
    if (submittingRef.current) return
    const allErrors = collectErrors()
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      setFormMessage('Néhány mezőt még javítani kell a beküldés előtt.')
      // Ugorjunk az első hibát tartalmazó lépésre.
      const target = visibleSteps.find((s) => STEP_FIELDS[s].some((f) => allErrors[String(f)]))
      if (target) {
        setStep(target)
        setTimeout(() => focusFirstError(STEP_FIELDS[target].map(String), allErrors), 60)
      }
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setFormMessage(null)
    try {
      const res = await fetch('/api/tabulama/jelentkezes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(state)),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok && typeof data.applicationId === 'string' && data.applicationId) {
        setSuccess({ applicationId: data.applicationId })
        return
      }
      if (res.status === 422 && data.fieldErrors) {
        setErrors(data.fieldErrors)
        const target = visibleSteps.find((s) =>
          STEP_FIELDS[s].some((f) => data.fieldErrors[String(f)]),
        )
        if (target) setStep(target)
        setFormMessage(data.message ?? 'Kérjük, ellenőrizd a megjelölt mezőket.')
      } else {
        setFormMessage(
          data.message ??
            'A beküldés átmenetileg nem sikerült. Az adataid megmaradtak – kérjük, próbáld újra.',
        )
      }
    } catch {
      setFormMessage(
        'Hálózati hiba történt a beküldés közben. Az adataid megmaradtak – kérjük, próbáld újra.',
      )
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (success) {
    return <SuccessPanel applicationId={success.applicationId} headingRef={headingRef} />
  }

  const stepIndex = visibleSteps.indexOf(step)
  const pkg = state.packageKey ? course.paymentOptions[state.packageKey] : null

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="order-2 lg:order-1">
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kiválasztott kurzus</p>
          <p className="mt-1 font-heading font-bold text-foreground">{course.title}</p>
        </div>
        {/* Progress */}
        <ol className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm" aria-label="Lépések">
          {visibleSteps.map((s, i) => {
            const done = i < stepIndex
            const current = i === stepIndex
            return (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    current
                      ? 'bg-primary text-primary-foreground'
                      : done
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  aria-current={current ? 'step' : undefined}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`hidden sm:inline ${current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {STEP_LABELS[s]}
                </span>
                {i < visibleSteps.length - 1 && (
                  <span className="mx-1 hidden h-px w-4 bg-border sm:inline-block" aria-hidden="true" />
                )}
              </li>
            )
          })}
        </ol>

        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-heading text-2xl font-bold outline-none sm:text-3xl"
        >
          {STEP_LABELS[step]}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stepIndex + 1}. lépés / {visibleSteps.length}
        </p>

        {formMessage && (
          <div
            ref={messageRef}
            tabIndex={-1}
            role="alert"
            className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive outline-none"
          >
            {formMessage}
          </div>
        )}

        <div className="mt-6">
          {step === 'package' && (
            <PackageStep state={state} paymentOptions={course.paymentOptions} error={errors.packageKey} onSelect={(k) => update('packageKey', k)} />
          )}
          {step === 'applicant' && (
            <ApplicantStep value={state.applicantType} error={errors.applicantType} onSelect={(v) => update('applicantType', v)} />
          )}
          {step === 'participant' && (
            <ParticipantStep state={state} errors={errors} update={update} isMinor={isMinor} ageInfo={ageInfo} />
          )}
          {step === 'guardian' && (
            <GuardianStep state={state} errors={errors} update={update} />
          )}
          {step === 'payment' && (
            <PaymentStep
              state={state}
              errors={errors}
              update={update}
              onPayerTypeChange={changePayerType}
              isMinor={isMinor}
            />
          )}
          {step === 'declarations' && (
            <DeclarationsStep state={state} errors={errors} update={update} isMinor={isMinor} />
          )}
          {step === 'review' && (
            <ReviewStep state={state} isMinor={isMinor} paymentOptions={course.paymentOptions} onEdit={jumpTo} />
          )}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border px-5 py-2.5 font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Vissza
            </button>
          ) : (
            <span />
          )}

          {step !== 'review' ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Tovább
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-2.5 font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? 'Küldés folyamatban…' : 'Jelentkezés elküldése'}
            </button>
          )}
        </div>
      </div>

      {/* Package summary */}
      <aside className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-24">
          <PackageSummary pkg={pkg} onChange={() => jumpTo('package')} />
        </div>
      </aside>
    </div>
  )
}

/* ---------------------------------------------------------------- helpers */

function Field({
  id,
  label,
  error,
  required,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}) {
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <div className="mt-1.5">{children({ id, describedBy, invalid: Boolean(error) })}</div>
      {error && (
        <p id={errId} role="alert" className="mt-1.5 flex items-start gap-1 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

const inputClass =
  'w-full min-h-[44px] rounded-xl border bg-background px-3.5 py-2.5 text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 placeholder:text-muted-foreground/70'

function fieldBorder(invalid: boolean) {
  return invalid ? 'border-destructive' : 'border-input'
}

function TextInput(props: {
  id: string
  value: string
  onChange: (v: string) => void
  describedBy?: string
  invalid: boolean
  type?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'tel' | 'numeric'
}) {
  const { id, value, onChange, describedBy, invalid, type = 'text', ...rest } = props
  return (
    <input
      id={`f-${id}`}
      name={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className={`${inputClass} ${fieldBorder(invalid)}`}
      {...rest}
    />
  )
}

function SelectInput(props: {
  id: string
  value: string
  onChange: (v: string) => void
  describedBy?: string
  invalid: boolean
  options: readonly string[]
  placeholder: string
}) {
  const { id, value, onChange, describedBy, invalid, options, placeholder } = props
  return (
    <select
      id={`f-${id}`}
      name={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className={`${inputClass} ${fieldBorder(invalid)} appearance-none`}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function CheckboxRow(props: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  error?: string
  children: ReactNode
}) {
  const { id, checked, onChange, error, children } = props
  const errId = error ? `${id}-err` : undefined
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          id={`f-${id}`}
          name={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={errId}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-input text-primary accent-primary focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-sm leading-relaxed text-foreground">{children}</span>
      </label>
      {error && (
        <p id={errId} role="alert" className="ml-8 mt-1 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ steps */

function PackageStep({
  state,
  paymentOptions,
  error,
  onSelect,
}: {
  state: FormState
  paymentOptions: CoursePaymentOptions
  error?: string
  onSelect: (k: PackageKey) => void
}) {
  const order: PackageKey[] = ['early-bird', 'standard', 'installment']
  return (
    <fieldset>
      <legend className="text-sm text-muted-foreground">
        Válaszd ki a fizetési konstrukciót. Később bármikor módosíthatod.
      </legend>
      <div id="f-packageKey" className="mt-4 grid gap-3" aria-invalid={Boolean(error)}>
        {order.map((key) => {
          const pkg = paymentOptions[key]
          if (!pkg) return null
          const disabled = !pkg.available
          const selected = state.packageKey === key
          return (
            <button
              type="button"
              key={key}
              disabled={disabled}
              onClick={() => onSelect(key)}
              className={`rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
              aria-pressed={selected}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-heading font-bold text-foreground">{pkg.name}</span>
                <span className="font-heading text-lg font-bold text-primary">{formatHUF(pkg.total)}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
              {disabled && <p className="mt-1 text-xs font-semibold text-destructive">Az ajánlat lejárt.</p>}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}

function ApplicantStep({
  value,
  error,
  onSelect,
}: {
  value: string
  error?: string
  onSelect: (v: 'child' | 'self') => void
}) {
  const options: { key: 'child' | 'self'; label: string; desc: string }[] = [
    { key: 'child', label: 'Gyermekemet jelentkeztetem', desc: 'Kiskorú résztvevőnél a törvényes képviselő adatait is bekérjük.' },
    { key: 'self', label: 'Saját magamat jelentkeztetem', desc: 'Ha 18 év alatti vagy, a törvényes képviselő lépését automatikusan hozzáadjuk.' },
  ]
  return (
    <fieldset>
      <legend className="text-sm text-muted-foreground">
        18 év alatti résztvevőnél a törvényes képviselő adatai is szükségesek lesznek.
      </legend>
      <div id="f-applicantType" className="mt-4 grid gap-3 sm:grid-cols-2" aria-invalid={Boolean(error)}>
        {options.map((o) => {
          const selected = value === o.key
          return (
            <button
              type="button"
              key={o.key}
              onClick={() => onSelect(o.key)}
              className={`rounded-2xl border-2 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              aria-pressed={selected}
            >
              <span className="font-heading font-bold text-foreground">{o.label}</span>
              <p className="mt-1.5 text-sm text-muted-foreground">{o.desc}</p>
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}

function ParticipantStep({
  state,
  errors,
  update,
  isMinor,
  ageInfo,
}: {
  state: FormState
  errors: Record<string, string>
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  isMinor: boolean
  ageInfo: ReturnType<typeof computeAgeInfo> | null
}) {
  return (
    <div className="grid gap-5">
      <Field id="participantName" label="Résztvevő teljes neve" required error={errors.participantName}>
        {(p) => (
          <TextInput {...p} value={state.participantName} onChange={(v) => update('participantName', v)} autoComplete="name" />
        )}
      </Field>

      <Field
        id="participantBirthDate"
        label="Születési dátum"
        required
        error={errors.participantBirthDate}
        hint="Az életkort ebből számoljuk – 18 év alatt a törvényes képviselő adatait is kérjük."
      >
        {(p) => (
          <TextInput {...p} type="date" value={state.participantBirthDate} onChange={(v) => update('participantBirthDate', v)} />
        )}
      </Field>

      {ageInfo?.valid && state.applicantType === 'self' && isMinor && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
          A megadott dátum szerint még nem vagy 18 éves, ezért a jelentkezéshez a törvényes
          képviselőd adatait is bekérjük egy külön lépésben.
        </div>
      )}

      <Field
        id="participantEmail"
        label="Résztvevő e-mail-címe"
        error={errors.participantEmail}
        hint="Add meg, ha a résztvevőnek van saját e-mail-címe."
      >
        {(p) => (
          <TextInput {...p} type="email" inputMode="email" value={state.participantEmail} onChange={(v) => update('participantEmail', v)} autoComplete="email" />
        )}
      </Field>

      <Field
        id="participantPhone"
        label="Résztvevő telefonszáma"
        required={!isMinor}
        error={errors.participantPhone}
        hint={isMinor ? 'Kiskorúnál nem kötelező – a kapcsolattartás a képviselőn keresztül történik.' : undefined}
      >
        {(p) => (
          <TextInput {...p} type="tel" inputMode="tel" value={state.participantPhone} onChange={(v) => update('participantPhone', v)} autoComplete="tel" placeholder="+36 ..." />
        )}
      </Field>

      <Field id="grade" label="Évfolyam" required error={errors.grade}>
        {(p) => <SelectInput {...p} value={state.grade} onChange={(v) => update('grade', v)} options={grades} placeholder="Válassz évfolyamot" />}
      </Field>

      <Field id="goal" label="Felkészülési cél" required error={errors.goal}>
        {(p) => <SelectInput {...p} value={state.goal} onChange={(v) => update('goal', v)} options={goals} placeholder="Válassz célt" />}
      </Field>

      <Field id="experience" label="Programozási tapasztalat" required error={errors.experience}>
        {(p) => <SelectInput {...p} value={state.experience} onChange={(v) => update('experience', v)} options={experiences} placeholder="Válassz szintet" />}
      </Field>

      <Field id="schoolName" label="Iskola neve" error={errors.schoolName}>
        {(p) => <TextInput {...p} value={state.schoolName} onChange={(v) => update('schoolName', v)} />}
      </Field>

      <Field
        id="message"
        label="Üzenet (nem kötelező)"
        error={errors.message}
        hint="Kérjük, ne írj ide egészségügyi vagy más különleges személyes adatot."
      >
        {(p) => (
          <div>
            <textarea
              id={`f-${p.id}`}
              name="message"
              value={state.message}
              onChange={(e) => update('message', e.target.value.slice(0, MESSAGE_MAX))}
              aria-invalid={p.invalid}
              aria-describedby={p.describedBy}
              rows={4}
              className={`${inputClass} ${fieldBorder(p.invalid)} resize-y`}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {state.message.length}/{MESSAGE_MAX}
            </p>
          </div>
        )}
      </Field>
    </div>
  )
}

function GuardianStep({
  state,
  errors,
  update,
}: {
  state: FormState
  errors: Record<string, string>
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void
}) {
  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        A résztvevő 18 év alatti, ezért a törvényes képviselő e-mail-címe és telefonszáma lesz az
        elsődleges kapcsolattartási adat.
      </div>

      <Field id="guardianName" label="Törvényes képviselő teljes neve" required error={errors.guardianName}>
        {(p) => <TextInput {...p} value={state.guardianName} onChange={(v) => update('guardianName', v)} autoComplete="name" />}
      </Field>

      <Field id="guardianEmail" label="Képviselő e-mail-címe" required error={errors.guardianEmail}>
        {(p) => <TextInput {...p} type="email" inputMode="email" value={state.guardianEmail} onChange={(v) => update('guardianEmail', v)} autoComplete="email" />}
      </Field>

      <Field id="guardianPhone" label="Képviselő telefonszáma" required error={errors.guardianPhone}>
        {(p) => <TextInput {...p} type="tel" inputMode="tel" value={state.guardianPhone} onChange={(v) => update('guardianPhone', v)} autoComplete="tel" placeholder="+36 ..." />}
      </Field>

      <Field id="guardianRelation" label="Kapcsolat a résztvevővel" required error={errors.guardianRelation}>
        {(p) => <SelectInput {...p} value={state.guardianRelation} onChange={(v) => update('guardianRelation', v)} options={guardianRelations} placeholder="Válassz kapcsolatot" />}
      </Field>

      <CheckboxRow
        id="guardianDeclaration"
        checked={state.guardianDeclaration}
        onChange={(v) => update('guardianDeclaration', v)}
        error={errors.guardianDeclaration}
      >
        Kijelentem, hogy a résztvevő képviseletére jogosult vagyok.
      </CheckboxRow>
    </div>
  )
}

function PaymentStep({
  state,
  errors,
  update,
  onPayerTypeChange,
  isMinor,
}: {
  state: FormState
  errors: Record<string, string>
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  onPayerTypeChange: (payerType: PayerType) => void
  isMinor: boolean
}) {
  const options = (Object.keys(PAYER_LABELS) as PayerType[]).filter((k) => {
    if (k === 'participant') return !isMinor
    if (k === 'guardian') return isMinor
    return true
  })

  const isCompany = state.payerType === 'company'
  const billingNameLabel = state.payerType
    ? PAYER_NAME_LABELS[state.payerType]
    : 'Számlázási név'

  return (
    <div className="grid gap-5">
      <fieldset>
        <legend className="text-sm font-semibold text-foreground">Ki fizeti a képzést?</legend>
        <div id="f-payerType" className="mt-3 grid gap-2.5" aria-invalid={Boolean(errors.payerType)}>
          {options.map((k) => {
            const selected = state.payerType === k
            return (
              <button
                type="button"
                key={k}
                onClick={() => onPayerTypeChange(k)}
                className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  selected ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
                aria-pressed={selected}
              >
                {PAYER_LABELS[k]}
              </button>
            )
          })}
        </div>
        {errors.payerType && (
          <p role="alert" className="mt-2 text-sm font-medium text-destructive">
            {errors.payerType}
          </p>
        )}
      </fieldset>

      <Field id="billingName" label={billingNameLabel} required error={errors.billingName}>
        {(p) => <TextInput {...p} value={state.billingName} onChange={(v) => update('billingName', v)} />}
      </Field>

      <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
        <Field id="billingZip" label="Irányítószám" required error={errors.billingZip}>
          {(p) => <TextInput {...p} inputMode="numeric" value={state.billingZip} onChange={(v) => update('billingZip', v)} autoComplete="postal-code" />}
        </Field>
        <Field id="billingCity" label="Település" required error={errors.billingCity}>
          {(p) => <TextInput {...p} value={state.billingCity} onChange={(v) => update('billingCity', v)} autoComplete="address-level2" />}
        </Field>
      </div>

      <Field
        id="billingAddress"
        label="Cím (közterület, házszám, emelet/ajtó)"
        required
        error={errors.billingAddress}
      >
        {(p) => <TextInput {...p} value={state.billingAddress} onChange={(v) => update('billingAddress', v)} autoComplete="street-address" />}
      </Field>

      <Field id="billingEmail" label="Számlázási e-mail-cím" required error={errors.billingEmail}>
        {(p) => <TextInput {...p} type="email" inputMode="email" value={state.billingEmail} onChange={(v) => update('billingEmail', v)} autoComplete="email" />}
      </Field>

      {isCompany && (
        <Field id="taxNumber" label="Adószám" required error={errors.taxNumber}>
          {(p) => <TextInput {...p} value={state.taxNumber} onChange={(v) => update('taxNumber', v)} placeholder="pl. 12345678-1-42" />}
        </Field>
      )}

      <p className="text-xs text-muted-foreground">
        Ezeket az adatokat kizárólag a későbbi díjbekérő előkészítéséhez gyűjtjük.
      </p>
    </div>
  )
}

function DeclarationsStep({
  state,
  errors,
  update,
  isMinor,
}: {
  state: FormState
  errors: Record<string, string>
  update: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  isMinor: boolean
}) {
  return (
    <div className="grid gap-4">
      <CheckboxRow id="declPrivacy" checked={state.declPrivacy} onChange={(v) => update('declPrivacy', v)} error={errors.declPrivacy}>
        Elolvastam és tudomásul vettem az{' '}
        <LegalDialog
          title={legalDocuments.privacyPolicy.title}
          triggerLabel="Adatkezelési tájékoztatót"
          externalUrl={legalDocuments.privacyPolicy.url}
        >
          <LegalPlaceholderNotice doc="adatkezelési tájékoztató" />
        </LegalDialog>
        . Ez nem általános adatkezelési hozzájárulás.
      </CheckboxRow>

      <CheckboxRow id="declNotAutomatic" checked={state.declNotAutomatic} onChange={(v) => update('declNotAutomatic', v)} error={errors.declNotAutomatic}>
        Tudomásul veszem, hogy a jelentkezési űrlap elküldése nem jelent automatikus felvételt vagy
        szerződéskötést. A hely az aláírt szerződés és a teljes díj vagy az első részlet jóváírása
        után válik véglegessé.
      </CheckboxRow>

      <CheckboxRow id="declPaymentTerms" checked={state.declPaymentTerms} onChange={(v) => update('declPaymentTerms', v)} error={errors.declPaymentTerms}>
        A kiválasztott fizetési konstrukció feltételeit és összegét megismertem
        {legalDocuments.applicationTerms.url ? (
          <>
            {' ('}
            <LegalDialog
              title={legalDocuments.applicationTerms.title}
              triggerLabel="Jelentkezési és fizetési feltételek"
              externalUrl={legalDocuments.applicationTerms.url}
            >
              <LegalPlaceholderNotice doc="jelentkezési és fizetési feltételek" />
            </LegalDialog>
            {')'}
          </>
        ) : null}
        .
      </CheckboxRow>

      <CheckboxRow id="declTruthful" checked={state.declTruthful} onChange={(v) => update('declTruthful', v)} error={errors.declTruthful}>
        Kijelentem, hogy a megadott adatok a valóságnak megfelelnek.
      </CheckboxRow>

      {isMinor && (
        <CheckboxRow id="declGuardianAuth" checked={state.declGuardianAuth} onChange={(v) => update('declGuardianAuth', v)} error={errors.declGuardianAuth}>
          Kijelentem, hogy a résztvevő törvényes képviselője vagyok, képviseletére jogosult vagyok,
          és a jelentkezéshez hozzájárulok.
        </CheckboxRow>
      )}
    </div>
  )
}

function LegalPlaceholderNotice({ doc }: { doc: string }) {
  return (
    <div>
      <p>
        A(z) {doc} végleges, nyilvános változata még feltöltés alatt áll. A dokumentum végleges
        szövegét és hivatalos elérhetőségét az éles indulás előtt tesszük közzé.
      </p>
      <p className="mt-3">
        Addig is kérdés esetén írj bátran:{' '}
        <a className="font-semibold text-primary underline" href={`mailto:${provider.email}`}>
          {provider.email}
        </a>
      </p>
    </div>
  )
}

function ReviewStep({
  state,
  isMinor,
  paymentOptions,
  onEdit,
}: {
  state: FormState
  isMinor: boolean
  paymentOptions: CoursePaymentOptions
  onEdit: (s: StepKey) => void
}) {
  const pkg = state.packageKey ? paymentOptions[state.packageKey] : null
  return (
    <div className="grid gap-4">
      <ReviewBlock title="Csomag" onEdit={() => onEdit('package')}>
        {pkg ? (
          <>
            <Row label="Csomag" value={pkg.name} />
            <Row
              label="Teljes díj"
              value={
                pkg.paymentType === 'installment' && pkg.installmentCount && pkg.installmentAmount
                  ? `${formatHUF(pkg.total)} (${pkg.installmentCount} × ${formatHUF(pkg.installmentAmount)})`
                  : formatHUF(pkg.total)
              }
            />
            {pkg.paymentDeadline && (
              <Row
                label={pkg.paymentType === 'installment' ? 'Első részlet határideje' : 'Fizetési határidő'}
                value={formatHuDate(pkg.paymentDeadline)}
              />
            )}
            {pkg.bonusPrivateLessons != null && (
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                  <Gift className="h-3.5 w-3.5" />
                  {pkg.bonusPrivateLessons} × {pkg.bonusLessonMinutes} perc ajándék magánóra
                </span>
                {pkg.savingsVsStandard != null && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                    <TrendingDown className="h-3.5 w-3.5" />
                    {formatHUF(pkg.savingsVsStandard)} megtakarítás
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-destructive">Nincs kiválasztott csomag.</p>
        )}
      </ReviewBlock>

      <ReviewBlock title="Résztvevő" onEdit={() => onEdit('participant')}>
        <Row label="Név" value={state.participantName} />
        <Row label="Születési dátum" value={state.participantBirthDate} />
        <Row label="Évfolyam" value={state.grade} />
        <Row label="Cél" value={state.goal} />
        <Row label="Tapasztalat" value={state.experience} />
        {state.schoolName && <Row label="Iskola" value={state.schoolName} />}
        {state.participantEmail && <Row label="E-mail" value={state.participantEmail} />}
        {state.participantPhone && <Row label="Telefon" value={state.participantPhone} />}
        {state.message && <Row label="Üzenet" value={state.message} />}
      </ReviewBlock>

      {isMinor && (
        <ReviewBlock title="Törvényes képviselő" onEdit={() => onEdit('guardian')}>
          <Row label="Név" value={state.guardianName} />
          <Row label="Kapcsolat" value={state.guardianRelation} />
          <Row label="E-mail" value={state.guardianEmail} />
          <Row label="Telefon" value={state.guardianPhone} />
        </ReviewBlock>
      )}

      <ReviewBlock title="Fizető és számlázás" onEdit={() => onEdit('payment')}>
        <Row label="Fizető" value={state.payerType ? PAYER_LABELS[state.payerType] : ''} />
        <Row label="Számlázási név" value={state.billingName} />
        <Row label="Cím" value={`${state.billingZip} ${state.billingCity}, ${state.billingAddress}`} />
        <Row label="Számlázási e-mail" value={state.billingEmail} />
        {state.taxNumber && <Row label="Adószám" value={state.taxNumber} />}
      </ReviewBlock>

      <ReviewBlock title="Nyilatkozatok" onEdit={() => onEdit('declarations')}>
        <p className="text-sm text-muted-foreground">
          A kötelező nyilatkozatokat elfogadtad. A beküldéssel megerősíted a megadott adatok
          valódiságát.
        </p>
      </ReviewBlock>
    </div>
  )
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="font-heading font-bold text-foreground">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil className="h-3.5 w-3.5" />
          Módosítás
        </button>
      </div>
      <div className="grid gap-1.5">{children}</div>
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}

function PackageSummary({ pkg, onChange }: { pkg: CoursePaymentOption | null; onChange: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Választott csomag
        </h2>
        <button
          type="button"
          onClick={onChange}
          className="rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Módosítás
        </button>
      </div>

      {pkg ? (
        <div className="mt-3">
          <p className="font-heading text-lg font-bold text-foreground">{pkg.name}</p>
          <p className="font-heading mt-1 text-3xl font-extrabold text-primary">{formatHUF(pkg.total)}</p>
          {pkg.paymentType === 'installment' && pkg.installmentCount && pkg.installmentAmount && (
            <p className="text-sm text-muted-foreground">
              {pkg.installmentCount} × {formatHUF(pkg.installmentAmount)}
            </p>
          )}
          {pkg.paymentDeadline && (
            <p className="mt-2 text-sm text-muted-foreground">
              {pkg.paymentType === 'installment' ? 'Első részlet: ' : 'Fizetési határidő: '}
              {formatHuDate(pkg.paymentDeadline)}
            </p>
          )}
          {pkg.bonusPrivateLessons != null && (
            <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-sm">
              <li className="flex items-center gap-2 text-foreground">
                <Gift className="h-4 w-4 text-primary" />
                {pkg.bonusPrivateLessons} × {pkg.bonusLessonMinutes} perc ajándék magánóra
              </li>
              {pkg.savingsVsStandard != null && (
                <li className="flex items-center gap-2 text-foreground">
                  <TrendingDown className="h-4 w-4 text-primary" />
                  {formatHUF(pkg.savingsVsStandard)} megtakarítás
                </li>
              )}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Még nincs csomag kiválasztva. Az első lépésben tudod kiválasztani.
        </p>
      )}
    </div>
  )
}

function SuccessPanel({
  applicationId,
  headingRef,
}: {
  applicationId: string
  headingRef: React.RefObject<HTMLHeadingElement | null>
}) {
  const steps = [
    { icon: Phone, title: 'Telefonos egyeztetés', desc: 'Rajmund telefonon keres a megadott számon.' },
    { icon: FileSignature, title: 'Szerződés és díjbekérő', desc: 'Az egyeztetés után küldjük a szerződést és a díjbekérőt.' },
    { icon: BadgeCheck, title: 'Befizetés után végleges hely', desc: 'A hely a díj vagy az első részlet jóváírása után válik véglegessé.' },
  ]
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
        <Check className="h-8 w-8 text-primary" />
      </div>
      <h2 ref={headingRef} tabIndex={-1} className="font-heading mt-6 text-3xl font-bold outline-none">
        Köszönjük, a jelentkezésed megérkezett.
      </h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        Rajmund rövidesen telefonon keres a megadott számon, hogy átbeszéljétek a képzés részleteit
        és megerősítsétek a választott fizetési konstrukciót. Az űrlap elküldése még nem jelent
        szerződéskötést vagy automatikus felvételt. A hely az aláírt szerződés és a teljes képzési
        díj vagy az első részlet jóváírása után válik véglegessé.
      </p>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
        <span className="text-sm text-muted-foreground">Jelentkezési azonosító:</span>
        <span className="font-heading font-bold tracking-wide text-foreground">{applicationId}</span>
      </div>

      <ol className="mt-8 grid gap-4 text-left sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <p className="font-heading mt-3 font-bold text-foreground">
              {i + 1}. {s.title}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </li>
        ))}
      </ol>

      <Link
        href="/"
        className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Vissza a főoldalra
      </Link>
    </div>
  )
}
