import Link from 'next/link'

export default function CourseNotFound() {
  return <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-bold">A kurzus nem található</h1><Link href="/admin/kurzusok" className="mt-6 inline-flex rounded-xl bg-[#1b2430] px-5 py-3 font-bold text-white">Vissza a kurzusokhoz</Link></div>
}
