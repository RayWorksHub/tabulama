import nodemailer, { type Transporter } from 'nodemailer'
import {
  provider,
  legalDocuments,
  formatHUF,
  formatHuDate,
  formatHuDateTime,
} from '@/lib/tabulama-config'
import type { ApplicationPricing } from '@/lib/course-payment-options'
import {
  computeAgeInfo,
  type ApplicationData,
} from '@/lib/tabulama-application-schema'

export type EmailDeliveryStatus = 'sent' | 'skipped' | 'error'

export interface EmailResult {
  status: EmailDeliveryStatus
  detail: string
}

export interface ApplicationMeta {
  applicationId: string
  receivedAt: Date
}

export type ApplicationWorkflowEmailEvent =
  | 'received'
  | 'accepted'
  | 'awaiting_payment'
  | 'payment_recorded'
  | 'enrolled'
  | 'course_completed'

export interface ApplicationWorkflowEmailInput {
  applicationId: string
  participantName: string
  recipientName: string
  recipient: string
  courseTitle: string
  packageName: string
  paymentType: 'lump-sum' | 'installment'
  installmentCount: number | null
  installmentAmountHuf: number | null
  totalAmountHuf: number
  paidAmountHuf: number
  remainingAmountHuf: number
  nextDueAt: string | null
  receivedAt: string
  isTest: boolean
}

export interface StudentActivationEmailInput {
  recipient: string
  studentName: string
  studentNumber: string
  courseTitle: string
  activationUrl: string
  expiresAt: string
}

export interface PasswordResetEmailInput {
  recipient: string
  fullName: string
  resetUrl: string
  expiresAt: string
}

