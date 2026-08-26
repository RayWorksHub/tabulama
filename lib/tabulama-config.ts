/**
 * TabuLama Programozó Akadémia – központi, típusos konfiguráció.
 *
 * Minden felület (jelentkezési űrlap, szerveroldali validáció, e-mailek)
 * ebből a fájlból olvassa a szövegeket, árakat, dátumokat és szolgáltatói
 * adatokat. Ne szórd szét ezeket a komponensekbe.
 *
 * A jelenleg NEM véglegesített adatok értéke szándékosan `null`. Ezeket az
 * élesítés előtt kell kitölteni – a hiányzó tételek a fejlesztői
 * összefoglalóban is fel vannak sorolva. Ne találj ki mintaadatot.
 */

export type PackageKey = 'early-bird' | 'standard' | 'installment'

export type PaymentType = 'lump-sum' | 'installment'

export interface PackageConfig {
  key: PackageKey
  name: string
  paymentType: PaymentType
  /** Teljes képzési díj forintban. */
  total: number
  /** Részletfizetésnél a részletek száma és összege. */
  installmentCount: number | null
  installmentAmount: number | null
  /** A teljes összeg / első részlet jóváírásának határideje (ISO, Budapest idő). */
  paymentDeadline: string | null
  /** Csak az early-bird csomagnál: ajándék magánóra adatai. */
  bonusPrivateLessons: number | null
  bonusLessonMinutes: number | null
  /** Megtakarítás a normál egyösszegű árhoz képest. */
  savingsVsStandard: number | null
  /** Rövid, semleges leírás. */
  description: string
}

/** Szolgáltatói adatok. A `null` értékek még nincsenek véglegesítve. */
export const provider = {
  brandName: 'TabuLama Programozó Akadémia',
  plannedLegalName: 'Csukárdi Rajmund Olivér egyéni vállalkozó',
  contactName: 'Csukárdi Rajmund',
  website: 'https://tabulama.com',
  email: 'info@tabulama.com',

  // --- Még nem véglegesített adatok (élesítés előtt kitöltendő) ---
  legalNameExact: null as string | null,
  registeredAddress: null as string | null,
  mailingAddress: null as string | null,
  entrepreneurRegistrationNumber: null as string | null,
  taxNumber: null as string | null,
  adultTrainingRegistrationNumber: null as string | null,
  farId: null as string | null,
  phone: null as string | null,
  bankAccountNumber: null as string | null,
} as const

/** Képzés adatai. A `null` értékek még nincsenek véglegesítve. */
export const training = {
  name: '12 hetes Python programozó- és vizsgafelkészítő képzés',
  targetGroup: 'középiskolások',
  goal: 'Felkészítés az ágazati alapvizsga vagy a digitális kultúra érettségi Python/programozási részére.',
  durationWeeks: 12,
  schedule: 'hétfő, szerda és péntek, 17:00–18:30',
  startDate: '2026-08-24',
  scope: '36 × 90 perc, azaz 54 valós óra / 72 db 45 perces képzési óra',
  minHeadcount: 10,

  // --- Még nem véglegesített adatok ---
  format: null as string | null,
  location: null as string | null,
  onlinePlatform: null as string | null,
  maxHeadcount: null as number | null,
  endDate: null as string | null,
} as const

/** Az early-bird ajánlat lejárata Budapest időzónában (CEST = UTC+2). */
export const EARLY_BIRD_DEADLINE_ISO = '2026-08-10T23:59:59+02:00'

