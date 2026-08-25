import Link from 'next/link'

export default function ApplicationNotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold">A jelentkezés nem található</h1>
      <p className="mt-3 text-slate-600">Az azonosító hibás, vagy a jelentkezést már eltávolították.</p>
      <Link href="/admin/jelentkezok" className="mt-6 inline-flex rounded-xl bg-[#1b2430] px-5 py-3 font-bold text-white">
        Vissza a jelentkezőkhöz
      </Link>
    </div>
  )
}
