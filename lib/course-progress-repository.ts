import 'server-only'

import { randomUUID } from 'node:crypto'
import { getSql } from '@/lib/database'
import type { ModuleProgressStatus } from '@/lib/student-repository'

export type BulkProgressOperation = 'advance' | 'complete_current' | 'set_current'

export interface CourseRosterStudent {
  enrollmentId: string
  studentId: string
  studentNumber: string
  fullName: string
  email: string
  enrollmentStatus: string
  progressPercent: number
  currentModuleId: string | null
  currentModuleTitle: string | null
  currentModulePosition: number | null
  nextModuleTitle: string | null
}

export interface CourseProgressDistributionItem {
  moduleId: string | null
  label: string
  position: number | null
  count: number
}

export interface CourseProgressWorkspace {
  students: CourseRosterStudent[]
  groupCurrentModuleId: string | null
  groupCurrentModuleTitle: string | null
  groupCurrentModulePosition: number | null
  distribution: CourseProgressDistributionItem[]
}

interface RosterRow {
  enrollment_id: string
  student_id: string
  student_number: string
  full_name: string
  email: string
  enrollment_status: string
  progress_percent: number
  current_module_id: string | null
  current_module_title: string | null
  current_module_position: number | null
  next_module_title: string | null
}

interface ProgressRow {
  enrollment_id: string
  module_id: string
  position: number
  progress_status: ModuleProgressStatus | null
}

export async function getCourseProgressWorkspace(courseId: string): Promise<CourseProgressWorkspace> {
  const rows = await getSql().query(
    `SELECT
       ce.id AS enrollment_id,
       sp.id AS student_id,
       sp.student_number,
       u.full_name,
       u.email,
       ce.status AS enrollment_status,
       ce.progress_percent,
       current_module.id AS current_module_id,
       current_module.title AS current_module_title,
       current_module.position AS current_module_position,
       next_module.title AS next_module_title
     FROM course_enrollments ce
     JOIN student_profiles sp ON sp.id = ce.student_profile_id
     JOIN users u ON u.id = sp.user_id
     LEFT JOIN LATERAL (
       SELECT cm.id, cm.title, cm.position
       FROM course_modules cm
       LEFT JOIN student_module_progress smp
         ON smp.enrollment_id = ce.id AND smp.module_id = cm.id
       WHERE cm.course_id = ce.course_id
         AND cm.is_active
         AND coalesce(smp.status, 'upcoming') IN ('in_progress', 'upcoming')
       ORDER BY CASE WHEN smp.status = 'in_progress' THEN 0 ELSE 1 END, cm.position ASC
       LIMIT 1
     ) current_module ON true
     LEFT JOIN LATERAL (
       SELECT cm.title
       FROM course_modules cm
       WHERE cm.course_id = ce.course_id
         AND cm.is_active
         AND current_module.position IS NOT NULL
         AND cm.position > current_module.position
       ORDER BY cm.position ASC
       LIMIT 1
     ) next_module ON true
     WHERE ce.course_id = $1
       AND ce.status IN ('pending', 'active', 'completed')
     ORDER BY u.full_name ASC`,
    [courseId],
  ) as RosterRow[]

  const students: CourseRosterStudent[] = rows.map((row) => ({
    enrollmentId: row.enrollment_id,
    studentId: row.student_id,
    studentNumber: row.student_number,
    fullName: row.full_name,
    email: row.email,
    enrollmentStatus: row.enrollment_status,
    progressPercent: Number(row.progress_percent),
    currentModuleId: row.current_module_id,
    currentModuleTitle: row.current_module_title,
    currentModulePosition: row.current_module_position === null ? null : Number(row.current_module_position),
    nextModuleTitle: row.next_module_title,
  }))

  const counts = new Map<string, CourseProgressDistributionItem>()
  for (const student of students) {
    const key = student.currentModuleId ?? '__completed__'
    const current = counts.get(key)
    if (current) current.count += 1
    else counts.set(key, {
      moduleId: student.currentModuleId,
      label: student.currentModuleTitle ?? 'Kurzus teljesítve',
      position: student.currentModulePosition,
      count: 1,
    })
  }

  const distribution = [...counts.values()].sort((a, b) => {
    if (a.position === null) return 1
    if (b.position === null) return -1
    return a.position - b.position
  })
  const groupCurrent = [...distribution]
    .filter((item) => item.moduleId !== null)
    .sort((a, b) => b.count - a.count || (a.position ?? 0) - (b.position ?? 0))[0] ?? null

  return {
    students,
    groupCurrentModuleId: groupCurrent?.moduleId ?? null,
    groupCurrentModuleTitle: groupCurrent?.label ?? null,
    groupCurrentModulePosition: groupCurrent?.position ?? null,
    distribution,
  }
}

