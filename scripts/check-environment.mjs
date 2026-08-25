import { resolve } from 'node:path'

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(resolve(process.cwd(), '.env.local'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

const required = ['DATABASE_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET']
const missing = required.filter((name) => !process.env[name]?.trim())

if (missing.length > 0) {
  console.error(`Hiányzó kötelező környezeti változók: ${missing.join(', ')}`)
  process.exit(1)
}

const errors = []

if (!/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL)) {
  errors.push('A DATABASE_URL nem PostgreSQL-kapcsolati karakterlánc.')
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ADMIN_EMAIL)) {
  errors.push('Az ADMIN_EMAIL formátuma hibás.')
}

if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(process.env.ADMIN_PASSWORD_HASH)) {
  errors.push('Az ADMIN_PASSWORD_HASH formátuma hibás; generáld újra a pnpm admin:credentials paranccsal.')
}

if (process.env.ADMIN_SESSION_SECRET.trim().length < 32) {
  errors.push('Az ADMIN_SESSION_SECRET legalább 32 karakter legyen.')
}

if (errors.length > 0) {
  errors.forEach((message) => console.error(message))
  process.exit(1)
}

const smtpNames = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']
const missingSmtp = smtpNames.filter((name) => !process.env[name]?.trim())
if (missingSmtp.length > 0) {
  console.warn(`Figyelmeztetés: az e-mail-küldéshez még hiányzik: ${missingSmtp.join(', ')}`)
}

console.log(`Kötelező környezeti változók rendben: ${required.join(', ')}`)
