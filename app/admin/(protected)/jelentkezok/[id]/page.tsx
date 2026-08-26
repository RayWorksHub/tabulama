import Link from 'next/link'
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  UserRound,
} from 'lucide-react'
import { notFound } from 'next/navigation'
import { getApplicationById } from '@/lib/application-repository'
import type { ApplicationWorkflowEmailEvent } from '@/lib/tabulama-email'
import {
  APPLICATION_STATUSES,
  applicationStatusLabel,
  applicationStatusLabels,
  formatAdminDate,
  formatAdminDay,
  paymentMethodLabels,
  paymentStatusLabel,
} from '@/lib/admin-display'
import { formatHUF, packages } from '@/lib/tabulama-config'
import { StatusBadge } from '@/components/admin/status-badge'
import {
  recordApplicationPaymentAction,
  resendApplicationEmailAction,
  updateApplicationStatusAction,
  updatePaymentItemDueDateAction,
} from './actions'

export const dynamic = 'force-dynamic'

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800">{value || '—'}</dd>
    </div>
  )
}

const successMessages: Record<string, string> = {
  status_updated: 'A jelentkezés státusza frissült.',
  payment_recorded: 'A befizetés rögzítve, az egyenleg és a státuszok frissültek.',
  due_date_updated: 'A fizetési határidő és az érintett státuszok frissültek.',
  test_created: 'A 10 Ft-os TESZT jelentkezés elkészült.',
  email_resent: 'A rendszerlevél sikeresen elküldve.',
}

const errorMessages: Record<string, string> = {
  invalid_form: 'Ellenőrizd a megadott adatokat.',
  not_found: 'A jelentkezés nem található.',
  payment_plan_missing: 'Ehhez a részlethez nem található fizetési terv.',
  overpayment: 'Az összeg nagyobb a részlet fennmaradó egyenlegénél.',
  inactive_application: 'Elutasított vagy lemondott jelentkezéshez nem rögzíthető befizetés.',
  no_change: 'Válassz másik státuszt, vagy adj meg megjegyzést.',
  save_failed: 'A módosítás most nem menthető. Próbáld újra.',
  email_send_failed: 'A rendszerlevél nem küldhető el. Az eredmény az e-mail státuszoknál látható.',
}

const emailEventLabels: Record<ApplicationWorkflowEmailEvent, string> = {
  received: 'Jelentkezés beérkezett',
  accepted: 'Jelentkezés elfogadva',
  awaiting_payment: 'Fizetésre vár',
  payment_recorded: 'Befizetés rögzítve',
  enrolled: 'Sikeres beiratkozás',
  course_completed: 'Kurzus teljesítve',
}

const resendableEmailEvents: ApplicationWorkflowEmailEvent[] = [
  'received',
  'accepted',
  'awaiting_payment',
  'payment_recorded',
  'enrolled',
]

function paymentBadgeClasses(status: string): string {
  const variants: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-700 ring-slate-200',
    partially_paid: 'bg-orange-50 text-orange-800 ring-orange-200',
    paid: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    overdue: 'bg-red-50 text-red-800 ring-red-200',
    cancelled: 'bg-slate-100 text-slate-500 ring-slate-200',
  }
  return variants[status] ?? variants.pending
}

function todayInBudapest(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Budapest',
  }).format(new Date())
}

