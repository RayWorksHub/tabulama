import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { getSql } from '@/lib/database'
import { packages } from '@/lib/tabulama-config'
import type { ApplicationData } from '@/lib/tabulama-application-schema'
import type { ApplicationMeta } from '@/lib/tabulama-email'

const DEFAULT_COURSE_ID = 'course-python-2026'

export interface ApplicationListItem {
  id: string
  participantName: string
  contactEmail: string
  contactPhone: string | null
  courseTitle: string
  packageKey: ApplicationData['packageKey']
  totalAmountHuf: number
  status: string
  isTest: boolean
  createdAt: string
}

export interface ApplicationDetails extends ApplicationListItem {
  participantBirthDate: string
  participantEmail: string | null
  participantPhone: string | null
  guardianName: string | null
  guardianEmail: string | null
  guardianPhone: string | null
  billingName: string
  billingEmail: string
  billingAddress: string
  taxNumber: string | null
  paymentType: 'lump-sum' | 'installment'
  source: string | null
  referrer: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  submittedData: ApplicationData
  history: StatusHistoryItem[]
}

export interface StatusHistoryItem {
  id: string
  fromStatus: string | null
  toStatus: string
  note: string | null
  createdAt: string
}

export interface AdminDashboardStats {
  activeCourses: number
  upcomingCourses: number
  applications: number
  newApplications: number
  activeStudents: number
  awaitingPayment: number
  overduePayments: number
  receivedAmountHuf: number
  outstandingAmountHuf: number
}

interface ApplicationRow {
  id: string
  participant_name: string
  participant_birth_date: string
  participant_email: string | null
  participant_phone: string | null
  guardian_name: string | null
  guardian_email: string | null
  guardian_phone: string | null
  billing_name: string
  billing_email: string
  billing_address: string
  tax_number: string | null
  package_key: ApplicationData['packageKey']
  payment_type: 'lump-sum' | 'installment'
  total_amount_huf: number
  status: string
  is_test: boolean
  source: string | null
  referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  submitted_data: ApplicationData
  created_at: string
  course_title: string
}

interface HistoryRow {
  id: string
  from_status: string | null
  to_status: string
  note: string | null
  created_at: string
}

function contactEmail(row: ApplicationRow): string {
  return row.guardian_email ?? row.participant_email ?? row.billing_email
}

function contactPhone(row: ApplicationRow): string | null {
  return row.guardian_phone ?? row.participant_phone
}

function toListItem(row: ApplicationRow): ApplicationListItem {
  return {
    id: row.id,
    participantName: row.participant_name,
    contactEmail: contactEmail(row),
    contactPhone: contactPhone(row),
    courseTitle: row.course_title,
    packageKey: row.package_key,
    totalAmountHuf: Number(row.total_amount_huf),
    status: row.status,
    isTest: row.is_test,
    createdAt: row.created_at,
  }
}

export function hashRequestIp(ip: string): string {
  const salt = process.env.RATE_LIMIT_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? 'tabulama'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const sql = getSql()
  const rows = (await sql.query(
    `INSERT INTO rate_limits (key, hit_count, reset_at)
     VALUES ($1, 1, now() + ($2 * interval '1 second'))
     ON CONFLICT (key) DO UPDATE SET
       hit_count = CASE
         WHEN rate_limits.reset_at <= now() THEN 1
         ELSE rate_limits.hit_count + 1
       END,
       reset_at = CASE
         WHEN rate_limits.reset_at <= now() THEN now() + ($2 * interval '1 second')
         ELSE rate_limits.reset_at
       END
     RETURNING hit_count`,
    [key, windowSeconds],
  )) as Array<{ hit_count: number }>

  return Number(rows[0]?.hit_count ?? limit + 1) <= limit
}

export async function saveApplication(
  data: ApplicationData,
  meta: ApplicationMeta,
  requestIpHash: string,
): Promise<void> {
  const sql = getSql()
  const selectedPackage = packages[data.packageKey]
  const billingAddress = `${data.billingZip} ${data.billingCity}, ${data.billingAddress}`

  await sql.query(
    `WITH inserted AS (
       INSERT INTO applications (
         id, course_id, participant_name, participant_birth_date,
         participant_email, participant_phone, guardian_name, guardian_email,
         guardian_phone, billing_name, billing_email, billing_address, tax_number,
         package_key, payment_type, total_amount_huf, status, is_test,
         source, referrer, utm_source, utm_medium, utm_campaign,
         request_ip_hash, submitted_data, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13,
         $14, $15, $16, 'new', false, $17, $18, $19, $20, $21,
         $22, $23::jsonb, $24::timestamptz, $24::timestamptz
       )
       RETURNING id
     )
     INSERT INTO status_history (
       id, entity_type, entity_id, from_status, to_status, note, created_at
     )
     SELECT $25, 'application', id, NULL, 'new', 'Jelentkezés beérkezett.', $24::timestamptz
     FROM inserted`,
    [
      meta.applicationId,
      DEFAULT_COURSE_ID,
      data.participantName,
      data.participantBirthDate,
      data.participantEmail ?? null,
      data.participantPhone ?? null,
      data.guardianName ?? null,
      data.guardianEmail ?? null,
      data.guardianPhone ?? null,
      data.billingName,
      data.billingEmail,
      billingAddress,
      data.taxNumber ?? null,
      data.packageKey,
      selectedPackage.paymentType,
      selectedPackage.total,
      data.source ?? null,
      data.referrer ?? null,
      data.utmSource ?? null,
      data.utmMedium ?? null,
      data.utmCampaign ?? null,
      requestIpHash,
      JSON.stringify(data),
      meta.receivedAt.toISOString(),
      randomUUID(),
    ],
  )
}

