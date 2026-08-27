import 'server-only'

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getSql } from '@/lib/database'
import { hashPassword } from '@/lib/password'
import { nextPaymentDueAt, paymentItemState, paymentPlanState } from '@/lib/payment-calculations'
import { packages } from '@/lib/tabulama-config'
import type { EmailResult } from '@/lib/tabulama-email'

export const MODULE_PROGRESS_STATUSES = ['upcoming', 'in_progress', 'completed'] as const
export type ModuleProgressStatus = (typeof MODULE_PROGRESS_STATUSES)[number]
export type AccountStatus = 'pending' | 'active' | 'disabled'
export type AuthTokenType = 'activation' | 'password_reset'

export interface CourseModuleItem {
  id: string
  courseId: string
  title: string
  position: number
  description: string | null
  topic: string | null
  plannedDate: string | null
  isActive: boolean
  progressStatus: ModuleProgressStatus
}

export interface StudentPaymentItem {
  id: string
  position: number
  amountHuf: number
  paidAmountHuf: number
  remainingAmountHuf: number
  dueAt: string | null
  status: string
}

export interface StudentPaymentSummary {
  packageName: string
  paymentType: 'lump-sum' | 'installment'
  totalAmountHuf: number
  paidAmountHuf: number
  remainingAmountHuf: number
  nextDueAt: string | null
  status: string
  installmentCount: number
  items: StudentPaymentItem[]
}

export interface StudentEnrollmentDetails {
  id: string
  applicationId: string | null
  status: string
  progressPercent: number
  enrolledAt: string
  course: {
    id: string
    title: string
    shortTitle: string
    slug: string
    status: string
    startDate: string | null
    endDate: string | null
    weeklySchedule: string | null
  }
  modules: CourseModuleItem[]
  currentModule: CourseModuleItem | null
  nextModule: CourseModuleItem | null
  payment: StudentPaymentSummary | null
}

export interface StudentDetails {
  id: string
  userId: string
  studentNumber: string
  fullName: string
  email: string
  phone: string | null
  birthDate: string | null
  address: string | null
  guardianName: string | null
  guardianEmail: string | null
  guardianPhone: string | null
  accountStatus: AccountStatus
  enrollments: StudentEnrollmentDetails[]
}

export interface StudentListItem {
  id: string
  studentNumber: string
  fullName: string
  email: string
  accountStatus: AccountStatus
  courses: string[]
  applicationIds: string[]
}

export interface EnrollmentProvisionResult {
  statusChanged: boolean
  studentProfileId: string
  studentNumber: string
  participantName: string
  email: string
  courseTitle: string
  activation: {
    rawToken: string
    tokenHash: string
    expiresAt: string
  } | null
}

interface ProfileRow {
  id: string
  user_id: string
  student_number: string
  full_name: string
  email: string
  account_status: AccountStatus
  birth_date: string | Date | null
  phone: string | null
  address: string | null
  guardian_name: string | null
  guardian_email: string | null
  guardian_phone: string | null
}

interface EnrollmentRow {
  id: string
  application_id: string | null
  status: string
  progress_percent: number
  enrolled_at: string | Date
  course_id: string
  title: string
  short_title: string
  slug: string
  course_status: string
  start_date: string | Date | null
  end_date: string | Date | null
  weekly_schedule: string | null
}

interface ModuleRow {
  enrollment_id: string
  id: string
  course_id: string
  title: string
  position: number
  description: string | null
  topic: string | null
  planned_date: string | Date | null
  is_active: boolean
  progress_status: ModuleProgressStatus | null
}

interface PlanRow {
  enrollment_id: string
  package_key: keyof typeof packages
  payment_type: 'lump-sum' | 'installment'
  id: string
  total_amount_huf: number
  installment_count: number
  status: string
}

interface ItemRow {
  enrollment_id: string
  id: string
  position: number
  amount_huf: number
  due_at: string | Date | null
  status: string
  paid_amount_huf: number
}

function toIso(value: string | Date | null): string | null {
  return value instanceof Date ? value.toISOString() : value
}

function tokenPair(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('base64url')
  return { rawToken, tokenHash: createHash('sha256').update(rawToken).digest('hex') }
}

