import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import { getSql } from '@/lib/database'
import { provider } from '@/lib/tabulama-config'
import { buildApplicationSchema, type ApplicationData } from '@/lib/tabulama-application-schema'
import type {
  ApplicationMeta,
  ApplicationWorkflowEmailEvent,
  EmailResult,
} from '@/lib/tabulama-email'
import type { ApplicationStatus, PaymentMethod } from '@/lib/admin-display'
import { getApplicationCourseById } from '@/lib/course-repository'
import {
  pricingForApplication,
  type ApplicationPricing,
  type CoursePaymentOption,
} from '@/lib/course-payment-options'
import {
  canRecordPayment,
  nextPaymentDueAt,
  paymentItemState,
  paymentPlanState,
} from '@/lib/payment-calculations'

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
  emailDeliveries: ApplicationEmailDelivery[]
  payment: PaymentSummary | null
}

export interface ApplicationEmailDelivery {
  id: string
  event: ApplicationWorkflowEmailEvent
  recipient: string | null
  status: EmailResult['status']
  detail: string
  attemptedAt: string
  sentAt: string | null
}

export interface StatusHistoryItem {
  id: string
  fromStatus: string | null
  toStatus: string
  note: string | null
  createdAt: string
}

export interface PaymentRecord {
  id: string
  paymentItemId: string
  amountHuf: number
  paidAt: string
  paymentMethod: PaymentMethod
  note: string | null
  createdAt: string
}

export interface PaymentItemDetails {
  id: string
  position: number
  amountHuf: number
  paidAmountHuf: number
  remainingAmountHuf: number
  dueAt: string | null
  status: string
  paidAt: string | null
  paymentMethod: PaymentMethod | null
  payments: PaymentRecord[]
}

export interface PaymentSummary {
  id: string
  totalAmountHuf: number
  paidAmountHuf: number
  remainingAmountHuf: number
  nextDueAt: string | null
  installmentCount: number
  status: string
  items: PaymentItemDetails[]
}

export type ApplicationMutationErrorCode =
  | 'not_found'
  | 'payment_plan_missing'
  | 'overpayment'
  | 'inactive_application'
  | 'no_change'

export class ApplicationMutationError extends Error {
  constructor(public readonly code: ApplicationMutationErrorCode) {
    super(code)
    this.name = 'ApplicationMutationError'
  }
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
  participant_birth_date: string | Date
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
  created_at: string | Date
  course_title: string
}

interface HistoryRow {
  id: string
  from_status: string | null
  to_status: string
  note: string | null
  created_at: string | Date
}

interface EmailDeliveryRow {
  id: string
  event: ApplicationWorkflowEmailEvent
  recipient: string | null
  status: EmailResult['status']
  detail: string
  attempted_at: string | Date
  sent_at: string | Date | null
}

interface PaymentPlanRow {
  id: string
  total_amount_huf: number
  installment_count: number
  status: string
}

interface PaymentItemRow {
  id: string
  position: number
  amount_huf: number
  due_at: string | Date | null
  status: string
  paid_at: string | Date | null
  payment_method: PaymentMethod | null
}

interface PaymentRow {
  id: string
  payment_item_id: string
  amount_huf: number
  paid_at: string | Date
  payment_method: PaymentMethod
  note: string | null
  created_at: string | Date
}

interface PaymentTargetRow {
  item_id: string
  item_amount_huf: number
  item_status: string
  plan_id: string
  plan_total_amount_huf: number
  plan_status: string
  application_status: ApplicationStatus
  item_due_at: string | Date | null
  item_paid_amount_huf: number
  plan_paid_amount_huf: number
  other_overdue: boolean
}

function toIso(value: string | Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : value ?? null
}

interface PaymentScheduleItem {
  position: number
  amountHuf: number
  dueAt: string | null
}

function buildPaymentSchedule(selectedPackage: CoursePaymentOption): PaymentScheduleItem[] {
  const count = selectedPackage.installmentCount ?? 1
  const regularAmount = selectedPackage.installmentAmount ?? selectedPackage.total

  return Array.from({ length: count }, (_, index) => ({
    position: index + 1,
    amountHuf:
      index === count - 1
        ? selectedPackage.total - regularAmount * (count - 1)
        : regularAmount,
    dueAt: selectedPackage.dueDates[index] ?? null,
  }))
}