export async function bulkUpdateCourseProgress(input: {
  courseId: string
  enrollmentIds: string[]
  operation: BulkProgressOperation
  targetModuleId?: string | null
}): Promise<number> {
  const enrollmentIds = [...new Set(input.enrollmentIds.map((value) => value.trim()).filter(Boolean))]
  if (!enrollmentIds.length) return 0

  const sql = getSql()
  const enrollmentPlaceholders = enrollmentIds.map((_, index) => `$${index + 2}`).join(', ')
  const rows = await sql.query(
    `SELECT ce.id AS enrollment_id, cm.id AS module_id, cm.position,
            smp.status AS progress_status
     FROM course_enrollments ce
     JOIN course_modules cm ON cm.course_id = ce.course_id AND cm.is_active
     LEFT JOIN student_module_progress smp
       ON smp.enrollment_id = ce.id AND smp.module_id = cm.id
     WHERE ce.course_id = $1
       AND ce.id IN (${enrollmentPlaceholders})
       AND ce.status IN ('pending', 'active', 'completed')
     ORDER BY ce.id, cm.position ASC`,
    [input.courseId, ...enrollmentIds],
  ) as ProgressRow[]

  const byEnrollment = new Map<string, ProgressRow[]>()
  for (const row of rows) {
    const modules = byEnrollment.get(row.enrollment_id) ?? []
    modules.push({ ...row, position: Number(row.position) })
    byEnrollment.set(row.enrollment_id, modules)
  }

  const writes: Array<{ enrollmentId: string; moduleId: string; status: ModuleProgressStatus }> = []
  const progressUpdates: Array<{ enrollmentId: string; percent: number }> = []

  for (const enrollmentId of enrollmentIds) {
    const modules = byEnrollment.get(enrollmentId)
    if (!modules?.length) continue

    let targetPosition: number | null = null
    let completeThroughPosition: number | null = null

    if (input.operation === 'set_current') {
      const target = modules.find((module) => module.module_id === input.targetModuleId)
      if (!target) throw new Error('target_module_not_found')
      targetPosition = target.position
    } else {
      const explicitCurrentIndex = modules.findIndex((module) => module.progress_status === 'in_progress')
      const firstUpcomingIndex = modules.findIndex((module) => (module.progress_status ?? 'upcoming') === 'upcoming')
      const currentIndex = explicitCurrentIndex >= 0 ? explicitCurrentIndex : firstUpcomingIndex
      const normalizedIndex = currentIndex >= 0 ? currentIndex : modules.length - 1
      const current = modules[normalizedIndex]
      if (!current) continue

      if (input.operation === 'complete_current') {
        completeThroughPosition = current.position
      } else {
        const next = modules[normalizedIndex + 1]
        if (next) targetPosition = next.position
        else completeThroughPosition = current.position
      }
    }

    let completedCount = 0
    for (const module of modules) {
      let status: ModuleProgressStatus
      if (targetPosition !== null) {
        if (module.position < targetPosition) status = 'completed'
        else if (module.position === targetPosition) status = 'in_progress'
        else status = 'upcoming'
      } else if (completeThroughPosition !== null) {
        status = module.position <= completeThroughPosition ? 'completed' : 'upcoming'
      } else {
        status = module.progress_status ?? 'upcoming'
      }
      if (status === 'completed') completedCount += 1
      writes.push({ enrollmentId, moduleId: module.module_id, status })
    }
    progressUpdates.push({
      enrollmentId,
      percent: modules.length ? Math.round((completedCount * 100) / modules.length) : 0,
    })
  }

  if (!writes.length) return 0

  const values: unknown[] = []
  const valueSql = writes.map((write, index) => {
    const offset = index * 4
    values.push(randomUUID(), write.enrollmentId, write.moduleId, write.status)
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
  }).join(', ')

  const transaction = [
    sql.query(
      `INSERT INTO student_module_progress (id, enrollment_id, module_id, status)
       VALUES ${valueSql}
       ON CONFLICT (enrollment_id, module_id)
       DO UPDATE SET status = excluded.status, updated_at = now()`,
      values,
    ),
    ...progressUpdates.map((item) => sql.query(
      `UPDATE course_enrollments
       SET progress_percent = $2,
           status = CASE
             WHEN $2 = 100 THEN 'completed'
             WHEN status = 'completed' THEN 'active'
             ELSE status
           END,
           completed_at = CASE WHEN $2 = 100 THEN coalesce(completed_at, now()) ELSE NULL END
       WHERE id = $1 AND course_id = $3`,
      [item.enrollmentId, item.percent, input.courseId],
    )),
  ]

  await sql.transaction(transaction)
  return progressUpdates.length
}