export function tokenHash(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

export async function completeStudentEnrollment(
  applicationId: string,
  note: string | null,
): Promise<EnrollmentProvisionResult> {
  const pair = tokenPair()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const rows = await getSql().query(
    `WITH app AS MATERIALIZED (
       SELECT a.*, c.title AS course_title,
              lower(coalesce(nullif(a.participant_email, ''), nullif(a.guardian_email, ''), a.billing_email)) AS account_email
       FROM applications a
       JOIN courses c ON c.id = a.course_id
       WHERE a.id = $1
       LIMIT 1
     ),
     status_update AS (
       UPDATE applications a
       SET status = 'enrolled', updated_at = now()
       FROM app
       WHERE a.id = app.id AND a.status <> 'enrolled'
       RETURNING a.id
     ),
     history AS (
       INSERT INTO status_history (id, entity_type, entity_id, from_status, to_status, note)
       SELECT $2, 'application', app.id, app.status, 'enrolled',
              coalesce($3, 'Adminisztrátori státuszmódosítás.')
       FROM app
       WHERE app.status <> 'enrolled' OR $3 IS NOT NULL
       RETURNING id
     ),
     upserted_user AS (
       INSERT INTO users (id, email, full_name, role, account_status)
       SELECT $4, app.account_email, app.participant_name, 'student', 'pending'
       FROM app
       ON CONFLICT (email) DO UPDATE SET
         full_name = excluded.full_name,
         updated_at = now()
       RETURNING id, email, full_name, account_status, password_hash
     ),
     profile AS (
       INSERT INTO student_profiles (
         id, user_id, birth_date, phone, address,
         guardian_name, guardian_email, guardian_phone
       )
       SELECT $5, u.id, app.participant_birth_date, app.participant_phone,
              app.billing_address, app.guardian_name, app.guardian_email, app.guardian_phone
       FROM app CROSS JOIN upserted_user u
       ON CONFLICT (user_id) DO UPDATE SET
         birth_date = coalesce(student_profiles.birth_date, excluded.birth_date),
         phone = coalesce(excluded.phone, student_profiles.phone),
         guardian_name = coalesce(excluded.guardian_name, student_profiles.guardian_name),
         guardian_email = coalesce(excluded.guardian_email, student_profiles.guardian_email),
         guardian_phone = coalesce(excluded.guardian_phone, student_profiles.guardian_phone),
         updated_at = now()
       RETURNING id, user_id, student_number
     ),
     enrollment AS (
       INSERT INTO course_enrollments (
         id, course_id, student_profile_id, application_id, status, progress_percent
       )
       SELECT $6, app.course_id, profile.id, app.id, 'active', 0
       FROM app CROSS JOIN profile
       ON CONFLICT (course_id, student_profile_id) DO UPDATE SET status = 'active'
       RETURNING id
     ),
     invalidated AS (
       UPDATE auth_tokens t SET used_at = now()
       FROM upserted_user u
       WHERE t.user_id = u.id AND t.token_type = 'activation' AND t.used_at IS NULL
       RETURNING t.id
     ),
     activation AS (
       INSERT INTO auth_tokens (id, user_id, token_type, token_hash, expires_at)
       SELECT $7, u.id, 'activation', $8, $9::timestamptz
       FROM upserted_user u
       WHERE u.account_status = 'pending'
         AND (SELECT count(*) FROM invalidated) >= 0
       RETURNING id
     )
     SELECT
       app.status <> 'enrolled' AS status_changed,
       profile.id AS student_profile_id,
       profile.student_number,
       app.participant_name,
       u.email,
       app.course_title,
       EXISTS (SELECT 1 FROM activation) AS activation_created
     FROM app CROSS JOIN upserted_user u CROSS JOIN profile`,
    [
      applicationId,
      randomUUID(),
      note?.trim() || null,
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
      pair.tokenHash,
      expiresAt,
    ],
  ) as Array<{
    status_changed: boolean
    student_profile_id: string
    student_number: string
    participant_name: string
    email: string
    course_title: string
    activation_created: boolean
  }>
  const row = rows[0]
  if (!row) throw new Error('application_not_found')
  return {
    statusChanged: row.status_changed,
    studentProfileId: row.student_profile_id,
    studentNumber: row.student_number,
    participantName: row.participant_name,
    email: row.email,
    courseTitle: row.course_title,
    activation: row.activation_created ? { ...pair, expiresAt } : null,
  }
}

export async function createActivationForStudent(profileId: string): Promise<EnrollmentProvisionResult | null> {
  const pair = tokenPair()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  const rows = await getSql().query(
    `WITH target AS MATERIALIZED (
       SELECT sp.id AS profile_id, sp.student_number, u.id AS user_id,
              u.full_name, u.email, u.account_status,
              (SELECT c.title FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
               WHERE ce.student_profile_id = sp.id ORDER BY ce.enrolled_at DESC LIMIT 1) AS course_title
       FROM student_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.id = $1
     ),
     invalidated AS (
       UPDATE auth_tokens t SET used_at = now()
       FROM target
       WHERE t.user_id = target.user_id AND t.token_type = 'activation' AND t.used_at IS NULL
       RETURNING t.id
     ),
     inserted AS (
       INSERT INTO auth_tokens (id, user_id, token_type, token_hash, expires_at)
       SELECT $2, target.user_id, 'activation', $3, $4::timestamptz
       FROM target
       WHERE target.account_status = 'pending' AND (SELECT count(*) FROM invalidated) >= 0
       RETURNING id
     )
     SELECT target.*, EXISTS (SELECT 1 FROM inserted) AS activation_created FROM target`,
    [profileId, randomUUID(), pair.tokenHash, expiresAt],
  ) as Array<{
    profile_id: string
    student_number: string
    full_name: string
    email: string
    course_title: string | null
    activation_created: boolean
  }>
  const row = rows[0]
  if (!row?.activation_created) return null
  return {
    statusChanged: false,
    studentProfileId: row.profile_id,
    studentNumber: row.student_number,
    participantName: row.full_name,
    email: row.email,
    courseTitle: row.course_title ?? 'TabuLama kurzus',
    activation: { ...pair, expiresAt },
  }
}

export async function recordAuthTokenEmailResult(hash: string, result: EmailResult): Promise<void> {
  await getSql().query(
    `UPDATE auth_tokens SET email_status = $2, email_detail = $3,
       email_sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE NULL END
     WHERE token_hash = $1`,
    [hash, result.status, result.detail],
  )
}

export async function getAuthTokenPreview(rawToken: string, type: AuthTokenType): Promise<{
  fullName: string
  studentNumber: string | null
} | null> {
  const rows = await getSql().query(
    `SELECT u.full_name, sp.student_number
     FROM auth_tokens t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     WHERE t.token_hash = $1 AND t.token_type = $2
       AND t.used_at IS NULL AND t.expires_at > now()
     LIMIT 1`,
    [tokenHash(rawToken), type],
  ) as Array<{ full_name: string; student_number: string | null }>
  return rows[0] ? { fullName: rows[0].full_name, studentNumber: rows[0].student_number } : null
}

export async function activateStudentAccount(rawToken: string, password: string): Promise<boolean> {
  const rows = await getSql().query(
    `WITH consumed AS (
       UPDATE auth_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND token_type = 'activation'
         AND used_at IS NULL AND expires_at > now()
       RETURNING user_id
     )
     UPDATE users u SET password_hash = $2, account_status = 'active', updated_at = now()
     FROM consumed WHERE u.id = consumed.user_id
     RETURNING u.id`,
    [tokenHash(rawToken), hashPassword(password)],
  ) as Array<{ id: string }>
  return rows.length === 1
}

export async function createPasswordReset(emailInput: string): Promise<{
  rawToken: string
  tokenHash: string
  expiresAt: string
  email: string
  fullName: string
} | null> {
  const email = emailInput.trim().toLowerCase()
  const users = await getSql().query(
    `SELECT id, email, full_name FROM users
     WHERE lower(email) = $1 AND account_status = 'active' AND password_hash IS NOT NULL
     LIMIT 1`,
    [email],
  ) as Array<{ id: string; email: string; full_name: string }>
  const user = users[0]
  if (!user) return null

  const pair = tokenPair()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  const sql = getSql()
  await sql.transaction([
    sql.query(
      `UPDATE auth_tokens SET used_at = now()
       WHERE user_id = $1 AND token_type = 'password_reset' AND used_at IS NULL`,
      [user.id],
    ),
    sql.query(
      `INSERT INTO auth_tokens (id, user_id, token_type, token_hash, expires_at)
       VALUES ($1, $2, 'password_reset', $3, $4::timestamptz)`,
      [randomUUID(), user.id, pair.tokenHash, expiresAt],
    ),
  ])
  return { ...pair, expiresAt, email: user.email, fullName: user.full_name }
}

export async function resetPasswordWithToken(rawToken: string, password: string): Promise<boolean> {
  const rows = await getSql().query(
    `WITH consumed AS (
       UPDATE auth_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND token_type = 'password_reset'
         AND used_at IS NULL AND expires_at > now()
       RETURNING user_id
     )
     UPDATE users u SET password_hash = $2, account_status = 'active', updated_at = now()
     FROM consumed WHERE u.id = consumed.user_id
     RETURNING u.id`,
    [tokenHash(rawToken), hashPassword(password)],
  ) as Array<{ id: string }>
  return rows.length === 1
}

export async function listStudents(search = ''): Promise<StudentListItem[]> {
  const query = search.trim().toLowerCase()
  const rows = await getSql().query(
    `SELECT sp.id, sp.student_number, u.full_name, u.email, u.account_status,
            coalesce(array_agg(DISTINCT c.short_title) FILTER (WHERE c.id IS NOT NULL), '{}') AS courses,
            coalesce(array_agg(DISTINCT ce.application_id) FILTER (WHERE ce.application_id IS NOT NULL), '{}') AS application_ids
     FROM student_profiles sp
     JOIN users u ON u.id = sp.user_id
     LEFT JOIN course_enrollments ce ON ce.student_profile_id = sp.id
     LEFT JOIN courses c ON c.id = ce.course_id
     WHERE $1 = '' OR lower(u.full_name) LIKE '%' || $1 || '%'
       OR lower(u.email) LIKE '%' || $1 || '%'
       OR lower(sp.student_number) LIKE '%' || $1 || '%'
       OR lower(coalesce(ce.application_id, '')) LIKE '%' || $1 || '%'
     GROUP BY sp.id, sp.student_number, u.full_name, u.email, u.account_status
     ORDER BY u.full_name ASC`,
    [query],
  ) as Array<{
    id: string
    student_number: string
    full_name: string
    email: string
    account_status: AccountStatus
    courses: string[]
    application_ids: string[]
  }>
  return rows.map((row) => ({
    id: row.id,
    studentNumber: row.student_number,
    fullName: row.full_name,
    email: row.email,
    accountStatus: row.account_status,
    courses: row.courses,
    applicationIds: row.application_ids,
  }))
}

async function getStudentDetails(column: 'u.id' | 'sp.id', id: string): Promise<StudentDetails | null> {
  const sql = getSql()
  const profileRows = await sql.query(
    `SELECT sp.id, sp.user_id, sp.student_number, sp.birth_date, sp.phone, sp.address,
            sp.guardian_name, sp.guardian_email, sp.guardian_phone,
            u.full_name, u.email, u.account_status
     FROM student_profiles sp JOIN users u ON u.id = sp.user_id
     WHERE ${column} = $1 LIMIT 1`,
    [id],
  ) as ProfileRow[]
  const profile = profileRows[0]
  if (!profile) return null

  const [enrollmentRows, moduleRows, planRows, itemRows] = await Promise.all([
    sql.query(
      `SELECT ce.id, ce.application_id, ce.status, ce.progress_percent, ce.enrolled_at,
              c.id AS course_id, c.title, c.short_title, c.slug, c.status AS course_status,
              c.start_date, c.end_date, c.weekly_schedule
       FROM course_enrollments ce JOIN courses c ON c.id = ce.course_id
       WHERE ce.student_profile_id = $1 ORDER BY ce.enrolled_at DESC`,
      [profile.id],
    ),
    sql.query(
      `SELECT ce.id AS enrollment_id, cm.id, cm.course_id, cm.title, cm.position,
              cm.description, cm.topic, cm.planned_date, cm.is_active,
              smp.status AS progress_status
       FROM course_enrollments ce
       JOIN course_modules cm ON cm.course_id = ce.course_id
       LEFT JOIN student_module_progress smp
         ON smp.enrollment_id = ce.id AND smp.module_id = cm.id
       WHERE ce.student_profile_id = $1
       ORDER BY ce.enrolled_at DESC, cm.position ASC`,
      [profile.id],
    ),
    sql.query(
      `SELECT ce.id AS enrollment_id, a.package_key, a.payment_type,
              pp.id, pp.total_amount_huf, pp.installment_count, pp.status
       FROM course_enrollments ce
       JOIN applications a ON a.id = ce.application_id
       JOIN payment_plans pp ON pp.application_id = a.id
       WHERE ce.student_profile_id = $1`,
      [profile.id],
    ),
    sql.query(
      `SELECT ce.id AS enrollment_id, pi.id, pi.position, pi.amount_huf,
              pi.due_at, pi.status, coalesce(sum(p.amount_huf), 0)::int AS paid_amount_huf
       FROM course_enrollments ce
       JOIN applications a ON a.id = ce.application_id
       JOIN payment_plans pp ON pp.application_id = a.id
       JOIN payment_items pi ON pi.payment_plan_id = pp.id
       LEFT JOIN payments p ON p.payment_item_id = pi.id
       WHERE ce.student_profile_id = $1
       GROUP BY ce.id, pi.id, pi.position, pi.amount_huf, pi.due_at, pi.status
       ORDER BY ce.id, pi.position`,
      [profile.id],
    ),
  ])

  const modulesByEnrollment = new Map<string, CourseModuleItem[]>()
  for (const row of moduleRows as ModuleRow[]) {
    const modules = modulesByEnrollment.get(row.enrollment_id) ?? []
    modules.push({
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      position: Number(row.position),
      description: row.description,
      topic: row.topic,
      plannedDate: toIso(row.planned_date),
      isActive: row.is_active,
      progressStatus: row.progress_status ?? 'upcoming',
    })
    modulesByEnrollment.set(row.enrollment_id, modules)
  }

  const itemsByEnrollment = new Map<string, StudentPaymentItem[]>()
  for (const row of itemRows as ItemRow[]) {
    const amountHuf = Number(row.amount_huf)
    const paidAmountHuf = Number(row.paid_amount_huf)
    const dueAt = toIso(row.due_at)
    const items = itemsByEnrollment.get(row.enrollment_id) ?? []
    items.push({
      id: row.id,
      position: Number(row.position),
      amountHuf,
      paidAmountHuf,
      remainingAmountHuf: Math.max(amountHuf - paidAmountHuf, 0),
      dueAt,
      status: paymentItemState({
        amountHuf,
        paidAmountHuf,
        dueAt,
        currentStatus: row.status,
        now: new Date(),
      }),
    })
    itemsByEnrollment.set(row.enrollment_id, items)
  }

  const paymentByEnrollment = new Map<string, StudentPaymentSummary>()
  for (const row of planRows as PlanRow[]) {
    const items = itemsByEnrollment.get(row.enrollment_id) ?? []
    const totalAmountHuf = Number(row.total_amount_huf)
    const paidAmountHuf = items.reduce((sum, item) => sum + item.paidAmountHuf, 0)
    paymentByEnrollment.set(row.enrollment_id, {
      packageName: packages[row.package_key]?.name ?? row.package_key,
      paymentType: row.payment_type,
      totalAmountHuf,
      paidAmountHuf,
      remainingAmountHuf: Math.max(totalAmountHuf - paidAmountHuf, 0),
      nextDueAt: nextPaymentDueAt(items),
      status: paymentPlanState({
        totalAmountHuf,
        paidAmountHuf,
        itemStatuses: items.map((item) => item.status),
        currentStatus: row.status,
      }),
      installmentCount: Number(row.installment_count),
      items,
    })
  }

  const enrollments = (enrollmentRows as EnrollmentRow[]).map((row) => {
    const modules = (modulesByEnrollment.get(row.id) ?? []).filter((module) => module.isActive)
    const completed = modules.filter((module) => module.progressStatus === 'completed').length
    const progressPercent = modules.length ? Math.round(completed * 100 / modules.length) : 0
    const currentIndex = modules.findIndex((module) => module.progressStatus === 'in_progress')
    const upcomingIndex = modules.findIndex((module) => module.progressStatus === 'upcoming')
    const activeIndex = currentIndex >= 0 ? currentIndex : upcomingIndex
    return {
      id: row.id,
      applicationId: row.application_id,
      status: row.status,
      progressPercent,
      enrolledAt: toIso(row.enrolled_at) ?? '',
      course: {
        id: row.course_id,
        title: row.title,
        shortTitle: row.short_title,
        slug: row.slug,
        status: row.course_status,
        startDate: toIso(row.start_date),
        endDate: toIso(row.end_date),
        weeklySchedule: row.weekly_schedule,
      },
      modules,
      currentModule: activeIndex >= 0 ? modules[activeIndex] : null,
      nextModule: activeIndex >= 0 ? modules[activeIndex + 1] ?? null : null,
      payment: paymentByEnrollment.get(row.id) ?? null,
    }
  })

  return {
    id: profile.id,
    userId: profile.user_id,
    studentNumber: profile.student_number,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    birthDate: toIso(profile.birth_date),
    address: profile.address,
    guardianName: profile.guardian_name,
    guardianEmail: profile.guardian_email,
    guardianPhone: profile.guardian_phone,
    accountStatus: profile.account_status,
    enrollments,
  }
}

export function getStudentDashboard(userId: string): Promise<StudentDetails | null> {
  return getStudentDetails('u.id', userId)
}

export function getAdminStudentById(profileId: string): Promise<StudentDetails | null> {
  return getStudentDetails('sp.id', profileId)
}

export async function listCourseModules(courseId: string): Promise<CourseModuleItem[]> {
  const rows = await getSql().query(
    `SELECT id, course_id, title, position, description, topic, planned_date, is_active
     FROM course_modules WHERE course_id = $1 ORDER BY position ASC`,
    [courseId],
  ) as Array<Omit<ModuleRow, 'enrollment_id' | 'progress_status'>>
  return rows.map((row) => ({
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    position: Number(row.position),
    description: row.description,
    topic: row.topic,
    plannedDate: toIso(row.planned_date),
    isActive: row.is_active,
    progressStatus: 'upcoming',
  }))
}

export async function createCourseModule(input: {
  courseId: string
  title: string
  description: string | null
  topic: string | null
  plannedDate: string | null
  isActive: boolean
}): Promise<void> {
  await getSql().query(
    `INSERT INTO course_modules (
       id, course_id, title, position, description, topic, planned_date, is_active
     ) SELECT $1, $2, $3, coalesce(max(position), 0) + 1, $4, $5, $6::date, $7
       FROM course_modules WHERE course_id = $2`,
    [randomUUID(), input.courseId, input.title, input.description, input.topic, input.plannedDate, input.isActive],
  )
}

export async function updateCourseModule(input: {
  id: string
  courseId: string
  title: string
  description: string | null
  topic: string | null
  plannedDate: string | null
  isActive: boolean
}): Promise<void> {
  await getSql().query(
    `UPDATE course_modules SET title = $3, description = $4, topic = $5,
       planned_date = $6::date, is_active = $7, updated_at = now()
     WHERE id = $1 AND course_id = $2`,
    [input.id, input.courseId, input.title, input.description, input.topic, input.plannedDate, input.isActive],
  )
}

export async function moveCourseModule(id: string, courseId: string, direction: 'up' | 'down'): Promise<void> {
  const sql = getSql()
  const rows = await sql.query(
    `SELECT id, position FROM course_modules WHERE course_id = $1 ORDER BY position ASC`,
    [courseId],
  ) as Array<{ id: string; position: number }>
  const index = rows.findIndex((row) => row.id === id)
  const other = rows[index + (direction === 'up' ? -1 : 1)]
  const target = rows[index]
  if (!target || !other) return
  await sql.transaction([
    sql.query('UPDATE course_modules SET position = 2147483647 WHERE id = $1 AND course_id = $2', [target.id, courseId]),
    sql.query('UPDATE course_modules SET position = $3 WHERE id = $1 AND course_id = $2', [other.id, courseId, target.position]),
    sql.query('UPDATE course_modules SET position = $3, updated_at = now() WHERE id = $1 AND course_id = $2', [target.id, courseId, other.position]),
  ])
}

export async function updateModuleProgress(
  enrollmentId: string,
  moduleId: string,
  status: ModuleProgressStatus,
): Promise<void> {
  const sql = getSql()
  const valid = await sql.query(
    `SELECT 1 FROM course_enrollments ce JOIN course_modules cm ON cm.course_id = ce.course_id
     WHERE ce.id = $1 AND cm.id = $2 LIMIT 1`,
    [enrollmentId, moduleId],
  ) as unknown[]
  if (!valid.length) throw new Error('module_not_found')
  await sql.transaction([
    sql.query(
      `INSERT INTO student_module_progress (id, enrollment_id, module_id, status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (enrollment_id, module_id) DO UPDATE SET status = excluded.status, updated_at = now()`,
      [randomUUID(), enrollmentId, moduleId, status],
    ),
    sql.query(
      `UPDATE course_enrollments ce SET progress_percent = (
         SELECT CASE WHEN count(*) = 0 THEN 0
           ELSE round(100.0 * count(*) FILTER (WHERE smp.status = 'completed') / count(*))::int END
         FROM course_modules cm
         LEFT JOIN student_module_progress smp
           ON smp.module_id = cm.id AND smp.enrollment_id = ce.id
         WHERE cm.course_id = ce.course_id AND cm.is_active
       ) WHERE ce.id = $1`,
      [enrollmentId],
    ),
  ])
}