const payerLabels: Record<string, string> = {
  participant: 'A résztvevő (nagykorú)',
  guardian: 'Törvényes képviselő',
  'other-person': 'Más magánszemély',
  company: 'Cég / szervezet',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface Row {
  label: string
  value: string | undefined | null
}

/** A választott csomag ember által olvasható díjsora. */
function priceLine(pricing: ApplicationPricing): string {
  return pricing.paymentType === 'installment' && pricing.installmentCount && pricing.installmentAmountHuf
    ? `${formatHUF(pricing.totalHuf)} (${pricing.installmentCount} × ${formatHUF(pricing.installmentAmountHuf)})`
    : formatHUF(pricing.totalHuf)
}

/** A belső értesítő sorai a validált jelentkezésből. */
function buildRows(data: ApplicationData, meta: ApplicationMeta, pricing: ApplicationPricing): Row[] {
  const ageInfo = computeAgeInfo(data.participantBirthDate, meta.receivedAt)

  const rows: Row[] = [
    { label: 'Jelentkezési azonosító', value: meta.applicationId },
    { label: 'Beérkezett', value: formatHuDateTime(meta.receivedAt.toISOString()) },
    { label: 'Következő teendő', value: 'Telefonos kapcsolatfelvétel' },
    { label: '— Kurzus és csomag —', value: '' },
    { label: 'Kurzus', value: pricing.courseTitle },
    { label: 'Választott csomag', value: pricing.packageName },
    { label: 'Képzési díj', value: priceLine(pricing) },
  ]

  if (pricing.paymentDeadline) {
    rows.push({
      label: pricing.paymentType === 'installment' ? 'Első részlet határideje' : 'Fizetési határidő',
      value: formatHuDate(pricing.paymentDeadline),
    })
  }

  rows.push(
    { label: '— Résztvevő —', value: '' },
    { label: 'Név', value: data.participantName },
    {
      label: 'Születési dátum / életkori státusz',
      value: `${data.participantBirthDate} (${ageInfo.age} év, ${ageInfo.isMinor ? 'kiskorú' : 'nagykorú'})`,
    },
    { label: 'Évfolyam', value: data.grade },
    { label: 'Felkészülési cél', value: data.goal },
    { label: 'Tapasztalati szint', value: data.experience },
    { label: 'Iskola', value: data.schoolName },
    { label: 'Résztvevő e-mail', value: data.participantEmail },
    { label: 'Résztvevő telefon', value: data.participantPhone },
  )

  if (ageInfo.isMinor) {
    rows.push(
      { label: '— Törvényes képviselő —', value: '' },
      { label: 'Név', value: data.guardianName },
      { label: 'Kapcsolat', value: data.guardianRelation },
      { label: 'E-mail', value: data.guardianEmail },
      { label: 'Telefon', value: data.guardianPhone },
    )
  }

  rows.push(
    { label: '— Fizető és számlázás —', value: '' },
    { label: 'Fizető típusa', value: payerLabels[data.payerType] ?? data.payerType },
    { label: 'Számlázási név', value: data.billingName },
    {
      label: 'Számlázási cím',
      value: `${data.billingZip} ${data.billingCity}, ${data.billingAddress}`,
    },
    { label: 'Számlázási e-mail', value: data.billingEmail },
    { label: 'Adószám', value: data.taxNumber },
  )

  if (data.message) {
    rows.push({ label: '— Üzenet —', value: '' }, { label: 'Üzenet', value: data.message })
  }

  rows.push(
    { label: '— Nyilatkozatok —', value: '' },
    {
      label: 'Adatkezelési tájékoztató',
      value: `elfogadva (verzió: ${legalDocuments.privacyPolicy.version ?? 'nincs beállítva'})`,
    },
    { label: 'Nem automatikus felvétel tudomásul véve', value: 'igen' },
    { label: 'Fizetési feltételek megismerve', value: 'igen' },
    { label: 'Adatok valódisága megerősítve', value: 'igen' },
  )
  if (ageInfo.isMinor) {
    rows.push({ label: 'Törvényes képviselői nyilatkozat', value: 'elfogadva' })
  }

  return rows.filter((r) => r.value !== undefined && r.value !== null)
}

function renderText(rows: Row[]): string {
  return rows
    .map((r) => (r.value === '' ? `\n${r.label}` : `${r.label}: ${r.value}`))
    .join('\n')
}

function renderShell(title: string, innerHtml: string): string {
  return `<!doctype html><html lang="hu"><body style="margin:0;background:#f7f2ea;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1b2430;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e8decd;border-radius:16px;overflow:hidden;">
      <div style="background:#1b2430;color:#f3ede1;padding:20px 24px;">
        <div style="font-size:18px;font-weight:800;">${escapeHtml(provider.brandName)}</div>
        <div style="font-size:14px;opacity:.85;">${escapeHtml(title)}</div>
      </div>
      <div style="padding:24px;font-size:14px;line-height:1.6;">${innerHtml}</div>
    </div>
  </body></html>`
}

function renderRowsHtml(rows: Row[]): string {
  const body = rows
    .map((r) => {
      if (r.value === '') {
        return `<tr><td colspan="2" style="padding:16px 0 4px;font-weight:700;color:#bd8b3c;">${escapeHtml(
          r.label,
        )}</td></tr>`
      }
      return `<tr>
        <td style="padding:4px 12px 4px 0;color:#6c6456;vertical-align:top;white-space:nowrap;">${escapeHtml(
          r.label,
        )}</td>
        <td style="padding:4px 0;color:#1b2430;font-weight:600;">${escapeHtml(String(r.value)).replace(
          /\n/g,
          '<br>',
        )}</td>
      </tr>`
    })
    .join('')
  return `<table style="width:100%;border-collapse:collapse;">${body}</table>`
}

// Rackhost SMTP – a host/port/felhasználó nem titkos, ezért kódban van
// alapértelmezve, de környezeti változóval felülírható. Csak a jelszó titkos.
const SMTP_HOST = process.env.SMTP_HOST ?? 'smtp.rackhost.hu'
const SMTP_PORT = Number(process.env.SMTP_PORT ?? '465')
const SMTP_USER = process.env.SMTP_USER ?? 'noreply@tabulama.com'
const SMTP_PASSWORD = process.env.SMTP_PASSWORD

// Küldő: alapból a noreply fiók, olvasható névvel.
const FROM = () =>
  process.env.APPLICATION_FROM_EMAIL ??
  `${provider.brandName} <${SMTP_USER}>`

// Címzett (belső értesítő): alapból az info fiók.
const INTERNAL_RECIPIENT = () =>
  process.env.APPLICATION_TO_EMAIL ?? provider.email ?? 'info@tabulama.com'

let cachedTransporter: Transporter | null = null

function createTransporter(): Transporter | null {
  if (!SMTP_PASSWORD) return null
  if (cachedTransporter) return cachedTransporter
  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // 465 = implicit TLS (secure), egyébként STARTTLS.
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  })
  return cachedTransporter
}

