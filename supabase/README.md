# Supabase backend — Bearing / Dogfood

This makes Dogfood a real, persistent, single-client app (a CFO works out of it daily), not a
demo running on an in-memory seed. It leans on the **`DataStore` "Swap Don't Rewrite" seam**
(CLAUDE.md §4): `lib/queries/` reads only through `DataStore`, so swapping `InMemoryDataStore` →
`SupabaseDataStore` is a one-file change, no spine rewrite.

## What lives where

- **Supabase (source of truth):** every base record + the derived series + the CFO's mutable work
  (flux notes, scenarios, budget locks, imported actuals). The deterministic generator seeds it
  **once**; after that Supabase is live.
- **TypeScript (unchanged):** the statement/metric **builders** still compute the P&L, Balance
  Sheet, Cash Flow, and KPIs — now over records/series read from Supabase. The numbers tie out the
  same way; only the storage moved.

## Migration plan (staged)

1. **Schema** — `migrations/0001_init.sql` (this commit). Tables + the write tables (`flux_notes`,
   `scenarios`, `scenario_inputs`, `budget_snapshots`).
2. **Schema patches — DONE.** `migrations/0002_ratio_precision.sql` (ratio columns → `double precision`
   for exact float round-trip) and `migrations/0003_flux_notes.sql` (the flux-note write store: 3 anchor
   grains + thread + `source`). **RLS / auth** is still TODO — a future migration once the auth model is
   decided (current posture: trusted single-tenant, server-side service-role, permissive/no RLS).
3. **Seed loader — DONE.** `scripts/seed-supabase.ts`: runs the generator, upserts every record + series
   into Supabase (idempotent on the stable ids). 21 data tables loaded (the 4 write tables stay empty).
4. **SupabaseDataStore — DONE + validated.** `lib/datastore/supabase.ts` extends `InMemoryDataStore`
   and overrides the record/config reads to `select` from Supabase; statements/metrics/models are
   inherited (the TS builders read the generator). `getDataStore()` selects it when **`DATASTORE=supabase`**
   is set (an explicit opt-in — NOT auto-triggered by `SUPABASE_URL` being present, so the app keeps
   running while the DB is seeded), else falls back to InMemory. Verified by `scripts/supabase-parity.ts`.
5. **Write paths** — flux notes first (the drill UI is already built), then scenarios + budget lock
   + actuals import (the CSV templates in `import-templates/`).
6. **Deploy** — Vercel + the Supabase project; the CFO's daily home.

## Setup (once you have a project)

1. Create a project at [supabase.com](https://supabase.com) (or reuse one).
2. Put the keys in `.env.local` (gitignored):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>   # server-only; never expose to the client
   SUPABASE_DB_URL=postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres  # for DDL only (apply-schema)
   ```
   The service-role key reaches only the data API (PostgREST), so it CANNOT run DDL. `SUPABASE_DB_URL`
   (Project Settings → Database → Connection string → URI; if the direct host won't connect, use the
   Session-pooler URI on port 5432) is needed only to apply/alter the schema.
3. Apply the schema: `npx tsx scripts/apply-schema.ts` (runs `migrations/0001_init.sql` over
   `SUPABASE_DB_URL`; re-runnable — "already exists" is treated as applied). Or paste the SQL into the
   SQL editor. `supabase db push` also works if you link the CLI.
4. Seed it: `npx tsx scripts/seed-supabase.ts` (full generator → upsert, idempotent on the stable ids).
5. Verify the swap: `npx tsx scripts/supabase-parity.ts` (every collection round-trips the generator
   exactly), then the gates against Supabase: `DATASTORE=supabase npx tsx scripts/data-sweep.ts` /
   `scout-readiness.ts`.
6. Flip the backend: set `DATASTORE=supabase` (env / Vercel). The selector defaults to the in-memory
   generator and switches ONLY on this explicit flag — NOT on `SUPABASE_URL` being present — so the app
   keeps running while the database is being populated. With no flag it stays on the in-memory seed.

## Gotchas (from the first apply, 2026-06-21)

- **The direct DB host `db.<ref>.supabase.co` is IPv6-only** — unreachable from an IPv4 network
  (`ENOTFOUND`). DDL must go through the **Session pooler** (port 5432, which supports DDL). This
  project is on **`aws-1-us-west-2.pooler.supabase.com`**, user `postgres.<ref>`. `apply-schema.ts`
  takes `SUPABASE_DB_HOST` / `SUPABASE_DB_USER` / `SUPABASE_DB_PORT` overrides for exactly this:
  ```
  SUPABASE_DB_HOST=aws-1-us-west-2.pooler.supabase.com SUPABASE_DB_USER=postgres.<ref> \
    SUPABASE_DB_PORT=5432 npx tsx scripts/apply-schema.ts [migration.sql]
  ```
  The REST API (seed loader + all datastore reads) is IPv4 and needs none of this — only DDL does.
- `SUPABASE_DB_URL` is needed ONLY for DDL. Everything else uses `SUPABASE_SERVICE_ROLE_KEY` over REST.
- `apply-schema.ts` fills a leftover `<ref>` placeholder from `NEXT_PUBLIC_SUPABASE_URL` and strips
  stray `<…>` / `[…]` delimiters left wrapping the password.

## Conventions

- Money stored as `numeric(16,2)` USD dollars (the app converts to/from integer cents on the seam).
- `period` is text `YYYY-MM`; `date` columns are real dates.
- Stable record ids are the app's ids (e.g. `VB-2026-05-1330`), so re-seeding is idempotent and
  flux notes keep their anchor across reloads / restatements.