export class CourseApplicationError extends Error {
  constructor(public readonly code: 'course_not_found' | 'course_unavailable' | 'payment_option_unavailable') {
    super(code)
    this.name = 'CourseApplicationError'
  }
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
    createdAt: toIso(row.created_at) ?? '',
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
): Promise<ApplicationPricing> {
  const sql = getSql()
  const course = await getApplicationCourseById(data.courseId, meta.receivedAt)
  if (!course) throw new CourseApplicationError('course_not_found')
  if (!course.acceptingApplications) throw new CourseApplicationError('course_unavailable')
  const selectedPackage = course.paymentOptions[data.packageKey]
  if (!selectedPackage?.available) throw new CourseApplicationError('payment_option_unavailable')
  const billingAddress = `${data.billingZip} ${data.billingCity}, ${data.billingAddress}`
  const paymentPlanId = randomUUID()
  const schedule = buildPaymentSchedule(selectedPackage)
  const createdAt = meta.receivedAt.toISOString()

  try {
    await sql.transaction([
      sql.query(
      `INSERT INTO applications (
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
       )`,
      [
        meta.applicationId,
        course.id,
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
        createdAt,
      ],
      ),
      sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'application', $2, NULL, 'new', 'Jelentkezés beérkezett.', $3::timestamptz)`,
      [randomUUID(), meta.applicationId, createdAt],
      ),
      sql.query(
      `INSERT INTO payment_plans (
         id, application_id, total_amount_huf, installment_count, status, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, 'pending', $5::timestamptz, $5::timestamptz)`,
      [paymentPlanId, meta.applicationId, selectedPackage.total, schedule.length, createdAt],
      ),
      ...schedule.map((item) =>
        sql.query(
        `INSERT INTO payment_items (
           id, payment_plan_id, position, amount_huf, due_at, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5::timestamptz, 'pending', $6::timestamptz, $6::timestamptz)`,
        [randomUUID(), paymentPlanId, item.position, item.amountHuf, item.dueAt, createdAt],
        ),
      ),
    ])
  } catch (error) {
    if (/course_(?:unavailable|full)/.test(String(error))) {
      throw new CourseApplicationError('course_unavailable')
    }
    throw error
  }

  return pricingForApplication(course.title, selectedPackage)
}

export async function createTestApplication(courseId: string): Promise<string> {
  const sql = getSql()
  const course = await getApplicationCourseById(courseId)
  if (!course) throw new CourseApplicationError('course_not_found')
  const now = new Date()
  const createdAt = now.toISOString()
  const datePart = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Budapest',
  }).format(now).replace(/-/g, '')
  const applicationId = `TEST-${datePart}-${randomUUID().slice(0, 8).toUpperCase()}`
  const paymentPlanId = randomUUID()
  const paymentItemId = randomUUID()
  const testData = buildApplicationSchema(now).parse({
    courseId,
    packageKey: 'standard',
    applicantType: 'self',
    participantName: 'TESZT Jelentkező',
    participantBirthDate: '2000-01-01',
    participantEmail: provider.email,
    participantPhone: '+36 30 000 0000',
    grade: 'Egyéb / már nem vagyok középiskolás',
    goal: 'Még nem tudom, segítséget kérek a választáshoz',
    experience: 'Még nem programoztam',
    schoolName: 'TESZT',
    message: 'Adminisztrátori 10 Ft-os tesztjelentkezés.',
    payerType: 'participant',
    billingName: 'TESZT Jelentkező',
    billingZip: '0000',
    billingCity: 'Tesztváros',
    billingAddress: 'Teszt utca 10.',
    billingEmail: provider.email,
    declPrivacy: true,
    declNotAutomatic: true,
    declPaymentTerms: true,
    declTruthful: true,
    source: 'admin-test',
  })

  await sql.transaction([
    sql.query(
      `INSERT INTO applications (
         id, course_id, participant_name, participant_birth_date,
         participant_email, participant_phone, billing_name, billing_email,
         billing_address, package_key, payment_type, total_amount_huf,
         status, is_test, source, submitted_data, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4::date, $5, $6, $7, $8, $9, 'standard',
         'lump-sum', 10, 'new', true, 'admin-test', $10::jsonb,
         $11::timestamptz, $11::timestamptz
       )`,
      [
        applicationId,
        courseId,
        testData.participantName,
        testData.participantBirthDate,
        testData.participantEmail,
        testData.participantPhone,
        testData.billingName,
        testData.billingEmail,
        `${testData.billingZip} ${testData.billingCity}, ${testData.billingAddress}`,
        JSON.stringify(testData),
        createdAt,
      ],
    ),
    sql.query(
      `INSERT INTO payment_plans (
         id, application_id, total_amount_huf, installment_count, status, created_at, updated_at
       ) VALUES ($1, $2, 10, 1, 'pending', $3::timestamptz, $3::timestamptz)`,
      [paymentPlanId, applicationId, createdAt],
    ),
    sql.query(
      `INSERT INTO payment_items (
         id, payment_plan_id, position, amount_huf, due_at, status, created_at, updated_at
       ) VALUES ($1, $2, 1, 10, NULL, 'pending', $3::timestamptz, $3::timestamptz)`,
      [paymentItemId, paymentPlanId, createdAt],
    ),
    sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'application', $2, NULL, 'new', '10 Ft-os TESZT jelentkezés létrehozva adminból.', $3::timestamptz)`,
      [randomUUID(), applicationId, createdAt],
    ),
    sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'payment_plan', $2, NULL, 'pending', 'TESZT fizetési terv létrehozva.', $3::timestamptz)`,
      [randomUUID(), paymentPlanId, createdAt],
    ),
    sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'payment_item', $2, NULL, 'pending', '10 Ft-os TESZT fizetési tétel létrehozva.', $3::timestamptz)`,
      [randomUUID(), paymentItemId, createdAt],
    ),
  ])

  return applicationId
}

