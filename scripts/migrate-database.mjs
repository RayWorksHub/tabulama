import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = process.cwd()
const migrationsDirectory = resolve(projectRoot, 'db/migrations')
const checkOnly = process.argv.includes('--check')

function loadLocalEnvironment() {
  if (typeof process.loadEnvFile !== 'function') return

  try {
    process.loadEnvFile(resolve(projectRoot, '.env.local'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

function splitSqlStatements(source) {
  const statements = []
  let buffer = ''
  let state = 'plain'
  let dollarTag = ''

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (state === 'line-comment') {
      buffer += character
      if (character === '\n') state = 'plain'
      continue
    }

    if (state === 'block-comment') {
      buffer += character
      if (character === '*' && next === '/') {
        buffer += next
        index += 1
        state = 'plain'
      }
      continue
    }

    if (state === 'single-quote') {
      buffer += character
      if (character === "'" && next === "'") {
        buffer += next
        index += 1
      } else if (character === "'") {
        state = 'plain'
      }
      continue
    }

    if (state === 'double-quote') {
      buffer += character
      if (character === '"' && next === '"') {
        buffer += next
        index += 1
      } else if (character === '"') {
        state = 'plain'
      }
      continue
    }

    if (state === 'dollar-quote') {
      if (source.startsWith(dollarTag, index)) {
        buffer += dollarTag
        index += dollarTag.length - 1
        dollarTag = ''
        state = 'plain'
      } else {
        buffer += character
      }
      continue
    }

    if (character === '-' && next === '-') {
      buffer += character + next
      index += 1
      state = 'line-comment'
      continue
    }

    if (character === '/' && next === '*') {
      buffer += character + next
      index += 1
      state = 'block-comment'
      continue
    }

    if (character === "'") {
      buffer += character
      state = 'single-quote'
      continue
    }

    if (character === '"') {
      buffer += character
      state = 'double-quote'
      continue
    }

    if (character === '$') {
      const match = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)
      if (match) {
        dollarTag = match[0]
        buffer += dollarTag
        index += dollarTag.length - 1
        state = 'dollar-quote'
        continue
      }
    }

    if (character === ';') {
      const statement = buffer.trim()
      if (statement) statements.push(statement)
      buffer = ''
      continue
    }

    buffer += character
  }

  if (state !== 'plain' && state !== 'line-comment') {
    throw new Error(`Lezáratlan SQL-részlet: ${state}`)
  }

  const finalStatement = buffer.trim()
  if (finalStatement) statements.push(finalStatement)
  return statements
}

function removeTransactionBoundaries(statements) {
  return statements.filter((statement) => {
    const normalized = statement
      .replace(/^\s*(?:--[^\n]*(?:\n|$)\s*)*/u, '')
      .trim()
      .toUpperCase()
    return normalized !== 'BEGIN' && normalized !== 'COMMIT'
  })
}

async function readMigrations() {
  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort()

  if (names.length === 0) throw new Error('Nem található SQL-migráció.')

  return Promise.all(
    names.map(async (name) => {
      const source = await readFile(resolve(migrationsDirectory, name), 'utf8')
      const statements = removeTransactionBoundaries(splitSqlStatements(source))
      if (statements.length === 0) throw new Error(`Üres migráció: ${name}`)

      return {
        name,
        checksum: createHash('sha256').update(source).digest('hex'),
        statements,
      }
    }),
  )
}

const migrations = await readMigrations()

if (checkOnly) {
  const statementCount = migrations.reduce((total, migration) => total + migration.statements.length, 0)
  console.log(`Migrációk rendben: ${migrations.length} fájl, ${statementCount} SQL-utasítás.`)
  process.exit(0)
}

loadLocalEnvironment()

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  throw new Error('A DATABASE_URL nincs beállítva érvényes PostgreSQL-kapcsolati karakterláncra.')
}

const { neon } = await import('@neondatabase/serverless')
const sql = neon(databaseUrl)

await sql.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`)

const appliedRows = await sql.query('SELECT name, checksum FROM schema_migrations ORDER BY name')
const applied = new Map(appliedRows.map((row) => [row.name, row.checksum]))

for (const migration of migrations) {
  const previousChecksum = applied.get(migration.name)
  if (previousChecksum === migration.checksum) {
    console.log(`Kihagyva: ${migration.name}`)
    continue
  }
  if (previousChecksum) {
    throw new Error(`A már lefuttatott migráció megváltozott: ${migration.name}`)
  }

  await sql.transaction([
    ...migration.statements.map((statement) => sql.query(statement)),
    sql.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [
      migration.name,
      migration.checksum,
    ]),
  ])
  console.log(`Lefuttatva: ${migration.name}`)
}

console.log('Az adatbázis naprakész.')
