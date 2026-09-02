const isProduction = process.env.VERCEL_ENV === 'production'
  || process.env.VERCEL_TARGET_ENV === 'production'

if (!isProduction) {
  console.log('Production adatbázis-migráció kihagyva.')
  process.exit(0)
}

await import('./migrate-database.mjs')
