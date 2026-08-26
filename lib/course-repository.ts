import 'server-only'

import { randomUUID } from 'node:crypto'
import { getSql } from '@/lib/database'

export const COURSE_STATUSES = [
  'draft',
  'coming_soon',
  'open',
  'full',
  'in_progress',
  'closed',
  'archived',
] as const

export type CourseStatus = (typeof COURSE_STATUSES)[number]

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  draft: 'Piszkozat',
  coming_soon: 'Hamarosan',
  open: 'Jelentkezhető',
  full: 'Betelt',
  in_progress: 'Folyamatban',
  closed: 'Lezárt',
  archived: 'Archivált',
}

export interface CourseInput {
  title: string
  shortTitle: string
  slug: string
  description: string
  summary: string
  category: string
  imageUrl: string | null
  startDate: string | null
  endDate: string | null
  applicationDeadline: string | null
  weeklySchedule: string | null
  maxCapacity: number | null
  priceHuf: number
  discountedPriceHuf: number | null
  discountedPaymentDeadline: string | null
  installmentEnabled: boolean
  installmentCount: number | null
  installmentAmountHuf: number | null
  installmentDueDates: Array<string | null>
  status: CourseStatus
  instructorName: string | null
  targetAudience: string | null
  prerequisites: string | null
  syllabus: string | null
  applicationsEnabled: boolean
}

export interface Course extends CourseInput {
  id: string
  currentHeadcount: number
  remainingCapacity: number | null
  createdAt: string
  updatedAt: string
}

interface CourseRow {
  id: string
  slug: string
  title: string
  short_title: string
  description: string
  summary: string
  category: string
  image_url: string | null
  start_date: string | null
  end_date: string | null
  application_deadline: string | null
  weekly_schedule: string | null
  max_capacity: number | null
  price_huf: number
  discounted_price_huf: number | null
  discounted_payment_deadline: string | null
  installment_enabled: boolean
  installment_count: number | null
  installment_amount_huf: number | null
  installment_due_dates: Array<string | null>
  status: CourseStatus
  instructor_name: string | null
  target_audience: string | null
  prerequisites: string | null
  syllabus: string | null
  applications_enabled: boolean
  current_headcount: number
  created_at: string
  updated_at: string
}

const COURSE_SELECT = `
  SELECT c.*,
    COALESCE((
      SELECT count(*)
      FROM (
        SELECT 'application:' || a.id AS slot
        FROM applications a
        WHERE a.course_id = c.id
          AND NOT a.is_test
          AND a.status NOT IN ('rejected', 'cancelled')
        UNION
        SELECT COALESCE('application:' || e.application_id, 'enrollment:' || e.id) AS slot
        FROM course_enrollments e
        WHERE e.course_id = c.id
          AND e.status IN ('pending', 'active')
      ) occupancy
    ), 0) AS current_headcount
  FROM courses c`