export default async function ApplicationDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const [{ id }, feedback] = await Promise.all([params, searchParams])
  const application = await getApplicationById(id)
  if (!application) notFound()

  const data = application.submittedData
  const selectedPackage = packages[application.packageKey]
  const successMessage = feedback.success ? successMessages[feedback.success] : null
  const errorMessage = feedback.error ? errorMessages[feedback.error] : null
  const paymentDate = todayInBudapest()
  const paymentRecordingAllowed = !['rejected', 'cancelled'].includes(application.status)

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/jelentkezok" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" />
        Vissza a jelentkezőkhöz
      </Link>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{application.participantName}</h1>
            <StatusBadge status={application.status} />
            {application.isTest ? <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-bold text-fuchsia-700 ring-1 ring-fuchsia-200">TESZT</span> : null}
          </div>
          <p className="mt-2 text-sm text-slate-500">{application.id} · {formatAdminDate(application.createdAt)}</p>
        </div>
      </div>

      {successMessage ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      ) : null}
      {application.isTest ? (
        <div className="mt-5 rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-4 py-3 text-sm font-bold text-fuchsia-900" role="note">
          TESZT jelentkezés · 10 Ft · Billingo-bizonylat készítése adatbázis-szinten blokkolva
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900" role="alert">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><UserRound className="h-5 w-5 text-[#9b6e2f]" /> Személyes adatok</h2>
            <dl className="mt-4">
              <DetailRow label="Név" value={application.participantName} />
              <DetailRow label="Születési dátum" value={formatAdminDay(application.participantBirthDate)} />
              <DetailRow label="E-mail" value={application.participantEmail ? <a className="hover:underline" href={`mailto:${application.participantEmail}`}>{application.participantEmail}</a> : null} />
              <DetailRow label="Telefon" value={application.participantPhone ? <a className="hover:underline" href={`tel:${application.participantPhone}`}>{application.participantPhone}</a> : null} />
              <DetailRow label="Évfolyam" value={data.grade} />
              <DetailRow label="Cél" value={data.goal} />
              <DetailRow label="Tapasztalat" value={data.experience} />
              <DetailRow label="Iskola" value={data.schoolName} />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Banknote className="h-5 w-5 text-[#9b6e2f]" /> Pénzügy
              </h2>
              {application.payment ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${paymentBadgeClasses(application.payment.status)}`}>
                  {paymentStatusLabel(application.payment.status)}
                </span>
              ) : null}
            </div>

            {application.payment ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fizetendő</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{formatHUF(application.payment.totalAmountHuf)}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Befizetve</p>
                    <p className="mt-1 text-lg font-bold text-emerald-900">{formatHUF(application.payment.paidAmountHuf)}</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Hátralék</p>
                    <p className="mt-1 text-lg font-bold text-orange-900">{formatHUF(application.payment.remainingAmountHuf)}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-600">
                  Következő esedékesség:{' '}
                  <strong className="text-slate-900">
                    {application.payment.remainingAmountHuf === 0
                      ? 'nincs hátralék'
                      : application.payment.nextDueAt
                        ? formatAdminDay(application.payment.nextDueAt)
                        : 'nincs rögzítve'}
                  </strong>
                </p>

                <div className="mt-5 space-y-4">
                  {application.payment.items.map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">
                            {application.payment!.installmentCount === 1 ? 'Egyösszegű díj' : `${item.position}. részlet`}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatHUF(item.amountHuf)}
                            {' · '}
                            {item.dueAt ? `Határidő: ${formatAdminDay(item.dueAt)}` : 'Határidő nincs rögzítve'}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${paymentBadgeClasses(item.status)}`}>
                          {paymentStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                        <span className="text-slate-600">Befizetve: <strong className="text-slate-900">{formatHUF(item.paidAmountHuf)}</strong></span>
                        <span className="text-slate-600">Hátralék: <strong className="text-slate-900">{formatHUF(item.remainingAmountHuf)}</strong></span>
                      </div>

                      <form action={updatePaymentItemDueDateAction} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                        <input type="hidden" name="applicationId" value={application.id} />
                        <input type="hidden" name="paymentItemId" value={item.id} />
                        <label className="grid min-w-52 flex-1 gap-1 text-sm font-semibold text-slate-700">
                          Részlet határideje
                          <input type="date" name="dueAt" defaultValue={item.dueAt?.slice(0, 10) ?? ''} className="rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20" />
                        </label>
                        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50">
                          Határidő mentése
                        </button>
                      </form>

                      {item.payments.length > 0 ? (
                        <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                          {item.payments.map((payment) => (
                            <li key={payment.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              <div className="flex flex-wrap justify-between gap-2">
                                <strong className="text-slate-900">{formatHUF(payment.amountHuf)}</strong>
                                <span>{formatAdminDay(payment.paidAt)} · {paymentMethodLabels[payment.paymentMethod]}</span>
                              </div>
                              {payment.note ? <p className="mt-1 text-slate-500">{payment.note}</p> : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {item.remainingAmountHuf > 0 && paymentRecordingAllowed ? (
                        <form action={recordApplicationPaymentAction} className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                          <input type="hidden" name="applicationId" value={application.id} />
                          <input type="hidden" name="paymentItemId" value={item.id} />
                          <label className="grid gap-1 text-sm font-semibold text-slate-700">
                            Összeg (Ft)
                            <input required type="number" name="amountHuf" min="1" max={item.remainingAmountHuf} step="1" defaultValue={item.remainingAmountHuf} className="rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20" />
                          </label>
                          <label className="grid gap-1 text-sm font-semibold text-slate-700">
                            Befizetés dátuma
                            <input required type="date" name="paidAt" defaultValue={paymentDate} className="rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20" />
                          </label>
                          <label className="grid gap-1 text-sm font-semibold text-slate-700 sm:col-span-2">
                            Fizetési mód
                            <select required name="paymentMethod" defaultValue="bank_transfer" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20">
                              <option value="bank_transfer">Banki átutalás</option>
                              <option value="cash">Készpénz</option>
                            </select>
                          </label>
                          <label className="grid gap-1 text-sm font-semibold text-slate-700 sm:col-span-2">
                            Megjegyzés
                            <textarea name="note" rows={2} maxLength={500} placeholder="Opcionális belső megjegyzés" className="resize-y rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20" />
                          </label>
                          <button type="submit" className="inline-flex justify-center rounded-lg bg-[#1b2430] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2b3747] sm:col-span-2">
                            Befizetés rögzítése
                          </button>
                        </form>
                      ) : null}
                    </article>
                  ))}
                </div>

                {!paymentRecordingAllowed ? (
                  <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    A jelentkezés jelenlegi státuszában nem rögzíthető új befizetés.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-900">
                A fizetési terv még nincs létrehozva ehhez a jelentkezéshez.
              </p>
            )}
          </section>

          {application.guardianName ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold">Törvényes képviselő</h2>
              <dl className="mt-4">
                <DetailRow label="Név" value={application.guardianName} />
                <DetailRow label="Kapcsolat" value={data.guardianRelation} />
                <DetailRow label="E-mail" value={application.guardianEmail ? <a className="hover:underline" href={`mailto:${application.guardianEmail}`}>{application.guardianEmail}</a> : null} />
                <DetailRow label="Telefon" value={application.guardianPhone ? <a className="hover:underline" href={`tel:${application.guardianPhone}`}>{application.guardianPhone}</a> : null} />
              </dl>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><ReceiptText className="h-5 w-5 text-[#9b6e2f]" /> Számlázási adatok</h2>
            <dl className="mt-4">
              <DetailRow label="Számlázási név" value={application.billingName} />
              <DetailRow label="Számlázási e-mail" value={application.billingEmail} />
              <DetailRow label="Cím" value={application.billingAddress} />
              <DetailRow label="Adószám" value={application.taxNumber} />
              <DetailRow label="Fizető típusa" value={data.payerType} />
            </dl>
          </section>

          {data.message ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold">Jelentkező üzenete</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.message}</p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Jelentkezés</h2>
            <dl className="mt-4">
              <DetailRow label="Kurzus" value={application.courseTitle} />
              <DetailRow label="Konstrukció" value={selectedPackage.name} />
              <DetailRow label="Fizetési mód" value={application.paymentType === 'installment' ? 'Részletfizetés' : 'Egyösszegű'} />
              <DetailRow label="Teljes összeg" value={formatHUF(application.totalAmountHuf)} />
              <DetailRow label="Státusz" value={applicationStatusLabel(application.status)} />
            </dl>

            <form action={updateApplicationStatusAction} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
              <input type="hidden" name="applicationId" value={application.id} />
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Új státusz
                <select name="status" defaultValue={application.status} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20">
                  {APPLICATION_STATUSES.map((status) => (
                    <option key={status} value={status}>{applicationStatusLabels[status]}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                Megjegyzés
                <textarea name="note" rows={2} maxLength={500} placeholder="Opcionális belső megjegyzés" className="resize-y rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20" />
              </label>
              <button type="submit" className="w-full rounded-lg bg-[#1b2430] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#2b3747]">
                Státusz mentése
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Kapcsolat</h2>
            <div className="mt-4 space-y-3 text-sm">
              <a href={`mailto:${application.contactEmail}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 font-semibold hover:bg-slate-100"><Mail className="h-4 w-4 text-[#9b6e2f]" />{application.contactEmail}</a>
              {application.contactPhone ? <a href={`tel:${application.contactPhone}`} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3 font-semibold hover:bg-slate-100"><Phone className="h-4 w-4 text-[#9b6e2f]" />{application.contactPhone}</a> : null}
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#9b6e2f]" /><span>{application.billingAddress}</span></div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Mail className="h-5 w-5 text-[#9b6e2f]" /> Rendszerlevelek</h2>
            {application.emailDeliveries.length > 0 ? (
              <ul className="mt-4 space-y-3">
                {application.emailDeliveries.map((delivery) => (
                  <li key={delivery.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{emailEventLabels[delivery.event]}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {delivery.status === 'sent' ? 'Kiküldve: ' : 'Próbálkozás: '}
                          {formatAdminDate(delivery.sentAt ?? delivery.attemptedAt)}
                          {delivery.recipient ? ` · ${delivery.recipient}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{delivery.detail}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${
                        delivery.status === 'sent'
                          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                          : delivery.status === 'error'
                            ? 'bg-red-50 text-red-800 ring-red-200'
                            : 'bg-slate-100 text-slate-700 ring-slate-200'
                      }`}>
                        {delivery.status === 'sent' ? 'Sikeres' : delivery.status === 'error' ? 'Sikertelen' : 'Kihagyva'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Még nincs naplózott rendszerlevél.</p>
            )}

            <form action={resendApplicationEmailAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="applicationId" value={application.id} />
              <label className="grid gap-1 text-sm font-semibold text-slate-700">
                E-mail újraküldése
                <select name="event" defaultValue="received" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-950 outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20">
                  {resendableEmailEvents.map((event) => (
                    <option key={event} value={event}>{emailEventLabels[event]}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50">
                E-mail küldése
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="h-5 w-5 text-[#9b6e2f]" /> Előzmények</h2>
            <ol className="mt-5 space-y-4">
              {application.history.map((entry, index) => (
                <li key={entry.id} className="relative pl-7">
                  {index < application.history.length - 1 ? <span className="absolute left-[7px] top-4 h-[calc(100%+8px)] w-px bg-slate-200" aria-hidden="true" /> : null}
                  <span className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#bd8b3c] ring-1 ring-[#bd8b3c]" aria-hidden="true" />
                  <p className="text-sm font-bold">{applicationStatusLabel(entry.toStatus)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatAdminDate(entry.createdAt)}</p>
                  {entry.note ? <p className="mt-1 text-sm text-slate-600">{entry.note}</p> : null}
                </li>
              ))}
            </ol>
          </section>

          {(application.utmSource || application.utmMedium || application.utmCampaign || application.referrer) ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Jelentkezési forrás</h2>
              <dl className="mt-4">
                <DetailRow label="Forrás" value={application.source} />
                <DetailRow label="UTM source" value={application.utmSource} />
                <DetailRow label="UTM medium" value={application.utmMedium} />
                <DetailRow label="UTM campaign" value={application.utmCampaign} />
                <DetailRow label="Hivatkozó oldal" value={application.referrer} />
              </dl>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
