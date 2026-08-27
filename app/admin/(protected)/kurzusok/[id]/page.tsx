import { notFound } from 'next/navigation'
import { CourseForm } from '@/components/admin/course-form'
import { getCourseById } from '@/lib/course-repository'
import { listCourseModules } from '@/lib/student-repository'
import { CourseModules } from '@/components/admin/course-modules'

export const dynamic = 'force-dynamic'

export default async function CourseDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams])
  const [course, modules] = await Promise.all([getCourseById(id), listCourseModules(id)])
  if (!course) notFound()
  return <div className="mx-auto max-w-5xl"><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9b6e2f]">Kurzuskezelés</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{course.shortTitle}</h1><p className="mt-2 text-slate-600">{course.currentHeadcount} jelentkező/beiratkozott · {course.remainingCapacity === null ? 'korlátlan' : `${course.remainingCapacity} szabad hely`}</p>{feedback.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">{feedback.error.startsWith('module_') ? 'A modul nem menthető. Ellenőrizd a mezőket.' : 'A kurzus nem menthető. Ellenőrizd az adatokat és a slug egyediségét.'}</p> : null}{feedback.success ? <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{feedback.success === 'module_saved' ? 'A kurzusmodul elmentve.' : 'A kurzus adatai elmentve.'}</p> : null}<div className="mt-8"><CourseForm course={course} /></div><CourseModules courseId={course.id} modules={modules} /></div>
}
