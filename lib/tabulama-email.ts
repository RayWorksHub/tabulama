import nodemailer, { type Transporter } from 'nodemailer'
import {
  packages,
  provider,
  legalDocuments,
  formatHUF,
  formatHuDate,
  formatHuDateTime,
} from '@/lib/tabulama-config'
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
  | 'accepted'
  | 'awaiting_payment'
  | 'payment_recorded'
  | 'enrolled'

export interface ApplicationWorkflowEmailInput {
  applicationId: string
  participantName: string
  recipient: string
  courseTitle: string
  totalAmountHuf: number
  paidAmountHuf: number
  remainingAmountHuf: number
  nextDueAt: string | null
  isTest: boolean
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
function priceLine(packageKey: ApplicationData['packageKey']): string {
  const pkg = packages[packageKey]
  return pkg.paymentType === 'installment' && pkg.installmentCount && pkg.installmentAmount
    ? `${formatHUF(pkg.total)} (${pkg.installmentCount} × ${formatHUF(pkg.installmentAmount)})`
    : formatHUF(pkg.total)
}

/** A belső értesítő sorai a validált jelentkezésből. */
function buildRows(data: ApplicationData, meta: ApplicationMeta): Row[] {
  const pkg = packages[data.packageKey]
  const ageInfo = computeAgeInfo(data.participantBirthDate, meta.receivedAt)

  const rows: Row[] = [
    { label: 'Jelentkezési azonosító', value: meta.applicationId },
    { label: 'Beérkezett', value: formatHuDateTime(meta.receivedAt.toISOString()) },
    { label: 'Következő teendő', value: 'Telefonos kapcsolatfelvétel' },
    { label: '— Csomag —', value: '' },
    { label: 'Választott csomag', value: pkg.name },
    { label: 'Képzési díj', value: priceLine(data.packageKey) },
  ]

  if (pkg.paymentDeadline) {
    rows.push({
      label: pkg.paymentType === 'installment' ? 'Első részlet határideje' : 'Fizetési határidő',
      value: formatHuDate(pkg.paymentDeadline),
    })
  }
  if (pkg.bonusPrivateLessons) {
    rows.push({
      label: 'Ajándék magánóra',
      value: `${pkg.bonusPrivateLessons} × ${pkg.bonusLessonMinutes} perc (fizetéshez kötött)`,
    })
    if (pkg.savingsVsStandard) {
      rows.push({ label: 'Megtakarítás', value: formatHUF(pkg.savingsVsStandard) })
    }
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
): Promise<EmailResult> {
  const recipient = INTERNAL_RECIPIENT()
  const transporter = createTransporter()

  if (!transporter || !recipient) {
    console.log(
      `[TabuLama] Belső értesítő kihagyva (SMTP nincs konfigurálva). Azonosító: ${meta.applicationId}, csomag: ${data.packageKey}`,
    )
    return { status: 'skipped', detail: 'E-mail kézbesítés nincs konfigurálva.' }
  }

  const rows = buildRows(data, meta)
  const subject = `Új TabuLama-jelentkezés – ${data.participantName} – ${packages[data.packageKey].name}`

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
  } catch {
    console.log(`[TabuLama] Belső e-mail kivétel (azonosító: ${meta.applicationId})`)
    return { status: 'error', detail: 'A belső értesítő kézbesítése nem sikerült.' }
  }
}

/** A jelentkező visszaigazoló e-mail címe: kiskorúnál a képviselőé. */
function applicantRecipient(data: ApplicationData, meta: ApplicationMeta): string | undefined {
  const ageInfo = computeAgeInfo(data.participantBirthDate, meta.receivedAt)
  if (ageInfo.isMinor) return data.guardianEmail ?? data.participantEmail ?? data.billingEmail
  return data.participantEmail ?? data.billingEmail
}

/**
 * Visszaigazoló e-mail a jelentkezőnek. Ennek külön hibája NEM buktatja meg
 * a jelentkezést (a belső értesítő a mérvadó).
 */
export async function sendApplicantConfirmation(
  data: ApplicationData,
  meta: ApplicationMeta,
): Promise<EmailResult> {
  const to = applicantRecipient(data, meta)
  const transporter = createTransporter()

  if (!transporter || !to) {
    return { status: 'skipped', detail: 'Jelentkezői visszaigazolás nincs konfigurálva vagy nincs cím.' }
  }

  const pkg = packages[data.packageKey]
  const subject = 'Megérkezett a TabuLama-jelentkezés'
  const bonus =
    pkg.bonusPrivateLessons != null
      ? ` A korai ajánlathoz ${pkg.bonusPrivateLessons} × ${pkg.bonusLessonMinutes} perc ajándék magánóra jár a díj beérkezése után.`
      : ''

  const text = [
    `Kedves Jelentkező!`,
    ``,
    `Köszönjük, hogy jelentkeztél a TabuLama Programozó Akadémiára.`,
    ``,
    `Jelentkezési azonosító: ${meta.applicationId}`,
    `Résztvevő: ${data.participantName}`,
    `Választott csomag: ${pkg.name} – ${priceLine(data.packageKey)}.${bonus}`,
    ``,
    `Rajmund hamarosan telefonon keres a megadott számon, hogy átbeszéljétek a részleteket.`,
    `A jelentkezés még nem jelent automatikus felvételt vagy szerződéskötést, és most még nem kell fizetni – a díjbekérő a telefonos egyeztetés és a szerződés után érkezik.`,
    ``,
    `Kérdés esetén írj bátran: ${provider.email}`,
    ``,
    `Üdvözlettel:`,
    `${provider.brandName}`,
  ].join('\n')

  const html = renderShell(
    subject,
    `<p>Kedves Jelentkező!</p>
     <p>Köszönjük, hogy jelentkeztél a <strong>${escapeHtml(provider.brandName)}</strong> képzésére.</p>
     <p><strong>Jelentkezési azonosító:</strong> ${escapeHtml(meta.applicationId)}<br>
        <strong>Résztvevő:</strong> ${escapeHtml(data.participantName)}<br>
        <strong>Választott csomag:</strong> ${escapeHtml(pkg.name)} – ${escapeHtml(priceLine(data.packageKey))}.${escapeHtml(bonus)}</p>
     <p>Rajmund hamarosan telefonon keres a megadott számon, hogy átbeszéljétek a részleteket.</p>
     <p>A jelentkezés még nem jelent automatikus felvételt vagy szerződéskötést, és most még nem kell fizetni – a díjbekérő a telefonos egyeztetés és a szerződés után érkezik.</p>
     <p>Kérdés esetén írj bátran: <a href="mailto:${escapeHtml(provider.email)}">${escapeHtml(provider.email)}</a></p>
     <p>Üdvözlettel:<br>${escapeHtml(provider.brandName)}</p>`,
  )

  try {
    await transporter.sendMail({ from: FROM(), to, replyTo: provider.email ?? undefined, subject, text, html })
    return { status: 'sent', detail: 'A visszaigazoló e-mail elküldve.' }
  } catch {
    console.log(`[TabuLama] Visszaigazolás kivétel (azonosító: ${meta.applicationId})`)
    return { status: 'error', detail: 'A visszaigazoló e-mail kézbesítése nem sikerült.' }
  }
}

export async function sendApplicationWorkflowEmail(
  event: ApplicationWorkflowEmailEvent,
  application: ApplicationWorkflowEmailInput,
): Promise<EmailResult> {
  const transporter = createTransporter()
  if (!transporter || !application.recipient) {
    return { status: 'skipped', detail: 'Folyamatértesítés nincs konfigurálva vagy nincs cím.' }
  }

  const eventContent: Record<ApplicationWorkflowEmailEvent, { subject: string; message: string }> = {
    accepted: {
      subject: 'Elfogadtuk a TabuLama-jelentkezésed',
      message: 'A jelentkezésedet elfogadtuk. A fizetési információkról külön értesítést küldünk.',
    },
    awaiting_payment: {
      subject: 'A TabuLama-jelentkezés fizetésre vár',
      message: `A fizetésre váró összeg ${formatHUF(application.remainingAmountHuf)}.${
        application.nextDueAt ? ` A következő határidő: ${formatHuDate(application.nextDueAt)}.` : ''
      }`,
    },
    payment_recorded: {
      subject: 'Rögzítettük a TabuLama-befizetést',
      message: `Eddig ${formatHUF(application.paidAmountHuf)} befizetést rögzítettünk, a fennmaradó összeg ${formatHUF(application.remainingAmountHuf)}.`,
    },
    enrolled: {
      subject: 'Elkészült a TabuLama-beiratkozás',
      message: 'A beiratkozás elkészült. Hamarosan küldjük a kurzus indulásához szükséges további tudnivalókat.',
    },
  }
  const content = eventContent[event]
  const testPrefix = application.isTest ? '[TESZT] ' : ''
  const subject = `${testPrefix}${content.subject}`
  const testNotice = application.isTest
    ? 'TESZT folyamatértesítés – nem éles jelentkezés.'
    : null
  const text = [
    `Kedves ${application.participantName}!`,
    '',
    testNotice,
    content.message,
    '',
    `Jelentkezési azonosító: ${application.applicationId}`,
    `Kurzus: ${application.courseTitle}`,
    `Teljes díj: ${formatHUF(application.totalAmountHuf)}`,
    '',
    `Üdvözlettel:`,
    provider.brandName,
  ].filter((line): line is string => line !== null).join('\n')
  const html = renderShell(
    subject,
    `${testNotice ? `<p style="padding:10px 12px;background:#fdf2f8;color:#9d174d;font-weight:700;border-radius:8px;">${escapeHtml(testNotice)}</p>` : ''}
     <p>Kedves ${escapeHtml(application.participantName)}!</p>
     <p>${escapeHtml(content.message)}</p>
     <p><strong>Jelentkezési azonosító:</strong> ${escapeHtml(application.applicationId)}<br>
        <strong>Kurzus:</strong> ${escapeHtml(application.courseTitle)}<br>
        <strong>Teljes díj:</strong> ${escapeHtml(formatHUF(application.totalAmountHuf))}</p>
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
