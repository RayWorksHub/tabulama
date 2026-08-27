import 'server-only'

import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSql } from '@/lib/database'
import { verifyPassword } from '@/lib/password'

const COOKIE_NAME = 'tabulama_admin_session'
const SESSION_SECONDS = 8 * 60 * 60

export type UserRole = 'admin' | 'instructor' | 'student'

export interface AuthSession {
  email: string
  role: UserRole
  userId?: string
  issuedAt: number
  expiresAt: number
}

interface UserAuthRow {
  id: string
  email: string
  role: UserRole
  password_hash: string | null
  account_status: 'pending' | 'active' | 'disabled'
}

export type AuthenticationResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'invalid' | 'inactive' | 'unconfigured' }

export function configuredAdminEmail(): string | null {
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

export function isAuthConfigured(): boolean {
  return Boolean(sessionSecret())
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(configuredAdminEmail() && process.env.ADMIN_PASSWORD_HASH?.trim() && sessionSecret())
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = configuredAdminEmail()
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim()
  if (!expectedEmail || !passwordHash || !sessionSecret()) return false
  if (!safeEqual(email.trim().toLowerCase(), expectedEmail)) return false

  const [saltHex, expectedHex] = passwordHash.split(':')
  if (!saltHex || !expectedHex || !/^[a-f\d]+$/i.test(saltHex + expectedHex)) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  if (salt.length < 16 || expected.length !== 64) return false
  return timingSafeEqual(scryptSync(password, salt, expected.length), expected)
}

function createSession(email: string, role: UserRole, userId?: string): AuthSession {
  const now = Math.floor(Date.now() / 1000)
  return {
    email: email.trim().toLowerCase(),
    role,
    userId,
    issuedAt: now,
    expiresAt: now + SESSION_SECONDS,
  }
}

export function createSessionToken(session: AuthSession): string {
  const secret = sessionSecret()
  if (!secret) throw new Error('A munkamenet titka nincs megfelelően beállítva.')
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function createAdminSessionToken(email: string): string {
  return createSessionToken(createSession(email, 'admin'))
}

function verifySessionToken(token: string): AuthSession | null {
  const secret = sessionSecret()
  if (!secret) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthSession
    const now = Math.floor(Date.now() / 1000)
    if (
      !['admin', 'instructor', 'student'].includes(session.role)
      || !session.email
      || !Number.isInteger(session.expiresAt)
      || session.expiresAt <= now
      || (session.role !== 'admin' && !session.userId)
      || (session.role === 'admin' && session.email !== configuredAdminEmail())
    ) return null
    return session
  } catch {
    return null
  }
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  const session = token ? verifySessionToken(token) : null
  if (!session || session.role === 'admin') return session
  const rows = await getSql().query(
    `SELECT email, role, account_status FROM users WHERE id = $1 LIMIT 1`,
    [session.userId],
  ) as Array<{ email: string; role: UserRole; account_status: string }>
  const user = rows[0]
  return user
    && user.account_status === 'active'
    && user.role === session.role
    && user.email.toLowerCase() === session.email
    ? session
    : null
}

export async function requireStudent(returnTo = '/portal'): Promise<AuthSession & { userId: string }> {
  const session = await getAuthSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`)
  if (session.role !== 'student' || !session.userId) redirect('/admin')
  return session as AuthSession & { userId: string }
}

export async function authenticateCredentials(
  emailInput: string,
  password: string,
): Promise<AuthenticationResult> {
  if (!sessionSecret()) return { status: 'unconfigured' }
  const email = emailInput.trim().toLowerCase()
  const adminEmail = configuredAdminEmail()
  if (adminEmail && safeEqual(email, adminEmail)) {
    return verifyAdminCredentials(email, password)
      ? { status: 'authenticated', session: createSession(email, 'admin') }
      : { status: 'invalid' }
  }

  const rows = await getSql().query(
    `SELECT id, email, role, password_hash, account_status
     FROM users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  ) as UserAuthRow[]
  const user = rows[0]
  if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
    return { status: 'invalid' }
  }
  if (user.account_status !== 'active') return { status: 'inactive' }
  return {
    status: 'authenticated',
    session: createSession(user.email, user.role, user.id),
  }
}

export const authSessionCookie = {
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
