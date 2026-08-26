import Link from 'next/link'

export default function CourseNotFound() {
  return <section className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="font-heading text-3xl font-bold">A kurzus nem található</h1><Link href="/kurzusok" className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground">Összes kurzus</Link></section>
}
