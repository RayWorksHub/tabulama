# TabuLama

Next.js alapú nyilvános kurzusoldal és adminisztrációs rendszer.

## Első indítás

1. Hozz létre egy PostgreSQL-adatbázist, majd másold le a `.env.example` fájlt `.env.local` néven.
2. Futtasd a `pnpm admin:credentials` parancsot, majd másold a kapott két értéket a környezeti változók közé.
3. Ellenőrzés: `pnpm env:check` és `pnpm db:migrate:check`.
4. Migráció: `pnpm db:migrate`.
5. Indítás: `pnpm dev`.

A migrációs parancs naplózza a már lefuttatott fájlokat, az ismételt futtatás biztonságos. Buildellenőrzés: `pnpm typecheck` és `pnpm build`.
