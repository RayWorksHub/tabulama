import Link from 'next/link'
import { Search } from 'lucide-react'
import { listStudents } from '@/lib/student-repository'

export const dynamic = 'force-dynamic'

const accountLabels = { pending: 'Nincs aktiválva', active: 'Aktív', disabled: 'Inaktív' }

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams
  const students = await listStudents(q)
  return <div className="mx-auto max-w-7xl"><div><p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9b6e2f]">Diákkezelés</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Diákok</h1><p className="mt-2 text-slate-600">{students.length} találat.</p></div><form className="mt-6 flex max-w-xl gap-2"><label className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" /><span className="sr-only">Keresés</span><input name="q" defaultValue={q} placeholder="Név, e-mail, TBL- vagy TL-azonosító" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#9b6e2f]" /></label><button type="submit" className="rounded-xl bg-[#1b2430] px-5 text-sm font-bold text-white">Keresés</button></form><div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{students.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Diák</th><th className="px-5 py-4">Azonosító</th><th className="px-5 py-4">Kurzusok</th><th className="px-5 py-4">Fiók</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student) => <tr key={student.id} className="hover:bg-slate-50"><td className="px-5 py-4"><Link href={`/admin/diakok/${student.id}`} className="font-bold hover:underline">{student.fullName}</Link><p className="mt-1 text-slate-500">{student.email}</p>{student.applicationIds.length ? <p className="mt-1 font-mono text-xs text-slate-400">{student.applicationIds.join(', ')}</p> : null}</td><td className="px-5 py-4 font-mono font-semibold">{student.studentNumber}</td><td className="px-5 py-4 text-slate-600">{student.courses.join(', ') || '—'}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{accountLabels[student.accountStatus]}</span></td></tr>)}</tbody></table></div> : <p className="p-10 text-center text-slate-500">Nincs találat.</p>}</div></div>
}
