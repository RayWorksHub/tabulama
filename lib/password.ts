import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const HASH_BYTES = 64
const PREFIX = 'scrypt-v1'

export function passwordValidationError(password: string): string | null {
  if (password.length < 10) return 'A jelszó legalább 10 karakter legyen.'
  if (password.length > 128) return 'A jelszó legfeljebb 128 karakter lehet.'
  if (!/[a-záéíóöőúüű]/i.test(password) || !/\d/.test(password)) {
    return 'A jelszó tartalmazzon betűt és számot.'
  }
  return null
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, HASH_BYTES)
  return `${PREFIX}:${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [prefix, saltHex, expectedHex] = encoded.split(':')
  if (
    prefix !== PREFIX
    || !saltHex
    || !expectedHex
    || !/^[a-f\d]+$/i.test(saltHex + expectedHex)
  ) return false

  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  if (salt.length !== 16 || expected.length !== HASH_BYTES) return false

  const actual = scryptSync(password, salt, HASH_BYTES)
  return timingSafeEqual(actual, expected)
}
