const PRODUCTION_APP_ORIGIN = 'https://tabulama.vercel.app'

function normalizeOrigin(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null

  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).origin
  } catch {
    return null
  }
}

export function publicAppUrl(path: string): string {
  const origin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
    ?? normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    ?? normalizeOrigin(process.env.VERCEL_URL)
    ?? (process.env.NODE_ENV === 'production' ? PRODUCTION_APP_ORIGIN : 'http://localhost:3000')

  return new URL(path, `${origin}/`).toString()
}
