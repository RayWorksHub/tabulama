import { CourseForm } from '@/components/admin/course-form'

export default async function NewCoursePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const feedback = await searchParams
  return <div className="mx-auto max-w-5xl"><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9b6e2f]">Kurzuskezelés</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Új kurzus</h1>{feedback.error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">A kurzus nem menthető. Ellenőrizd a kötelező mezőket.</p> : null}<div className="mt-8"><CourseForm /></div></div>
}
