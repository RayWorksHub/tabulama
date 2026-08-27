import 'server-only'

import { redirect } from 'next/navigation'
import {
  authSessionCookie,
  createAdminSessionToken,
  getAuthSession,
  isAdminAuthConfigured,
  verifyAdminCredentials,
  type AuthSession,
} from '@/lib/auth'

export type AdminSession = AuthSession & { role: 'admin' | 'instructor' }

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await getAuthSession()
  return session && (session.role === 'admin' || session.role === 'instructor')
    ? session as AdminSession
    : null
}

export async function requireAdmin(returnTo = '/admin'): Promise<AdminSession> {
  const session = await getAuthSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(sanitizeReturnTo(returnTo))}`)
  if (session.role === 'student') redirect('/portal')
  return session as AdminSession
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/admin'
  return value.startsWith('/admin') ? value : '/admin'
}

export {
  authSessionCookie as adminSessionCookie,
  createAdminSessionToken,
  isAdminAuthConfigured,
  verifyAdminCredentials,
}