/**
 * Belső értesítő e-mail az akadémiának. Ez határozza meg a jelentkezés
 * sikerességét. Ha az SMTP_PASSWORD vagy a címzett hiányzik,
 * NEM naplózunk személyes adatot: csak az azonosítót és a csomagkulcsot.
 */
export async function sendInternalNotification(
  data: ApplicationData,
  meta: ApplicationMeta,
  pricing: ApplicationPricing,
): Promise<EmailResult> {
  const recipient = INTERNAL_RECIPIENT()
  const transporter = createTransporter()

  if (!transporter || !recipient) {
    console.log(
      `[TabuLama] Belső értesítő kihagyva (SMTP nincs konfigurálva). Azonosító: ${meta.applicationId}, csomag: ${data.packageKey}`,
    )
    return { status: 'skipped', detail: 'E-mail kézbesítés nincs konfigurálva.' }
  }

  const rows = buildRows(data, meta, pricing)
  const subject = `Új TabuLama-jelentkezés – ${data.participantName} – ${pricing.courseTitle}`

  try {
    await transporter.sendMail({
      from: FROM(),
      to: recipient,
      replyTo: data.billingEmail || data.participantEmail || undefined,
      subject,
      text: renderText(rows),
      html: renderShell(subject, renderRowsHtml(rows)),
    })
    return { status: 'sent', detail: 'A belső értesítő elküldve.' }
  } catch (error: unknown) {
    const smtpError = error as {
      message?: unknown
      code?: unknown
      command?: unknown
      responseCode?: unknown
      response?: unknown
    }
    console.error(`[TabuLama] Belső e-mail kivétel (azonosító: ${meta.applicationId})`, {
      message: typeof smtpError.message === 'string' ? smtpError.message : null,
      code: typeof smtpError.code === 'string' ? smtpError.code : null,
      command: typeof smtpError.command === 'string' ? smtpError.command : null,
      responseCode: typeof smtpError.responseCode === 'number' ? smtpError.responseCode : null,
      response: typeof smtpError.response === 'string' ? smtpError.response : null,
    })
    return { status: 'error', detail: 'A belső értesítő kézbesítése nem sikerült.' }
  }
}

/** A jelentkező visszaigazoló e-mail címzettje: kiskorúnál a képviselő. */
export function applicantEmailRecipient(
  data: ApplicationData,
  meta: ApplicationMeta,
): { email: string | undefined; name: string } {
  const ageInfo = computeAgeInfo(data.participantBirthDate, meta.receivedAt)
  if (ageInfo.isMinor && data.guardianEmail) {
    return { email: data.guardianEmail, name: data.guardianName ?? data.participantName }
  }
  return {
    email: data.participantEmail ?? data.billingEmail,
    name: data.participantName,
  }
}

/**
 * Visszaigazoló e-mail a jelentkezőnek. Ennek külön hibája NEM buktatja meg
 * a jelentkezést (a belső értesítő a mérvadó).
 */