export async function listApplications(limit = 100): Promise<ApplicationListItem[]> {
  const sql = getSql()
  const rows = (await sql.query(
    `SELECT
       a.id, a.participant_name, a.participant_birth_date,
       a.participant_email, a.participant_phone,
       a.guardian_name, a.guardian_email, a.guardian_phone,
       a.billing_name, a.billing_email, a.billing_address, a.tax_number,
       a.package_key, a.payment_type, a.total_amount_huf, a.status, a.is_test,
       a.source, a.referrer, a.utm_source, a.utm_medium, a.utm_campaign,
       a.submitted_data, a.created_at, c.short_title AS course_title
     FROM applications a
     JOIN courses c ON c.id = a.course_id
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500)],
  )) as ApplicationRow[]

  return rows.map(toListItem)
}

export async function getApplicationById(id: string): Promise<ApplicationDetails | null> {
  const sql = getSql()
  const [applicationRows, historyRows] = await Promise.all([
    sql.query(
      `SELECT
         a.id, a.participant_name, a.participant_birth_date,
         a.participant_email, a.participant_phone,
         a.guardian_name, a.guardian_email, a.guardian_phone,
         a.billing_name, a.billing_email, a.billing_address, a.tax_number,
         a.package_key, a.payment_type, a.total_amount_huf, a.status, a.is_test,
         a.source, a.referrer, a.utm_source, a.utm_medium, a.utm_campaign,
         a.submitted_data, a.created_at, c.short_title AS course_title
       FROM applications a
       JOIN courses c ON c.id = a.course_id
       WHERE a.id = $1
       LIMIT 1`,
      [id],
    ),
    sql.query(
      `SELECT id, from_status, to_status, note, created_at
       FROM status_history
       WHERE entity_type = 'application' AND entity_id = $1
       ORDER BY created_at ASC`,
      [id],
    ),
  ])

  const row = (applicationRows as ApplicationRow[])[0]
  if (!row) return null

  const history = (historyRows as HistoryRow[]).map((item) => ({
    id: item.id,
    fromStatus: item.from_status,
    toStatus: item.to_status,
    note: item.note,
    createdAt: item.created_at,
  }))

  return {
    ...toListItem(row),
    participantBirthDate: row.participant_birth_date,
    participantEmail: row.participant_email,
    participantPhone: row.participant_phone,
    guardianName: row.guardian_name,
    guardianEmail: row.guardian_email,
    guardianPhone: row.guardian_phone,
    billingName: row.billing_name,
    billingEmail: row.billing_email,
    billingAddress: row.billing_address,
    taxNumber: row.tax_number,
    paymentType: row.payment_type,
    source: row.source,
    referrer: row.referrer,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    submittedData: row.submitted_data,
    history,
  }
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const sql = getSql()
  const [applicationRows, courseRows, studentRows, paymentRows] = await Promise.all([
    sql.query(
      `SELECT
         count(*)::int AS applications,
         count(*) FILTER (WHERE status = 'new')::int AS new_applications,
         count(*) FILTER (WHERE status IN ('proforma', 'awaiting_payment', 'partially_paid'))::int AS awaiting_payment,
         coalesce(sum(total_amount_huf) FILTER (WHERE status NOT IN ('rejected', 'cancelled')), 0)::int AS total_due,
         coalesce(sum(total_amount_huf) FILTER (WHERE status IN ('paid', 'invoiced', 'enrolled')), 0)::int AS paid_total
       FROM applications`,
    ),
    sql.query(
      `SELECT
         count(*) FILTER (WHERE status = 'in_progress')::int AS active_courses,
         count(*) FILTER (WHERE status IN ('coming_soon', 'open'))::int AS upcoming_courses
       FROM courses`,
    ),
    sql.query(
      `SELECT count(*) FILTER (WHERE status = 'active')::int AS active_students
       FROM course_enrollments`,
    ),
    sql.query(
      `SELECT count(*) FILTER (WHERE status = 'overdue')::int AS overdue_payments
       FROM payment_items`,
    ),
  ])

  const applications = (applicationRows as Array<Record<string, number>>)[0] ?? {}
  const courses = (courseRows as Array<Record<string, number>>)[0] ?? {}
  const students = (studentRows as Array<Record<string, number>>)[0] ?? {}
  const payments = (paymentRows as Array<Record<string, number>>)[0] ?? {}
  const totalDue = Number(applications.total_due ?? 0)
  const paidTotal = Number(applications.paid_total ?? 0)

  return {
    activeCourses: Number(courses.active_courses ?? 0),
    upcomingCourses: Number(courses.upcoming_courses ?? 0),
    applications: Number(applications.applications ?? 0),
    newApplications: Number(applications.new_applications ?? 0),
    activeStudents: Number(students.active_students ?? 0),
    awaitingPayment: Number(applications.awaiting_payment ?? 0),
    overduePayments: Number(payments.overdue_payments ?? 0),
    receivedAmountHuf: paidTotal,
    outstandingAmountHuf: Math.max(totalDue - paidTotal, 0),
  }
}
