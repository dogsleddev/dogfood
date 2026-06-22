# Handoff — Dogfood (the Run)

> Read this AND `CLAUDE.md` at the start of every session. `CLAUDE.md` is authoritative on
> product/architecture/spec; this file tracks where the build is. Do not read `archive/`.
> Last updated 2026-06-21.
>
> Everything below the "Session history + reference" divider is older per-session logs and reference,
> some predating the Run. The section here is authoritative for the current state.

---

> **📁 Repo moved 2026-06-21 — now at `C:\dev\dogfood` (off OneDrive).** Done to fix the dev-server
> flakiness (crashes / wedged renderer / dropped streams under OneDrive+Turbopack). Git-initialized
> here (`main` branch, first commit); `.env.local` is gitignored and carries the Supabase + Anthropic
> keys. The old `...\OneDrive\02_Projects\dogfood` copy is the stale original — delete once confident.
> Verified at the new location: tsc 0 · lint 0 · data-sweep 43/43 · `next build` exit 0. **Pushed to GitHub: https://github.com/dogsleddev/dogfood (PUBLIC)** — `main` tracks
> `origin/main`; all commits authored as Chris <dougherty4@gmail.com>. (The old `dogsleddev/dogfood`
> landing site was renamed to `dogsleddev/dogfood1`, content untouched; the app now owns the
> `dogfood` repo name.)
> Auto-memory was migrated to the `C--dev-dogfood` namespace.

## ▶ NEXT SESSION — START HERE

### State (2026-06-21, latest · next-steps review + steps 1–3: truthful guides, edge access gate, decision gate resolved) — GREEN  ·  _authoritative; the blocks below are prior context_

**A grounded next-steps review ran (a 7-reader verification workflow over the remaining workstreams) and Chris approved the recommended order. Steps 1–3 of that order are done this session.**

