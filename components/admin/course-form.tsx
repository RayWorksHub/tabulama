import Link from 'next/link'
import type { Course } from '@/lib/course-repository'
import { COURSE_STATUSES, COURSE_STATUS_LABELS } from '@/lib/course-repository'
import { saveCourseAction } from '@/app/admin/(protected)/kurzusok/actions'

const inputClass = 'mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#9b6e2f] focus:ring-2 focus:ring-[#9b6e2f]/20'
const labelClass = 'block text-sm font-semibold text-slate-800'

function dateValue(value: string | null): string { return value?.slice(0, 10) ?? '' }
function dateTimeValue(value: string | null): string { return value?.slice(0, 16) ?? '' }
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className={labelClass}>{label}{required ? <span className="text-red-600"> *</span> : null}{children}</label>
}

export function CourseForm({ course }: { course?: Course }) {
  const dueDates = course?.installmentDueDates.map((value) => value?.slice(0, 10) ?? '').join('\n') ?? ''
  return (
    <form action={saveCourseAction} className="space-y-7">
      {course ? <input type="hidden" name="courseId" value={course.id} /> : null}
      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <h2 className="text-lg font-bold md:col-span-2">Alapadatok</h2>
        <Field label="Cím" required><input className={inputClass} name="title" required defaultValue={course?.title} /></Field>
        <Field label="Rövid cím" required><input className={inputClass} name="shortTitle" required defaultValue={course?.shortTitle} /></Field>
        <Field label="Slug" required><input className={inputClass} name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={course?.slug} /></Field>
        <Field label="Kategória" required><input className={inputClass} name="category" required defaultValue={course?.category} /></Field>
        <Field label="Kép URL"><input className={inputClass} name="imageUrl" type="url" defaultValue={course?.imageUrl ?? ''} /></Field>
        <Field label="Oktató"><input className={inputClass} name="instructorName" defaultValue={course?.instructorName ?? ''} /></Field>
        <div className="md:col-span-2"><Field label="Rövid leírás" required><textarea className={inputClass} name="summary" required rows={3} defaultValue={course?.summary} /></Field></div>
        <div className="md:col-span-2"><Field label="Hosszú leírás" required><textarea className={inputClass} name="description" required rows={7} defaultValue={course?.description} /></Field></div>
      </section>
      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <h2 className="text-lg font-bold md:col-span-2">Időpontok és férőhely</h2>
        <Field label="Kezdő dátum"><input className={inputClass} name="startDate" type="date" defaultValue={dateValue(course?.startDate ?? null)} /></Field>
        <Field label="Záró dátum"><input className={inputClass} name="endDate" type="date" defaultValue={dateValue(course?.endDate ?? null)} /></Field>
        <Field label="Jelentkezési határidő"><input className={inputClass} name="applicationDeadline" type="datetime-local" defaultValue={dateTimeValue(course?.applicationDeadline ?? null)} /></Field>
        <Field label="Maximális létszám"><input className={inputClass} name="maxCapacity" type="number" min="1" defaultValue={course?.maxCapacity ?? ''} /></Field>
        <div className="md:col-span-2"><Field label="Heti időpontok"><textarea className={inputClass} name="weeklySchedule" rows={3} defaultValue={course?.weeklySchedule ?? ''} /></Field></div>
      </section>
      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <h2 className="text-lg font-bold md:col-span-2">Árak és fizetési konstrukciók</h2>
        <Field label="Teljes ár (Ft)" required><input className={inputClass} name="priceHuf" type="number" min="0" required defaultValue={course?.priceHuf ?? 0} /></Field>
        <Field label="Kedvezményes ár (Ft)"><input className={inputClass} name="discountedPriceHuf" type="number" min="0" defaultValue={course?.discountedPriceHuf ?? ''} /></Field>
        <Field label="Kedvezmény befizetési határideje"><input className={inputClass} name="discountedPaymentDeadline" type="datetime-local" defaultValue={dateTimeValue(course?.discountedPaymentDeadline ?? null)} /></Field>
        <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"><input name="installmentEnabled" type="checkbox" defaultChecked={course?.installmentEnabled} />Részletfizetés engedélyezve</label>
        <Field label="Részletek száma"><input className={inputClass} name="installmentCount" type="number" min="2" max="24" defaultValue={course?.installmentCount ?? ''} /></Field>
        <Field label="Egy részlet összege (Ft)"><input className={inputClass} name="installmentAmountHuf" type="number" min="1" defaultValue={course?.installmentAmountHuf ?? ''} /></Field>
        <div className="md:col-span-2"><Field label="Részletek határideje (soronként egy dátum)"><textarea className={inputClass} name="installmentDueDates" rows={6} placeholder={'2026-09-01\n2026-10-01\n2026-11-01'} defaultValue={dueDates} /></Field><p className="mt-2 text-xs text-slate-500">A hiányzó sorok határideje üres marad, és később adminból beállítható.</p></div>
      </section>
      <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
        <h2 className="text-lg font-bold md:col-span-2">Tartalom és publikálás</h2>
        <Field label="Státusz"><select className={inputClass} name="status" defaultValue={course?.status ?? 'draft'}>{COURSE_STATUSES.map((status) => <option key={status} value={status}>{COURSE_STATUS_LABELS[status]}</option>)}</select></Field>
        <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold"><input name="applicationsEnabled" type="checkbox" defaultChecked={course?.applicationsEnabled} />Jelentkezés engedélyezve</label>
        <div className="md:col-span-2"><Field label="Célcsoport"><textarea className={inputClass} name="targetAudience" rows={3} defaultValue={course?.targetAudience ?? ''} /></Field></div>
        <div className="md:col-span-2"><Field label="Előfeltételek"><textarea className={inputClass} name="prerequisites" rows={3} defaultValue={course?.prerequisites ?? ''} /></Field></div>
        <div className="md:col-span-2"><Field label="Tematika"><textarea className={inputClass} name="syllabus" rows={9} defaultValue={course?.syllabus ?? ''} /></Field></div>
      </section>
      <div className="flex flex-wrap justify-end gap-3"><Link href="/admin/kurzusok" className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold hover:bg-slate-50">Mégse</Link><button type="submit" className="rounded-xl bg-[#1b2430] px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">Kurzus mentése</button></div>
    </form>
  )
}