export async function sendApplicantConfirmation(
  data: ApplicationData,
  meta: ApplicationMeta,
  pricing: ApplicationPricing,
): Promise<EmailResult> {
  const recipient = applicantEmailRecipient(data, meta)
  return sendApplicationWorkflowEmail('received', {
    applicationId: meta.applicationId,
    participantName: data.participantName,
    recipientName: recipient.name,
    recipient: recipient.email ?? '',
    courseTitle: pricing.courseTitle,
    packageName: pricing.packageName,
    paymentType: pricing.paymentType,
    installmentCount: pricing.installmentCount,
    installmentAmountHuf: pricing.installmentAmountHuf,
    totalAmountHuf: pricing.totalHuf,
    paidAmountHuf: 0,
    remainingAmountHuf: pricing.totalHuf,
    nextDueAt: pricing.paymentDeadline,
    receivedAt: meta.receivedAt.toISOString(),
    isTest: false,
  })
}

export async function sendApplicationWorkflowEmail(
  event: ApplicationWorkflowEmailEvent,
  application: ApplicationWorkflowEmailInput,
): Promise<EmailResult> {
  const transporter = createTransporter()
  if (!transporter || !application.recipient) {
    return { status: 'skipped', detail: 'Folyamatértesítés nincs konfigurálva vagy nincs cím.' }
  }

  const eventContent: Record<ApplicationWorkflowEmailEvent, {
    subject: string
    message: string
    nextStep: string
    paymentNotice?: string
  }> = {
    received: {
      subject: 'Megérkezett a TabuLama-jelentkezés',
      message: `Köszönjük, hogy jelentkeztél a ${provider.brandName} képzésére.`,
      nextStep: 'Rajmund hamarosan telefonon keres a megadott számon, hogy átbeszéljétek a részleteket.',
      paymentNotice: 'A jelentkezés még nem jelent automatikus felvételt vagy szerződéskötést. Most még nem kell fizetni; fizetési teendő csak az elfogadás, a szerződés és a díjbekérő után lesz.',
    },
    accepted: {
      subject: 'Elfogadtuk a TabuLama-jelentkezésed',
      message: 'A jelentkezésedet elfogadtuk.',
      nextStep: 'A fizetési információkról és az esedékességről külön értesítést küldünk.',
      paymentNotice: 'Addig nincs fizetési teendőd.',
    },
    awaiting_payment: {
      subject: 'A TabuLama-jelentkezés fizetésre vár',
      message: `A fizetésre váró összeg ${formatHUF(application.remainingAmountHuf)}.${
        application.nextDueAt ? ` A következő határidő: ${formatHuDate(application.nextDueAt)}.` : ''
      }`,
      nextStep: application.nextDueAt
        ? `Kérjük, a befizetést ${formatHuDate(application.nextDueAt)} napjáig indítsd el.`
        : 'Kérjük, kövesd a megküldött fizetési tájékoztatót.',
    },
    payment_recorded: {
      subject: 'Rögzítettük a TabuLama-befizetést',
      message: `Eddig ${formatHUF(application.paidAmountHuf)} befizetést rögzítettünk, a fennmaradó összeg ${formatHUF(application.remainingAmountHuf)}.`,
      nextStep: application.remainingAmountHuf > 0
        ? application.nextDueAt
          ? `A következő esedékesség: ${formatHuDate(application.nextDueAt)}.`
          : 'A fennmaradó összeg következő határidejéről külön tájékoztatást küldünk.'
        : 'A teljes képzési díj beérkezett; a beiratkozás állapotáról külön értesítést küldünk.',
    },
    enrolled: {
      subject: 'Sikeres TabuLama-beiratkozás',
      message: 'A beiratkozásod sikeresen elkészült.',
      nextStep: 'Hamarosan küldjük a kurzus indulásához szükséges további tudnivalókat.',
    },
    course_completed: {
      subject: 'Sikeresen teljesítetted a TabuLama-kurzust',
      message: 'Gratulálunk, a kurzust sikeresen teljesítetted.',
      nextStep: 'A teljesítéshez kapcsolódó további dokumentumokról külön tájékoztatást küldünk.',
    },
  }
  const content = eventContent[event]
  const testPrefix = application.isTest ? '[TESZT] ' : ''
  const subject = `${testPrefix}${content.subject}`
  const testNotice = application.isTest
    ? 'TESZT folyamatértesítés – nem éles jelentkezés.'
    : null
  const installmentLine = application.paymentType === 'installment'
    && application.installmentCount
    && application.installmentAmountHuf
    ? `${application.installmentCount} × ${formatHUF(application.installmentAmountHuf)}`
    : null
  const rows: Row[] = [
    { label: 'Jelentkezési azonosító', value: application.applicationId },
    { label: 'Kurzus', value: application.courseTitle },
    { label: 'Résztvevő', value: application.participantName },
    { label: 'Fizetési konstrukció', value: application.packageName },
    { label: 'Teljes összeg', value: formatHUF(application.totalAmountHuf) },
    { label: 'Részletek', value: installmentLine },
  ]
  if (event === 'received') {
    rows.push({ label: 'Jelentkezés időpontja', value: formatHuDateTime(application.receivedAt) })
  }
  if (event === 'awaiting_payment' || event === 'payment_recorded') {
    rows.push(
      { label: 'Befizetve', value: formatHUF(application.paidAmountHuf) },
      { label: 'Fennmaradó összeg', value: formatHUF(application.remainingAmountHuf) },
      {
        label: 'Következő határidő',
        value: application.nextDueAt ? formatHuDate(application.nextDueAt) : 'nincs rögzítve',
      },
    )
  }
  const text = [
    `Kedves ${application.recipientName}!`,
    '',
    testNotice,
    content.message,
    '',
    renderText(rows),
    '',
    `Következő lépés: ${content.nextStep}`,
    content.paymentNotice ?? null,
    '',
    `Kérdés esetén válaszolj erre az e-mailre, vagy írj a ${provider.email} címre.`,
    '',
    `Üdvözlettel:`,
    provider.brandName,
  ].filter((line): line is string => line !== null).join('\n')
  const html = renderShell(
    subject,
    `${testNotice ? `<p style="padding:10px 12px;background:#fdf2f8;color:#9d174d;font-weight:700;border-radius:8px;">${escapeHtml(testNotice)}</p>` : ''}
     <p>Kedves ${escapeHtml(application.recipientName)}!</p>
     <p>${escapeHtml(content.message)}</p>
     ${renderRowsHtml(rows)}
     <p><strong>Következő lépés:</strong> ${escapeHtml(content.nextStep)}</p>
     ${content.paymentNotice ? `<p>${escapeHtml(content.paymentNotice)}</p>` : ''}
     <p>Kérdés esetén válaszolj erre az e-mailre, vagy írj a <a href="mailto:${escapeHtml(provider.email)}">${escapeHtml(provider.email)}</a> címre.</p>
     <p>Üdvözlettel:<br>${escapeHtml(provider.brandName)}</p>`,
  )

  try {
    await transporter.sendMail({
      from: FROM(),
      to: application.recipient,
      replyTo: provider.email ?? undefined,
      subject,
      text,
      html,
    })
    return { status: 'sent', detail: 'A folyamatértesítő e-mail elküldve.' }
  } catch {
    console.log(`[TabuLama] Folyamatértesítő kivétel (${application.applicationId}, ${event})`)
    return { status: 'error', detail: 'A folyamatértesítő kézbesítése nem sikerült.' }
  }
}

