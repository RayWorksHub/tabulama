import 'server-only'

import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let cachedSql: NeonQueryFunction<false, false> | null = null
let cachedUrl: string | null = null

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('A DATABASE_URL környezeti változó nincs beállítva.')
    this.name = 'DatabaseNotConfiguredError'
  }
}

export function getSql(): NeonQueryFunction<false, false> {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new DatabaseNotConfiguredError()

  if (!cachedSql || cachedUrl !== databaseUrl) {
    cachedSql = neon(databaseUrl)
    cachedUrl = databaseUrl
  }

  return cachedSql
}
