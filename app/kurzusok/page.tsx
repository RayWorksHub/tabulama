import type { Metadata } from 'next'
import { CourseCard } from '@/components/tabulama/course-card'
import { listPublicCourses } from '@/lib/course-repository'

export const metadata: Metadata = { title: 'Kurzusok | TabuLama Programozó Akadémia', description: 'A TabuLama aktuális és közelgő programozó kurzusai.' }
export const dynamic = 'force-dynamic'

export default async function CoursesPage() {
  const courses = await listPublicCourses()
  return <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8"><div className="mx-auto max-w-2xl text-center"><span className="text-sm font-semibold uppercase tracking-[0.15em] text-primary">Kurzusok</span><h1 className="font-heading mt-3 text-4xl font-bold">Találd meg a következő képzésed</h1><p className="mt-4 text-muted-foreground">Az időpontok, árak és férőhelyek közvetlenül az aktuális kurzusadatokból jelennek meg.</p></div>{courses.length ? <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{courses.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <p className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">Jelenleg nincs nyilvános kurzus.</p>}</section>
}