export const packages: Record<PackageKey, PackageConfig> = {
  'early-bird': {
    key: 'early-bird',
    name: 'Korai egyösszegű befizetés',
    paymentType: 'lump-sum',
    total: 250_000,
    installmentCount: null,
    installmentAmount: null,
    paymentDeadline: EARLY_BIRD_DEADLINE_ISO,
    bonusPrivateLessons: 6,
    bonusLessonMinutes: 45,
    savingsVsStandard: 80_000,
    description:
      'A teljes díj egyösszegű, 2026. augusztus 10-ig történő jóváírása esetén. Kizárólag ehhez az ajánlathoz jár 6 × 45 perc ajándék magánóra.',
  },
  standard: {
    key: 'standard',
    name: 'Normál egyösszegű befizetés',
    paymentType: 'lump-sum',
    total: 330_000,
    installmentCount: null,
    installmentAmount: null,
    paymentDeadline: null,
    bonusPrivateLessons: null,
    bonusLessonMinutes: null,
    savingsVsStandard: null,
    description: 'Egyösszegű befizetés a korai határidő után.',
  },
  installment: {
    key: 'installment',
    name: 'Részletfizetés',
    paymentType: 'installment',
    total: 360_000,
    installmentCount: 3,
    installmentAmount: 120_000,
    paymentDeadline: '2026-08-24T23:59:59+02:00',
    bonusPrivateLessons: null,
    bonusLessonMinutes: null,
    savingsVsStandard: null,
    description: '3 × 120 000 Ft. Az első részlet határideje: 2026. augusztus 24.',
  },
}

export const PACKAGE_KEYS = Object.keys(packages) as PackageKey[]

/**
 * Ismert csomag-aliasok egyetlen leképezése kanonikus kulcsra.
 * Így a régebbi URL-értékek (pl. `korai`, `normal`, `reszlet`) is működnek.
 */
const PACKAGE_ALIASES: Record<string, PackageKey> = {
  'early-bird': 'early-bird',
  earlybird: 'early-bird',
  korai: 'early-bird',
  standard: 'standard',
  normal: 'standard',
  normál: 'standard',
  installment: 'installment',
  reszlet: 'installment',
  részlet: 'installment',
  reszletfizetes: 'installment',
}

/** URL-ből érkező csomagértéket kanonikus kulcsra képez, vagy `null`. */
export function resolvePackageKey(raw: string | null | undefined): PackageKey | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  return PACKAGE_ALIASES[key] ?? null
}

/** Igaz, ha az early-bird ajánlat a megadott időpontban még érvényes. */
export function isEarlyBirdAvailable(now: Date = new Date()): boolean {
  return now.getTime() <= new Date(EARLY_BIRD_DEADLINE_ISO).getTime()
}

/** Magyar pénzformátum, pl. 250000 -> "250 000 Ft". */
export function formatHUF(amount: number): string {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${grouped} Ft`
}

/** Rövid, ember által is olvasható magyar dátum, pl. "2026. augusztus 24." */
export function formatHuDate(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Budapest',
  }).format(new Date(iso))
}

/** Dátum + idő magyar formátumban, Budapest időzónában. */
export function formatHuDateTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Budapest',
  }).format(new Date(iso))
}

/**
 * Rövid jelentkezési azonosító, pl. `TL-20260804-ABCDE`.
 * A dátumrész Budapest időzóna szerinti, a véletlen rész félreérthető
 * karakterek (0/O, 1/I) nélkül készül.
 */
export function generateApplicationId(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Budapest',
  }).format(now)
  const datePart = parts.replace(/-/g, '')
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let random = ''
  for (let i = 0; i < 5; i++) {
    random += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `TL-${datePart}-${random}`
}

/**
 * Jogi dokumentumok. Amíg a valódi URL/verzió hiányzik, az érték `null`.
 * A felület ilyenkor NEM jelenít meg törött/megtévesztő linket.
 */
export const legalDocuments = {
  privacyPolicy: {
    title: 'Adatkezelési tájékoztató',
    url: null as string | null,
    version: null as string | null,
  },
  applicationTerms: {
    title: 'Jelentkezési és fizetési feltételek',
    url: null as string | null,
    version: null as string | null,
  },
} as const

export type LegalDocumentKey = keyof typeof legalDocuments