export async function listApplications(limit = 100, search = ''): Promise<ApplicationListItem[]> {
  const sql = getSql()
  const query = search.trim().toLowerCase()
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
     WHERE $2 = '' OR lower(a.id) LIKE '%' || $2 || '%'
       OR lower(a.participant_name) LIKE '%' || $2 || '%'
       OR lower(coalesce(a.participant_email, '')) LIKE '%' || $2 || '%'
       OR lower(coalesce(a.guardian_email, '')) LIKE '%' || $2 || '%'
     ORDER BY a.created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500), query],
  )) as ApplicationRow[]

  return rows.map(toListItem)
}

export async function getApplicationById(id: string): Promise<ApplicationDetails | null> {
  const sql = getSql()
  const [
    applicationRows,
    historyRows,
    emailDeliveryRows,
    paymentPlanRows,
    paymentItemRows,
    paymentRows,
  ] = await Promise.all([
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
    sql.query(
      `SELECT id, event, recipient, status, detail, attempted_at, sent_at
       FROM application_email_deliveries
       WHERE application_id = $1
       ORDER BY attempted_at DESC`,
      [id],
    ),
    sql.query(
      `SELECT id, total_amount_huf, installment_count, status
       FROM payment_plans
       WHERE application_id = $1
       LIMIT 1`,
      [id],
    ),
    sql.query(
      `SELECT pi.id, pi.position, pi.amount_huf, pi.due_at, pi.status,
              pi.paid_at, pi.payment_method
       FROM payment_items pi
       JOIN payment_plans pp ON pp.id = pi.payment_plan_id
       WHERE pp.application_id = $1
       ORDER BY pi.position ASC`,
      [id],
    ),
    sql.query(
      `SELECT p.id, p.payment_item_id, p.amount_huf, p.paid_at,
              p.payment_method, p.note, p.created_at
       FROM payments p
       JOIN payment_items pi ON pi.id = p.payment_item_id
       JOIN payment_plans pp ON pp.id = pi.payment_plan_id
       WHERE pp.application_id = $1
       ORDER BY p.paid_at ASC, p.created_at ASC`,
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
    createdAt: toIso(item.created_at) ?? '',
  }))
  const emailDeliveries = (emailDeliveryRows as EmailDeliveryRow[]).map((item) => ({
    id: item.id,
    event: item.event,
    recipient: item.recipient,
    status: item.status,
    detail: item.detail,
    attemptedAt: toIso(item.attempted_at) ?? '',
    sentAt: toIso(item.sent_at),
  }))

  const records = (paymentRows as PaymentRow[]).map((payment) => ({
    id: payment.id,
    paymentItemId: payment.payment_item_id,
    amountHuf: Number(payment.amount_huf),
    paidAt: toIso(payment.paid_at) ?? '',
    paymentMethod: payment.payment_method,
    note: payment.note,
    createdAt: toIso(payment.created_at) ?? '',
  }))
  const recordsByItem = new Map<string, PaymentRecord[]>()
  for (const record of records) {
    const itemRecords = recordsByItem.get(record.paymentItemId) ?? []
    itemRecords.push(record)
    recordsByItem.set(record.paymentItemId, itemRecords)
  }

  const now = new Date()
  const items = (paymentItemRows as PaymentItemRow[]).map((item) => {
    const itemRecords = recordsByItem.get(item.id) ?? []
    const paidAmountHuf = itemRecords.reduce((sum, payment) => sum + payment.amountHuf, 0)
    const amountHuf = Number(item.amount_huf)
    const dueAt = toIso(item.due_at)

    return {
      id: item.id,
      position: Number(item.position),
      amountHuf,
      paidAmountHuf,
      remainingAmountHuf: Math.max(amountHuf - paidAmountHuf, 0),
      dueAt,
      status: paymentItemState({
        amountHuf,
        paidAmountHuf,
        dueAt,
        currentStatus: item.status,
        now,
      }),
      paidAt: toIso(item.paid_at),
      paymentMethod: item.payment_method,
      payments: itemRecords,
    }
  })
  const paymentPlan = (paymentPlanRows as PaymentPlanRow[])[0]
  const paidAmountHuf = records.reduce((sum, payment) => sum + payment.amountHuf, 0)
  const payment = paymentPlan
    ? {
        id: paymentPlan.id,
        totalAmountHuf: Number(paymentPlan.total_amount_huf),
        paidAmountHuf,
        remainingAmountHuf: Math.max(Number(paymentPlan.total_amount_huf) - paidAmountHuf, 0),
        nextDueAt: nextPaymentDueAt(items),
        installmentCount: Number(paymentPlan.installment_count),
        status: paymentPlanState({
          totalAmountHuf: Number(paymentPlan.total_amount_huf),
          paidAmountHuf,
          itemStatuses: items.map((item) => item.status),
          currentStatus: paymentPlan.status,
        }),
        items,
      }
    : null

  return {
    ...toListItem(row),
    participantBirthDate: toIso(row.participant_birth_date) ?? '',
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
    emailDeliveries,
    payment,
  }
}

