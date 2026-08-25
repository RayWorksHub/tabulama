import { Construction } from 'lucide-react'

export default function AdminCoursesPage() {
  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <Construction className="h-8 w-8 text-[#9b6e2f]" />
      <h1 className="mt-5 text-3xl font-bold tracking-tight">Kurzuskezelés</h1>
      <p className="mt-3 leading-relaxed text-slate-600">
        A többkurzusos adatmodell elkészült. A létrehozás és szerkesztés a P2 fejlesztési szakasz része.
      </p>
    </div>
  )
}
