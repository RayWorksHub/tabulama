import 'server-only'

import {
  createHmac,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const COOKIE_NAME = 'tabulama_admin_session'
const SESSION_SECONDS = 8 * 60 * 60

export interface AdminSession {
  email: string
  role: 'admin'
  issuedAt: number
  expiresAt: number
}

function configuredEmail(): string | null {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || null
}

function sessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim()
  return secret && secret.length >= 32 ? secret : null
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(configuredEmail() && process.env.ADMIN_PASSWORD_HASH?.trim() && sessionSecret())
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = configuredEmail()
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (!expectedEmail || !passwordHash || !sessionSecret()) return false
  if (!safeEqual(email.trim().toLowerCase(), expectedEmail)) return false

  const [saltHex, expectedHex] = passwordHash.split(':')
  if (!saltHex || !expectedHex || !/^[a-f\d]+$/i.test(saltHex + expectedHex)) return false

  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  if (salt.length < 16 || expected.length !== 64) return false

  const actual = scryptSync(password, salt, expected.length)
  return timingSafeEqual(actual, expected)
}

export function createAdminSessionToken(email: string): string {
  const secret = sessionSecret()
  if (!secret) throw new Error('Az admin munkamenet titka nincs megfelelően beállítva.')

  const now = Math.floor(Date.now() / 1000)
  const session: AdminSession = {
    email: email.trim().toLowerCase(),
    role: 'admin',
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS,
  }
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

function verifyAdminSessionToken(token: string): AdminSession | null {
  const secret = sessionSecret()
  const expectedEmail = configuredEmail()
  if (!secret || !expectedEmail) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminSession
    const now = Math.floor(Date.now() / 1000)
    if (
      session.role !== 'admin' ||
      session.email !== expectedEmail ||
      !Number.isInteger(session.expiresAt) ||
      session.expiresAt <= now
    ) {
      return null
    }
    return session
  } catch {
    return null
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  return token ? verifyAdminSessionToken(token) : null
}

export async function requireAdmin(returnTo = '/admin'): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) redirect(`/admin/login?next=${encodeURIComponent(sanitizeReturnTo(returnTo))}`)
  return session
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin'
  return value.startsWith('/admin') ? value : '/admin'
}

export const adminSessionCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_SECONDS,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_SECONDS,
  },
}