export async function recordApplicationEmailDelivery(input: {
  applicationId: string
  event: ApplicationWorkflowEmailEvent
  recipient: string | null
  result: EmailResult
}): Promise<void> {
  const attemptedAt = new Date().toISOString()
  await getSql().query(
    `INSERT INTO application_email_deliveries (
       id, application_id, event, recipient, status, detail, attempted_at, sent_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)`,
    [
      randomUUID(),
      input.applicationId,
      input.event,
      input.recipient,
      input.result.status,
      input.result.detail,
      attemptedAt,
      input.result.status === 'sent' ? attemptedAt : null,
    ],
  )
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  note: string | null,
): Promise<boolean> {
  const sql = getSql()
  const rows = (await sql.query(
    `SELECT status FROM applications WHERE id = $1 LIMIT 1`,
    [id],
  )) as Array<{ status: ApplicationStatus }>
  const current = rows[0]
  if (!current) throw new ApplicationMutationError('not_found')

  const normalizedNote = note?.trim() || null
  if (current.status === status && !normalizedNote) {
    throw new ApplicationMutationError('no_change')
  }

  const changedAt = new Date().toISOString()
  await sql.transaction([
    sql.query(
      `UPDATE applications SET status = $2, updated_at = $3::timestamptz WHERE id = $1`,
      [id, status, changedAt],
    ),
    sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'application', $2, $3, $4, $5, $6::timestamptz)`,
      [
        randomUUID(),
        id,
        current.status,
        status,
        normalizedNote ?? 'Adminisztrátori státuszmódosítás.',
        changedAt,
      ],
    ),
  ])
  return current.status !== status
}

export async function updatePaymentItemDueDate(input: {
  applicationId: string
  paymentItemId: string
  dueAt: string | null
}): Promise<void> {
  const sql = getSql()
  const rows = (await sql.query(
    `SELECT
       pi.id AS item_id,
       pi.amount_huf AS item_amount_huf,
       pi.status AS item_status,
       pi.due_at AS item_due_at,
       pp.id AS plan_id,
       pp.total_amount_huf AS plan_total_amount_huf,
       pp.status AS plan_status,
       a.status AS application_status,
       coalesce((SELECT sum(p.amount_huf) FROM payments p WHERE p.payment_item_id = pi.id), 0)::int AS item_paid_amount_huf,
       coalesce((
         SELECT sum(p.amount_huf)
         FROM payments p
         JOIN payment_items paid_item ON paid_item.id = p.payment_item_id
         WHERE paid_item.payment_plan_id = pp.id
       ), 0)::int AS plan_paid_amount_huf,
       EXISTS (
         SELECT 1
         FROM payment_items other_item
         WHERE other_item.payment_plan_id = pp.id
           AND other_item.id <> pi.id
           AND other_item.due_at < now()
           AND other_item.status <> 'cancelled'
           AND coalesce((SELECT sum(p.amount_huf) FROM payments p WHERE p.payment_item_id = other_item.id), 0) < other_item.amount_huf
       ) AS other_overdue
     FROM payment_items pi
     JOIN payment_plans pp ON pp.id = pi.payment_plan_id
     JOIN applications a ON a.id = pp.application_id
     WHERE a.id = $1 AND pi.id = $2
     LIMIT 1`,
    [input.applicationId, input.paymentItemId],
  )) as PaymentTargetRow[]

  const target = rows[0]
  if (!target) throw new ApplicationMutationError('payment_plan_missing')

  const previousDay = toIso(target.item_due_at)?.slice(0, 10) ?? null
  const nextDay = input.dueAt?.slice(0, 10) ?? null
  if (previousDay === nextDay) throw new ApplicationMutationError('no_change')

  const changedAt = new Date().toISOString()
  const itemStatus = paymentItemState({
    amountHuf: Number(target.item_amount_huf),
    paidAmountHuf: Number(target.item_paid_amount_huf),
    dueAt: input.dueAt,
    currentStatus: target.item_status,
    now: new Date(changedAt),
  })
  const planStatus = paymentPlanState({
    totalAmountHuf: Number(target.plan_total_amount_huf),
    paidAmountHuf: Number(target.plan_paid_amount_huf),
    itemStatuses: [itemStatus, ...(target.other_overdue ? ['overdue'] : [])],
    currentStatus: target.plan_status,
  })
  const historyNote = `Fizetési határidő módosítva: ${previousDay ?? 'nincs'} → ${nextDay ?? 'nincs'}.`
  const queries = [
    sql.query(
      `UPDATE payment_items
       SET due_at = $2::timestamptz, status = $3, updated_at = $4::timestamptz
       WHERE id = $1`,
      [target.item_id, input.dueAt, itemStatus, changedAt],
    ),
    sql.query(
      `UPDATE payment_plans SET status = $2, updated_at = $3::timestamptz WHERE id = $1`,
      [target.plan_id, planStatus, changedAt],
    ),
    sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'payment_item', $2, $3, $4, $5, $6::timestamptz)`,
      [randomUUID(), target.item_id, target.item_status, itemStatus, historyNote, changedAt],
    ),
    sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'application', $2, $3, $3, $4, $5::timestamptz)`,
      [randomUUID(), input.applicationId, target.application_status, historyNote, changedAt],
    ),
  ]

  if (target.plan_status !== planStatus) {
    queries.push(sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'payment_plan', $2, $3, $4, $5, $6::timestamptz)`,
      [randomUUID(), target.plan_id, target.plan_status, planStatus, historyNote, changedAt],
    ))
  }

  await sql.transaction(queries)
}

