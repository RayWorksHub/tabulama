import Link from 'next/link'
import { ArrowLeft, CalendarDays, Mail, MapPin, Phone, ReceiptText, UserRound } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getApplicationById } from '@/lib/application-repository'
import { applicationStatusLabel, formatAdminDate } from '@/lib/admin-display'
import { formatHUF, packages } from '@/lib/tabulama-config'
import { StatusBadge } from '@/components/admin/status-badge'

export const dynamic = 'force-dynamic'

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800">{value || '—'}</dd>
    </div>
  )
}

export default async function ApplicationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const application = await getApplicationById(id)
  if (!application) notFound()

  const data = application.submittedData
  const selectedPackage = packages[application.packageKey]

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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><UserRound className="h-5 w-5 text-[#9b6e2f]" /> Személyes adatok</h2>
            <dl className="mt-4">
              <DetailRow label="Név" value={application.participantName} />
              <DetailRow label="Születési dátum" value={application.participantBirthDate} />
              <DetailRow label="E-mail" value={application.participantEmail ? <a className="hover:underline" href={`mailto:${application.participantEmail}`}>{application.participantEmail}</a> : null} />
              <DetailRow label="Telefon" value={application.participantPhone ? <a className="hover:underline" href={`tel:${application.participantPhone}`}>{application.participantPhone}</a> : null} />
              <DetailRow label="Évfolyam" value={data.grade} />
              <DetailRow label="Cél" value={data.goal} />
              <DetailRow label="Tapasztalat" value={data.experience} />
              <DetailRow label="Iskola" value={data.schoolName} />
            </dl>
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
