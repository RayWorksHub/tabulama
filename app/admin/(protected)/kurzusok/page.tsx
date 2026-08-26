import Link from 'next/link'
import { Archive, ChevronRight, Plus } from 'lucide-react'
import { COURSE_STATUSES, COURSE_STATUS_LABELS, listCourses } from '@/lib/course-repository'
import { formatHUF } from '@/lib/tabulama-config'
import { archiveCourseAction, updateCourseStatusAction } from './actions'

export const dynamic = 'force-dynamic'

const statusClasses = {
  draft: 'bg-slate-100 text-slate-700', coming_soon: 'bg-blue-100 text-blue-800',
  open: 'bg-emerald-100 text-emerald-800', full: 'bg-orange-100 text-orange-800',
  in_progress: 'bg-violet-100 text-violet-800', closed: 'bg-slate-200 text-slate-800', archived: 'bg-slate-800 text-white',
} as const

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const [courses, feedback] = await Promise.all([listCourses(), searchParams])
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9b6e2f]">Képzésszervezés</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Kurzusok</h1><p className="mt-2 text-slate-600">{courses.length} kurzus a központi adatbázisban.</p></div><Link href="/admin/kurzusok/uj" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1b2430] px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"><Plus className="h-4 w-4" /> Új kurzus</Link></div>
      {feedback.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">A módosítás nem menthető. Ellenőrizd az adatokat és a slug egyediségét.</p> : null}
      {feedback.success ? <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">A kurzus módosítása elmentve.</p> : null}
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {courses.length === 0 ? <p className="px-6 py-14 text-center text-slate-500">Még nincs kurzus.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Kurzus</th><th className="px-5 py-4">Időszak</th><th className="px-5 py-4">Létszám</th><th className="px-5 py-4">Ár</th><th className="px-5 py-4">Státusz</th><th className="px-5 py-4"><span className="sr-only">Műveletek</span></th></tr></thead><tbody className="divide-y divide-slate-100">{courses.map((course) => <tr key={course.id} className="hover:bg-slate-50">
          <td className="px-5 py-4"><Link href={`/admin/kurzusok/${course.id}`} className="font-bold hover:underline">{course.shortTitle}</Link><p className="mt-1 text-slate-500">/{course.slug}</p></td>
          <td className="px-5 py-4 text-slate-600">{course.startDate?.slice(0, 10) ?? 'Nincs megadva'}{course.endDate ? ` – ${course.endDate.slice(0, 10)}` : ''}</td>
          <td className="px-5 py-4 font-semibold">{course.currentHeadcount}{course.maxCapacity ? ` / ${course.maxCapacity}` : ''}</td><td className="px-5 py-4 font-semibold">{formatHUF(course.priceHuf)}</td>
          <td className="px-5 py-4"><form action={updateCourseStatusAction} className="flex items-center gap-2"><input type="hidden" name="courseId" value={course.id} /><select name="status" aria-label={`${course.shortTitle} státusza`} defaultValue={course.status} className={`rounded-lg border-0 px-2.5 py-1.5 text-xs font-bold ${statusClasses[course.status]}`}>{COURSE_STATUSES.map((status) => <option key={status} value={status}>{COURSE_STATUS_LABELS[status]}</option>)}</select><button type="submit" className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold hover:bg-white">Mentés</button></form></td>
          <td className="px-5 py-4"><div className="flex justify-end gap-1"><form action={archiveCourseAction}><input type="hidden" name="courseId" value={course.id} /><button type="submit" aria-label={`${course.shortTitle} archiválása`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><Archive className="h-4 w-4" /></button></form><Link href={`/admin/kurzusok/${course.id}`} aria-label={`${course.shortTitle} megnyitása`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></Link></div></td>
        </tr>)}</tbody></table></div>}
      </div>
    </div>
  )
}