export async function recordApplicationPayment(input: {
  applicationId: string
  paymentItemId: string
  amountHuf: number
  paidAt: string
  paymentMethod: PaymentMethod
  note: string | null
}): Promise<void> {
  const sql = getSql()
  const rows = (await sql.query(
    `SELECT
       pi.id AS item_id,
       pi.amount_huf AS item_amount_huf,
       pi.status AS item_status,
       pp.id AS plan_id,
       pp.total_amount_huf AS plan_total_amount_huf,
       pp.status AS plan_status,
       a.status AS application_status,
       pi.due_at AS item_due_at,
       coalesce((
         SELECT sum(p.amount_huf) FROM payments p WHERE p.payment_item_id = pi.id
       ), 0)::int AS item_paid_amount_huf,
       coalesce((
         SELECT sum(p.amount_huf)
         FROM payments p
         JOIN payment_items paid_item ON paid_item.id = p.payment_item_id
         WHERE paid_item.payment_plan_id = pp.id
       ), 0)::int AS plan_paid_amount_huf,
       EXISTS (
         SELECT 1
         FROM payment_items other_item
         WHERE other_item.payment_plan_id = pp.id
           AND other_item.id <> pi.id
           AND other_item.due_at < now()
           AND other_item.status <> 'cancelled'
           AND coalesce((SELECT sum(p.amount_huf) FROM payments p WHERE p.payment_item_id = other_item.id), 0) < other_item.amount_huf
       ) AS other_overdue
     FROM payment_items pi
     JOIN payment_plans pp ON pp.id = pi.payment_plan_id
     JOIN applications a ON a.id = pp.application_id
     WHERE a.id = $1 AND pi.id = $2
     LIMIT 1`,
    [input.applicationId, input.paymentItemId],
  )) as PaymentTargetRow[]

  const target = rows[0]
  if (!target) throw new ApplicationMutationError('payment_plan_missing')
  if (
    target.application_status === 'rejected' ||
    target.application_status === 'cancelled' ||
    target.plan_status === 'cancelled'
  ) {
    throw new ApplicationMutationError('inactive_application')
  }

  const itemAmountHuf = Number(target.item_amount_huf)
  const itemPaidBefore = Number(target.item_paid_amount_huf)
  const itemPaidAfter = itemPaidBefore + input.amountHuf
  if (!canRecordPayment(input.amountHuf, itemAmountHuf - itemPaidBefore)) {
    throw new ApplicationMutationError('overpayment')
  }

  const planTotalAmountHuf = Number(target.plan_total_amount_huf)
  const planPaidAfter = Number(target.plan_paid_amount_huf) + input.amountHuf
  const changedAt = new Date().toISOString()
  const itemStatus = paymentItemState({
    amountHuf: itemAmountHuf,
    paidAmountHuf: itemPaidAfter,
    dueAt: toIso(target.item_due_at),
    currentStatus: target.item_status,
    now: new Date(changedAt),
  })
  const planStatus = paymentPlanState({
    totalAmountHuf: planTotalAmountHuf,
    paidAmountHuf: planPaidAfter,
    itemStatuses: [itemStatus, ...(target.other_overdue ? ['overdue'] : [])],
    currentStatus: target.plan_status,
  })
  const protectedApplicationStatuses: ApplicationStatus[] = ['invoiced', 'enrolled']
  const applicationStatus = protectedApplicationStatuses.includes(target.application_status)
    ? target.application_status
    : planStatus === 'paid'
      ? 'paid'
      : 'partially_paid'
  const note = input.note?.trim() || null
  const methodLabel = input.paymentMethod === 'cash' ? 'készpénz' : 'banki átutalás'
  const historyNote = [
    `Befizetés rögzítve: ${input.amountHuf.toLocaleString('hu-HU')} Ft (${methodLabel}).`,
    note,
  ].filter(Boolean).join(' ')

  const queries = [
    sql.query(
      `INSERT INTO payments (
         id, payment_item_id, amount_huf, paid_at, payment_method, note, created_at
       ) VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7::timestamptz)`,
      [randomUUID(), target.item_id, input.amountHuf, input.paidAt, input.paymentMethod, note, changedAt],
    ),
    sql.query(
      `UPDATE payment_items
       SET status = $2, paid_at = $3::timestamptz, payment_method = $4, updated_at = $5::timestamptz
       WHERE id = $1`,
      [
        target.item_id,
        itemStatus,
        itemStatus === 'paid' ? input.paidAt : null,
        input.paymentMethod,
        changedAt,
      ],
    ),
    sql.query(
      `UPDATE payment_plans SET status = $2, updated_at = $3::timestamptz WHERE id = $1`,
      [target.plan_id, planStatus, changedAt],
    ),
    sql.query(
      `UPDATE applications SET status = $2, updated_at = $3::timestamptz WHERE id = $1`,
      [input.applicationId, applicationStatus, changedAt],
    ),
    sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'application', $2, $3, $4, $5, $6::timestamptz)`,
      [
        randomUUID(),
        input.applicationId,
        target.application_status,
        applicationStatus,
        historyNote,
        changedAt,
      ],
    ),
  ]

  if (target.item_status !== itemStatus) {
    queries.push(sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'payment_item', $2, $3, $4, $5, $6::timestamptz)`,
      [randomUUID(), target.item_id, target.item_status, itemStatus, historyNote, changedAt],
    ))
  }
  if (target.plan_status !== planStatus) {
    queries.push(sql.query(
      `INSERT INTO status_history (
         id, entity_type, entity_id, from_status, to_status, note, created_at
       ) VALUES ($1, 'payment_plan', $2, $3, $4, $5, $6::timestamptz)`,
      [randomUUID(), target.plan_id, target.plan_status, planStatus, historyNote, changedAt],
    ))
  }

  await sql.transaction(queries)
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const sql = getSql()
  const [applicationRows, courseRows, studentRows, paymentRows] = await Promise.all([
    sql.query(
      `SELECT
         count(*)::int AS applications,
         count(*) FILTER (WHERE status = 'new')::int AS new_applications,
         count(*) FILTER (WHERE status IN ('proforma', 'awaiting_payment', 'partially_paid'))::int AS awaiting_payment
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
      `SELECT
         (SELECT count(*)::int
          FROM payment_items pi
          JOIN payment_plans pp ON pp.id = pi.payment_plan_id
          JOIN applications a ON a.id = pp.application_id
          WHERE pi.due_at < now()
            AND pi.status NOT IN ('paid', 'cancelled')
            AND a.status NOT IN ('rejected', 'cancelled')
            AND a.is_test = false
            AND coalesce((SELECT sum(p.amount_huf) FROM payments p WHERE p.payment_item_id = pi.id), 0) < pi.amount_huf
         ) AS overdue_payments,
         coalesce(sum(plan.paid_amount_huf), 0)::int AS paid_total,
         coalesce(sum(greatest(plan.total_amount_huf - plan.paid_amount_huf, 0)), 0)::int AS outstanding_total
       FROM (
         SELECT
           pp.id,
           pp.total_amount_huf,
           coalesce(sum(p.amount_huf), 0)::int AS paid_amount_huf
         FROM payment_plans pp
         JOIN applications a ON a.id = pp.application_id
         LEFT JOIN payment_items pi ON pi.payment_plan_id = pp.id
         LEFT JOIN payments p ON p.payment_item_id = pi.id
         WHERE a.status NOT IN ('rejected', 'cancelled')
           AND a.is_test = false
         GROUP BY pp.id, pp.total_amount_huf
       ) AS plan`,
    ),
  ])

  const applications = (applicationRows as Array<Record<string, number>>)[0] ?? {}
  const courses = (courseRows as Array<Record<string, number>>)[0] ?? {}
  const students = (studentRows as Array<Record<string, number>>)[0] ?? {}
  const payments = (paymentRows as Array<Record<string, number>>)[0] ?? {}
  const paidTotal = Number(payments.paid_total ?? 0)

  return {
    activeCourses: Number(courses.active_courses ?? 0),
    upcomingCourses: Number(courses.upcoming_courses ?? 0),
    applications: Number(applications.applications ?? 0),
    newApplications: Number(applications.new_applications ?? 0),
    activeStudents: Number(students.active_students ?? 0),
    awaitingPayment: Number(applications.awaiting_payment ?? 0),
    overduePayments: Number(payments.overdue_payments ?? 0),
    receivedAmountHuf: paidTotal,
    outstandingAmountHuf: Number(payments.outstanding_total ?? 0),
  }
}