function toCourse(row: CourseRow): Course {
  const maxCapacity = row.max_capacity === null ? null : Number(row.max_capacity)
  const currentHeadcount = Number(row.current_headcount)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortTitle: row.short_title,
    description: row.description,
    summary: row.summary,
    category: row.category,
    imageUrl: row.image_url,
    startDate: row.start_date,
    endDate: row.end_date,
    applicationDeadline: row.application_deadline,
    weeklySchedule: row.weekly_schedule,
    maxCapacity,
    priceHuf: Number(row.price_huf),
    discountedPriceHuf: row.discounted_price_huf === null ? null : Number(row.discounted_price_huf),
    discountedPaymentDeadline: row.discounted_payment_deadline,
    installmentEnabled: row.installment_enabled,
    installmentCount: row.installment_count === null ? null : Number(row.installment_count),
    installmentAmountHuf: row.installment_amount_huf === null ? null : Number(row.installment_amount_huf),
    installmentDueDates: Array.isArray(row.installment_due_dates) ? row.installment_due_dates : [],
    status: row.status,
    instructorName: row.instructor_name,
    targetAudience: row.target_audience,
    prerequisites: row.prerequisites,
    syllabus: row.syllabus,
    applicationsEnabled: row.applications_enabled,
    currentHeadcount,
    remainingCapacity: maxCapacity === null ? null : Math.max(maxCapacity - currentHeadcount, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCourses(): Promise<Course[]> {
  const rows = await getSql().query(`${COURSE_SELECT} ORDER BY c.created_at DESC`) as CourseRow[]
  return rows.map(toCourse)
}

export async function listPublicCourses(): Promise<Course[]> {
  const rows = await getSql().query(
    `${COURSE_SELECT}
     WHERE c.status IN ('coming_soon', 'open', 'full', 'in_progress')
     ORDER BY c.start_date ASC NULLS LAST, c.created_at DESC`,
  ) as CourseRow[]
  return rows.map(toCourse)
}

export async function getCourseById(id: string): Promise<Course | null> {
  const rows = await getSql().query(`${COURSE_SELECT} WHERE c.id = $1 LIMIT 1`, [id]) as CourseRow[]
  return rows[0] ? toCourse(rows[0]) : null
}

export async function getPublicCourseBySlug(slug: string): Promise<Course | null> {
  const rows = await getSql().query(
    `${COURSE_SELECT}
     WHERE c.slug = $1 AND c.status NOT IN ('draft', 'archived')
     LIMIT 1`,
    [slug],
  ) as CourseRow[]
  return rows[0] ? toCourse(rows[0]) : null
}

function courseValues(input: CourseInput): unknown[] {
  return [
    input.slug,
    input.title,
    input.shortTitle,
    input.description,
    input.summary,
    input.category,
    input.imageUrl,
    input.startDate,
    input.endDate,
    input.applicationDeadline,
    input.weeklySchedule,
    input.maxCapacity,
    input.priceHuf,
    input.discountedPriceHuf,
    input.discountedPaymentDeadline,
    input.installmentEnabled,
    input.installmentCount,
    input.installmentAmountHuf,
    JSON.stringify(input.installmentDueDates),
    input.status,
    input.instructorName,
    input.targetAudience,
    input.prerequisites,
    input.syllabus,
    input.applicationsEnabled,
  ]
}

export async function createCourse(input: CourseInput): Promise<string> {
  const sql = getSql()
  const id = randomUUID()
  const historyId = randomUUID()
  await sql.transaction([
    sql.query(
      `INSERT INTO courses (
         id, slug, title, short_title, description, summary, category, image_url,
         start_date, end_date, application_deadline, weekly_schedule, max_capacity,
         price_huf, discounted_price_huf, discounted_payment_deadline,
         installment_enabled, installment_count, installment_amount_huf,
         installment_due_dates, status, instructor_name, target_audience,
         prerequisites, syllabus, applications_enabled
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9::date, $10::date, $11::timestamptz, $12, $13,
         $14, $15, $16::timestamptz, $17, $18, $19,
         $20::jsonb, $21, $22, $23, $24, $25, $26
       )`,
      [id, ...courseValues(input)],
    ),
    sql.query(
      `INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, note)
       VALUES ($1, 'course', $2, NULL, $3, 'Kurzus létrehozva adminból.')`,
      [historyId, id, input.status],
    ),
    sql.query('SELECT refresh_course_capacity_status($1)', [id]),
  ])
  return id
}

export async function updateCourse(id: string, input: CourseInput): Promise<void> {
  const sql = getSql()
  const current = await getCourseById(id)
  if (!current) throw new Error('course_not_found')

  await sql.transaction([
    sql.query(
      `UPDATE courses SET
         slug = $2, title = $3, short_title = $4, description = $5, summary = $6,
         category = $7, image_url = $8, start_date = $9::date, end_date = $10::date,
         application_deadline = $11::timestamptz, weekly_schedule = $12,
         max_capacity = $13, price_huf = $14, discounted_price_huf = $15,
         discounted_payment_deadline = $16::timestamptz, installment_enabled = $17,
         installment_count = $18, installment_amount_huf = $19,
         installment_due_dates = $20::jsonb, status = $21, instructor_name = $22,
         target_audience = $23, prerequisites = $24, syllabus = $25,
         applications_enabled = $26, updated_at = now()
       WHERE id = $1`,
      [id, ...courseValues(input)],
    ),
    sql.query(
      `INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, note)
       VALUES ($1, 'course', $2, $3, $4, 'Kurzusadatok módosítva adminból.')`,
      [randomUUID(), id, current.status, input.status],
    ),
    sql.query('SELECT refresh_course_capacity_status($1)', [id]),
  ])
}

export async function updateCourseStatus(id: string, status: CourseStatus): Promise<void> {
  const sql = getSql()
  const rows = await sql.query('SELECT status FROM courses WHERE id = $1 LIMIT 1', [id]) as Array<{ status: CourseStatus }>
  const current = rows[0]
  if (!current) throw new Error('course_not_found')
  if (current.status === status) return

  await sql.transaction([
    sql.query('UPDATE courses SET status = $2, updated_at = now() WHERE id = $1', [id, status]),
    sql.query(
      `INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, note)
       VALUES ($1, 'course', $2, $3, $4, 'Kurzus státusza módosítva adminból.')`,
      [randomUUID(), id, current.status, status],
    ),
    sql.query('SELECT refresh_course_capacity_status($1)', [id]),
  ])
}
