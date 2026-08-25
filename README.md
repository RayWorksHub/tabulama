# TabuLama

Next.js alapú nyilvános kurzusoldal és adminisztrációs rendszer.

## Első indítás

1. Másold le a `.env.example` fájlt `.env.local` néven.
2. Futtasd a `pnpm admin:credentials` parancsot, majd másold a kapott két értéket a környezeti változók közé.
3. Futtasd le a `db/migrations/0001_initial.sql` migrációt a PostgreSQL-adatbázisban.
4. Indítás: `pnpm dev`.

Ellenőrzés: `pnpm typecheck` és `pnpm build`.