- **Step 1 — guides truthful + Flux guide #7 (DONE).** `lib/guides/content.ts` is Scout's product-knowledge corpus, so a stale line is a wrong CFO-facing Scout answer. Fixed three falsehoods: (a) *updating-actuals* claimed the ERP is "the one and only live integration / everything else import-based by design" → rewritten to the §16/§18 model (every domain batch-imports from its system of record; live API connectors are roadmap for ANY domain; the CSV template is the contract a connector fills); (b) *asking-scout* implied Scout `setDriver` is live → now says Scout READS saved scenarios (list / one-P&L / compare) and does not yet model a new what-if or set a driver, plus a new flux paragraph (Scout reads+writes flux notes); (c) *budgets-and-forecasts* lock parenthetical softened to "today the P&L's Budget/Variance columns show the planned baseline." **Added the 7th guide** `creating-a-flux-analysis` (the most-complete shipped feature had no in-app guide), adapted from `creating-a-flux-analysis.md` to the `GuideBody` minimal-markdown subset (tables/blockquotes/numbered lists → prose+bullets; em dashes removed per §15; mojibake fixed). Wired into `GUIDES[]` (auto-propagates to Scout's `getProductMap`/`describeModule`) + a 7th leaf in `nav-config.ts` `guideChildren`. Browser-verified: renders cleanly (10 H2 / 2 H3 / 25 bullets / 20 code chips, zero raw-markdown artifacts), 0 console errors.
- **Step 2 — edge access gate + env scaffolding (DONE; GitHub push pending Chris).** The top real production risk: a bare Vercel deploy is public by default, and RLS is moot (the service-role key bypasses it), so protection must live at the edge. New `middleware.ts`: HTTP Basic Auth over all routes, enforced only on production builds (`NODE_ENV==='production'`), **fail-closed** (a deployed app with no `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` returns 503, never public); local dev is never gated. New `.env.example` (+ a `!.env.example` exception in `.gitignore`, since `.env*` was ignoring it). `package.json`: moved `--max-old-space-size=4096` onto `typecheck`/`lint` (they OOM'd fresh). **GitHub push BLOCKED on `gh` auth** — `gh` is not logged in and there is no remote. Repo is clean (2 commits, `.env*` gitignored, no secrets committed) and ready; Chris must `gh auth login` (or add a remote + token), then we push to a PRIVATE repo.
- **Step 3 — decision gate RESOLVED (Chris: "fully resolve, do not defer any work").** All five open decisions locked in the rigorous, no-defer direction (details under "Open decisions for Chris" below): Scout gets the FULL scenario write surface (create/duplicate/reset/setDriver, not setDriver-only); Budget becomes a REAL frozen snapshot (`lockBudget` implemented, synthetic `budgetFactor` retired); `scenario_inputs` stored as jsonb (lossless); the importer DRIVES closed-month statements (option a — re-plumb the builders); the override layer is field-level deltas.

**Gates:** tsc 0 · lint 0 · `next build` exit 0 (guides route SSG-prerenders all 7 slugs; `ƒ Middleware 34.2 kB` active). No data/seed/Scout-logic changes this session, so data-sweep / scout-readiness / scenario-check are unaffected (not re-run).

**▶ NEXT — continue the recommended order from step 4.** Corrected build order (the split-brain finding is new — the handoff previously framed scenario persistence as "just wire setDriver"): **(4)** unify the split-brain scenario store FIRST — `lib/queries/scenarios.ts` reads a module `Map` (`lib/scenario/registry.ts`) while `DataStore.{list,upsert,delete}Scenario` are unused + not overridden in Supabase, so a "persisted" scenario is invisible today; route scenarios through `getDataStore()` + seed Base/presets. **(5)** scenario persistence (Adjustment→jsonb serializer + Supabase overrides + Manager/Drivers Server Actions, mirror the flux write pattern). **(6)** budget lock (real snapshot + Lock UI; re-run data-sweep — Budget/Variance numbers move). **(7)** Scout full scenario writes (create+setDriver, relax the WHATIF guard, update `config.ts`). **(8)** global as-of Phase A (centralize `closeThrough` + unify `monthToIndex` into `period.ts`; the debt is ~38 files / 53 sites + magic `NOW_IDX=29` in `renewals.ts`, not "~12"; route pages/Scout, LEAVE the tie-out-critical seed builders on the sync constant). **(9/10)** override layer (field-level) + CSV importer (option a) together. **(11)** as-of Phase B (Settings write + roll-forward + the deferred forecast-month sub-ledger cut #15). **(12)** housekeeping (`getPipelineCoverage`/`getGrr` stubs at `lib/queries/sales.ts:34,201`; missing `cost-and-pl.svg` / `architecture.html`; the `addFluxNote` backslash-href nit at `lib/scout/tools.ts:~870`).

### State (2026-06-21 · the last 2 Flux surfaces built — Flux Analysis COMPLETE across all 3 grains + every reading/config surface) — GREEN  ·  _prior context (same day)_

**Both remaining Flux surfaces are built.** Flux Analysis now covers all three anchor grains on every reading + config surface. No new data work — both reuse the built write store + `lib/queries/flux.ts` + the Server-Action pattern; anchor = the last closed month (`PLACEHOLDER_SETTINGS.closeThrough` = May 2026), the settled-note semantics.

1. **Balance Sheet / Cash Flow peek panes — DONE.** Generalized the P&L pane's notes section into `components/statements/statement-flux-notes.tsx` (`StatementFluxNotes`, parameterized by `{ lineId, actions }` where `actions = { add, resolve, remove }` Server Actions). `inspect-pane.tsx` (P&L) now uses it (deleted `pnl-flux-notes.tsx`); `StatementInspectPane` (BS/CF) gained `lineId` + `fluxActions` props and renders it after the drill block (every line can carry notes). New per-route action files `app/statements/balance-sheet/actions.ts` + `cash-flow/actions.ts` (mirror `pnl/actions.ts`; only the `revalidatePath` differs). Both BS/CF pages pass their actions + `lineId={line.id}`.
2. **Account Mapping / TB account-grain card — DONE.** A GL-account row opens a right-hand note card scoped to `(account_code, closeThrough)` via `?note=<code>` (mirrors the Expense register's `?note=` flow): new `components/setup/account-flux-panel.tsx` + `app/setup/account-mapping/actions.ts` (`addAccountFluxNoteAction` etc., `addFluxNote({ anchor: { accountCode, period } })`). `account-mapping-table.tsx` gained a **Flux column** (`● note` / `＋` markers + selected-row highlight) + `notedCodes`/`selectedCode` props; the page reads `?note=` and renders the table + card in a two-column layout. Because `addFluxNote` denormalizes the statement line from the account, **an account note made here rolls up into that line's P&L/BS/CF peek pane** (verified). Unknown `?note=` codes degrade to no-card (full-width table).
3. **Bug fixed in passing:** the P&L `addLineFluxNoteAction` never read its composer's `resolved` checkbox (a no-op) — all four statement add-actions now honor it.

**Validated:** tsc 0 · lint 0 · `next build` exit 0 (`/setup/account-mapping` correctly became a dynamic route — it now reads `searchParams`) · data-sweep 43/43 · scout-readiness 70/70 · scenario-check 13/13. Render checks (curl — deterministic; the dev-server browser renderer was wedged under OneDrive+Turbopack, screenshot timed out) confirm all three surfaces emit the right hidden anchor fields (BS: `statementLine=cash` + `period=2026-05`; account card: `accountCode=6200` + `period=2026-05`) + the composer/empty-state. A forced-in-memory write-path round-trip confirmed: BS line note persists; account note persists AND rolls up to its statement line; the `resolved` flag is honored; cleanup leaves 0 residue (no Supabase writes). NOTE: the planned multi-agent adversarial review was blocked by repeated Anthropic **529 Overloaded** on every subagent (twice) — reviewed inline instead: no real bugs; two non-blocking observations (account/line notes don't snapshot `amountAtNote` — transaction-only by design in `flux.ts`; `NoteCard` markup duplicated across the 3 flux surfaces — acceptable given differing needs + regression risk on the verified expense panel).

**▶ NEXT SESSION — the other write paths (Flux is DONE).** In order: scenarios persistence (`scenario_inputs`) + Scout `setDriver` (gated on open-decision #5: can Scout create scenarios, or only set drivers on the current one?); budget lock; the override layer. **Then:** the CSV importer + the **global as-of control** (centralize `closeThrough` — today a constant in ~12 sites). RLS/auth stays optional (trusted single-tenant, server-side service-role). Parallel/non-blocking: align `lib/guides/content.ts` + the 3 detailed root `.md` guides with the shipped surfaces.

---

### State (2026-06-21 · ALL Scout tools wired + validated · Flux built across its core surfaces) — GREEN  ·  _prior context (same session)_

**Every Scout tool is now wired and LLM-validated, and Flux Analysis is built across its core surfaces.**

**Scout — 34 wired tools** (32 data + 2 product-knowledge; was 20). Added this session:
- **7 forecast drivers:** getRevenueForecast (contracted vs new-business), getCostOfRevenue, getPersonnelForecast (by function), getExpenseForecast (by group), getArForecast (DSO), getFixedAssetForecast (capex), getPrepaidsForecast — each steered (driver = the forward assumption; for the actual use getPnL/getMetric).
- **getBoardPackage** (the board deck).
- **3 scenario reads:** getScenarios · getScenarioPnL · compareScenarios (the engine is built; group-scoped, contained). `setDriver` stays deferred (scenario WRITE persistence not built).
- **Flux:** getFluxNotes (read) · getFluxDetail (the variance decomposition — the locked sibling) · **addFluxNote (Scout's first WRITE** — attributed to the user, source=scout). The registry now supports write tools via a `write` flag (a write is NOT a read thunk, so scout-readiness never executes it).
- System prompt (`config.ts`) updated for the drivers / scenario-reads-vs-what-if / flux; the WHATIF guard now blocks only NEW-hypothetical phrasing so scenario READS route to the tools.

**Validated:** tsc 0 · lint 0 · build 39/39 · scout-readiness **70/70** (InMemory AND Supabase) · scout-eval structural + deterministic + **LLM routing 58/58 (100%)** — every tool routes right under the live LLM (credits are back), incl. the read-vs-write flux guard, the driver-vs-actual overlap, and the what-if guard. **Eval hardened:** it now FORCES the in-memory store, so addFluxNote write-cases are ephemeral. (Bug found + fixed: `.env.local`'s `DATASTORE=supabase` had leaked through the eval's env-loader, writing 2 test notes into Supabase — purged; the force-in-memory fix prevents recurrence.)

**Flux Analysis — core surfaces built** (flux-analysis.md):
- (prior, same session) the write store (`0003_flux_notes.sql` — 3 anchor grains + multi-author thread + source) + the **Expense Transactions register** note card (transaction grain).
- (now) the **P&L peek-pane Notes section** (`components/statements/pnl-flux-notes.tsx` + `app/statements/pnl/actions.ts`): line notes anchored to the **last closed month** (where flux happens), with account- and transaction-grain notes **rolled up via the denormalized `statement_line` (one query)**, plus a composer + resolve/delete. Verified rendering a persisted Supabase line note.
- **getFluxDetail** (`lib/queries/flux.ts`): line actual/forecast/budget/variance + the bills composing the actual — pairs with getFluxNotes for "why is X over → here's the breakdown".

**▶ NEXT SESSION (agreed with Chris) — the last 2 flux surfaces.** Both reuse the built write store + `lib/queries/flux.ts` + the Server-Action pattern — NO new data work; anchor = the last closed month (`PLACEHOLDER_SETTINGS.closeThrough`), the settled note semantics.
1. **Balance Sheet / Cash Flow peek panes.** Add a flux Notes section to `components/statements/statement-inspect-pane.tsx` (the BS/CF peek pane, `?inspect=<lineId>`), mirroring the P&L pane. Generalize `components/statements/pnl-flux-notes.tsx` (or add a `statement-flux-notes.tsx` that takes a `revalidatePath` + line id) — it's the same one-query roll-up `listFluxNotes({ statementLine, period: closeThrough })`; only the Server Actions' `revalidatePath` differs (add `app/statements/balance-sheet/actions.ts` + `cash-flow/actions.ts`, or parameterize). Then render it in `StatementInspectPane`.
2. **Account Mapping / TB account-grain card.** On `app/setup/account-mapping/page.tsx`, let a GL-account row open a note card scoped to `(account_code, closeThrough)` via a `?note=<code>` param (mirror the Expense register's `?note=` flow + a small server action calling `addFluxNote({ anchor: { accountCode, period } })`). The query already derives `statement_line` from the account, so these account notes **already roll up into the P&L pane** (verified). Reuse the note-list + composer.

**Then (later write paths):** scenarios persistence (`scenario_inputs`) + Scout `setDriver`; budget lock; the override layer. **Then:** the CSV importer + the global as-of control (centralize `closeThrough`).

---

### State (2026-06-21 · Flux Analysis notes — the FIRST user-WRITE path) — GREEN  ·  _prior context (same session)_

**The first write surface is live: Flux Analysis notes on the Expense Transactions register**, end-to-end on **both** the in-memory and Supabase backends (flux-analysis.md). A note is a Dogfood-native write pinned by a **stable anchor** to immutable ERP data (delta-off-Base, like `scenario_inputs`) — it never edits the actuals, and it survives re-import.

**Built:**
- **Schema `0003_flux_notes.sql`** (applied to Supabase via the pooler): `transaction_id` now nullable, `+account_code`, `+source ('ui'|'scout')`, an **anchor check** (a note must anchor to a transaction · or account+period · or line+period), `(account_code, period)` index. Folds the 3 anchor grains + a multi-author thread onto the 0001 table.
- **Types** `lib/types/flux.ts` (FluxNote / FluxNoteAnchor / NewFluxNote / FluxNoteFilter).
- **DataStore seam** — 4 methods (`listFluxNotes` / `addFluxNote` / `setFluxNoteResolved` / `deleteFluxNote`) on the interface, impl'd in **both** stores: InMemory (mutable array, persists across requests via the globalThis store) and Supabase (insert/select/update/delete via PostgREST — never cached, since notes are mutable).
- **Query layer** `lib/queries/flux.ts` — `addFluxNote` resolves the author (current user "Chris") and **denormalizes the roll-up axis**: a transaction anchor derives `account_code` + `period` + `amount_at_note` from the bill and `statement_line` via Account Mapping, so the note rolls up to its line. Fails loud if the anchor resolves to no grain. `listFluxNotes` / `resolveFluxNote` / `deleteFluxNote` too.
- **UI** — Server Actions (`app/reporting/expense-transactions/actions.ts`, no client JS) + a right-hand **Flux note card** (`components/reporting/flux-note-panel.tsx`): the bill summary, the comment thread (author · provenance · time · amount-snapshot with a **"⚠ figure changed" flux-on-the-flux flag** · Resolve/Reopen · Delete), and the composer. The register table gains a **Flux column** (a `● note` marker on noted rows, `＋` to add) and a selected-row highlight, addressed by `?note=<txnId>` (the app's URL-param idiom). Delete is always available (a mis-added note is one click out).

**Verified:** a 13-check write-path test (add → enrich → list → roll-up-by-line → resolve → delete) **passes on BOTH backends**; the persisted Supabase note + marker + composer **render in the browser (HTTP 200)**; `next build` 39/39 (Server Actions compile); tsc 0 · lint 0 · data-sweep 0 fail · scout-readiness 44/44. Test rows cleaned up — Supabase `flux_notes` is empty.

**Auth note:** went straight to the write path (no RLS migration first) because the locked model is **trusted single-tenant, server-side service-role, permissive/no RLS** — the service-role key bypasses RLS anyway. RLS stays optional/deferred.

**▶ Next (flux follow-ons + the other write paths):**
- **Flux, remaining surfaces** (the spec's full scope): the **peek-pane** Notes section (`InspectPane`/`StatementInspectPane` on P&L/BS/CF) + the **Account Mapping / TB** account-grain notes (anchor `(account_code, period)` — the schema already supports it; the query enriches it), the **roll-up display** (line note + account notes + txn notes together), `getFluxDetail` (the budget-vs-actual decomposition table), and the **Scout flux tools** (`getFluxNotes` read + `addFluxNote` write — Scout's first write, write-then-undo per the locked decision).
- **Other write paths:** scenarios persistence (`scenario_inputs`) + budget lock + the override layer.
- **Then:** the CSV importer + the global as-of control; the remaining Scout tool wiring (drivers/board/scenarios); the metered LLM eval (needs Anthropic credits).

---

### State (2026-06-21, earlier · Supabase swap + crash fix) — GREEN  ·  _prior context (same session)_

**The Supabase backend is built, loaded, validated, and LIVE.** `.env.local` now has `DATASTORE=supabase`, so the app reads the persistent record layer from Supabase (project `zdbuojhtfvdbanhxedwx`, us-west-2). **Revert anytime:** remove/unset `DATASTORE=supabase` → instant fallback to the in-memory generator.

**What moved (and what didn't) — the decisive architecture fact:** the statement/metric BUILDERS read the deterministic generator DIRECTLY (`getSubscriptionSeed()` …), not through `getDataStore()`. So "statements stay computed in TS" = the builders are unchanged + generator-backed. Therefore `SupabaseDataStore` **extends `InMemoryDataStore` and overrides ONLY the record/config reads** (every layer-1 record, config, GL, the sub-ledger) to `select` from Supabase; statements / metrics / driver-models are INHERITED → identical by construction. The persistent record layer (the CFO's importable/mutable data) is genuinely served from Supabase; the derived financials remain deterministic TS over that same data.

**Built this session:**
- `lib/datastore/supabase.ts` — `SupabaseDataStore`: lazy-cached, paginated PostgREST reads, numeric-dollars↔Money on the seam, branded-id casts; loads `.env.local` as a fallback so tsx scripts work (no-op in Next).
- `lib/datastore/index.ts` — `getDataStore()` switches on the explicit `DATASTORE=supabase` flag (NOT auto-on-`SUPABASE_URL` — that would break the app before seeding) + a `dataStoreKind()` helper. **The store is cached on `globalThis`, not a module `let`** — see the crash fix below.
- `scripts/seed-supabase.ts` — loads the FULL generator sets (raw, not the as-of-filtered queries, so FKs resolve), idempotent clear-in-reverse-FK-order then insert; **21 tables / ~19k rows**.
- `scripts/apply-schema.ts` — runs a migration over `SUPABASE_DB_URL` (DDL can't go through the REST key); parses discrete fields (handles special-char passwords), fills a leftover `<ref>` placeholder, strips stray placeholder brackets, supports `SUPABASE_DB_HOST/USER/PORT` overrides + a migration-file arg.
- `scripts/supabase-parity.ts` — the "Verify the swap" validator: every collection vs the generator, canonical sorted-key compare + 9dp float tolerance.
- **Schema fixes** — `supabase/migrations/0001_init.sql` predated the data-credibility hardening; added `customers.churn_month`, `pipeline.kind`, `renewals.new_arr`, `cash_receipts.applied_doc_number`, and made `probability` / `pct_complete` / `margin_pct` **`double precision`** (full-float round-trip). `0002_ratio_precision.sql` migrates an already-applied DB.

**Validation — ALL GREEN:**
- **Parity: 21/21 collections round-trip the generator EXACTLY** (money to the cent; display ratios to 9dp — Postgres `double` text-output noise past ~14 sig digits is the only difference, far below any display/tie-out).
- Gates under `DATASTORE=supabase`: **data-sweep 0 failures · scout-readiness 44/44 · scenario-check 13/13**.
- Default InMemory path intact: tsc 0 · lint 0 · data-sweep 0 · scout-readiness 44/44.
- **Clean prod build** (all routes; no client-bundle leak of `node:fs`/supabase-js).
- App verified rendering from Supabase: **all 15 main routes (dashboard · all statements · all Sales registers · Projects · Staff · Expense Transactions · forecasts · all Scenarios · Setup · Board Package) → HTTP 200, server stable across the full sweep, log clean (zero errors).**

**Crash FIXED (Chris hit a crash right after the flip).** Root cause: `getDataStore()` cached the store in a module-level `let`, which Next **dev** blows away on HMR / per-route module re-eval. On InMemory that re-instantiation is free, but on Supabase each one spun up a NEW supabase-js client (new sockets) + an EMPTY collection cache → sockets/memory churn that tipped the (already OneDrive/Turbopack-fragile) dev server over after ~11 page loads. Fix: cache the store on **`globalThis`** (one client, one persistent cache that survives module reloads). After the fix the full route sweep is stable. NOTE the data layer was never at fault — a 37-query page-backing smoke passed 100% on Supabase throughout. (The dev server remains somewhat fragile under OneDrive+Turbopack in general — e.g. the `/api/scout` STREAMING route was flaky on InMemory in a prior session — but normal page loads are stable now.)

**Operational gotchas (also in `supabase/README.md`):** the direct host `db.<ref>.supabase.co` is **IPv6-only** → unreachable on an IPv4 network; DDL went via the **Session pooler `aws-1-us-west-2.pooler.supabase.com`** (port 5432, user `postgres.<ref>`) using the apply-schema overrides. The REST API (seed/reads) is IPv4 and needs none of that. `SUPABASE_DB_URL` is needed ONLY for DDL. (NOTE: the gate scripts default to InMemory unless prefixed `DATASTORE=supabase`, because tsx doesn't read `.env.local` for that flag — so CI stays fast; the Next dev server picks up the flag from `.env.local`.)

**▶ Next (per `supabase/README.md` plan, now unblocked):** RLS / auth migration, then the **WRITE paths** — flux notes first (the Expense-Transactions drill UI is built), then scenarios + budget lock + the override layer, then the **CSV importer** + the **global as-of control** (centralize `closeThrough`). Still open from prior sessions (reads, no auth dep): the remaining **Scout tool wiring** (drivers / Board Package / Scenarios — read-only first; scenario WRITE tools gated on open-decision #5) and the **metered LLM routing eval** (needs Anthropic credits — currently exhausted).

---

### State (2026-06-21, later · Scout register fan-out — Phase 4) — GREEN  ·  _prior context_

**Wired Scout DATA tools for the 5 remaining built registers — the documented register fan-out (Phase 4).** Renewals · Pipeline · Projects · Staff · Expense Transactions each got a Scout tool, so Scout now answers over EVERY shipped layer-1 register. **Scout data tools 13 → 18** (20 wired incl. the 2 product-knowledge tools). Each followed the proven recipe (registry binding → impl → deterministic-router route → dog-pun commentary → eval cases); descriptions NAME SIBLINGS to steer routing (NRR/logo RATE → getMetric · renewal worklist / gross dollar retention → getRenewals · open deals → getPipeline · signed → getContracts · utilization metric → getMetric, project register → getProjects).

- **New tools** (`lib/scout/tools.ts` + bindings in `lib/queries/registry.ts`, all backing live DataStore queries already forwarded): `getRenewals` (open ARR + outcomes by status + closed-book gross dollar retention + next due), `getPipeline` (open funnel: total/weighted ARR + by-stage + top reps; optional `stage`), `getProjects` (in-progress/complete + WIP + utilization + top engagements), `getStaff` (FTE roster as-of last closed month + org by dept + function split), `getExpenseTransactions` (period spend + by-group + top bills; optional `period`/`group` — the Flux drill, with CoR groups prettified to match the register). Outputs tie to the register pages by construction (verified: renewals 152 / GRR 86.1%, pipeline 46 / $6.1M, projects 88 / util 86%, staff **112 FTE** matching §11 splits R&D 37 / S&M 32 / Direct 19 / G&A 13%, expenses May $1.1M).
- **Router / commentary / eval** (`router.ts` · `commentary.ts` · `scripts/scout-eval.ts`): 5 deterministic routes, precedence-checked (renewals BEFORE the NRR/logo metrics; projects/staff/expenses BEFORE the statement routes so "project margin" / "headcount" / "spend on X" don't fall through to P&L/dashboard); 5 stepLabel dog-pun lines; **+12 LLM cases & +5 deterministic cases** incl. the NRR-vs-Renewals and utilization-vs-Projects overlap guards. Also: scout-readiness `ARGS` map extended for the 5 new query names (the `Record<QueryName,…>` type forces this).

**Gates:** tsc 0 · lint 0 · data-sweep 43/43 · **scout-readiness 44/44** (was 34 — the 5 new live queries each add a serialize+determinism check) · scenario-check 13/13 · **scout-eval STRUCTURAL 20/20 tools + DETERMINISTIC routing 18/18** (incl. the 5 new routes, no regression). End-to-end deterministic path verified (router → tool → grounded reply → clickable receipt) for all 5; the NRR overlap guard holds ("net revenue retention" → getMetric(nrr), NOT getRenewals). `/api/scout` returns HTTP 200. NOTE: did NOT re-run `next build` (changes are additive Scout-lib/script only, no page/component edits; tsc validated types project-wide incl. the route). Dev server is flaky under OneDrive+Turbopack on streaming requests (kept dropping mid-stream) — verified via the gates + a direct deterministic-path script instead.

**⚠️ Two EXTERNAL blockers surfaced this session (both Chris-side; neither blocked the work above):**
1. **Anthropic API credits exhausted** — `scout-eval`'s metered LLM routing layer (and the live in-app Scout loop) returns `invalid_request_error: "Your credit balance is too low"`. The FREE structural+deterministic layers (the CI gate) pass; Scout falls back to the deterministic router in-app. **→ Top up credits to run the LLM routing eval over the new tools + exercise conversational/multi-tool Scout.**
2. **No Supabase project** — `.env.local` holds only `ANTHROPIC_API_KEY` (no `NEXT_PUBLIC_SUPABASE_URL`/anon/service_role), so the whole Supabase chain (seed-loader → SupabaseDataStore → importer → global as-of → write paths) stays blocked. **→ Create a project + add the 3 keys to `.env.local` to start it (see `supabase/README.md`).**

**Remaining unblocked Run work (all reads, no auth dependency — pick up here):**
- **Scout tool wiring, cont.:** the 7 Forecast DRIVER surfaces (Revenue / CoR / Personnel / Expense / AR / Fixed-Asset / Prepaids), Board Package (`getBoardPackage` is still a stub query — build it first), and Scenarios. **Scenario WRITE tools (`setDriver`/`createScenario`) are gated on open-decision #5** (can Scout create scenarios, or only set drivers on the current one?) — but read-only scenario tools (`listScenarios` / `getScenarioPnL` / `compareScenarios`) can wire now against `lib/queries/scenarios.ts`.
- **Guides alignment:** `lib/guides/content.ts` still describes more than is built — reconcile to the shipped surfaces (the §92 parallel task).

---

### State (2026-06-21 · data-credibility hardening + exec-comp re-baseline + attrition) — GREEN  ·  _prior context_

**▶ Exec-comp re-baseline + attrition (#23) DONE + benchmark-validated. §11 headline held (slightly healthier, see below).** Three pieces:
- **#7 exec comp** — comp is realistic by seniority: a per-dept title ladder → relative comp multiplier, renormalized to the dept's planned envelope (per-function payroll held → CoR/GM/runway held), seniority SPREAD across the hire timeline (golden-ratio order) so exec pay doesn't front-load. Engineering rung-0 = "Co-founder & CEO".
- **Benchmark validation (research agent, cited: Kruze/Carta/Pave/RepVue/Bridge Group)** drove the corrections: **founder-CEO $402K → $228K** (Series-B founder-CEO base median ~$216K / band $200–260K — $402K was ~2× too high), and **sales OTE-shaped**. **Sales-envelope bump DONE (Chris's call):** sales plan.baseComp $130K→$145K + a steeper sales curve → **VP Sales $287K is the company's TOP earner, out-earning the founder-CEO** (the research's "top seller is often the highest-paid person"); 4 reps clear the non-sales-VP line (~$229K); SDRs ~$46–58K; median ~$120K. This pulled **§11 back to locked exactly** (NI −$12M, magic 1.2x, Rule of 40 25%, runway 49mo) — the added S&M offset the SBC-forfeiture shallowing. Opening cash bumped to **$8M** to hold runway at ~49 after the exec-comp + sales-OTE burn.
- **#23 attrition + backfill** — 23 departures (endMonth set, all in the CLOSED window ≤ May 2026 — you don't forecast specific terminations), each backfilled in the SAME slot so the headcount trajectory + per-function payroll are preserved (only the backfill's merit tenure resets + ASC 718 SBC forfeiture on departure). Total staff records 163, **140 active at horizon**, 116 active as-of June (mid-ramp). `listStaff` now shows the as-of roster (departed/future-hire excluded, like Customers #8); the export keeps all 163 with start/end months. Pipeline owners exclude departed staff.
- **Eng-org fix (independent adversarial review caught it)** — was: line Engineering Managers ($230–279K) out-earned the founder-CEO ($228K) and the 39-person R&D org had no leadership title above "Engineering Manager." Added a **VP Engineering** rung + an explicit eng comp shape: VP Eng ($264K) > Co-founder & CEO ($235K) > Engineering Managers ($209–234K, now all ≤ CEO). **0 eng managers out-earn the CEO** now; the org has a full leadership layer (VP Eng/Product/Sales/Marketing/CS, CFO, Director PS, Heads of People/Ops). VP Sales ($287K) remains the company top earner. Envelope-neutral (renormalized).

**Knobs moved:** opening cash **$6M→$7.5M** (funds the exec-heavy + market-rate-sales ramp-year burn). **Latent bug fixed:** three runway paths (`buildSeedRunway`, dashboard `computeMetricsAt`, scenario `engine.ts`) pre-rounded to 1 decimal differently and could disagree by a month — all now use raw `cash/netBurn`.

**Gates:** data-sweep 43/43 · scout-readiness 34/34 · scenario-check 13/13 · tsc/lint 0 · build 39/39. **§11 at locked:** revenue $23.4M, GM 71%, **NI −$11.9M** (vs locked −$12.1M — realistic comp + ASC 718 forfeiture trim non-cash SBC; arguably more accurate), NRR 109%, magic 1.2x, runway 49mo, Rule of 40 25%, burn 0.6x. **Still open:** the sales-managers-near-VP-Product nit (LOW, OTE-defensible), #22 founder hire-date spread (reverted — penny rounding tolerance), a small franchise tax (#39/#42, $0 defensible under NOLs), #37 function tags / #31 consultant-week cap (LOW). Files: `lib/seed/personnel.ts`, `params.ts`, `sbc.ts`, `transactions.ts`, `pipeline.ts`, `lib/queries/reporting.ts`, `statements.ts`, `lib/scenario/engine.ts`.

---

**Pickup audit + dataset confirmation done (Chris: "confirm the dataset" → "Everything incl. as-of + GL").** Re-ran all gates (green), then ran a 10-domain adversarial data-credibility sweep (each finding independently verified) to catch what reads as FAKE to a Series-B CFO drilling the sub-ledger, BEFORE the Supabase freeze. 42 confirmed findings (4 High / 17 Med / 21 Low). **The 2 prior HIGH fixes confirmed real in code — but a NEW HIGH: `data-export/` was STALE (pipeline.csv still had the pre-fix fake owners). Regenerated.**

**Gates (all green; re-run to confirm):** `tsc` 0 · `lint` 0 · data-sweep **43/43** · scout-readiness **34/34** · scenario-check **13/13** · scout-eval (structural + LLM **33/33**) · `next build`. §11 shape **preserved exactly** (revenue $23.4M, NI -$12.1M, NRR 109%, magic 1.2x, runway 49mo — verified by peer-check after the recalibration).

**FIXED this pass (~26 distinct findings; all tie-out-neutral or §11-preserving):**
- **Staff** (`personnel.ts`/`names.ts`/`params.ts`): per-dept **title ladder** (was every title = dept name — 39 "Engineering"); **de-correlated names** (broke the alliterative march; matching-initials 24→7).
- **Vendors** (`transactions.ts`): **anchor-vendor model** — recurring SaaS/PEO/insurance vendors now bill EVERY month at a stable share (Datadog 36/36 months, was absent 6/24 + 2-4× swings); **one PEO** (Rippling), not 3 competing; subcontractor anchors; **removed the misleading annual-lump** (it read smaller than a normal month under smooth drivers).
- **Sub-ledger** (`transactions.ts`): **doc numbers reset per year** (INV-2024-0001…); **opening AR** spread across late-2023 with a real INV-2023 series (was 6 self-equal docs on one day); **per-customer collection lag** (gap p10 26d/median 45d/p90 69d, was a 45-day spike); **cost-rate variance** (job-cost margin drifts off plan, was reconciled to 4 decimals).
- **Round-number tell** (`subscription.ts`): ARR grain **$1,000 → $50** (155/155 round-000 → 6/155; e.g. $324,100, $381,050) — unbiased, no RNG reshuffle, **§11 unmoved**. Cascades to invoices. **Contract term variety** 12/24/36mo (was all 12).
- **Pipeline** (`pipeline.ts`): close timing **biased by stage** (negotiations close soon, leads later); **probability jitter** (45 distinct, was 4); **new_logo/expansion `kind` flag**, expansions target only ACTIVE accounts (0 churned, 0 new-logo-in-book), no name-pool wrap.
- **Renewals** (`renewals.ts`): **outcome magnitudes** (expanded +5–25%, contracted −5–20%, churned $0 — new `newArr` field, was flat); in-close month (June) renewals now **open**, not resolved.
- **Customers** (`subscription.ts`/`sales.ts`): churned customer **ARR = 0** + `churnMonth` (record was carrying stale pre-churn ARR); **as-of register filter** — future-dated logos (Jul–Dec 2026) no longer shown as active (register 155→**125**; the export keeps all 155 as a raw dump).
- **Dashboard** (`dashboard-metrics.ts`): **per-metric budget factors** (was a uniform actual×1.04/0.94 across every non-financial tile).
- **Metrics** (`metrics.ts`): net_income basis string corrected (Bearing has interest INCOME + $0 tax → NI less negative than OI).
- **Export** (`export-data.ts`): vendor_bills gains doc#/date/due/status; project floats rounded to 4dp; new fields surfaced (kind, churn_month, new_arr). **Regenerated `data-export/` (20 files, 18,618 rows).**

**DEFERRED — with rationale (NOT silently dropped; Chris to decide):**
1. **§11-MOVING payroll/tax** — **exec comp (#7) + benchmark validation + terminations/attrition (#23) are DONE** (see the top block; §11 held). Remaining: the **sales-envelope/OTE bump** (raise sales plan.baseComp ~$130K→~$145K so VP Sales hits the $300–380K OTE band and multiple reps out-earn non-sales VPs — moves the S&M ratio/magic, Chris's call), **founder hire-date spread** (#22, reverted — penny CF↔BS rounding tolerance, low value), **small state/franchise tax** (#39/#42 — $0 tax largely defensible under NOLs).
2. **GL structure is BY DESIGN per §16** (the close itself is the ERP's job, OUT of scope): accumulated-deficit close-to-equity (#19), monthly-summary GL (#20), thin 28-account COA (#40). Dogfood reads a clean summary close; it is not a close engine. Documented, not "fixed."
3. **Forecast-month sub-ledger cut** (#15 — timesheets/bills with doc#s exist in Jul–Dec): tie-out-neutral but needs the 8 reconciliation checks made close-aware. Low exposure (registers default to the last closed month). **Bundle with the global-as-of control work** (already roadmapped, §17) — that's the natural home for the boundary handling.
4. **New-logo cadence lumpiness** (#10/#25/#26): the model is highly sensitive to logo TIMING (annual-prepay recognition + churn draws) — lumpifying broke §11 by +13% revenue when tried, so left smooth (deferred; would need a §11 re-baseline). #31 (per-consultant weekly-hours aggregate cap, LOW — arguably realistic crunch) and #37 (function tags all G&A — conditional on the functional cut being built) also deferred.

Full ranked findings + verdicts: the `confirm-dataset` workflow output (run `wf_7a7d8b01-bab`); `project-status-review.md` §2 had the original 5.

### State (2026-06-20 · validation review + full read-only build-out) — GREEN  ·  _prior context_

**Gates (all green; re-run to confirm):** `tsc` 0 · `lint` 0 · data-sweep **43/43** · scout-readiness **34/34** · scenario-check **13/13** · scout-eval (structural **15 tools** · deterministic 13 · LLM **33/33**) · `next build` **39/39 static pages**. NOTE: `tsc`/`lint` OOM at the default heap on this machine — use `NODE_OPTIONS=--max-old-space-size=4096`. (Clean `next build` still needs the dev server stopped, per the OneDrive note below.)

**THE APP NOW HAS NO PLACEHOLDERS (Chris directive).** Every nav surface is a real **read-only** page on tying-out data; only `app/setup/data-import/page.tsx` is still a stub and it is **hidden from the nav** (gated on the importer). Built this session:
- **Phase 1** — 8 live-query stub pages → read-only: Revenue Forecast, AR Forecast, Projects, Staff, Account Mapping, Pipeline, Renewals, Settings.
- **Phase 2** — the missing read-side queries from the seed (`getCostOfRevenue`/`getPersonnelForecast`/`getExpenseForecast`/`getFixedAssetForecast`/`getPrepaidsForecast` + `getBoardPackage` + `getNrr`), then the 6 driver pages + Board Package.
- **Phase 3** — the deterministic **Scenarios engine** (`lib/scenario/*` + `lib/queries/scenarios.ts`) + 3 seeded presets (25% Profit / Capacity / Breakeven) + the 4 Scenario surfaces. `assertBaseInvariant`: Base reproduces the real P&L exactly. Pure/deterministic; in-memory registry (Supabase-swappable). `scripts/scenario-check.ts` (13/13) is the gate.
- All read-only; **editing/persistence waits for the Supabase write path.**

**Decisions locked this session (Chris):**
- **NO PLUGS** — reconciliation is **fix-upstream-only**; an unresolved detail-vs-TB gap shows a blocking "needs attention" flag, never force-balanced. (Updated in CLAUDE.md §17 + §4, `import-templates/README.md`, the new-period guide.)
- **NO PLACEHOLDERS**; build all non-gated read-only (single company; editing → Supabase).
- **Access model (DESIGN, not built — the next chapter):** single company; **anonymous visitors get open read + a session-persistent SANDBOX** (browser-side overlay = the delta-off-immutable-base pattern) so they can fully explore incl. Scout writes WITHOUT touching the live DB; authenticated **roles gate live writes**; an **admin-editable capability matrix** per (role × action) → **Denied / Sandbox / Live**; enforce server-side + RLS; stay FAST (cached/static shared reads + client-side overlay + pure-TS engine); rate-limit anonymous Scout. Prereq = the Supabase swap.

**Validation review done** (artifacts: `project-status-review.md`, `scout-question-bank.md` + `.csv`, `scout-live-results.json`, `scripts/scout-live-sample.ts`):
- **Scout tested on 1,181 questions** (48% now / 33% gap / 11% decline / 9% ambiguous) + an 89-q live sample (NOW ~39/40, gaps/declines graceful, ambiguous routes right). Fixed: MRR→`getMetric(arr_mrr)`, the what-if guard, the churned-ARR guard (Contracts + Scout), pipeline owners from the Staff roster. **Scout now READS the guides** (`getProductMap`/`describeModule` wired → 15 wired tools).
- **Still open — Phase 4 (Scout tool wiring for the NEW pages):** drivers/pipeline/renewals/projects/staff/board/scenarios have no Scout tools yet, so the ~389-question gap backlog stays open until wired. All reads, no auth dependency — safe to do anytime.
- **New user guides** authored + app-styled HTML renders: `creating-a-flux-analysis`(.md/.html), `budget-and-scenarios`(.md/.html), `setting-up-a-new-period`(.md/.html); flux design spec `flux-analysis.md` + diagram `diagrams/flux-notes-model.svg`. Guide caveats reconciled to what shipped (view-now / edit-with-write-path).

### ▶ NEXT SESSION: SUPABASE — the dataset is CONFIRMED + freeze-ready (start here)

**Where we are.** The seed is done and validated. All gates green (data-sweep 43/43 · scout-readiness 34/34 · scenario-check 13/13 · scout-eval PASS · tsc/lint 0 · build 39/39); it ties out by construction and was hardened this session to survive a Series-B CFO drill-down (data-credibility audit + exec-comp re-baseline + attrition + eng-org fix — see the State block above). A final **18-check cross-variable sweep** re-derived salaries→payroll→GL→NI, sub-ledgers→drivers, and contracts→revenue→deferred — all tie to the dollar. §11 at locked: revenue $23.4M, NI −$11.9M, NRR 109%, magic 1.2x, runway 49mo. **The dataset is frozen-ready; next step is standing up the backend.**

**The ONLY prerequisite — a Supabase project.** Create one at supabase.com (or reuse), then put the keys in `.env.local` (gitignored; already holds `ANTHROPIC_API_KEY`):
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>   # server-only; never expose to the client
```

**Build order (full plan + setup in `supabase/README.md`):**
1. **Apply the schema** — `supabase/migrations/0001_init.sql` is written (base tables + the write tables `flux_notes`/`scenarios`/`scenario_inputs`/`budget_snapshots`; single-tenant). `supabase db push`, or paste into the SQL editor.
2. **Seed loader** — build `scripts/seed-supabase.ts`: run the generator, upsert every base record + derived series into Supabase, idempotent on the stable app ids (e.g. `VB-2026-05-1330`, `staff-engineering-3`).
3. **SupabaseDataStore** — build `lib/datastore/supabase.ts` implementing the `DataStore` interface (record reads = `select`; statements/metrics = the EXISTING TS builders over the read series — the math is unchanged, only storage moves). Wire `getDataStore()` to pick it when `SUPABASE_URL` is set, else fall back to InMemory so the app always runs.
4. **Verify the swap** — re-run all gates against `SupabaseDataStore`; the statements/metrics must compute identically to InMemory (seed loads once; builders unchanged).
5. **CSV importer** — parse → validate → reconcile detail-vs-TB (**fix-upstream, NO plugs**) → flag. Templates in `import-templates/`.
6. **Global as-of control** — centralize the ~14-site `closeThrough` constant + a Settings toggle (today `PLACEHOLDER_SETTINGS.closeThrough = May 2026`, hardcoded in ~12 builder/page sites + the new `listStaff`/`listCustomers` as-of filters added this session). Prereq for the importer + roll-forward.
7. **Write paths** — flux notes first (the Expense-Transactions drill UI is built), then scenarios + budget lock + the override layer, then the **capability-matrix + anonymous-sandbox access model** (the access-model design in the State block above / CLAUDE.md §17).

**Parallel / not blocking Supabase:** align the six in-app guides (`lib/guides/content.ts`) + the 3 detailed root `.md` guides with the built surfaces + the now-final seed; graduate detailed guides into `content.ts`. Refresh CLAUDE.md §0/§8 build-status.

**Deferred seed items (captured — low value, don't re-flag):** sales-manager-vs-VP-Product nit (OTE-defensible), #22 founder hire-date spread (penny CF↔BS rounding), small franchise tax (#39/#42, $0 defensible under NOLs), #37 function tags / #31 consultant-week cap (LOW), forecast-month sub-ledger cut (bundle with #6 global as-of), GL close-to-equity / monthly-summary GL / thin COA (by design per §16 — the close is the ERP's job). Full audit trail: the `confirm-dataset` workflow output + `project-status-review.md`.

---

### State (2026-06-20, earlier — pre-build-out) — GREEN  ·  _prior context_

Re-run these first to confirm:
- `npx tsx scripts/data-sweep.ts` → 43/43 (seed ties out; includes AR + AP sub-ledger foot to BS, CF↔BS cash, monthly↔FY, Account-Mapping totality, dashboard↔P&L)
- `npx tsx scripts/scout-readiness.ts` → 34/34 (was 26; +4 getCustomers/getCustomer, +2 getMonthlyPnL, +2 getBookingsHistory)
- `npx tsx scripts/scout-eval.ts` → routing gate; structural+deterministic always run (free), LLM layer (now **28 cases**) runs only with `ANTHROPIC_API_KEY`, metered/on-demand. Last full run: structural 13/13 · deterministic 9/9 · LLM routing 28/28 (100%).
- `npx tsc --noEmit` clean · `npm run lint` clean (0) · `npm run build` exit 0 (clean build needs the dev server STOPPED + `rm -rf .next` first — they share `.next` and a concurrent dev server corrupts the webpack build; see the §OneDrive note)

**PROJECT POSTURE CHANGED `[2026-06-20, Chris]`:** this is **no longer a throwaway demo** — it's a **single-client production prototype** a CFO maintains and works out of **daily**, **fully on Supabase**. Supabase moves from deferred → **active** (CLAUDE.md §3 updated). The `DataStore` "Swap Don't Rewrite" seam (§4) makes this clean: `InMemoryDataStore` → `SupabaseDataStore`, one file; the TS statement/metric builders keep computing, now over Supabase data. **Started:** `supabase/migrations/0001_init.sql` (full schema, single-tenant, incl. the write tables `flux_notes`/`scenarios`/`budget_snapshots`) + `supabase/README.md` (staged plan + setup). **Auth DECIDED:** trusted single-tenant (no login; server-side service-role behind a private/Vercel-gated deploy; permissive/no RLS). **Supabase setup PAUSED by Chris (2026-06-20):** before standing up the backend he wants to **validate functionality / processes / usability against the data + schema**, do **more testing**, understand the **how-to user guides**, and see **diagrams of information flow + how the functionality works**. So: confirm the product is right first (cheap to change pre-Supabase), THEN seed/swap. **Next chunk (after validation + a project):** `scripts/seed-supabase.ts` (generator → upsert), `lib/datastore/supabase.ts` (the SupabaseDataStore), the `getDataStore()` env switch, then the flux-notes write path. Statements stay computed in TS over the stored records + series (the `monthly_series` / `revrec_*` tables exist for this).

Harness (stage B) is COMPLETE; the Run is well underway. FY26 financial shape (LOCKED): revenue $23.4M, growth 61%, NRR 109% (i-12 cohort), GM 71%, magic 1.2x, LTV:CAC 4.3x, Rule of 40 25%, burn multiple 0.6x, runway 49mo, NI -$12.1M (-52% GAAP / -32% non-GAAP / -15% FCF), Series B $20M, 140 heads. (NRR/magic/CAC/LTV moved from the 2026-06-20 unit-econ formula tightening — cohort NRR + quarter-lagged S&M; see below.)

**Current data inventory (2026-06-20, re-swept):** Customers 155 (141 active · 14 churned) · Contracts 155 · Acquisitions 129 (+26 pre-existing base) · Projects 88 (70 complete · 18 in-progress) · Staff 140 · GL accounts 28 · Journal entries 500 / 1,324 lines · Sub-ledger 11,479 txns (vendor bills 1,712 · paychecks 5,852 · timesheets 2,310 / 40,700 hrs · customer invoices 825 · **cash receipts 780**) · P&L lines 23 · BS lines 11 · CF lines 12 · Dashboard tiles 19 · **Pipeline 46 opps** · **Renewals 165** (111 forward "open" + history). (The old "~14k txns / 3,462 receipts / 149 customers / 25 accounts" baseline in the reference section is SUPERSEDED — the receipt drop is the intended annual-prepay lump-collection model, not drift.)

**2026-06-20 progress-review (4-agent) outcome + decisions locked (Chris):**
- **firm_id → single-tenant, documented plan.** It's demo-only; no other firm will use it, so threading `firmId` through every record/seed/query buys the demo nothing. The clean swap seam already exists: firm scoping (+ Supabase RLS) attaches at the **DataStore boundary**, not by baking `firm_id` into 14k seed rows. If multi-tenancy ever mattered, add an optional tenant scope to the DataStore read methods + RLS at the Supabase layer; records need no change for the demo. Handoff open-decision #1 RESOLVED.
- **Metric fixes → TIGHTEN the formulas (Chris's call, was relabel-only).** Done: NRR → true i-12 cohort (was whole-book TTM) → **111%→109%**; magic + CAC → one-quarter S&M lag (textbook "spend precedes bookings") → magic **1.1x→1.2x**, CAC/logo **$143K→$129K**, LTV:CAC **3.9x→4.3x** (healthy band). All `METRIC_CATALOG` basis strings reconciled to match. Gates stayed green (these SaaS metrics aren't in the statement tie-out chain, so nothing reconciled moved). §11 + this doc updated with the new locked values.
- **Next push → the Contracts vertical + Scout loop** (record → query → first wired Scout tool → guide). Chris's pick. **DONE this session** — Contracts register + Scout loop (live, both lanes) + routing gate + seed-texture pre-pass all shipped (below). Next session = the register fan-out (§ Next steps #1).

**DONE this session — Customers vertical + Scout live commentary + nav scrollbar (gates green throughout: data-sweep 43/43, scout-readiness 30/30, tsc+lint clean, prod build exit 0, scout-eval structural 11/11 · deterministic 7/7 · LLM routing 24/24):**
- **Customers register shipped** (`app/sales/customers/page.tsx`, replacing the placeholder) — the 2nd Run module, per the proven recipe. New `components/sales/customers-table.tsx` (register: customer · segment · since · ARR · % of book · status; All/Active/Churned chips) + `customer-cards.tsx` (3 derived cards: Book of business, By segment, Acquisition cohorts). Reads live `listCustomers`. Browser-verified: 155 rows, cards tie out (run-rate ARR $24.8M = Σ active = exit ARR; segments starter 84 / growth 49 / scale 8; cohorts 26 base +33 +45 +51 = 155).
- **Scout `getCustomers` + `getCustomer` wired** (registry `TOOL_THUNKS` + `SCOUT_REGISTRY` `wired:true`, impls in `lib/scout/tools.ts`). Sibling-naming descriptions steer the boundaries (ARR/MRR *value* + any RATE → `getMetric`; agreements/bookings/RPO → `getContracts`). Eval cases added incl. the getCustomers↔getContracts steal (both directions) + the metric/register boundary (accounts → getCustomers; churn RATE → getMetric `logo_retention`).
- **Adversarial review (saved-pattern workflow, 3 dims → verify; 16 candidates → 11 confirmed) folded in:**
  - **[HIGH] ARR labeling reframe.** The register's Σ-active ARR is the **Dec exit run-rate ($24.8M)**, not a June point-in-time — it conflicted with the Dashboard's $18.1M June ARR tile under a shared "as of June 2026" stamp. Fix: dropped the June stamp (card kicker "Book of business · run-rate"; header "FY2026 · run-rate book"; table summary "run-rate ARR"), removed the inert `period` prop from `CustomerCards`, and added an on-card note pointing to the Dashboard's point-in-time June balance. (NOTE: the **Contracts** register has the same latent "active ARR = exit run-rate" framing on its table summary — lower exposure, no period-stamped kicker; consider the same relabel when convenient.)
  - **[MED] `getCustomers` period arg was a no-op** → dropped it from the schema; renamed the field `runRateArr` + added a `basis` string so Scout never quotes it as the June value.
  - **[MED] Churned ARR** → table + `getCustomer` now show "—" for churned rows (was the stale pre-churn ARR next to a "churned" badge; now consistent with the "% of book" column).
  - **[LOW×3] Deterministic router hardening** (`lib/scout/router.ts`): added a `logo_retention` route (before nrr/customers) so "logo retention"/"churn rate" hit the rate metric; moved the customers route before arr/mrr (so "ARR by segment" → register, bare "ARR" → metric) and switched bare `churn`→`churned`; added the matching DET eval cases. Also added "logo retention / churn rate" + "use this for any RATE" to `getMetric`'s description (fixed the one LLM-routing miss → 24/24).
- **Scout: live dog-pun calculation commentary (replaces "Reading the spine…").** `/api/scout` now **streams NDJSON** — one `{type:"step"}` per tool call as it fires, then `{type:"final"}`. `runScout(messages, onStep?)` threads the callback (agent + deterministic router both emit); new `lib/scout/commentary.ts` `stepLabel(tool,args)` returns playful, calculation-describing lines with dog puns ("Sniffing out Gross margin %…", "Herding the contracts…", "Chasing down the cash flow…"; metric names come from `METRIC_CATALOG`). `components/scout/scout-panel.tsx` reads the stream and renders the steps live with a `PawPrint` icon (active step pulses ember, done steps sage), then lands the answer + receipts. Browser-verified live (key set): multi-tool query streams 3 named steps then the grounded answer; no console errors. Non-streaming callers (the eval) just omit `onStep`.
- **Nav scrollbar de-emphasized** (`app/globals.css` `.nav-scrollbar` + the class on the sidebar `<nav>`): transparent track (blends with the Midnight rail), muted thumb `#243348` (a lighter shade of the bg), `scrollbar-width: thin`. Verified computed `scrollbar-color: rgb(36,51,72) transparent`.
- **Scout monthly-P&L bug FIXED (Chris flagged "Scout has a problem with monthly questions").** Root cause: `getPnL(period)` returns the FISCAL-YEAR P&L for the period's year, so Scout calling it for each month got identical FY totals ("all 12 calls returned the same full-year actuals"). The monthly data already existed via `getMonthlyPnL` (the `?view=monthly` board view) — it just wasn't a Scout tool. Wired **`getMonthlyPnL`** (registry `TOOL_THUNKS` + binding `wired:true`, impl in `tools.ts` shaping per-month revenue/GP/OI/NI, receipt → `/statements/pnl?view=monthly`), tightened `getPnL`'s description to say it's annual + steer monthly/"which month" questions to `getMonthlyPnL`, added a system-prompt note + deterministic-router monthly route + eval cases (LLM 26/26). **Live-verified:** "most profitable month in 2025?" → 1× `getMonthlyPnL` → "November 2025 biggest revenue ($1.5M) + least-negative NI (−$598K); December bonus-month dip to −$1.4M OI" (matches the seed). Was: "I can't determine it."
- **Scout bookings-YoY tool shipped (Chris's Option A, see resolved decision #0).** New `getBookingsHistory(period)` query + Scout tool gives the trailing-12-month + fiscal-year bookings windows (current vs prior) so YoY is compared on a window basis, not a lumpy single month. Live-verified: "bookings at this point last year vs this year?" → net ΔARR **+29% YoY** (TTM, expansion ~5×), the true growth story (was a misleading single-month −30%).
- **Data export + schema + Expense Transactions register (Chris, for Excel analysis + the flux drill).** (a) `scripts/export-data.ts` → **`data-export/` (20 CSVs, 18,594 rows)** dumping ALL seeded data at lowest-level detail: every sub-ledger txn (vendor bills 1,712 · paychecks 5,852 · timesheets 2,310 · invoices 825 · receipts 780), **revenue recognition per contract (`revrec_by_contract` 2,881) and per project (`revrec_by_project` 325)**, GL + monthly activity, `driver_series_monthly` master pivot, `pnl_monthly` (all FYs), dashboard metrics, all layer-1 records. Re-run: `npx tsx scripts/export-data.ts`. (b) **Schema:** `data-export/SCHEMA.md` (data dictionary + Mermaid ERD) + `schema.dbml` (root, for dbdiagram.io) — base vs derived tables, all FKs, the planned write tables (flux_notes/scenarios/budget_snapshots). (c) **Expense Transactions register BUILT** (`app/reporting/expense-transactions/page.tsx` + `components/reporting/expense-table.tsx`, replacing the placeholder) — reads the live `listExpenseTransactions`; by-group composition cards + a doc#/date/vendor/group/function/amount/status table, group filter chips, default last-closed month (May 2026). Browser-verified: 46 May bills, $1.1M, filter ?group=sales-marketing → the 5 S&M bills (the flux drill: P&L line → composing expenses). The stable `id` per row is the flux-note anchor. tsc/lint clean, data-sweep 43/43, scout-readiness 34/34, build exit 0.

**DONE this session (gates green throughout: data-sweep 43/43, scout-readiness 22/22→26/26, tsc+lint clean, prod build exit 0):**
- **Forwarded the Sales + Reporting layer-1 query stubs to the DataStore** — closed the "one source, two callers" disconnect the review flagged P0. Now LIVE (were `notImplemented`): `listContracts`/`getContract`, `listCustomers`/`getCustomer`, `getArr`, `listRenewals`, `listPipeline` (+ stage/rep filter), `getBookings` in `sales.ts`; `listProjects`/`getProject`, `listStaff`, `listExpenseTransactions`, `getUtilization`, `getHeadcount` (by-dept FTE roll-up) in `reporting.ts`. Still composed-work: `getNrr`, `getGrr`, `getPipelineCoverage`.
- **Tightened the unit-econ formulas** (cohort NRR + quarter-lagged S&M) + reconciled all metric basis strings — see the decisions block + §11/§17. New values: NRR 109%, magic 1.2x, CAC $129K, LTV:CAC 4.3x.
- **Built the Contracts register surface** (`app/sales/contracts/page.tsx` — the first real module of the Run, replacing the placeholder). Reads live queries: the register table (155 contracts, sortable by ARR, status filter chips, status/booking badges, active-ARR summary) + three §8 cards — Bookings (ΔARR new/expansion/contraction), the Deferred-revenue waterfall (opening + billings − recognized = closing), and the Contracted-revenue/RPO bridge. New: `components/sales/contracts-table.tsx`, `components/sales/contract-cards.tsx`; `monthLabel` helper in `period.ts`. **Browser-verified** (preview): 155 rows render, cards show real tying-out values (Bookings net +$471K · Deferred closing $7.9M === RPO contracted-forward $7.9M), status filter works (churned → 14 rows), no console errors.
- **Built the Scout agent loop — the AI differentiator is now live (was 100% scaffold).** New `lib/scout/`: `config.ts` (`SCOUT_MODEL = claude-sonnet-4-6`, system prompt with the in-context product map for the product-knowledge lane), `tools.ts` (one impl per wired registry tool — Anthropic input schema + a `run` that calls the live query and returns a display-shaped result + a click-through RECEIPT; fails loud if a wired data tool lacks an impl), `router.ts` (the deterministic keyword fallback), `agent.ts` (the loop), `types.ts`. New route `app/api/scout/route.ts` (nodejs). `components/scout/scout-panel.tsx` rewritten: composer enabled, thread state, POSTs `/api/scout`, renders answers + **receipt chips that link to the surface** + a deterministic-mode note. Installed `@anthropic-ai/sdk`.
  - **Key-optional by design:** real Anthropic tool-use loop (manual loop, receipt per call) when `ANTHROPIC_API_KEY` is set; a deterministic intent-router fallback otherwise — so the whole surface is verifiable today and auto-upgrades to conversational Scout the moment a key lands.
  - **Registry wired:** `listContracts`/`getContract` added to `TOOL_THUNKS`; 2 new Sales tools declared (`getContracts`, `getContract`); flipped `wired:true` on 9 tools (getDashboard, explainTile, getMetric, getPnL, explainVariance, getBalanceSheet, getCashFlow, getContracts, getContract).
  - **Browser-verified (deterministic mode, no key set):** "What's our runway?" → "Runway is 49 mo (cash ÷ net burn)" + a getMetric→/dashboard receipt; "How many contracts?" → "155 contracts (141 active, 14 churned)…" + getContracts→/sales/contracts; P&L question → net income −$12.1M + getPnL→/statements/pnl; receipts render as clickable chips; no console errors. The metric basis strings Scout quotes are the tightened ones (e.g. magic "…lagged 1 quarter").
- **LIVE loop VERIFIED (2026-06-20):** `ANTHROPIC_API_KEY` added to `.env.local` (gitignored); dev server restarted. Smoke-tested both lanes with the real Sonnet 4.6 loop — DATA lane: "NRR and magic number?" → 2× `getMetric` (nrr+magic), grounded answer (NRR 109% / magic 1.2x, explanation reflects the COHORT basis), 2 receipts, mode `live`; PRODUCT-KNOWLEDGE lane: "what does the Contracts page do / where's runway?" → answered from the in-context product map, NO tool call, mode `live`. No console errors. The multi-tool + how-to answers the deterministic fallback can't do now work.
- **Routing gate BUILT (`scripts/scout-eval.ts`):** two layers — (1) STRUCTURAL (free, CI-safe): every wired data tool is backed by a live query + has an impl + a well-formed schema + a usable receipt; (1b) deterministic-router smoke; (2) LLM ROUTING (metered, runs only with a key): 17 curated `question → expected tool` cases, weighted to the overlap pairs the fan-out will create (deferred → contracts/BS, runway → metric/cashflow, gross margin → metric/P&L) + multi-tool + product-knowledge (no-tool) cases; threshold-scored (≥85%). **First run: structural 9/9 · deterministic 4/4 · LLM routing 17/17 (100%).** Run on-demand (`npx tsx scripts/scout-eval.ts`) when the tool surface changes — it's metered + non-deterministic, so not a per-push gate (the structural layer is the free CI half).
- **Seed-texture pre-pass (DONE) — the register fan-out can now render real data on day one.** All additive + tie-out-neutral (data-sweep still 43/43):
  - **Pipeline** (`lib/seed/pipeline.ts`, net-new): 46 open opps, funnel-weighted stages, 85/15 sub/services, tier-sized ARR, 6 reps, H2-2026 closes. The DataStore's `listPipeline` now serves them (was `[]`).
  - **Renewals** (`lib/seed/renewals.ts`, derived from the contracts): 165 — 111 forward "open" + recent history (renewed/expanded/contracted/churned; churned only on churned contracts). `listRenewals(window?)` now serves + filters them (was `[]`).
  - **Staff names** (`names.ts`): pools widened 24×24 → **40×41 (coprime)** + combiner on independent moduli → 140 staff, **0 name collisions, longest same-surname run 1** (was 24). RNG-stable, financials untouched.
- **NEXT for Scout (after the registers):** ~~stream the response into the panel~~ DONE (2026-06-20 continued — NDJSON step stream + live dog-pun commentary, see the DONE block at the top). Remaining: stream the final TEXT token-by-token too (today the steps stream but the answer text lands in one shot); deepen the product-knowledge lane from `lib/guides/content.ts` (the system prompt holds a compact nav map today — wire `searchGuides` only if the corpus outgrows context).

### What's built (the Run so far)

- **All three statements on the spine, tying out:** Forecasted P&L (FY columns + a `?view=monthly` board view with the 8-group expense breakout + a KPI footer), Balance Sheet, Cash Flow Forecast (indirect, runway strip), all with `?inspect=` peek panes. SBC (ASC 718) add-back fixed so CF net change ties to the BS cash line.
- **Dashboard + 19 metric tiles**, tying to the P&L by construction (a data-sweep guard enforces it).
- **The seed** (drivers -> JEs -> GL -> statements) ties out by construction; GL reference impl + a ~14k-row transaction sub-ledger. The **AR/AP sub-ledger now FOOTS to the BS** via a global oldest-first LUMP collection model: the AR aging concentrates in current/1-30 dpd (no 90+ wall, no penny-receipt tail); opening AR $520K + AP $300K are represented. AP foot honestly labeled `kind: "definitional"`.
- **Principle-5 seam:** every `lib/queries` read routes through `getDataStore()` (no `lib/seed` import in the spine) -> the Supabase swap is a one-file change.
- **Account Mapping seam validated** (P0 #4): `StatementLineId` typed `PnLLineId | BalanceSheetLineId` (a typo is a compile error), `acctForLine` fails loud (no silent `6600` fallback), a totality check proves the map.
- **Sales/Reporting registers BUILT (3):** Contracts (`app/sales/contracts`), Customers (`app/sales/customers`), Expense Transactions (`app/reporting/expense-transactions` — the Flux drill target: by-group cards + a doc#/date/vendor/amount/status table, group filter, stable txn id per row). All read live layer-1 queries.
- **Scout is LIVE (in-app only, no Slack), now STREAMING:** the floating panel streams NDJSON — one step per tool call with on-brand dog-pun commentary (`lib/scout/commentary.ts`) + a click-through receipt — then the grounded answer. **18 data tools wired** (20 incl. the 2 product-knowledge guide tools; `wired:true`) against the type-safe two-lane registry (`lib/queries/registry.ts`) — now covering every shipped layer-1 register (Contracts · Customers · Renewals · Pipeline · Projects · Staff · Expense Transactions) plus the statements/dashboard/metrics/bookings lanes; the deterministic keyword-router fallback keeps it demoable with no key. `Scout-Context.md` is the briefing doc.
- **The six User Guides** drafted (`lib/guides/content.ts`, rendered at `/setup/guides/[slug]`) -- also the single source Scout's product-knowledge lane reads.

### Next steps (prioritized)

**1. ▶ CURRENT STATE — a functionality / usability VALIDATION pass (Chris), before standing up Supabase.** Chris is validating processes + usability against the data + schema first (this session: the info-flow / five-layer / period-update / data-integration / Salesforce-mapping diagrams + a deep "updating a new period" walkthrough). The architecture, data, and schema are stable and tying out; changes are CHEAP now, expensive once the backend is live. The models are captured in open-decisions **0b/0c/0d** (period/import, flux, data-integration).

**Next BUILD priorities (when Chris greenlights):**
   - **A · Supabase — the posture is now a single-client production prototype (§3/§4).** Order: seed-loader (`scripts/seed-supabase.ts`) → `SupabaseDataStore` + the `getDataStore()` env switch → the CSV importer (parse → validate → **reconcile** detail-vs-TB → flag) → the **global as-of control** (today `closeThrough` is a constant in ~12 sites) → the **flux-notes write path** + the note UI. Schema is `supabase/migrations/0001_init.sql`; auth = trusted single-tenant; blocked only on a Supabase project (URL + anon + service_role keys → `.env.local`). See 0b/0c/0d.
   - **B · the remaining registers** (Pipeline, Renewals, Projects, Staff) via the proven recipe below, then the Forecast driver surfaces, the Scenarios engine, and Board Package.

DONE already (don't redo): the **Contracts**, **Customers**, AND **Expense Transactions** registers (`app/sales/contracts` · `app/sales/customers` · `app/reporting/expense-transactions`, + their queries + Scout tools), the **Scout agent loop** (live, **streaming dog-pun step commentary**, receipts, **13 wired tools** incl. `getMonthlyPnL` / `getBookingsHistory` / `getCustomers` / `getCustomer`), the **routing gate** (`scout-eval.ts`, **28** LLM cases), and the **seed-texture pre-pass** (Pipeline 46 + Renewals 165 records + widened staff names). The record→query→tool→guide pattern is proven; repeat it across the remaining surfaces.

**The per-register recipe** (Scout Follows Modules — a tool ships WITH its register, never ahead):
   1. Build the register surface (model it on `app/sales/contracts/page.tsx` + `components/sales/`). Reads its layer-1 query (all now forwarded to the DataStore — see the forwarded list above).
   2. Declare its Scout tool(s) in `lib/queries/registry.ts` (add to `TOOL_THUNKS` if a new live query backs it; `wired:true`), add an impl in `lib/scout/tools.ts` (input schema + `run` → display shape + receipt).
   3. Add its overlap cases to `scripts/scout-eval.ts` and re-run the LLM layer (catches a new tool stealing routing from a sibling).
   4. Refine the relevant guide in `lib/guides/content.ts` alongside.

**Suggested order:** **Renewals next** — the retention sibling of the now-shipped Customers register; its Scout tools (`getNrr`/`getGrr`) are still **composed-work** (not just DataStore forwards — compute the i-12 cohort NRR / GRR, reusing the `dashboard-metrics.ts` logic), and the metric/register boundary is already eval-guarded (churn RATE → `getMetric logo_retention`; churned LOGOS → the register). Then **Pipeline** (`getPipelineCoverage` is light composed-work; 46 opps seeded), then Projects, Staff, Expense Transactions (Reporting). Records available now: Renewals 165, Pipeline 46, Projects 88, Staff 140, Expense txns (vendor bills). Watch the **ARR-labeling lesson from Customers**: the layer-1 records are an end-of-sim (Dec-2026 exit) snapshot, so any "active ARR / book" total is the **run-rate**, NOT the period point-in-time — label it run-rate and don't stamp it with the current month (the Contracts table summary still carries this latent framing; relabel when convenient).

**2. The rest of the Run:** Metrics drill-downs (tiles -> component lines); Account Mapping UI (the typed seam is done); the remaining driver surfaces (Revenue Forecast, Cost of Revenue, Personnel, Expense Forecast, AR/Fixed-Asset/Prepaids); the Scenarios engine (against `lib/types/scenario.ts`) + the 4 Scenario surfaces; the **Scout agent loop + tools per module**; Board Package (`getBoardPackage` is a stub).

**3. Scout Run plan** (from the reliability + integration-checklist docs): default model **Claude Sonnet 4.6** behind a `SCOUT_MODEL` constant; build **receipts** (tool+args chip, click-through to the surface) into the loop on day one; add `scripts/scout-eval.ts` (a `question -> expected tool` routing gate) in CI beside scout-readiness; decide the `getPnL` **baseline arg** (Base vs Budget) before freezing that tool's schema; route Scout down the **sub-ledger** path (the GL is monthly-summary). The four unblockers: type the registry (done), expose getMetric (done), the routing eval, receipts + model-config.

### Open decisions for Chris
0. ~~**Bookings lumpiness / monthly realism**~~ **RESOLVED 2026-06-20 (Chris chose Option A — annual/TTM bookings tool; no seed change).** Chris asked why "last year had more bookings than this year" (Scout had said Jun 2025 net ΔARR $677K vs Jun 2026 $471K, −30%). Root cause: Scout compared a single LUMPY month. The data is healthy in aggregate (TTM net +28% / gross +31% YoY; FY net +83%; ARR +64%→+72%). **Fix shipped:** new query `getBookingsHistory(period)` (`lib/queries/sales.ts`) → fiscal-year + trailing-12-month bookings (new/expansion/contraction/gross/net), current vs prior; reads the same bookings ledger whose cumulative net === ARR, so it reconciles by construction. Wired as Scout tool `getBookingsHistory` (registry + impl + router route + commentary + 3 eval cases + system-prompt note steering YoY questions here, away from single-month getContracts). **Live-verified:** "bookings at this point last year vs this year?" → 1× `getBookingsHistory` → "Net ΔARR +29% YoY ($5.5M→$7.1M TTM), driven by expansion ~5×" (was the misleading −30%). **Still NOT done (deferred, no longer blocking):** the Jan-2024 $4.3M opening-base dump (shown as Jan-2024 "new business") and the monthly spikiness — Option B (seed re-baseline) was not chosen; the TTM/FY windows for the current period avoid the FY2024 base dump anyway.
0b. **Period management + ERP import (design started 2026-06-20).** Chris wants a **GLOBAL as-of date** for ALL reporting (one app-wide close boundary, not a per-report override). Today the boundary is a fixed constant (`PLACEHOLDER_SETTINGS.closeThrough = May 2026`) read in ~2 builder files + hardcoded `month(2026,6)` in ~10 page/Scout/dev sites — making it user-movable needs (a) routing the split through `getSettings()` (statements.ts reads the constant directly), (b) one source of truth for "current period", (c) a Settings control; bounded by the 36-month seed (no data past Dec 2026). Import model + CSV templates drafted in **`import-templates/`** (README = the flow: new-month import advances the global as-of; prior-month re-import is idempotent-overwrite + re-rolls forward; reopen = move the as-of back). 11 templates; `chart_of_accounts.csv` is the real 28-account COA/Account-Mapping, `trial_balance.csv` is Bearing's **real, penny-balancing May-2026 TB** ($59,567,335.23 each side, ties to the GL; fixed an off-by-one that had this dated-May file holding June's index), and `expense_transactions.csv` is real Bearing May-2026 AP detail (stable `transaction_id`s; Σ per account-month === the GL activity → reconciles to the TB). **Not built:** the importer + the global-as-of control (next builds).
0c. **Flux Analysis + per-transaction notes (NEW scope, flagged by Chris 2026-06-20).** Chris wants a Flux/variance review where a reviewer adds **notes to expenses, saved per transaction**. Design captured in `import-templates/README.md` ("Transaction detail & Flux Analysis"): transaction detail ALREADY exists (`VendorBill extends ExpenseTransaction`, served by `listExpenseTransactions`, with stable `id`/`docNumber`/date/vendor/account/amount/status — the realism pass). The note key is the **stable `transaction_id`** (survives re-import/restatement); notes are the **first WRITE store** — a `flux_notes` table FK'd to the txn id, same pattern as `scenario_inputs` (delta off immutable Base), NOT an edit to actuals; snapshot `amount_at_note` so restatement shows flux-on-the-flux; orphan-flag if a re-import drops the txn; one-source-two-callers so Scout can narrate variance from the notes. **Scope flag (now reflected in the spec):** CLAUDE.md §16 now lists **Flux Analysis IN scope** (distinct from plain variance) + §17 carries the 2026-06-20 decided-block. The flux **write store + note UI are still NOT built** (only the Expense Transactions drill target is) — they land with Supabase. **Built 2026-06-20:** the GL→transaction **drill UI** — the Expense Transactions register (`app/reporting/expense-transactions`) renders the AP detail with group filtering (the flux drill target). **Still not built:** the `flux_notes` write store + the note UI on the statement lines + Scout reading notes (the write-path piece; needs the persistence decision — InMemory mutable map now, Supabase table later).
  - **DESIGN now fully spec'd `[2026-06-20, Chris confirmed]` → `flux-analysis.md` (root) + `diagrams/flux-notes-model.svg`.** It is the user-guide prose (ready as guide #7) AND the build spec. Decisions Chris locked this session, beyond the original txn-only note: (1) **three anchor grains**, all rolling up to `statement_line` for display — `transaction_id` (sub-ledger), **`(account_code, period)`** (the trial-balance account note "without drilling to a bill" — needs a NEW `account_code` column), and `(statement_line, period)` (multi-account lines + pure computed metrics with no account/txn). (2) **One right-hand card, three ways in** — the existing `?inspect=` peek pane (summary line), the TB / Account Mapping view (account), and a new right-hand drawer on the Expense register (transaction); shared `FluxNoteEditor`/`FluxNoteList`. (3) **Notes are a comment thread** (many per anchor), each carrying **`author` = the user** + **`source` = ui | scout** (the user-attribution ask). (4) **Scout reads AND writes** — `getFluxNotes` (narrate) + **`addFluxNote`** (Scout's first write: "for account 6200, add a note…" → resolves the anchor, `author` = the user, `source` = scout, write-receipt + Undo; never edits others' comments). Schema delta in the doc: make `transaction_id` nullable, add `account_code` + `source`, anchor check, swap the singleton indexes for plain anchor indexes. Build order when greenlit: schema delta → shared note components + the 3 card surfaces → `getFluxNotes`/`addFluxNote` + eval cases. Open (non-blocking): write-then-undo vs pre-confirm for Scout writes; multi-account-line note default.
0d. **Data-integration model `[DECIDED 2026-06-20, Chris — refines §4/§16]`.** Two architecture Qs answered: (1) **Statements are TRIAL-BALANCE-driven; transaction detail rides alongside and reconciles UP to the TB (the back-check, not the driver).** The ERP's TB is authoritative (it already summed + adjusted/accrued); Dogfood reads the clean close, never re-sums a line-item feed into the P&L. `Σ(detail per account-month) === the TB account movement`; a gap surfaces as "uncategorized / detail incomplete" (the ERP booked something the feed misses), never silently changes a statement. Matches the seed (statements = view of the monthly-summary GL; sub-ledger = parallel reconciling layer). Drill-to-txn is for explanation, not derivation. (2) **Every domain batch-imports from its system of record, upsert on stable id (no re-keying, no dupes); manual edits are an OVERRIDE LAYER (delta off the synced base — same pattern as scenario_inputs / flux_notes), flagged + persisting across re-imports.** CRM/Salesforce → clients/contracts/pipeline; HRIS → staff; ERP → TB + COA; AP → vendors/bills. Forward-looking data (forecasts, scenarios, planned hires) + the Account Mapping are **Dogfood-native** (not imported). **Override layer = a new write surface** (alongside flux_notes). **Connectors (Salesforce/Rippling API) = roadmap**, behind the DataStore seam — the CSV templates ARE the contract a connector fills. **Scope note:** §16 currently says "ERP = the one live connector, everything else CSV" — this keeps that (CSV batch now) but adds the override-layer model + flags API connectors as a roadmap item; **now folded into CLAUDE.md §4 (Key seams) + §16 (scope) + §17 + §18 (connectors roadmap) this session.** **Also fixed this turn:** the off-by-one in `import-templates/trial_balance.csv` (it was dated 2026-05 but held June's index-29 data; now correct May, idx 28, foots to $59,567,335.23; README/SCHEMA/handoff refs updated).
  - **Reconciliation (Q1 follow-up, in `import-templates/README.md` "Reconciliation"):** statements ALWAYS equal the TB (it balances); the check is detail-vs-TB per (account, period): `Σ detail === TB account movement`. Variance > a materiality threshold → flagged with the $ gap, shown as a per-account/per-line reconciliation status + on drill ("TB $X · detail $Y · unreconciled $Z"). Force tie-out two honest ways (never make the TB match the detail): (a) **auto-plug** a visible "Unreconciled / uncategorized" reconciling line so the detail foots, or (b) **fix upstream** (pull the missing JE/accrual or fix the mapping) + re-import. The statement number never moves; reconciliation is about whether the *explanation* is complete.
  - **Connector concept (Q2 follow-up):** the target is **direct connection to each data source (regardless of ERP)** — ideally NO import step (connected + refreshable, or written-in-Dogfood + saved). For THIS build those are **notes/documentation of intended functionality; CSVs are the mechanism today.** The CSV template IS the contract a connector fills. **Worked example added: `connectors/salesforce.md`** — field-by-field Salesforce → `customers`/`pipeline`/`contracts` (Account/Opportunity/Contract), upsert on the SF Id, picklist maps, synced-vs-override, and the caveat that SF owns the SALES domain only (recognized revenue/AR/cash come from billing/ERP).
  - **DONE this session — the handoff process ran:** CLAUDE.md updated with all the changes + decisions from this run (§0 posture/status, §3/§4 Supabase-active + the TB-driven / batch-import / override data-integration model, §8 build status, §10 Scout, §16 scope, §17 decided-2026-06-20 block, §18 connectors, appendix). **CLAUDE.md is the authoritative spec home now; this Handoff tracks build-state.** Verified by a 3-agent doc-consistency workflow — fixes applied: stale gate counts (38/20→43/34), the §8 "single live ERP connection" line, the §4 diagram caption, eval count 26→28, and a real **2-cent rounding plug** in `import-templates/trial_balance.csv` (now foots to $59,567,335.23 each side).
1. ~~**firm_id multi-tenancy**~~ — **RESOLVED 2026-06-20: single-tenant, documented plan.** Demo-only; firm scoping attaches at the DataStore boundary (+ Supabase RLS) if ever needed, not baked into records. See the State block above.
2. **Schema/ERD** -- `schema.dbml` is committed (22 tables, repo root) and `data-export/SCHEMA.md` is the data dictionary + Mermaid ERD. Still missing: an in-app `/dev/schema` page rendering it — commit that page?
3. **GL drill floor** -- accept monthly-summary GL (drill the sub-ledger) and document it, or add a JournalLine->source link? (Review leans: document the boundary + route Scout drill-downs to the sub-ledger — cheaper than per-transaction JEs.)
4. ~~**Budget realism**~~ — **RESOLVED 2026-06-21 (Chris: fully resolve, no defer): Budget becomes a REAL frozen snapshot, not synthetic.** Implement `lockBudget` to snapshot the Base layer-2 drivers into `budget_snapshots`; the P&L Budget/Variance columns read the locked snapshot; retire the synthetic per-line `budgetFactor` in `lib/seed/statements.ts`; collapse the two budget seams to one (`getBudgetView` reads the snapshot). Seed an initial "FY26 Plan" lock so the columns populate day one. Real Base-vs-plan drift supplies the narratable variances (no synthetic jitter needed). Re-run data-sweep after — every Budget/Variance number moves. Build at step 6.
5. ~~**Scout scenario scope**~~ — **RESOLVED 2026-06-21 (Chris: fully resolve, no defer): Scout gets the FULL scenario write surface.** `createScenario` / duplicate / reset AND `setDriver` (target an explicit scenario id; create returns a new named scenario + receipt). All attributed to the user (`source=scout`), validated through the engine, write-then-undo (no pre-confirm — single-tenant), never touching Base/actuals. The UI exposes the same CRUD. Build at steps 5/7.
6. ~~**getPnL baseline arg**~~ — **RESOLVED 2026-06-20: froze the `getPnL` Scout tool schema WITHOUT a baseline arg** (Base only). Add the Base-vs-Budget arg when the Scenarios engine lands.
   (Already resolved: Scout in-app only, no Slack; ASC 842 leases IN; 340-40 commissions + 350-40 cap-software deferred; firm_id single-tenant; **metric fixes = TIGHTEN formulas** — cohort NRR + quarter-lagged S&M, done.)

**Also resolved 2026-06-21 (Chris: fully resolve, no defer) — the three architecture calls the next-steps review surfaced:**
- **`scenario_inputs` storage → jsonb.** Store the full typed `Adjustment` (discriminated `LeverTarget`, categorical `freeze`, `days` unit, per-row id) as a jsonb column — the flat (lever, sub_dimension, magnitude, window, shape) shape is lossy. Small migration; add a serialize/deserialize unit test + extend `supabase-parity` to the now-populated scenarios tables.
- **CSV importer wiring → option (a): imported TBs DRIVE closed-month statements.** Closed (Actual) months read the imported `trial_balance` from Supabase; forecast months stay generator-driven; a per-month Actual/Forecast switch in the statement builders. Honors §4/§16 — the headline "import a month → statements re-derive" must actually work; no records-only fallback. Needs a new `trial_balance` table + `upsertTrialBalance` + a CSV parser (papaparse — not yet installed). Accepted as L-effort re-plumbing of `lib/seed/statements.ts` (today the builders read the driver generator directly, never a TB).
- **Override layer → field-level deltas.** A generic `(table, row_id, field, value)` store merged at read time; re-import preserves a flagged override until the user clears it — more honest than freezing a whole synced record. Land alongside the importer (step 9/10) so stable-id upsert never clobbers overrides.

### Carried-forward debts / nits (none block the Run)
- **`getXModel()`** returns full seed shapes -- narrow to domain views at the Supabase swap.
- ~~**Unit-economics tiles**~~ — RESOLVED 2026-06-20: formulas tightened (cohort NRR, quarter-lagged magic/CAC) + every `METRIC_CATALOG` basis string reconciled to what the code computes, so Scout quotes literally-true bases.
- **AP aging is one bucket** (all current) -- optionally seed 2-4 disputed/stretched bills for a thin tail when the AP register is built.
- **Opening AR/AP records** (period 2023-12) -- give them an explicit "opening balance" treatment in the register so they don't read as a stray Dec-2023 row.
- ~~**Staff name pool** 24x24 collides at 140 heads~~ — RESOLVED 2026-06-20: widened to 40×41 coprime, 0 collisions (seed-texture pre-pass).
- **ASC 340-40 deferred contract costs** (approved, P2) -- one bundled accounting pass, ~2pt shallower loss.
- **GL per-transaction JEs** -- optional; only if Scout must drill GL -> single transaction (the sub-ledger already gives record-level drill).

### Pointers
- `Scout-Context.md` (Scout briefing) · `CLAUDE.md` §4 / §8 / §10 / §13 · `diagrams/` (IA + drilldowns) · the saved `progress-review` workflow (Chris likes a multi-agent review before next steps).
- Dev gates: `scripts/data-sweep.ts`, `scripts/scout-readiness.ts`, `scripts/peer-check.ts`; `scripts/scout-eval.ts` (Scout routing — structural layer free/CI-safe, LLM layer metered/on-demand).

---

## Session history + reference (newest first; some predates the Run -- the section above is authoritative)

**DONE (2026-06-19, revenue/606 drill-down chain — read-side):** Built the contract-accounting drill chain
through the query spine so revenue → deferred → RPO → AR → cash resolves end-to-end and ties at every level.
**41/41 tie-outs (+1 new subscription check), 20/20 Scout-readiness, tsc clean.**
- **Seed:** added per-contract monthly recognition (`recByContract`) to `lib/seed/subscription.ts` — mirrors
  services' `recByProject`; Σ per-contract recognized[i] === series.recognized[i] (new definitional check). The
  drill source so getRecognizedRevenue ties to the P&L revenue line.
- **Queries now LIVE (were notImplemented):** `getRecognizedRevenue` (per-contract + per-engagement recognition
  rows; subtotals === the seed series — verified 116 sub + 9 svc rows sum exactly), `getDeferredWaterfall`
  (opening + billings − recognized = closing === BS deferred), `getRevenueForecast` (per-month × stream;
  contracted vs new-business split at the close boundary — wedge opens only in the forecast tail; FY total ===
  fyRecognized), `getContractedRevenue` (RPO: recognized-to-date + contracted-forward === deferred),
  `getArForecast` (DSO; balance === BS AR, Δ === cash-flow change_ar).
- **Still stubbed (Sales read surface):** getBookings, getArr, getNrr, getGrr, listContracts/getContract,
  listCustomers/getCustomer, listPipeline, listRenewals; getFixedAssetForecast/getPrepaidsForecast.
- **NOT yet built — top remaining chain item:** ASC 340-40 deferred contract costs (the cost-side companion to
  606/deferred — capitalize commissions, amortize over the customer life; ~2pt shallower loss → light re-baseline).

**DONE (2026-06-19, audit-readiness + milestone review + coherent-efficient recalibration):** Ran the saved
`progress-review` (5 agents) — green light to the Run after a re-baseline + financial-shape sign-off (both done).
All **38/38 tie-outs green · 20/20 Scout-readiness · tsc clean**:
- **Runway reporting cleanup** — removed the stray Dec-2026 `runwayMonths`/`netBurn` off `BalanceSheetSeed` (they
  computed runway at a different as-of than every user surface); peer-check + the dev seed page now read
  `buildSeedRunway(asOf)` at the current period, matching the dashboard tile.
- **Scout-readiness gate** — new `scripts/scout-readiness.ts`: proves the live tool surface is serializable +
  deterministic + cross-tool-consistent (NI agrees across getPnL/getCashFlow/getMetric). 6/9 declared tools live; 20/20.
- **Stock-based comp (ASC 718)** — new `lib/seed/sbc.ts`: non-cash, equity-neutral driver (Dr SBC / Cr APIC, added
  back in OCF), threaded through P&L/BS/CF/GL + 3 tie-out checks. FY26 SBC ≈ $4.3M (deepens GAAP loss, not cash).
- **GAAP→non-GAAP reconciliation + FCF** — `buildSeedNonGaap` / `getNonGaapReconciliation`: GAAP −52% → non-GAAP
  (ex-SBC) −32% → FCF −15%, the way real SaaS reports.
- **Coherent-efficient recalibration** — a "funded grower" pass overshot into an inefficient burner (43% S&M / 0.9x
  magic / −59%; review's #1). Reverted: S&M programs `rate` 0.14, Series B $28M→$20M (right-sized — $28M left ~80mo
  runway). Final: revenue $23.4M, growth 61%, NRR 111%, GM 71%, magic 1.1x, Rule of 40 25%, LTV:CAC 3.9x, burn
  multiple 0.6x, runway 49mo, NI −$12.1M, 140 heads. KEY: annual-prepay makes a low burn multiple + long runway
  structural/cohort-accurate, not "outrageous" — don't over-spend to fake burn; right-size the raise instead.
- **Spec re-baselined** — CLAUDE.md §11 (numbers + SBC in scope) + §17 (this milestone) + this Handoff. New files:
  `lib/seed/sbc.ts`, `scripts/scout-readiness.ts`; new query `getNonGaapReconciliation`.
- **Operating leases (ASC 842) — BUILT:** `lib/seed/leases.ts` adds a right-of-use asset + lease liability to the
  BS (ROU === liability each month → equity-neutral; lease cost stays in Facilities so P&L/cash/NI/runway unchanged).
  FY26 ROU/liability ≈ $1.6M; BS assets $22.5M → $24.1M (both sides). Threaded through balance-sheet/statements/GL +
  2 tie-out checks. 40/40 green, 20/20 Scout-readiness, tsc clean.
- **DEFERRED (review-ranked below visible product work):** commission capitalization (340-40 — legitimate eventually,
  standard SaaS GAAP) and capitalized software (350-40 — likely never; expensing R&D is cleaner). The "board-package"
  win is the BS/CF pages + the monthly column view, not more accounting layers.

**DONE (2026-06-18, Series-B realism audit + fixes):** Ran a 5-lens adversarial audit (P&L · balance-sheet/CF ·
SaaS metrics · transaction sub-ledger · narrative) asking "what reads as FAKE to a Series-B CFO/investor/auditor",
then implemented the high-value fixes. Diagnosis: the statements/aggregate story were believable; the demo failed
the finance-expert first-impression test on TEXTURE (the sub-ledger drill-down surfaces). **All 35 tie-outs stay
green by construction; typecheck/lint/build clean; dashboard renders (verified).** Fixed:
- **Customer names 71→180** — no more numeric-suffix repeats (was 78/149 "Northwind Cloud 2/3"). RNG-stable.
- **Partial contractions / downsells** (`MONTHLY_CONTRACTION`, `CONTRACTION_PCT` in params; `billDecrement` +
  a 3b block in `subscription.ts`) — the NRR/GRR bridge now shows real downsell, not only binary churn-to-zero.
  Plus a **module-launch expansion-wave** story beat (`EXPANSION_WAVE`, mid-2025).
- **Paychecks** (sub-ledger) — were byte-identical for 36 months. Added a shared `monthlyCompFor()` (merit raise at
  each anniversary + a December bonus) in `personnel.ts`, read by both the payroll series AND `transactions.ts`
  paychecks; realistic withholding (SS 6.2% to the $168,600 cap tracked YTD, Medicare 1.45%, progressive federal).
  Now 531 distinct grosses, effective tax 19.6–29.7%.
- **Timesheets** — were billing impossible hours (666h/mo, 135h weeks). Crew-sized to the month with a hard 45h/week
  cap → **0 weeks over 45h**.
- **Transaction dates + doc#s + status** — every row now carries a full YYYY-MM-DD date (within its month, so no
  total moves), net-30 due dates, open/paid status vs the close, and human doc numbers (INV-/BILL-/PAY-/TS-).
- **Cash receipts** — real per-customer FIFO open-invoice queue + AR aging (762 distinct applied invoices, was 149).
- **Vendor bills** — de-duped within group-month, jittered counts, per-vendor memos, annual lumps (Jan D&O premium,
  Jul SaaS prepay).
- **Cheap metric fixes:** LTV:CAC 9.1x→**3.5x** (5-yr lifetime cap, kills the vanity ratio); "Growth rate" →
  **"Revenue growth (FY)"** (was silently inconsistent with the ARR tile); **budget-variance dispersion** (per-line,
  per-year `planFactor` in `statements.ts` — no more identical −2.91% every year).
- **Recalibration (the realism changes reshuffled the cohort/cost RNG):** FY24 founding base softened 52→40 (FY24
  opex 133%→~115% of revenue); S&M 0.20→0.17 (realistic programs:payroll split); Series B $28M→$24M (right-size the
  cash pile); TIERS +15% to restore the arc; opening cash $8M→$6M. **Result: arc $7.4/14.5/22.5M, mix 18/21/15%,
  GM 66→71% widening, NRR 111% (with downsells), logo 92%, ltv 3.5x, magic 1.0x, runway ~53mo, NI −$8.95M (−40%,
  the §11-structural 140-heads-on-$22M deep loss), Rule-of-40 ~11 (honest for an aggressively-investing Series B).**
- **DEFERRED (documented, not done — lower-severity / deep-drill / high-recalibration or scope-coupled):** equity
  Preferred/Common split (GL-account-coupled, §16 borders out-of-scope), utilization-curve smoothing, seasonality,
  odd-dollar ARR jitter, per-head OpEx fixed/variable split, a small state/franchise income-tax provision, interest-
  rate variation, a Support-dept activity ledger / PS bench, in-close-month texture, GL accrual accounts. ~22
  consultant-months still exceed full-time during the early ramp (bounded 229h, was 666h) — a PS-headcount artifact.
- **Diagram:** `revenue-drilldown.svg` re-themed (marquee names) to match the seed.

**DONE (2026-06-18, peer-profile retune — "look like Numeric/Campfire"):** Researched Numeric (numeric.io,
close-automation, $89M raised) + Campfire (campfire.ai, AI-native ERP, $100M+) + the AI-native-finance cohort and
2025 SaaS benchmarks, then reshaped Bearing to read as a credible PEER. The core finding: Bearing's locked
financials already sat dead-center of the cohort, so the work was mostly TEXTURE + a few knobs, not structure. **All
35 tie-outs stay green by construction; typecheck / lint clean.** Changes:
- **Customer base → tech/AI/SaaS/fintech** (was old-economy industrial — freight/mining/brewing). `names.ts`:
  71-name `CUSTOMER_NAMES` re-themed (Tensil, Cinder AI, Keel Financial, …); the 6 names in `revenue-drilldown.svg`
  re-themed index-stable (Northwind Cloud / Helix AI / Atlas Data / Cedar Security / Mariner Analytics / Pinnacle
  Health AI) — **update that diagram's rows to match if it's refreshed.** `transactions.ts`: modern SaaS-stack
  `VENDORS` (AWS/Anthropic/OpenAI under CoR-hosting — Bearing buys the AI infra it sells; Ramp/Carta/Rippling/Datadog).
- **Services mix taper 25→19→~15% by FY26** (the software norm): `TIERS` ARR bands +10% (→ subscription),
  `SERVICES_ATTACH_PCT` −38%; arc held (FY26 $22.58M). GM rose to 64→68→**71.5%** (widening, more software-like).
- **Headcount trued 44→134 ⟹ 52→140** (§11 ~60→140): PS 20→15 (services taper), reallocated to Eng/Sales/CS →
  software-shaped org (R&D 37% · S&M 32% · Direct 19% · G&A 12%).
- **Series B $9M → $28M** (cohort-credible vs Numeric $51M / Campfire $65M / Aleph $29M); opening cash $7M→$8M (clears
  the pre-raise trough, min cash +$2.2M at Feb-2025). S&M programs 0.11→0.20 to **deploy** the raise →
  NI ≈ −$8M (−35%), magic 1.1x, burn-multiple 0.6x, Rule-of-40 36%, runway ~50mo (BS) / ~70mo (dashboard, as-of
  Jun-2026). Long runway is peer-accurate (the real comps raised 6–8× ARR). Hosting 0.15→0.17 (AI inference COGS).
- **Cheap metric fixes:** `cac_payback` → "CAC per new logo" (formula unchanged — computes dollar CAC); NRR basis
  documented "whole-book TTM"; LTV churn floor 0.02→0.05. `ltv_cac` ~9x stays first-pass-optimistic (Run).
- **Spec updated:** CLAUDE.md §11 (mix 75/25→85/15, customer base, $28M Series B, 52→140) + §17 (retune note;
  AP/DPO marked LOCKED). Dev tool `scripts/peer-check.ts` added (mix/GM/runway/tiles — companions `data-sweep.ts`).
- **Deferred (approved, not done — additive + RNG-reshuffling):** the 2 new story beats (module-launch expansion wave
  + marquee-logo land) and an explicit CAC/magic reconciliation target. Left for a focused follow-up.

**DONE (2026-06-18, transaction sub-ledger):** Built a full synthetic transaction sub-ledger — exploded the
monthly drivers into **13,641 individual transactions (4,557 in 2025)**, each stream reconciling to its driver
BY CONSTRUCTION, so the GL/statements are untouched and all prior tie-outs hold. New files
`lib/types/transactions.ts` + `lib/seed/transactions.ts` (`getTransactionsSeed`). Streams (6 new reconciliation
checks, all green):
- **Vendor bills (1,891)** → the 8 non-payroll OpEx groups + non-employee CoR (hosting / pass-through), per
  vendor with a vendor pool. **Wired to `listExpenseTransactions`** (the §8 Expense Transactions register).
- **Paychecks (5,836)** → total payroll (per employee × 2 semi-monthly periods, ramped; gross/taxes/benefits/net).
- **Timesheets (2,288; 55,624 hrs)** → services recognized revenue (hours × bill rate ⇒ WIP); fully-loaded cost
  rate ⇒ **job-costed margin ~35%**. Resolves the "PS needs timesheets/bill rates for WIP" gap.
- **Customer invoices (894)** → subscription billings (emitted per billing event) + services billed (%-complete arrears).
- **Cash receipts (2,732)** → collections (billings − ΔAR), allocated FIFO across open customer balances.
- **Source extensions (additive; tie-outs unaffected):** `subscription.ts` now emits per-customer `invoices`;
  `services.ts` emits `recByProject` (per-project monthly recognition). Verified the trial balance is byte-identical.
- **DataStore:** added `listTimesheets / listPaychecks / listCustomerInvoices / listCashReceipts`; `listExpenseTransactions`
  now returns the real vendor bills (filtered).
- **35/35 checks (29 statement + 6 sub-ledger reconciliation); typecheck / lint / build green.** The GL remains
  monthly-summary (the statements' source); the sub-ledger is a reconciling layer-1 detail view. One-JE-per-transaction
  in the GL is now an *optional* future refinement — record-level drill-down already exists via the sub-ledger.

**DONE (2026-06-18, high-growth retune):** Researched current high-growth Series B SaaS benchmarks
(ICONIQ/KeyBanc/Bessemer/Benchmarkit 2024-25) + measured the seed, then retuned it to read as a credible
high-growth company **within §11** (chosen over re-opening the locked arc). Diagnosis: the growth *rate* was
already fine, but NRR<100%/14% logo churn (leaky bucket) + an over-efficient burn posture undercut the
high-growth read. Param changes (`lib/seed/params.ts`):
- `MONTHLY_CHURN` 0.01→**0.007**, `CHURN_SPIKE` 0.045→**0.030** (keep the Q3-24 story, soften the crater) →
  logo retention ~86%→**91-94%**, GRR ~91-96%.
- `MONTHLY_EXPANSION` 0.014→**0.028**, `EXPANSION_PCT` 8-25%→**10-30%** → continuous land-and-expand →
  **NRR 102%→111%** (FY26), 90%→101% (FY25); expansion ~22% of net-new.
- `TIERS` ARR bands scaled **×0.87** (RNG-stable level lever — trimming logo COUNT reshuffles the whole draw
  and is noisy; scaling deal SIZE is smooth and leaves NRR/retention ratios untouched) to hold the §11 arc as
  the stronger retention added ARR.
- `SERVICES_ATTACH_PCT` {0.4/1.0/0.65}→**{0.45/1.12/0.73}** to restore the ~75/25 mix (recurring grew faster).
- `OPEX_DRIVERS` S&M programs 0.09→**0.11** (more demand-gen / investing posture).
- `SUBSCRIPTION_REVENUE_TARGETS`→5.5/10.0/17.0M, `SERVICES_REVENUE_TARGETS`→2.5/3.4/5.2M (dev-page bands realigned).
- **Result:** arc **$8.0/$13.3/$22.5M** (~+68% steady); NRR 111%, logo ret 94%, GRR 91%, GM 70% (in band,
  widening), runway 38mo, burn $198k/mo, magic 1.47x, CAC $146k, mix 77/23, 140 heads, $9M Series B, 7 in-progress.
  **29/29 checks + GM band PASS; typecheck/lint/build green.** NEW_LOGOS unchanged (123; avoided the reshuffle).
- **Known minor §11 drift (acceptable, flagged):** FY25 $13.3M vs the locked ~$14M (−5%; the expansion flywheel
  smoothed growth toward steady-accelerating); runway 38mo is a touch above the 24-30mo high-growth ideal (a real
  deferred-revenue/annual-upfront-billing effect — shorten only by investing harder, which §11's $9M raise bounds).
  A true top-quartile rocket (sustained 90%+, NRR 120%, ~$27M raise, ~200 heads) needs re-opening §11 (Recipe B, not done).

**DONE (2026-06-18):** Re-ran the durable data sweep (zero drift vs the 2026-06-17 baseline — 29/29, revenue/NI/
BS/trial-balance all reconciled to 0), then ran a **9-agent watch-out audit workflow** (parallel investigate +
2-lens adversarial verify) on the four flagged watch-outs. Outcome: **one confirmed seed bug + a capacity tuning,
both now FIXED**; metrics mostly clean (two flagged items downgraded on verification); integrity clean.
- **Services completion-threshold bug (CONFIRMED, fixed).** Projects completed only at an absolute `remaining
  ≤ $0.5`, but proportional capacity throttling shaves `remaining × scale` each month, so a near-done project
  decayed geometrically toward 0 without crossing $0.5 inside the horizon → ~31 finished projects stranded
  "in_progress" forever (one a 6-mo deal open 26 months at 100.0%). Live in `InMemoryDataStore.listProjects`.
  Fix (`lib/seed/services.ts`): value-relative bound `Math.max(1, contractValue*0.001)` in the active filter +
  completion guard. Tie-out preserved by the residual-recognition line.
- **PS capacity retune `DELIVERY_PER_HEAD_PER_MONTH` 26k→28k** (`lib/seed/params.ts`). Audit showed capacity was
  ~2% short every month (32/36 pinned at 100%). Measured the curve: **28k dominates the literal "~30k"** — same
  project realism (8 in-progress, all ≤3mo old) but FY26 revenue stays on the $22M arc ($22.15M vs 30k's $21.81M
  and a −10% services miss). 26k-alone left 28 projects still dragging. Front-loads services delivery, so the
  first-pass `SERVICES_REVENUE_TARGETS` were retuned to the new shape ($2.3/4.2/5.3M) to keep the dev-page
  reconciliation honest.
- **Utilization invariant fix.** The new completion residual (≤0.1% of value) recognized on top of throttled
  delivery pushed utilization to 100.13% in 10 closing-out months (tripped the ≤100% check). Resolved by
  measuring utilization on capacity-throttled **delivery** (≤capacity by construction); the closure residual
  stays in recognized REVENUE but is excluded from utilization. Calibration unchanged; **29/29 green**.
- **Result:** 77 complete / 8 in-progress (all started ≤3mo before horizon, no stranding); utilization eased off
  the pin (Jul–Dec 2026 ≈ 100/100/100/84/57/58%); FY26 $22.15M, GM 69.7%, NI −$4.71M. typecheck/lint/build green.
- **Metric findings (logged for the Run, below)** — `cac_payback` label nit, NRR whole-book-vs-cohort framing,
  `ltv_cac`/`magic_number` optimism. None a build blocker; SaaS formulas are explicitly first-pass per §17.

**DONE (2026-06-17):** Tie-out audit + cleanup, **Seed step 5** (balance sheet + cash flow), **Seed step 6 —
the live queries now read the SEED**, AND **Seed step 6b — the JE → GL roll-up + Account Mapping.** The app
shows real, tying-out Bearing data: verified live that the Dashboard Revenue tile ($22.3M) === the P&L Total
Revenue (one source, two callers), the P&L foots and net income ties to the cash flow, the balance sheet
balances, and the trial balance balances. **29 seed/GL checks green; typecheck / lint / build green; Dashboard
+ P&L + /dev/seed render clean (no console errors).** `lib/target/model.ts` is **retired**.

**Step 6 core — what landed:**
- **`lib/seed/statements.ts`** — assembles the typed `PnL` (§8 layout, Budget/Actual/Variance/Forecast with
  the close-boundary actual/forecast split), `BudgetSnapshot`, `BalanceSheet`, `CashFlow` (indirect), `Runway`
  from the seed. Subtotals foot; NI ties to the seed; BS balances; CF foots — all verified.
- **`lib/seed/dashboard-metrics.ts`** — the 19 metrics from the seed: Financial family from the seed P&L (ties
  by construction); SaaS metrics (ARR/MRR, bookings ΔARR, NRR, logo retention, growth, CAC, LTV:CAC, magic,
  utilization, net burn, runway, Rule of 40, burn multiple) from real series, with **real prior-year + trailing
  sparkline** (replacing the model's hand-set PY_RULES).
- **Repointed** `lib/queries/{statements,dashboard,metrics,balance-drivers}` to the seed (signatures unchanged).
  Pages cleaned (removed "illustrative" banners; FY label derived from the period).
- **Types extended:** `CashFlowLineId` (+ `depreciation` addback, `change_ap`, `financing`, subtotals);
  `BalanceSheetLineId` (+ `paid_in_capital`, `accumulated_deficit`, a `section` field); AP un-gated.
- **Calibration retune (resolves the services miss):** services attach ↑ (0.4/1.0/0.65), delivery capacity
  26k/head/mo, and **%-complete-in-arrears billing** (replaces bill-at-completion). Result: services hits all
  three per-year targets (+7 / +11 / −2%), total revenue FY26 **$22.3M** (on the §11 arc), WIP realistic
  (~$520K, no balloon), runway ~32–60mo, GM trajectory in band. All 26 checks still green.

**Step 6b — JE → GL roll-up + Account Mapping — ALSO DONE.** `lib/seed/gl.ts`: a chart of accounts (25
accounts, each mapped to a statement line), balanced per-source monthly journal entries (430 JEs) derived from
the seed, rolled into a GL. **The statements are now a VIEW of the GL.** Verified: **trial balance balances
(Σ debits === Σ credits, $236M across 430 JEs); every GL balance-sheet account reproduces its series to 0.0000;
the P&L accounts reproduce the P&L lines per FY.** Wired through the DataStore (`InMemoryDataStore.listGlAccounts`
→ COA, `listJournalEntries` → JEs, and the layer-1 records — contracts/customers/projects/staff — from the seed);
`getAccountMap` now reads the §4 DataStore seam. `/dev/seed` shows the trial balance (balances ✓). Granularity is
monthly-summary; per-individual-transaction JEs are a later refinement.

### ▶ NEXT TASK — another full data sweep (confirm + quantify)

**Re-run the durable sweep, confirm every count and tie-out below still holds, and scrutinize anything off.**
Run `npx tsx scripts/data-sweep.ts` (a permanent dev tool, lint/typecheck-clean, not part of the build). It
both (a) CONFIRMS the data (all 29 checks, the revenue/NI/balance-sheet/trial-balance reconciliations) and
(b) INVENTORIES the volume. Compare against this baseline; investigate any drift or anything that reads wrong.

**Data inventory — baseline (updated 2026-06-18 after the peer-profile retune):**

```
TIME
  Months: 36 (2024-01 … 2026-12) · Fiscal years: 3 (FY2024–26)
  Close: actual ≤ 2026-05 · in-close 2026-06 · forecast 2026-07…12

LAYER 1 · SOURCE RECORDS
  Customers: 149 (136 active, 13 churned) · Contracts (subscription): 149
  Acquisitions (in-window new logos): 123 + pre-existing base 26
  Projects (services): 88 (70 complete, 18 in-progress at horizon — the H2-2026 growth ramp outran PS capacity, a defensible backlog; doneBound 0.1%→0.5% so no stranded near-100% projects)
  Staff: 140 — depts: PS 15 · Support 11 · Eng 39 · Product 13 · Sales 22 · Mktg 10 · CS 13 · Finance 7 · People 5 · Ops 5
         functions: direct 26 · rnd 52 · sm 45 · ga 17
  GL accounts: 25 (asset 5 · liability 2 · equity 1 · contra-equity 1 · revenue 2 · CoR 2 · OpEx 10 · other-income 1 · tax 1)
  Journal entries: 432 · journal LINES: 1,188 (monthly-summary)
    by source: invoice 179 · payroll 36 · ap_bill 72 · depreciation 36 · prepaid_amort 36 · manual 73

LAYER 1 · TRANSACTION SUB-LEDGER (13,966 individual txns; each Σ === its monthly driver; now carry
                                   full YYYY-MM-DD dates + doc#s + open/paid status + due dates)
  Vendor bills 1,711 · Paychecks 5,852 · Timesheets 2,141 (38,522 hrs, ≤45h/wk) · Customer invoices 800 · Cash receipts 3,462 (FIFO, aged)

LAYER 2 · DRIVERS
  Departments: 10 · Function tags: 4 · Plan tiers: 3 · OpEx groups: 8
  Monthly series: ~52 (sub 8 · svc 4 · personnel 7 · CoR 8 · OpEx 9 · BS 16) → ~1,872 monthly data points

LAYER 3 · STATEMENTS
  P&L lines: 22 (16 leaf + 6 subtotals) · Balance sheet lines: 9 · Cash flow lines: 11
  Trial balances: 3 fiscal-year-close + 36 monthly — 25 accounts each

LAYER 4 · METRICS
  Dashboard tiles: 19 (financial 6 · growth 5 · unit-econ 4 · cash 4)

VOLUMES (rows)
  Vendor-bill (expense) JE lines: 360 · OpEx group-months: 288 · Active customer-months: 2,853 · booking-active months: 36/36

TIE-OUT CONFIRMATION (all green; post 2026-06-19 coherent-efficient recalibration + SBC/ASC-718 + ASC-842 leases)
  Checks: 41/41 PASS (sub 6 · svc 5 · personnel 5 · CoR 3 · opex 3 · balance-sheet 5 · sbc 3 · leases 2 · gl 3 · sub-ledger 6)
  Revenue FY26: seed 23,425,097 === P&L 23,425,097 (Δ 0) · growth 61% · mix ~84/16
  Net income FY26: P&L −12,091,727 === seed −12,091,727 (Δ 0) · −52% GAAP / −32% non-GAAP / −15% FCF
  Balance sheet FY26-close: assets 24,128,412 === L+E 24,128,412 (Δ ~0) · A=L+E every month (incl. ROU asset / lease liability)
  Trial balance: BALANCES — Σ debits === Σ credits across 500 JEs · Scout-readiness 20/20
  (Inventory counts above are PRE-recalibration; now GL 28 accounts, BS 11 lines, P&L 23 lines, ~140 staff — re-run data-sweep for exact counts.)
```

**Watch-outs — status after the 2026-06-18 audit:**
- **Projects in-progress count — RESOLVED.** Was a completion-threshold bug (not realism); fixed + capacity
  retuned to 28k → 77 complete / 8 in-progress, all genuinely young, no stranding. See the 2026-06-18 DONE block.
- **Data integrity — CLEAN (verified).** 0 duplicate IDs across all 7 record collections; all 82 monthly series
  are exactly length 36 with the horizon index (35) populated (no off-by-one). Cosmetic only: 54% of customers
  are suffixed repeats of a 69-name pool (IDs + name strings still distinct); staff names unique with headroom.
- **SaaS metric formulas — first-pass, refine in the Run (NOT bugs).** Audited all 11; growth/logo-retention/
  net-burn/runway/rule-of-40/utilization/burn-multiple are correct + correctly typed. Open items for the Run:
  - `cac_payback` (`dashboard-metrics.ts:83`, `metrics.ts:68`): formula correctly computes **dollar CAC** ($110.6K,
    matches its basis string + the LOCKED `drilldowns-dashboard.svg`); only the label word "payback" is loose.
    Cosmetic label nit — optionally relabel "CAC", or add a real payback-months tile. Do NOT change the formula
    (it would break the seed tie-out + the locked diagram).
  - `nrr` (`dashboard-metrics.ts:64-68`): whole-book TTM expansion/contraction over a 12-mo-ago stock denominator,
    not a true cohort. Churn is NOT missing (contraction includes churn-to-zero, `subscription.ts:182`). The gap
    vs cohort NRR is **unsigned** (understates 4–8pp mid-2025, +3pp at 2026-06) — document as "whole-book TTM
    NRR", or restrict the sums to the i-12 cohort if true cohort NRR is wanted.
  - `ltv_cac` ~8x and `magic_number` ~1.5x read optimistically (low 12.2% churn + a 0.02 churn floor active 7/36
    months; same-period vs prior-period S&M). Legit-but-rosy modeling, not formula errors; tune if a less idyllic
    story is wanted (raise churn floor to ~0.05; lag the S&M window).

### After the sweep — the Run
1. **Module surfaces** — the Reporting + Sales registers (the DataStore now serves real contracts/customers/
   projects/staff), the **Balance Sheet / Cash Flow pages** (queries return real data; pages are still placeholders),
   the Metrics drill-downs, the Expense Transactions register (derive from journal entries).
2. The **Scenarios engine** (contract types in `lib/types/scenario.ts`), **Scout tools per shipped module**
   (the query↔tool `registry.ts` seam), and finishing the **guides**.
3. **Per-transaction JE detail** (one JE per invoice/paycheck) — OPTIONAL now: the transaction sub-ledger
   (`lib/seed/transactions.ts`) already provides record-level drill (vendor bills, paychecks, timesheets,
   invoices, receipts), reconciling to the monthly drivers. Posting one GL JE per transaction is only needed if
   Scout must drill the GL itself to the transaction (vs the sub-ledger records).

---

## Where the build is

**Harness Phase 0 (scaffold) and Phase 1 (example Dashboard + Forecasted P&L) are DONE and verified.**
**Seed (Phase 2): steps 1–6 + 6b done — the live spine reads the seed; the GL is its reference implementation.**
29 checks classified + green; the statements tie out by construction (and are now a view of the GL); the
Dashboard + P&L render real Bearing data. `lib/target/model.ts` retired (config remains in
`lib/target/placeholder.ts`). Build/typecheck/lint green. See `tie-out-audit.md` for the reconciliation;
`/dev/seed` for the QA surface. **Harness is essentially complete — remaining work is the Run.**

### Stack
- Next.js **15.5.19** (App Router, RSC, TS) + React 19.1 + Tailwind **v4** + shadcn/ui (base-nova /
  Base UI + lucide-react ^1.20). npm. Pinned to Next **15** deliberately (`@latest` now gives 16; §3 says 15).
- Scripts: `npm run dev` (turbopack) · `build` (webpack, heap-bumped) · `typecheck` (`tsc --noEmit`) · `lint`.
- Dev tools: `npx tsx scripts/data-sweep.ts` — durable data sweep (confirms tie-outs + inventories volume;
  re-run each session vs the baseline in "NEXT TASK"). Lint/typecheck-clean; not part of the build.

### File map
- `app/` — route tree for every nav leaf (placeholder pages except Dashboard + P&L). `app/dashboard`,
  `app/statements/pnl` (+ `?inspect=` peek pane). `app/dev/seed` = **dev-only seed QA page** (not in nav).
- `components/` — `nav/` (sidebar + typed `nav-config.ts`), `shell/` (app-shell, placeholder-page),
  `scout/` (floating panel scaffold + context), `dashboard/` (kpi-tile, sparkline), `statements/`
  (pnl-table, inspect-pane, drill-map).
- `lib/types/` — money, period, common, source, drivers, statements, metrics (`METRIC_CATALOG`, 19 tiles),
  scenario (full typed contract), dashboard, **transactions** (sub-ledger: invoices/receipts/paychecks/timesheets).
- `lib/datastore/` — `DataStore` interface + `InMemoryDataStore` (wired to the seed: GL accounts, journal
  entries, contracts/customers/projects/staff, **+ the transaction sub-ledger**: vendor bills via
  `listExpenseTransactions`, plus `listTimesheets/listPaychecks/listCustomerInvoices/listCashReceipts`) +
  `getDataStore()`. `lib/erp/` — stub.
- `lib/queries/` — typed §8 signatures; P&L / Budget / Balance Sheet / Cash Flow / Runway / Dashboard /
  metrics all **read the seed**; `getAccountMap` reads the GL via the DataStore seam; Reporting/Sales/Scenario
  reads still throw `notImplemented` (the Run). `registry.ts` = Scout query↔tool seam (`wired:false`).
- `lib/target/` — `placeholder.ts` ONLY (Bearing identity, settings, seed depts + 8 OpEx groups; LOCKED config
  read by the seed + statements). `model.ts` is **retired** (the seed is the source).
- `lib/seed/` — the §12 generator: `prng.ts`, `names.ts`, `params.ts` (ALL tunable params), `subscription.ts`,
  `services.ts`, `personnel.ts`, `cost-of-revenue.ts`, `opex.ts`, `balance-sheet.ts` (step 5), `statements.ts`
  (seed→typed P&L/BS/CF/Runway, step 6), `dashboard-metrics.ts` (seed→19 metrics, step 6), `gl.ts` (chart of
  accounts + balanced JEs → trial balance, step 6b), `transactions.ts` (the transaction sub-ledger: explodes the
  monthly drivers into 13.6k individual txns reconciling to each driver; `getTransactionsSeed`), `index.ts` (getters).

### Seed status (steps 1–6b), all on `/dev/seed`
1. **Subscription** (`subscription.ts`) — deterministic cohort → 606 ratable recognition + deferred +
   ARR/MRR/bookings. Story events: churn spike Q3-2024, soft quarter Q1-2026, price increase Jan-2026.
2. **Services** (`services.ts`) — implementation projects attach to subscription acquisitions by tier →
   capacity-gated % complete + WIP + utilization. Capacity = PS headcount × `DELIVERY_PER_HEAD_PER_MONTH`.
3. **Personnel + CoR** (`personnel.ts`, `cost-of-revenue.ts`) — heads by dept + function tag
   (Direct/R&D/S&M/G&A), hiring surge H1-2025; CoR assembled = Direct payroll + hosting%×sub +
   passthrough%×svc. Exposes `indirectPayroll` (the P&L Indirect Payroll line MUST use this, not totalPayroll).
4. **Non-payroll OpEx** (`opex.ts`) — the 8 groups: Employee Expenses = burden×payroll; S&M programs +
   Insurance = %×revenue; T&E/IT/HR/Admin/Facilities = per-head.

5. **Balance sheet + cash flow** (`balance-sheet.ts`, step 5) — AR/DSO, prepaids, fixed assets + D&A,
   AP/DPO, monthly NI, the BS (A=L+E by construction) + indirect CF + runway.
6. **Seed → typed statements + metrics** (`statements.ts`, `dashboard-metrics.ts`, step 6) — the live
   queries read these; the app renders real Bearing data.
6b. **General ledger** (`gl.ts`, step 6b) — 25-account COA mapped to statement lines; 430 balanced monthly
   JEs from the seed → trial balance (Σ debits === Σ credits); the statements are a view of the GL. Wired
   through `InMemoryDataStore` (GL accounts, JEs, layer-1 records); `getAccountMap` reads it.

### Calibrated result (current; post 2026-06-18 high-growth retune)
- Revenue ≈ **$8.0M / $13.3M / $22.5M** (~+68% steady; FY25 ~5% under the §11 $14M — the expansion flywheel
  smoothed growth toward steady-accelerating). Mix **77/23** (~§11 75/25). GM trajectory 64.0% → 67.3% →
  **69.9%** (in band, widening, ~0.9pt above floor — thin; sensitive to hosting/pass-through rates).
- **High-growth retention engine:** **NRR 101% → 111%** (FY25→FY26), logo retention **91–94%**, GRR 91–96%,
  expansion ~22% of net-new (continuous land-and-expand). The headline lift vs the old 102%/86% profile.
- **Operating margin ≈ −38% (FY25) → −24% (FY26)**, improving toward breakeven (NI −$4.64M → −$4.93M; net
  margin −35% → −22%). FY24 is the deepest loss year. The retune's band-scaling lowered revenue against a held
  headcount cost base, so early losses run a touch deeper than pre-retune — a more pronounced "spending ahead
  of revenue." ~134 end heads.
- Cash: opening $7M + $9M Series B (Mar-2025) → **runway ~38mo** (a touch above the 24–30mo high-growth ideal —
  a real deferred-revenue / annual-upfront-billing effect; shorten only by investing harder, bounded by the $9M raise).
  Net burn ~$198K/mo; burn multiple 0.25x; magic 1.47x; CAC ~$146K; ARR/FTE ~$158K.
- **Services projects realistic:** 75 projects, 68 complete / 7 in-progress at the horizon (all started ≤3mo
  before it, no stranding). Utilization eased off the 100% pin in the forecast tail. WIP realistic (%-complete-in-arrears).
- **Tension to remember:** §11 locks ~140 heads AND ~$22M; the seed honors both → large P&L losses but
  low cash burn (deferred funds growth). The dashboard burn/runway tiles reflect this honestly. A true
  top-quartile rocket (sustained 90%+, NRR 120%, ~$27M raise, ~200 heads) would require re-opening §11 (Recipe B).

### Adversarial review (6 agents, steps 1–4) — findings, for the Task-1 audit
- **CONFIRMED CLEAN:** two-axis cost model has **no double-counting** (Direct→CoR once; burden on
  *total* payroll; S&M programs ≠ S&M payroll; hosting/pass-through don't overlap). Determinism sound
  (mulberry32, separate seeds, no wall-clock/random, stable draw order). WIP completing-month guard,
  capacity-gating direction, churn/contraction sign, negative-index modulo — all verified correct.
- **FIXED:** tautological checks → independent (subscription ARR-from-bookings; personnel
  payroll-from-records; services all-projects value-accounting, which caught + fixed a ~$4 residual
  leak); added `indirectPayroll`; stopped month-0 base-churn double-count; fail-loud invariants on the
  open param arrays; surfaced services horizon backlog; clarifying comments (burden-in-OpEx per §8;
  project marginPct is illustrative, not the authoritative services cost).
- **RESOLVED by the tie-out audit (2026-06-17):** all definitional/tautological checks relabeled with a
  typed `kind`; added independent checks (subscription active-records→ARR; services months-series vs field;
  CoR GM-trajectory); the four open gaps (deferred roll-forward, services FY26 −24%, model-vs-seed ~19pt
  op-margin gap, thin FY26 GM band) surfaced on the `/dev/seed` Reconciliation watch. See `tie-out-audit.md`.
- **RESOLVED in step 5:** deferred billings roll-forward (now a real billings series); D&A line (fixed
  assets + depreciation); AR/DSO, prepaids, AP/DPO; balance sheet + cash flow tie out.
- **RESOLVED in step 6:** queries repointed to the seed; `lib/target/model.ts` retired; the services miss
  (now +7/+11/−2% via attach↑ + %-complete billing); the WIP balloon (now ~$520K); model↔seed conflict
  (seed is the live source); burn/runway (dashboard reads the seed).
- **RESOLVED in step 6b:** JE → GL roll-up (`gl.ts`); Account Mapping wired via the DataStore; the trial
  balance balances and the statements are a view of the GL.
- **STILL OPEN (the Run):** per-transaction JE detail (currently monthly-summary) for Scout drill-to-JE;
  SaaS metric formulas (CAC/LTV:CAC/magic/burn-multiple) are first-pass; services `marginPct` vs assembled
  CoR deliberately unreconciled (surface in guide prose); customer/person name pools
  near-exhausted (ids unique, texture degrades — cosmetic).

## Remaining Harness DoD (§13)
- **Seed step 5** — balance sheet + cash flow. ✅ DONE (`lib/seed/balance-sheet.ts`; ties out by construction).
- **Seed step 6 — switch the live queries to the seed.** ✅ DONE: `lib/seed/statements.ts` +
  `dashboard-metrics.ts`; queries repointed; `lib/target/model.ts` retired; types extended; app renders real data.
- **Seed step 6b — JEs → GL roll-up + Account Mapping (the §12 GL reference impl).** ✅ DONE (`lib/seed/gl.ts`;
  trial balance balances; statements are a view of the GL; DataStore wired).
- **Reporting + Sales surfaces** — DECIDED (signatures + UI shape); the DataStore now serves the records. Built in the Run.
- **Scenario engine spec** — finalized (contract types already in `lib/types/scenario.ts`).
- **Guides** — ~80% drafted.

## Open decisions / watch-outs
- **AP/DPO: IN** — now built in the step-5 seed (DPO balance + cash-flow `change_ap`). §17 still lists it
  [RECOMMENDED]; the build has committed to it. Confirm the §17 status when convenient.
- **Charts/graphs** coming to the Dashboard (Chris) — tooling decision pending (charting lib vs
  hand-rolled SVG; sparklines are hand-rolled SVG today).
- **`lib/target` vs seed** — RESOLVED: `model.ts` retired; the seed is the single live source (step 6).
  Budget = a frozen plan derived from the seed forecast (per-line plan factors in `lib/seed/statements.ts`).
- **Build heap:** `npm run build` runs Node with `--max-old-space-size=4096` (in the script) — plain
  `next build` OOMs in "Collecting build traces" on this machine (large `node_modules` on OneDrive). Keep it.
- **Build EINVAL:** an occasional `EINVAL: readlink '.next/diagnostics/framework.json'` (OneDrive symlink
  sync artifact) — not a code error; `rm -rf .next` then rebuild clears it.
- **Env:** repo lives under **OneDrive** (`node_modules` syncs, slow); dev server first compile of a route
  can exceed 30s — a single long `preview_eval` may time out, so poll readiness in short steps (the route
  often lands on `/dashboard` first, then re-navigate to `/dev/seed`). `preview_screenshot` works.
- `diagrams/` are being refreshed; CLAUDE.md wins where a diagram lags. shadcn = Base UI (not Radix).
