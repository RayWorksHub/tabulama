'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { CheckCircle2, CircleAlert, FastForward, UsersRound } from 'lucide-react'
import { bulkCourseProgressAction } from '@/app/admin/(protected)/kurzusok/actions'
import type { CourseModuleItem } from '@/lib/student-repository'
import type { CourseProgressWorkspace } from '@/lib/course-progress-repository'

const enrollmentLabels: Record<string, string> = {
  pending: 'Függőben',
  active: 'Aktív',
  completed: 'Befejezte',
  withdrawn: 'Kilépett',
}

function deviationLabel(studentPosition: number | null, groupPosition: number | null, progressPercent: number) {
  if (progressPercent === 100) return { label: 'Teljesítve', className: 'bg-emerald-50 text-emerald-700' }
  if (studentPosition === null || groupPosition === null) return { label: '—', className: 'bg-slate-100 text-slate-600' }
  if (studentPosition < groupPosition) return { label: 'Lemaradva', className: 'bg-amber-50 text-amber-800' }
  if (studentPosition > groupPosition) return { label: 'Előrébb', className: 'bg-blue-50 text-blue-700' }
  return { label: 'Csoporttal együtt', className: 'bg-slate-100 text-slate-700' }
}

export function CourseStudentProgress({
  courseId,
  workspace,
  modules,
}: {
  courseId: string
  workspace: CourseProgressWorkspace
  modules: CourseModuleItem[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const activeModules = useMemo(() => modules.filter((module) => module.isActive), [modules])
  const allSelected = workspace.students.length > 0 && selected.size === workspace.students.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(workspace.students.map((student) => student.enrollmentId)))
  }

  function toggle(enrollmentId: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(enrollmentId)) next.delete(enrollmentId)
      else next.add(enrollmentId)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><UsersRound className="h-4 w-4" />Résztvevők</div>
          <p className="mt-2 text-3xl font-bold">{workspace.students.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
          <p className="text-sm font-semibold text-slate-500">Csoport aktuális tananyaga</p>
          <p className="mt-2 text-xl font-bold">{workspace.groupCurrentModuleTitle ?? 'Még nincs közös aktuális modul'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {workspace.distribution.map((item) => (
              <span key={item.moduleId ?? 'completed'} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {item.count} fő · {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <form action={bulkCourseProgressAction} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <input type="hidden" name="courseId" value={courseId} />
        <div className="border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="font-bold">Csoportos előrehaladás-kezelés</h2>
              <p className="mt-1 text-sm text-slate-500">Csak a kijelölt tanulók állapota módosul. Kijelölve: {selected.size} fő.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[220px_240px_auto]">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Művelet
                <select name="operation" defaultValue="advance" className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="advance">Következő egységre léptetés</option>
                  <option value="complete_current">Aktuális egység teljesítve</option>
                  <option value="set_current">Konkrét egység beállítása</option>
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Konkrét tananyagegység
                <select name="targetModuleId" defaultValue="" className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
                  <option value="">— csak a beállítás művelethez —</option>
                  {activeModules.map((module) => <option key={module.id} value={module.id}>{module.position}. {module.title}</option>)}
                </select>
              </label>
              <button type="submit" disabled={selected.size === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#1b2430] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                <FastForward className="h-4 w-4" />Alkalmazás
              </button>
            </div>
          </div>
        </div>

        {workspace.students.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input type="checkbox" aria-label="Összes tanuló kijelölése" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" />
                  </th>
                  <th className="px-4 py-3">Tanuló</th>
                  <th className="px-4 py-3">Státusz</th>
                  <th className="px-4 py-3">Aktuális tananyag</th>
                  <th className="px-4 py-3">Haladás</th>
                  <th className="px-4 py-3">Eltérés</th>
                  <th className="px-4 py-3 text-right">Részletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workspace.students.map((student) => {
                  const deviation = deviationLabel(student.currentModulePosition, workspace.groupCurrentModulePosition, student.progressPercent)
                  return (
                    <tr key={student.enrollmentId} className={selected.has(student.enrollmentId) ? 'bg-amber-50/40' : undefined}>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          name="enrollmentId"
                          value={student.enrollmentId}
                          aria-label={`${student.fullName} kijelölése`}
                          checked={selected.has(student.enrollmentId)}
                          onChange={() => toggle(student.enrollmentId)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-950">{student.fullName}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">{student.studentNumber}</p>
                      </td>
                      <td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">{enrollmentLabels[student.enrollmentStatus] ?? student.enrollmentStatus}</span></td>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{student.currentModuleTitle ?? 'Kurzus teljesítve'}</p>
                        <p className="mt-1 text-xs text-slate-500">{student.nextModuleTitle ? `Következő: ${student.nextModuleTitle}` : 'Nincs következő egység'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#bd8b3c]" style={{ width: `${student.progressPercent}%` }} /></div>
                          <strong>{student.progressPercent}%</strong>
                        </div>
                      </td>
                      <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${deviation.className}`}>{student.progressPercent === 100 ? <CheckCircle2 className="h-3.5 w-3.5" /> : deviation.label !== 'Csoporttal együtt' && deviation.label !== '—' ? <CircleAlert className="h-3.5 w-3.5" /> : null}{deviation.label}</span></td>
                      <td className="px-4 py-4 text-right"><Link href={`/admin/diakok/${student.studentId}?view=progress&course=${student.enrollmentId}`} className="font-bold text-[#8b642b] hover:underline">Megnyitás</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">Ehhez a kurzushoz még nincs beiratkozott tanuló.</div>
        )}
      </form>
    </div>
  )
}
