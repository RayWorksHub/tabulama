'use client'

import { useMemo, useState } from 'react'
import { UsersRound } from 'lucide-react'
import { saveSessionAttendanceAction } from '@/app/admin/(protected)/kurzusok/session-actions'

const attendanceStatuses = ['unmarked', 'present', 'late', 'excused', 'absent'] as const
type AttendanceStatus = (typeof attendanceStatuses)[number]

const attendanceLabels: Record<AttendanceStatus, string> = {
  unmarked: 'Nincs jelölve',
  present: 'Jelen',
  late: 'Késett',
  excused: 'Igazolt hiányzás',
  absent: 'Hiányzott',
}

interface StudentAttendanceRow {
  enrollmentId: string
  studentNumber: string
  fullName: string
  status: AttendanceStatus
  note: string | null
}

export function CourseSessionAttendanceEditor({
  courseId,
  sessionId,
  weekStart,
  students,
  disabled,
}: {
  courseId: string
  sessionId: string
  weekStart: string
  students: StudentAttendanceRow[]
  disabled?: boolean
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present')
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => Object.fromEntries(students.map((student) => [student.enrollmentId, student.status])))
  const allSelected = students.length > 0 && selected.length === students.length
  const selectedSet = useMemo(() => new Set(selected), [selected])

  function toggleAll() {
    setSelected(allSelected ? [] : students.map((student) => student.enrollmentId))
  }

  function toggleOne(enrollmentId: string) {
    setSelected((current) => current.includes(enrollmentId) ? current.filter((id) => id !== enrollmentId) : [...current, enrollmentId])
  }

  function applyBulkStatus() {
    if (!selected.length) return
    setStatuses((current) => {
      const next = { ...current }
      for (const enrollmentId of selected) next[enrollmentId] = bulkStatus
      return next
    })
  }

  return (
    <form action={saveSessionAttendanceAction}>
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="week" value={weekStart} />

      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">Kijelölve: {selected.length} / {students.length} tanuló</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as AttendanceStatus)} disabled={disabled || selected.length === 0} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400">
              {attendanceStatuses.map((status) => <option key={status} value={status}>{attendanceLabels[status]}</option>)}
            </select>
            <button type="button" onClick={applyBulkStatus} disabled={disabled || selected.length === 0} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-40">Alkalmazás a kijelöltekre</button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-white text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-14 px-5 py-3"><input type="checkbox" aria-label="Összes tanuló kijelölése" checked={allSelected} onChange={toggleAll} disabled={disabled} className="h-4 w-4 rounded border-slate-300" /></th>
              <th className="px-5 py-3">Tanuló</th>
              <th className="px-5 py-3">Jelenlét</th>
              <th className="px-5 py-3">Megjegyzés</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((student) => (
              <tr key={student.enrollmentId} className={selectedSet.has(student.enrollmentId) ? 'bg-amber-50/50' : undefined}>
                <td className="px-5 py-4"><input type="checkbox" aria-label={`${student.fullName} kijelölése`} checked={selectedSet.has(student.enrollmentId)} onChange={() => toggleOne(student.enrollmentId)} disabled={disabled} className="h-4 w-4 rounded border-slate-300" /></td>
                <td className="px-5 py-4"><input type="hidden" name="enrollmentId" value={student.enrollmentId} /><p className="font-bold">{student.fullName}</p><p className="mt-1 font-mono text-xs text-slate-500">{student.studentNumber}</p></td>
                <td className="px-5 py-4"><select name={`status:${student.enrollmentId}`} value={statuses[student.enrollmentId]} onChange={(event) => setStatuses((current) => ({ ...current, [student.enrollmentId]: event.target.value as AttendanceStatus }))} disabled={disabled} className="min-h-10 w-full max-w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100">{attendanceStatuses.map((status) => <option key={status} value={status}>{attendanceLabels[status]}</option>)}</select></td>
                <td className="px-5 py-4"><input name={`note:${student.enrollmentId}`} defaultValue={student.note ?? ''} disabled={disabled} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100" placeholder="pl. 10 perc késés" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-slate-500"><UsersRound className="h-4 w-4" />{students.length} tanuló · {selected.length} kijelölve</p>
        <button type="submit" disabled={disabled} className="min-h-10 rounded-lg bg-[#1b2430] px-4 text-sm font-bold text-white disabled:opacity-40">Jelenlét mentése</button>
      </div>
    </form>
  )
}