export async function sendStudentActivationEmail(
  input: StudentActivationEmailInput,
): Promise<EmailResult> {
  const transporter = createTransporter()
  if (!transporter || !input.recipient) {
    return { status: 'skipped', detail: 'Az aktiváló e-mail küldése nincs konfigurálva.' }
  }
  const subject = `TabuLama diákfiók aktiválása – ${input.studentNumber}`
  const rows: Row[] = [
    { label: 'Diákazonosító', value: input.studentNumber },
    { label: 'Kurzus', value: input.courseTitle },
    { label: 'Link érvényessége', value: formatHuDateTime(input.expiresAt) },
  ]
  const text = [
    `Kedves ${input.studentName}!`,
    '',
    `Üdvözlünk a ${provider.brandName} diákjai között! Elkészült a saját diákfiókod.`,
    renderText(rows),
    '',
    `Fiók aktiválása és jelszó beállítása: ${input.activationUrl}`,
    'A link egyszer használható, és a fenti időpontig érvényes.',
    '',
    `Kérdés esetén írj a ${provider.email} címre.`,
  ].join('\n')
  const html = renderShell(
    subject,
    `<p>Kedves ${escapeHtml(input.studentName)}!</p>
     <p>Üdvözlünk a ${escapeHtml(provider.brandName)} diákjai között! Elkészült a saját diákfiókod.</p>
     <p style="margin:24px 0;"><a href="${escapeHtml(input.activationUrl)}" style="display:inline-block;background:#bd8b3c;color:#1b2430;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">Fiók aktiválása</a></p>
     ${renderRowsHtml(rows)}
     <p>A link egyszer használható, és a fenti időpontig érvényes.</p>
     <p>Kérdés esetén írj a <a href="mailto:${escapeHtml(provider.email)}">${escapeHtml(provider.email)}</a> címre.</p>`,
  )
  try {
    await transporter.sendMail({
      from: FROM(),
      to: input.recipient,
      replyTo: provider.email,
      subject,
      text,
      html,
    })
    return { status: 'sent', detail: 'A diákfiók aktiváló e-mail elküldve.' }
  } catch {
    console.error('[TabuLama] Diákfiók aktiváló e-mail küldése sikertelen.')
    return { status: 'error', detail: 'A diákfiók aktiváló e-mail nem kézbesíthető.' }
  }
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<EmailResult> {
  const transporter = createTransporter()
  if (!transporter || !input.recipient) {
    return { status: 'skipped', detail: 'A jelszó-visszaállító e-mail küldése nincs konfigurálva.' }
  }
  const subject = 'TabuLama jelszó-visszaállítás'
  const text = [
    `Kedves ${input.fullName}!`,
    '',
    'Jelszó-visszaállítást kértek a TabuLama-fiókodhoz.',
    `Új jelszó beállítása: ${input.resetUrl}`,
    `A link egyszer használható és eddig érvényes: ${formatHuDateTime(input.expiresAt)}.`,
    'Ha nem te kérted, nincs további teendőd.',
    '',
    `Kérdés esetén írj a ${provider.email} címre.`,
  ].join('\n')
  const html = renderShell(
    subject,
    `<p>Kedves ${escapeHtml(input.fullName)}!</p>
     <p>Jelszó-visszaállítást kértek a TabuLama-fiókodhoz.</p>
     <p style="margin:24px 0;"><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;background:#bd8b3c;color:#1b2430;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:10px;">Új jelszó beállítása</a></p>
     <p>A link egyszer használható és eddig érvényes: <strong>${escapeHtml(formatHuDateTime(input.expiresAt))}</strong>.</p>
     <p>Ha nem te kérted, nincs további teendőd.</p>
     <p>Kérdés esetén írj a <a href="mailto:${escapeHtml(provider.email)}">${escapeHtml(provider.email)}</a> címre.</p>`,
  )
  try {
    await transporter.sendMail({
      from: FROM(),
      to: input.recipient,
      replyTo: provider.email,
      subject,
      text,
      html,
    })
    return { status: 'sent', detail: 'A jelszó-visszaállító e-mail elküldve.' }
  } catch {
    console.error('[TabuLama] Jelszó-visszaállító e-mail küldése sikertelen.')
    return { status: 'error', detail: 'A jelszó-visszaállító e-mail nem kézbesíthető.' }
  }
}
