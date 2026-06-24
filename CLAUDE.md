# CLAUDE.md — Dogfood

> **What this file is.** The single source of project context for building **Dogfood**, an AI-native FP&A platform. It captures every decision made during design, the things still open, and the order to build in. Read it top to bottom before writing code. When something here conflicts with an older PRD in `archive/`, this file wins.

> **Status legend used throughout:** `[LOCKED]` decided · `[PROPOSED]` working assumption, confirm before it hardens · `[OPEN]` not yet decided · `[ROADMAP]` deliberately deferred.

---

## 0. TL;DR — what we're building and in what order  _(updated 2026-06-20)_

Dogfood is a forward-looking **financial planning (FP&A) web app** for a fictional company we "dogfood" on. It is built on a **typed query spine** (`lib/queries/`) that is consumed by two callers: the module UI (React server components) and **Scout**, a persistent AI agent (Anthropic tool-use, zero RAG over structured data).

Build **top-down**, in a three-stage relay (§13): **Trailhead** clears the demo-company gate (design only, no code) → **Harness** builds the spine + the target Dashboard/P&L + the seed that reconciles *up* to them, fully defines the scenario contract and the metric set, and drafts ~80% of the guides → **the Run** builds the remaining modules + Scout for real on Harness's artifacts and finishes the guides. Decide and prepare in Harness; build in the Run.

The demo company is **Bearing (§11)** and the seed is built and ties out.

**Status (2026-06-22).** Harness (B) is complete; the Run (C) is well underway. Built on the live spine and tying out (43/43 seed checks): Dashboard + 20 metric tiles, all three statements (Forecasted P&L, Balance Sheet, Cash Flow — each with an FY and a monthly board view), and **all seven layer-1 registers read-only** (Contracts · Customers · Renewals · Pipeline · Projects · Staff · Expense Transactions), plus the Forecast driver pages, Board Package, and the 4 Scenario surfaces on the (built) Scenarios engine. **Scout is live + tool-complete** — key-optional Anthropic tool-use, **36 wired tools** (34 data + 2 product-knowledge) spanning dashboard/metrics/statements (incl. monthly P&L/BS/CF board views), all seven layer-1 registers, all seven forecast drivers, Board Package, the 3 scenario reads, and Flux (read + the variance-decomposition `getFluxDetail` + **`addFluxNote`, Scout's first WRITE**); streaming dog-pun step commentary, click-through receipts, and a routing eval at **LLM 63/63 (100%)**. **Supabase is LIVE `[2026-06-21]`:** the `InMemoryDataStore` → `SupabaseDataStore` swap is built, loaded (21 data tables / ~19k rows; 25 tables in the schema incl. the 4 empty write tables), and **validated** (round-trip parity exact + all gates green on Supabase + clean prod build); the app reads the persistent record layer from Supabase behind a `DATASTORE=supabase` flag, statements/metrics still deterministic TS (builders unchanged). **Flux Analysis — COMPLETE `[2026-06-21]`** (the first user-WRITE path) across all three anchor grains and every reading/config surface: the write store + the Expense-register transaction card + the **P&L · Balance Sheet · Cash Flow peek-pane notes** (shared `StatementFluxNotes`) + the **Account Mapping / TB account-grain card** (`?note=<code>`, rolls up to its statement line) + all Scout flux tools. **Scenario persistence is DONE `[2026-06-21]`** (`scenarios.adjustments` JSONB; the split-brain scenario store unified) and the **real frozen Budget snapshot is DONE `[2026-06-22]`** (resequenced step 3: `lockBudget`/`resetBudget` replace the synthetic per-read factor; the P&L Budget/Variance columns now read a lockable, resettable artifact). Also done this round (resequenced steps 1-2): the quick-win batch (a base-scope containment guard, truthfulness fixes, a real CAC-payback-**months** tile) and the monthly Balance-Sheet/Cash-Flow board views. Still to wire/build: the Setup write-screens and the remaining Supabase work — **RLS/auth, the CSV importer, the global as-of control**, and the other write paths (`setDriver` / override layer; persisting the budget snapshot to the Supabase table). `Handoff.md` has the exact next steps.

---

## 1. Product & brand

- **Dogfood** (`dogfood.cafe`) — **the product.** An AI-native FP&A platform for strategic finance. The name states the methodology: we dogfood the software on a fictional company running on seeded data. `[LOCKED]`
- **Dogsled** (`dogsled.dev`) — the studio/developer behind it. Public-facing tutorial/content hub. Modules may ship first as standalone Dogsled tutorials, then graduate component code into this shared spine. `[LOCKED]`
- **Scout** — the persistent AI agent *inside* Dogfood. Tool-use over the query spine. `[LOCKED]`
- **Fast Insights** — `[ROADMAP]` **paused.** Was once the eventual commercial destination. For this project there is **one product (Dogfood), one home (`dogfood.cafe`), no separate paid codebase.** Do not reference Fast Insights anywhere in the build.

---

## 2. Positioning

Lead with the vision, anchor with the category:

> **Strategic finance, made AI-native** — a living forecast, scenarios in minutes, statements that tie out, and an agent that works the same numbers you do.

- **Category (anchors comprehension):** "AI-native FP&A platform."
- **Posture (what we sell):** "strategic finance" — finance that looks forward and steers decisions, vs. backward-looking scorekeeping.
- Always say **"native," not "AI-powered."**
- Messaging ladder, never let an abstraction sit without a concrete capability: **posture → category → mechanism → proof.**
- Tagline: **"Know your next move."**
- Borrow one discipline from competitors (e.g. Numeric): anchor every abstract promise to a hard number. Our proof is a demo whose books actually tie out.

**Competitive frame (Numeric et al.):** Numeric and the close-automation tools own **record-to-report** (accounting, backward-looking, controller-facing, *acts on* the ERP). Dogfood owns **plan-to-perform** (FP&A, forward-looking, CFO/founder-facing, *reads* the ERP). They're complementary, not competitive — Dogfood sits downstream of a clean close. The honest one-liner: *"Numeric closes your books; Dogfood plans your future off them."*

---

## 3. Tech stack

- **Frontend:** Next.js 15 (App Router, server components), TypeScript, Tailwind CSS, shadcn/ui.
- **Data:** Supabase (Postgres) — **ACTIVE** `[2026-06-20]`. The project is no longer a throwaway demo: it is a **single-client production prototype** a CFO works out of daily, so Supabase is the real backend (persistent records + the CFO's mutable work: flux notes, scenarios, budget locks, imported actuals). **Single-tenant** (firm scoping at the DB, not per-row `firm_id` — see §17). The deterministic generator seeds it once; the TS statement/metric builders still compute over the stored data. Swap path = the `DataStore` seam (§4): `InMemoryDataStore` → `SupabaseDataStore`, one file. Schema + plan in `supabase/`. Vercel for hosting.
- **AI:** Anthropic Claude API (Scout — tool-use pattern).
- **Compute:** Modal (for any heavier LLM-adjacent / narrative work).
- Deterministic arithmetic in TypeScript; the model never asks an LLM to do math that must tie out.

---

## 4. Architecture — the query spine

The whole system hinges on **`lib/queries/`**: typed functions that are the *only* way anything reads financial data.

```
                        ┌─────────────────────────┐
   Module UI  ─────────▶│                         │
   (server components)  │      lib/queries/       │─────▶  DataStore  ─────▶  InMemory  (seed)
                        │  typed query functions  │      (interface)         Supabase   (target)
   Scout tools ────────▶│                         │
   (Anthropic tool-use) └─────────────────────────┘
```

### The six principles `[LOCKED]`

1. **Register vs. Process** (the "Tuesday test"): distinguish what is *recorded* from what *executes*. Helps decide whether a thing is a stored record or a derived computation.
2. **One Source, Two Callers:** every `lib/queries/` function is consumed by both the UI and Scout. No duplicated data logic, ever.
3. **Tool-Use over RAG:** structured financial data is served through typed tool calls, never retrieval. (RAG is fine for unstructured help/guide text only.)
4. **Typed Contracts at Every Seam:** strong types across every integration point — query inputs/outputs, tool schemas, the DataStore.
5. **Swap Don't Rewrite:** a `DataStore` interface lets us swap `InMemoryDataStore` → `SupabaseDataStore` with no restructuring. (We also apply this to *scope* — see scenarios, §9.)
6. **Scout Follows Modules:** Scout's tools expand only as modules are built. Never build agent capability ahead of the module that grounds it.

### Key seams

- **`DataStore` interface** — two implementations, selected by the `DATASTORE` env flag (`lib/datastore/index.ts`): `InMemoryDataStore` (the generator) and **`SupabaseDataStore` — BUILT + validated + LIVE `[2026-06-21]`** (production prototype, §3). `SupabaseDataStore` extends `InMemoryDataStore` and overrides only the record/config reads to `select` from Supabase; statements/metrics/driver-models are inherited (the TS builders read the generator directly, so they're unchanged + identical). The seed loaded into Supabase once (`scripts/seed-supabase.ts`); round-trip parity vs the generator is exact (`scripts/supabase-parity.ts`).
- **Data in — TB-driven, batch imports, reconciliation `[DECIDED 2026-06-20]`.** The **ERP** feeds the **trial balance + Chart of Accounts** (the financials). **Statements are trial-balance-driven**; the transaction sub-ledger rides alongside for drill + flux and **reconciles UP to the TB** (Σ detail per account === TB movement; a gap is surfaced as a blocking "unreconciled / needs attention" flag and cleared by fixing upstream — never plugged, never silently changing a statement — §16). Every operational domain batch-imports from its system of record (CRM→customers/contracts/pipeline, HRIS→staff, AP→vendors) via the CSV/XLSX templates in `import-templates/`. A live API connector (Salesforce/Rippling/ERP) can replace the CSV step later behind this seam — the CSV template *is* the contract it fills (field maps in `connectors/`). One global **as-of date** drives the actual/forecast split everywhere; importing a new month advances it (§16).
- **Write surfaces — deltas off immutable source.** `scenario_inputs` (scenario adjustments off Base, §9); **`flux_notes`** (Flux Analysis reviewer notes, keyed on the stable transaction id, surviving re-import — §16); and the **override layer** (manual edits on synced records, flagged + persisting across re-imports). Same pattern: the source stays immutable, the user's work layers on top.

### The Scout-ready bar  _(updated 2026-06-16)_

The architecture above is already right; this does not re-architect it. It's the explicit bar **Harness must satisfy** so the Run can wire Scout tools without touching the spine:

- Every `lib/queries/` function has a typed I/O contract, and its **output type is the basis a Scout tool's result schema derives from** — "one source, two callers" made concrete at the type level.
- Query functions are **pure + deterministic with serializable I/O** (no UI-only concerns leaking in), so tool-use can call them directly.
- The **query ↔ Scout-tool mapping is an explicit named seam** (a registry or equivalent), so adding a tool in the Run is wiring, not redesign.
- **Scout Follows Modules** holds: Harness defines the per-module tool *surface* but builds no tools ahead of the module; the Run wires them as modules ship.

---

## 5. The data model in five layers

Stop thinking in nav groups; think in layers. If every layer is present and each module sits in exactly one layer, the model is complete with no redundancy.

| Layer | Name | What it is | Modules |
|---|---|---|---|
| 1 | **Source records** | the atoms Scout points at | Pipeline, Contracts (incl. the Bookings view), Customers, Renewals · Projects, Staff, Expense Transactions · (GL / JEs underneath) |
| 2 | **Drivers** | forward assumptions that generate the forecast | Revenue Forecast, **Cost of Revenue**, Personnel, Expense Forecast · AR Forecast, Fixed Asset Budget, Prepaids Budget · **(AP/DPO — to add)** |
| 3 | **Statements** | the tie-out | Forecasted P&L, Balance Sheet, Cash Flow Forecast |
| 4 | **Metrics** | derived analytics (four families) | **Financial/profitability** — Revenue, gross profit, gross margin %, operating income, net income, net margin % · **Growth & Retention** — ARR/MRR, NRR/GRR, logo retention, growth · **Unit Economics** — CAC/payback, LTV/CAC, magic number, utilization · **Cash & Efficiency** — Rule of 40, burn multiple, net burn, runway |
| 5 | **Summaries** | the roll-ups | Dashboard, Board Package |

Wrapped by **Scenarios** (a lens over layers 2–5), **Scout** (a guide across all layers), and **Setup** (config: ERP/Data Import, Account Mapping, Settings).

**Diagnosis from this slotting:** we're strong on layers 1, 2, 3, 5. **Layer 4 (Metrics) isn't built yet** — it's the rung half the dashboard tiles drill into (surfaced *through* the Dashboard, not its own nav item). Now **accepted**: design decided in Harness, built in the Run (§17).

---

## 6. Drilldown / rollup map

Every dashboard tile must fall through *summary → mid-layer (metric / statement / driver) → source detail* and roll back up the same path. Scenarios wrap layers 2–5 (contained); Scout can walk any arrow either direction.

```
                          ┌─────────────────────────────────┐
              ┌──────────▶│   SUMMARIES          (layer 5)   │◀──────────┐
              │           │   Dashboard · Board Package      │           │
              │           └────────────────┬────────────────┘           │
              │                      drill ↓  ↑ roll up                  │
              │           ┌─────────────────────────────────┐           │
              │           │   METRICS     (layer 4 · NEW)    │           │
   SCENARIO   │           │   ARR · NRR · Rule of 40 ·       │   SCOUT   │
    LENS      │           │   burn · runway · CAC payback    │           │
              │           └────────────────┬────────────────┘  (tool-use │
  (contained  │                      drill ↓  ↑ roll up         over the │
   to the     │           ┌─────────────────────────────────┐  spine;   │
   Scenarios  │           │   STATEMENTS         (layer 3)   │  walks    │
   group;     │           │   P&L · Balance Sheet · Cash     │  any      │
   re-derives │           └────────────────┬────────────────┘  arrow,   │
   layers     │                      drill ↓  ↑ roll up         either   │
   2–5)       │           ┌─────────────────────────────────┐  way)     │
              │           │   DRIVERS            (layer 2)   │           │
              │           │   Revenue · CoR · Personnel ·    │           │
              │           │   Expense · AR · Fixed · Prepaid │           │
              │           └────────────────┬────────────────┘           │
              │                      drill ↓  ↑ roll up                  │
              └──────────▶┌─────────────────────────────────┐◀──────────┘
                          │   SOURCE RECORDS     (layer 1)   │
                          │   Pipeline·Contracts·Customers·  │
                          │   Renewals·Projects·Staff·       │
                          │   Expense Txns · GL/JEs          │
                          └────────────────┬────────────────┘
                                           │ feeds
                          ┌─────────────────────────────────┐
                          │  SETUP · ERP (actuals) ·         │
                          │  Account Mapping · Data Import    │
                          └─────────────────────────────────┘

  Scenario lens : applies ONLY inside the Scenarios group; source/actuals are shared & immutable
  Scout         : a tool-use agent over lib/queries; capabilities grow as modules ship
```

### Representative drill chains (build tiles so these resolve)

- **Revenue** → P&L revenue lines (Subscription / Services) → Revenue Forecast (by stream) ↘ actual side: Contracts (subscription) / Projects (services) → invoice/JE
- **Net income / margins (Financial family)** → Dashboard tile → P&L lines → their drivers (pane-only metrics drill into components)
- **ARR / NRR** → Metrics: Growth & Retention → Customers / Renewals / Contracts → one customer's contract history
- **Gross margin** → P&L → Cost of Revenue (non-employee rate × revenue) + Personnel (direct payroll) → Expense Transactions
- **Rule of 40 / Operating income** → Metrics + P&L → expense groups (Personnel functional + Expense Forecast) → Expense Transactions
- **Burn / Runway** → Cash Flow Forecast → drivers (Revenue, CoR, Personnel, Expense, AR, *AP*) → detail
- **Bookings / Pipeline coverage** → Contracts (Bookings view) / Pipeline → by stage or rep → a single deal
- **Services revenue / Utilization** → Projects + Revenue Forecast (services) → project & staff detail
- **Headcount** → Staff / Personnel → by department → a person

Every chain bottoms out in layer 1 and every chain is scenario-aware. That bidirectionality *is* the product feel.

### Peek vs Place `[LOCKED]`

On the **reading surfaces** (Dashboard + the Statements), the first tap on a number opens a **right-side pane** that shows the lineage *in place* — a "peek." The pane carries **"Open full ↗"** which navigates to the **working surface** (the register or driver). On the **working surfaces** (registers, drivers), interaction is direct navigation (row → detail). The rule: **peek where you read, navigate where you work.**

- **Actual** months peek their **register** (layer 1); **forecast** months peek their **driver** (layer 2).
- **Pure derived metrics** (gross margin, Rule of 40, CAC, etc.) are **pane-only** — the pane drills into the lines that compose them; there is no register to open. This is the one exception to peek-then-navigate.
- The pane is **just another spine caller** — no new data path. Addressed by a shallow URL param (e.g. `?inspect=subscription&period=2026-05`); no pane-in-pane.

Reference mocks: `diagrams/drilldowns-statements.svg`, `diagrams/drilldowns-dashboard.svg`.

---

## 7. Information architecture (the nav) `[LOCKED]`

Canonical rail: `diagrams/nav-rail-v16.svg`. Resting state, all dropdowns collapsed.

**Rule:** **groups** = co-equal top-level surfaces; **dropdowns** = variants of one surface. Don't turn a group into a dropdown or vice-versa.

```
OVERVIEW
  · Dashboard
  · Board Package
FINANCIAL STATEMENTS
  · Forecasted P&L
  · Balance Sheet
  · Cash Flow Forecast
REPORTING
  · Projects
  · Staff
  · Expense Transactions
SALES
  · Pipeline
  · Contracts            ← register + Bookings view + Schedules/Deferred + contracted-revenue bridge
  · Customers
  · Renewals
FORECASTS
  P&L drivers
    · Revenue Forecast
    · Cost of Revenue        ← non-employee cost-to-serve assumptions (reads Revenue + Personnel)
    · Personnel              ← payroll by department + function tag (Direct / R&D / S&M / G&A)
    · Expense Forecast ▸ (non-payroll OpEx groups, from Account Mapping: Employee Expenses, Sales & Marketing, Travel & Entertainment, IT, HR, Admin, Facilities, Insurance)
  Balance sheet drivers
    · AR Forecast
    · Fixed Asset Budget
    · Prepaids Budget
SCENARIOS                         ← contained; see §9
  · Scenario Manager
  · Scenario Drivers
  · Scenario P&L
  · Scenario Dashboard
──────────────────────────────
SETUP
  · Data Import
  · Account Mapping
  · Settings
  · User Guides ▸ (7)
footer: Chris · CFO  ·  Ask Scout launcher (bottom of rail; opens as a floating panel, lower-right)
```

**Why Sales sits between Reporting and Forecasts:** it's the revenue-source data the Revenue Forecast is built from. The revenue spine reads **Pipeline → Contracts → Customers → Renewals → Revenue Forecast → Forecasted P&L**, with **Contracts the pivot** — it holds the register, the **Bookings view** (period ΔARR: new / expansion / contraction), the schedules/deferred waterfall, and the contracted-revenue bridge, and it feeds 606 recognition and AR. (Bookings is a view inside Contracts, not a separate nav item; the Dashboard keeps a Bookings/ARR tile.)

**Account Mapping is load-bearing:** it's the editable account→statement-line map that the statement engine and every drill-down read. The expense-group dropdown under Expense Forecast is sourced from it (define a group in Account Mapping → it appears in the dropdown). **Expense groups are config-driven, not hardcoded:** Account Mapping owns membership (GL account → group); Settings owns the group *set*, labels, and order. Each group carries a **typed classification** (Cost of Revenue vs OpEx) plus a **function sub-role** (Direct / R&D / S&M / G&A) so the statement engine, the metrics, and the Expense▸group scenario lever can all reason about it. Membership/label/order are editable; the classification is typed (Typed Contracts at a Seam). Each GL account may also carry a **function tag** so the functional metrics (CAC, magic number, R&D-%-of-revenue) can reassemble functional views without disturbing the natural P&L.

---

## 8. Module specs

For each, one-line purpose · layer · proposed `lib/queries/` functions · Scout tools. Query/tool names are proposals — keep them typed and consistent, refine as you build. Scout tools are added per **Scout Follows Modules**.

**Build status (2026-06-22).** BUILT on the live spine: Dashboard + 20 metric tiles; Forecasted P&L · Balance Sheet · Cash Flow (each with FY columns + a `?view=monthly` board view); **all seven layer-1 registers read-only** (Contracts · Customers · Renewals · Pipeline · Projects · Staff · Expense Transactions); the Forecast driver pages; Board Package; and the 4 Scenario surfaces on the built Scenarios engine. **Scout DATA tools wired (34; + 2 product-knowledge) — tool-complete across the shipped surfaces:** the statements/dashboard/metrics lane (`getDashboard` · `explainTile` · `getMetric` · `getPnL` · `getMonthlyPnL` · `explainVariance` · `getBalanceSheet` · `getMonthlyBalanceSheet` · `getCashFlow` · `getMonthlyCashFlow` · `getBoardPackage`); the Sales/Reporting registers (`getContracts` · `getContract` · `getBookingsHistory` · `getCustomers` · `getCustomer` · `getRenewals` · `getPipeline` · `getProjects` · `getStaff` · `getExpenseTransactions`); the 7 Forecast DRIVERS (`getRevenueForecast` · `getCostOfRevenue` · `getPersonnelForecast` · `getExpenseForecast` · `getArForecast` · `getFixedAssetForecast` · `getPrepaidsForecast`); Scenarios read (`getScenarios` · `getScenarioPnL` · `compareScenarios`); and **Flux** (`getFluxNotes` · `getFluxDetail` · **`addFluxNote` — Scout's first WRITE**) (+ product-knowledge `getProductMap` · `describeModule`). Routing validated by the LLM eval at 63/63. NOT yet wired: scenario WRITE (`setDriver` — unblocked now that scenario persistence has landed, still to wire); the Account Mapping / Data Import / Settings WRITE UIs. The per-module specs below stand; where a module shipped, the proposed names are the built names. (On the production path, **statements are trial-balance-driven** per §4 — the seed's GL *is* the TB source and the sub-ledger reconciles to it, so the §6/§8 "view of the GL" framing and the new TB-driven framing are the same pipeline.)

### Overview
- **Dashboard** — the live cockpit; tiles that drill. *Layer 5.* `getDashboardSummary()`, `getKpiTile(metricId, period)`. Scout: `getDashboard`, `explainTile`.
- **Board Package** — the exportable monthly/quarterly deliverable. *Layer 5.* `getBoardPackage(period)`. Scout: `getBoardPackage`.

### Financial Statements
- **Forecasted P&L** — P&L with **Budget · Actual · Variance · Forecast** columns. *Layer 3.* `getPnL(period, {scenarioId?})`, `getPnLLine(lineId, period)`. Scout: `getPnL`, `explainVariance`. **First tap = peek pane** (§6 Peek vs Place). The locked line layout:

```
Revenue
  Subscription · Services · Total Revenue
Cost of Revenue
  Direct Payroll                 ← Personnel · Direct-function depts (base comp)
  Non-employee Cost of Revenue   ← Cost of Revenue module · rate × revenue per stream
  Total Cost of Revenue
Gross Profit            ·  Gross Margin %
Operating Expenses
  Indirect Payroll               ← Personnel · R&D/S&M/G&A depts (ONE subtotal; depts expandable within)
  Employee Expenses              ← all payroll burden: taxes, medical, other benefits (direct + indirect)
  Sales & Marketing (programs) · Travel & Entertainment · IT · HR · Admin · Facilities · Insurance
  Depreciation & Amortization    ← Fixed Assets
  Total Operating Expenses
Operating Income (EBIT) ·  Operating Margin %
  Interest / Other · Taxes
Net Income              ·  Net Margin %
```

  Two **off-statement payroll views** (not on the main P&L): **Total Payroll** (Direct + Indirect, by department, heads + comp) and **Departmental P&L** (each function fully loaded — department payroll + burden share + tagged non-payroll). The Departmental P&L is what powers the functional metrics (CAC, magic number, R&D-%-of-revenue); the main P&L shows only Direct vs Indirect payroll.
- **Budget — the locked baseline** `[LOCKED]`. Budget is a **frozen snapshot of the layer-2 drivers** taken at plan time: the approved annual plan, immutable once locked, the yardstick for variance. **Base** keeps moving as actuals close (the working forecast, the app default); the Budget snapshot does not. You **set the Budget by locking** a working plan (or an approved scenario). The Forecasted P&L's Budget/Variance columns read this snapshot; `getBudget(period)` / `lockBudget(...)`.
- **Balance Sheet** — *Layer 3.* `getBalanceSheet(period, {scenarioId?})`. First tap = peek pane.
- **Cash Flow Forecast** — *Layer 3.* `getCashFlow(period, {scenarioId?})`, `getRunway()`. First tap = peek pane.

### Reporting
- **Projects** — services delivery; % complete, WIP/unbilled, capacity. *Layer 1.* `listProjects()`, `getProject(id)`, `getUtilization(period)`.
- **Staff** — the people register. *Layer 1.* `listStaff()`, `getHeadcount(period, {byDept?})`.
- **Expense Transactions** — GL-level expense detail. *Layer 1.* `listExpenseTransactions(filter)`.

### Sales (the revenue funnel; all *Layer 1*)
- **Pipeline** — open opportunities. `listPipeline({byStage?,byRep?})`, `getPipelineCoverage()`.
- **Contracts** — signed agreements; **the 606 / deferred / AR pivot**, and the home of bookings. Holds: the register; a **Bookings view** (period ΔARR — new / expansion / contraction); a **Schedules/Deferred** view (606 ratable + deferred waterfall); and a **contracted-revenue bridge** (recognized-to-date solid, contracted-forward dashed, split at today — the RPO/backlog wedge between actual and forecast). `listContracts()`, `getContract(id)`, `getDeferredWaterfall(period)`, `getBookings(period,{byStream?})`, `getContractedRevenue(period)`.
- **Customers** — accounts; ARR, expansion, churn. `listCustomers()`, `getCustomer(id)`, `getArr(period)`.
- **Renewals** — the retention motion (the forward worklist that defends the contracted base). `listRenewals(window)`, `getNrr(period)`, `getGrr(period)`.

### Forecasts (drivers; *Layer 2*) — each accepts an optional `scenarioId`

**Two-axis cost model `[LOCKED]`.** Every cost has a **nature** (payroll vs non-payroll) and a **function** (Direct/CoR · R&D · S&M · G&A). You *input* by nature (Personnel for payroll, Expense Forecast for non-payroll) and by department/category; you *present and measure* by function via the function tag. Cost of Revenue is **assembled** from those, not entered.

- **Revenue Forecast** — owns subscription and services. **Subscription** forecast = **contracted (read from Contracts) + a new-business / retention assumption** (it does not re-derive contracted revenue — one source, two callers); 606 ratable + deferred waterfall + ARR. **Services** = capacity-driven (% complete + unbilled/WIP); implementation capacity gates SaaS go-lives. `getRevenueForecast(period, {stream?, scenarioId?})`, `getRecognizedRevenue(period, {stream?})`.
- **Cost of Revenue** — **a coupled driver, not standalone input.** Sits between Revenue Forecast and Personnel; holds the **non-employee** cost-to-serve assumptions. `getCostOfRevenue(period, {stream?, scenarioId?})` = **Direct Payroll** (read from Personnel's Direct-function departments) **+ rate × revenue per stream** (subscription infra/hosting/pass-through as % of subscription revenue; services pass-through). The rate is the only new input here, and is what the **Direct cost** scenario lever perturbs. The rate model is swappable behind this stable line (% of revenue → later per-active-customer / per-usage-unit; the P&L line + GM% tile never change). A new revenue stream = a new rate row, not a rewrite.
- **Personnel** — payroll **by department + function tag**. `getPersonnelForecast(period, {dept?, function?, scenarioId?})`. Seed departments (editable in Settings): Professional Services, Support → **Direct (CoR)**; Engineering, Product & Design → **R&D**; Sales, Marketing, Customer Success → **S&M**; Finance, People, Ops → **G&A**. Direct-function depts roll into Cost of Revenue; the rest into the P&L's single **Indirect Payroll** line. Base comp here; the burden (taxes/medical/benefits) lives in the Employee Expenses OpEx group.
- **Expense Forecast** — **non-payroll OpEx only**, by group (groups + classification come from Account Mapping; §7). Seed groups: **Employee Expenses** (all payroll burden — taxes/medical/benefits, direct + indirect), **Sales & Marketing** (programs only), **Travel & Entertainment**, **IT**, **HR**, **Admin**, **Facilities**, **Insurance**. `getExpenseForecast(period, {group?, scenarioId?})`.
- **AR Forecast** — DSO-driven receivables. `getArForecast(period, {scenarioId?})`.
- **Fixed Asset Budget** — capex + depreciation schedule. `getFixedAssetForecast(period, {scenarioId?})`.
- **Prepaids Budget** — prepaid amortization. `getPrepaidsForecast(period, {scenarioId?})`.
- **(AP Forecast — DPO)** `[OPEN]` add so cash & working capital tie out (or fold payment timing into Expense Forecast).

### Setup
- **Data Import** — CSV/XLSX **batch imports for every data domain, upsert on a stable id** (§4): trial balance + COA + JEs from the ERP; customers/contracts/pipeline from CRM; staff from HRIS; vendors + bills from AP; plus budget, AR/AP aging, FX. Templates + the import/period/reconciliation model live in `import-templates/`. **Live API connectors (Salesforce/Rippling/ERP) are `[ROADMAP]`** (§18) — the CSV template is the contract a connector fills.
- **Account Mapping** — the account→statement-line map (editable). Read by the statement engine and all drill-downs.
- **Settings** — firm/period config.
- **User Guides** — the six guides (§14), served as help content.

---

## 9. Scenarios — the contained model `[LOCKED]`  _(updated 2026-06-16)_

**Decision:** reject global scenario state. **Contain scenarios to the Scenarios group only.** Keep the lens *capability* in the spine (forecast functions accept an optional `scenarioId`; `scenario_inputs` stores deltas off Base; actuals are shared/immutable — the only branch point) but **scope its application** to the group. No top-bar switcher. Dashboard / P&L / statements are always Base + actuals.

**Dynamic by design.** Scenarios are **user-created**, not a fixed list: users create / duplicate / reset their own, each built from the adjustment DSL below. The named scenarios further down are *seed presets* (example bundles), not the model. Containment is unchanged — the dynamic richness lives entirely inside the Scenarios group, and the rest of the app never leaves Base + actuals.

This is "Swap Don't Rewrite" applied to **scope**, not storage — we can widen to global later by widening scope, not rewriting. **Trade we accept:** you cannot drill a scenario number to source through the outside modules. The audience (founders/board) won't miss it — board scenarios are about *shape* (margin, runway, growth), not drilling a hypothetical to a transaction.

### The adjustment unit (the "small DSL")

Depth and time are independent of containment — you can have rich, time-aware inputs that still never touch a module outside the group. Each scenario stacks a few **adjustments**:

```
adjustment = lever (a driver, optionally narrowed to a sub-dimension)
           + magnitude (the slider)
           + time window (Start, optional End)
           + shape (Step | Ramp)
```

- **Depth = more rules + finer targeting, NOT line-by-month cell editing.** Keep the slider set **coarse** (one lever per driver/sub-dimension). The moment you allow per-line month editing you've rebuilt the expensive machinery you chose to skip.
- **Sub-dimensions:** Revenue → bookings/growth, split by stream (subscription vs services); Personnel → hiring pace/adds by department (+ "freeze"); Expense → opex level by group (from the live group set); Direct cost → the **Cost-of-Revenue rate / target margin**; AR → DSO; AP → DPO.
- **Time:** granularity is **monthly** `[LOCKED]`. Start + optional End ("if applicable" — most run start-through-horizon; bounded ones revert to Base after the End).
  - *Rate* levers (growth, DSO, unit cost): the rate is overridden inside the window, Base outside.
  - *Level* levers (headcount, opex): the delta applies inside the window.
- **Shape:** **Step** (full at start) and **Ramp** (phase-in across the window) — **ramp is in** `[LOCKED]`.

Reference mock: `diagrams/scenario-drivers.svg`.

### The four-item group `[LOCKED]`
- **Scenario Manager** — the scenarios + Base; create / duplicate / reset. No global save-state machinery.
- **Scenario Drivers** — the adjustment board: stacked levers, each a slider + monthly window + step/ramp.
- **Scenario P&L** — the contained result; **each scenario picks its comparison baseline: Base (working forecast) or Budget (the locked snapshot).** Version dropdown: Budget, Base Forecast, + the seed-preset scenarios and any the user creates.
- **Scenario Dashboard** — the compare/board view, 2–3 side by side + KPIs. (Name chosen over "Scenario Compare." Absorbs what would have been a separate compare page.)

### Seed presets (example bundles, not the model)
**25% Profit** · **Capacity** · **Breakeven** ship in the seed as ready-made example scenarios — each a *saved bundle* of time-bounded adjustments the user could have built themselves. They are presets, not part of the model; users can edit, duplicate, or ignore them. Their exact lever contents lock once **Harness** locks the base drivers + the dashboard metric set (#5 / §17) — that's what the presets, and the lever menu, are written against.

### The scenario contract (typed) — Harness locks this in full (not 80%)

Because scenarios are dynamic, the adjustment system is a **fully specified typed contract**, not a loose UI. Harness pins all of it (a dynamic system is only safe once these are nailed):

- **Lever enumeration** — a *closed typed union* of the levers + sub-dimensions from the list above (Revenue▸stream, Personnel▸dept incl. *freeze*, Expense▸group, Direct cost, AR▸DSO, AP▸DPO). **No free-form levers.**
- **Adjustment schema** — `lever + magnitude + window (Start, optional End) + shape (Step | Ramp)`, **monthly** granularity; rate-vs-level semantics retained (rate levers override in-window, level levers apply a delta in-window).
- **Composition + precedence** — define what happens when two adjustments hit the **same lever with overlapping windows**: stack, override (last-wins), or reject. State the rule; the engine must be deterministic about it.
- **Validation** — what the engine **rejects**: windows outside the forecast horizon, magnitudes past their limits, disallowed lever combinations. State the rules.
- **Engine contract** — pure deterministic TypeScript; one operation: *Base + the scenario's active adjustments for the period → re-derive Scenario P&L + Scenario Dashboard only.* `scenario_inputs` holds the structured, period-bounded deltas. Nothing outside the Scenarios group changes.

**Assignment:** **Harness defines** this contract + the engine spec in full (locked here, not left at 80%). **The Run builds** the engine and wires Scout's `setDriver` / `compareScenarios` (group-scoped) — wiring, because the contract already exists.

---

## 10. Scout  _(updated 2026-06-16)_

A persistent AI agent in the app. **Tool-use over `lib/queries/`, zero RAG for structured data.** Module-aware (knows which surface you're on). Can walk any drill chain in either direction because each arrow is a typed query it can call. Scenario tools are scoped to the Scenarios group. Capabilities are added **only as modules ship** (principle 6). **Launches from a button at the bottom of the nav rail and opens as a floating panel, lower-right.** **Scout shows its work as it runs** — the response streams one step per tool call, narrated with light, on-brand commentary (the dog motif: "Sniffing out gross margin %…", "Herding the contracts…") and a click-through receipt per call, so the user watches the calculation happen and can audit every number. `[LOCKED — 2026-06-20]` **Built + tool-complete `[2026-06-21]`:** Scout is live — key-optional Anthropic tool-use (`SCOUT_MODEL = claude-sonnet-4-6`; deterministic keyword-router fallback with no key), **34 wired data tools + 2 product-knowledge** (§8 build status — statements/metrics incl. the monthly P&L/Balance-Sheet/Cash-Flow board views, all seven layer-1 registers, all seven forecast drivers, Board Package, the 3 scenario reads, and Flux read/decomposition/**write**), a receipt per call, and a routing gate `scripts/scout-eval.ts` (free structural + deterministic layers + a 63-case LLM routing set, last run **63/63**; the eval forces the in-memory store so the `addFluxNote` write-cases are ephemeral). **`addFluxNote` is Scout's first WRITE** — it records a flux note attributed to the user (`source = scout`); the registry marks write tools with a `write` flag so they're never run as read thunks. `setDriver` (scenario write) stays deferred until scenario-input persistence lands.

**Scout-ready handoff:** Harness leaves the spine satisfying the Scout-ready bar (§4); the Run then wires each module's tools as it ships — adding a tool is wiring against an existing typed seam (the query↔tool registry), not redesign.

Reference mock: `diagrams/scout-dock.svg`.

**Scout is in-app only `[LOCKED — 2026-06-19]`.** Scout lives entirely inside Dogfood: the bottom-of-rail launcher plus the floating lower-right panel. **No Slackbot and no proactive Slack alerts** — the former "Flavor C" (proactive alerts via Slack) is **rejected, not deferred.** Both reactive Q&A and any proactive nudges surface in-app. This keeps Scout's whole surface on the query spine with a single delivery channel and removes the Slack integration from scope entirely. (The prior Slack hackathon work is not carried into this build.)

---

## 11. Demo company — **Bearing** `[LOCKED]`

The demo company is **Bearing** (chip in mockups: Bearing / "BR" / "FY26 · Jun"). A literal dog name was rejected on purpose — the demo's job is to look like a *believable* company, and "Bearing" doubles as the heading metaphor ("Know your next move") and the mechanical sense (precision).

- **Company:** a B2B **AI-native FP&A SaaS company with a professional-services / implementation arm** — i.e. Bearing sells the same kind of product Dogfood is, the clean meta-mirror. `[LOCKED]`
- **Customer base `[LOCKED — 2026-06-18 peer-profile retune]`:** sells to **other venture-backed tech / AI / SaaS / fintech startups**, modelled to read as a credible peer of the real AI-native-finance cohort (Numeric, Campfire, Aleph). The seed customer pool and Bearing's own vendor spend (its AWS / Anthropic / Datadog / Ramp stack) are themed accordingly — **not** old-economy industrial. See the §17 retune note.
- **Mix:** ~**85% subscription / 15% services** by FY26 `[LOCKED — was 75/25; retuned 2026-06-18]`. Tapers ~25% → 19% → ~15% across the arc ("services-led early, product-led as it matures") — the software norm for an AI-native FP&A peer, with the implementation arm framed as ERP-style migration/onboarding. (The prior 25% sat above the ~15% all-software benchmark.)
- **Scale (3-year arc):** ~$8M → $14.5M → $23M revenue (FY26 growth ~61%); **~40 → 140 heads**, a software-shaped org (R&D 37% · S&M 32% · Direct 19% · G&A 12%); **Series B ~$20M** (right-sized for a capital-efficient $23M-revenue company — the cohort raises more (Numeric $51M, Campfire $65M, Rillet $70M, Aleph $29M) but at far smaller, hype-stage ARR). Spends ahead of revenue yet capital-efficient on a cash basis (FY26 NI ≈ −$11.9M = **−51% GAAP / −33% non-GAAP / −17% FCF** margin; NRR 109% (i-12 cohort), magic 1.2x, LTV:CAC 4.1x, Rule of 40 25%, burn multiple 0.6x, runway ~49mo). **Why the ~49-month runway is structural, not hoarding:** Bearing bills annual-prepay, so growth itself *generates* cash — a low burn multiple and a long runway are the cohort-accurate consequence of the prepay model, not an over-raised balance sheet (lead with this whenever the runway reads optimistic). `[LOCKED — coherent-efficient recalibration 2026-06-19; unit-econ formulas tightened 2026-06-20, live values re-anchored 2026-06-22, see §17]`
- **Calendar:** calendar fiscal year. Jan 2024 – May 2026 closed; **June 2026 in close**; Jul–Dec 2026 forecast. `[LOCKED]`
- **Revenue model:** subscription (606 ratable + deferred waterfall + ARR), services (% complete + unbilled/WIP, capacity-constrained). **Implementation capacity gates SaaS go-lives**, so delivery capacity caps ARR activation — this coupling is the interesting part of the model.
- **Accounting scope `[LOCKED]`** — **IN:** subscription 606/deferred, services %-complete/WIP, AR/DSO, payroll (Personnel by dept/function), the two-axis cost model (Cost of Revenue assembled; non-payroll OpEx groups), **stock-based compensation (ASC 718 — non-cash, equity-neutral; reported GAAP plus the standard non-GAAP / free-cash-flow reconciliation via `getNonGaapReconciliation`)**, **operating leases (ASC 842 — right-of-use asset + lease liability on the balance sheet; the lease cost stays in the Facilities OpEx line, so P&L / cash / net income are unchanged)**, Budget snapshot + variance, capex/depreciation, prepaids. **OUT (defer):** commission capitalization (ASC 340-40 — the more legitimate "eventually" item; standard SaaS GAAP) and capitalized software (ASC 350-40 — likely never; expensing R&D is the cleaner, common choice). The 2026-06-19 milestone review ranked these two below the visible statement/register work.

**Seed status:** the deterministic generator (§12) has been run and recalibrated several times; the numbers above are the current calibrated result, verified by `scripts/data-sweep.ts` (43/43 tie-outs green) and `scripts/scout-readiness.ts` (74/74). AP/DPO is built (§17). All parameters live in `lib/seed/params.ts` and stay tunable without touching the engine.

---

## 12. Seed data method `[LOCKED approach]`

**Generate the seed the same way the product forecasts:** drivers → balanced JEs → GL → statements. It ties out by construction, and the seed doubles as a reference implementation of the spine.

- **Deterministic TypeScript** for all arithmetic; **Claude** only for texture (customer/vendor names, project descriptions, memo lines).
- A few deliberate **story events** so the data has narrative: a churn spike, a hiring surge, a soft quarter, a price increase.
- **Top-down (target-first):** hand-set the 3-yr P&L shape + the dashboard KPIs as the "story," then the generator works downward to produce transactions that roll up to *exactly* those targets.

---

## 13. Build plan — the three-stage relay  _(updated 2026-06-16)_

Three distinct stages; don't conflate them. Each has a working name and an alias; the aliases keep older references valid. (These are internal **stage codenames**, not the demo company's name, which is still open in §11.)

**Handoff rule:** each stage ends by naming the next and exactly what it hands over. Nobody jumps ahead. **This file beats any kickoff prompt.**

- **Trailhead = (A) — the design.** The brainstorm + this file + `diagrams/`. Clears the §11 gate. **No code.** Hands to Harness: this file, company confirmed.
- **Harness = (B) — decide + prepare.** Builds the spine and the target, prepares the seed, and *defines* (does not build) the scenario engine and the metrics layer. Hands to the Run: a compiling spine, tying-out targets + seed, a typed scenario contract, a decided metric/driver set, a Scout-ready spine, and ~80% guides.
- **The Run = (C) — build.** Builds the remaining module surfaces + Scout for real on Harness's artifacts, and finishes the guides.

### Harness (B) — Definition of Done

The Run does not start until every item below is checked off. Front-loading only pays off if Harness actually finishes.

- **Phase 0 — spine, BUILT:** Next.js 15, TS, Tailwind + shadcn, nav v16, `DataStore` + `InMemoryDataStore`, domain types, `lib/queries/` signatures, `ErpConnector` stub, brand tokens (§19).
- **Phase 1 — Dashboard + Forecasted P&L, BUILT** as real components on the spine and **tying out.** Building them is what **locks the dashboard design + the primary metric set.** Carried into the Run, not throwaway.
- **Reports — DECIDED:** the Reporting + Sales source surfaces specced (function signatures + UI shape — concrete enough that the Run renders them, not re-decides their data contracts). Built for real in the Run.
- **Phase 2 — seed, PREPARED:** the §12 generator (drivers → JEs → GL → statements) run to produce a dataset that ties out to the Phase 1 targets **by construction.**
- **Scenario model — DEFINED** as a typed contract + engine spec (§9). Engine built in the Run.
- **Metrics layer — DESIGN decided** (§5 / §17). Built under the Dashboard in the Run.
- **Scout-ready** — the spine satisfies the §4 bar.
- **Guides — DRAFTED (2026-06-20, Run).** All seven User Guides now exist as grounded prose in `lib/guides/content.ts`, rendered at `app/setup/guides/[slug]` (no longer placeholders). They are the single source for BOTH the help route AND Scout's product-knowledge lane (§10) — "one source, two callers" for guide text. Refine exact UI wording against built modules as the Run ships them. [The earlier "~0% prose" status is resolved.]

### The Run (C) — builds for real on the above

- **Phases 3–5:** the Reporting + Sales module surfaces, Account Mapping wiring, the remaining drivers and the Balance Sheet / Cash Flow statement modules, the **Metrics layer** (the Dashboard's metric tiles + drill-downs), the **Scenarios engine**, and **Scout tools per shipped module** (wire against the typed `lib/queries/registry.ts` seam — the full two-lane tool surface is declared, `wired: false`).
- **Guides & processes — a FIRST-CLASS, early step (do partially up front).** The seven User Guides are drafted (`lib/guides/content.ts`) and double as Scout's product-knowledge lane; keep them moving alongside each module (they capture the "how to use it" processes/SOPs and ground Scout's how-to answers), refining exact UI wording as modules ship. Having the processes partially done substantially de-risks the rest of the Run.
- **Scout** — wire tools as modules ship (Scout Follows Modules); see §10 for the tool surface, the two lanes, receipts, the routing eval, and the model choice.

A kickoff prompt for **Harness** points Claude Code at this file and starts at **Phase 0 → Phase 1**: scaffold the spine, then stand up the example Dashboard + P&L against the confirmed target numbers. (The Run gets its own kickoff prompt once Harness's DoD is met.)

---

## 14. The six user guides `[LOCKED]`  _(updated 2026-06-16)_

Served in-app under Setup ▸ User Guides. Writing them is part of speccing each area — **spec-first, prose-later.** What **Harness locks** is the *structural* spec per area (its `lib/queries` functions, module-UI shape, Scout tool surface); what **the Run finishes** is the guide *prose* + exact UI wording. So "guides ~80%" means the prose is ~80% — never that the specs are 80%.

1. Getting started
2. Budgets & forecasts
3. Updating actuals
4. Creating scenarios
5. Reading the statements
6. Asking Scout

---

## 15. Conventions

- **Typed contracts everywhere** (principle 4). Query inputs/outputs, Scout tool schemas, and the DataStore are all strongly typed.
- **No duplicated data logic** — if the UI and Scout both need it, it's one `lib/queries/` function (principle 2).
- **Periods** are explicit parameters; never implicit "now."
- **Deterministic math in TS**; LLM only for language/texture, never for numbers that must tie out.
- Prose/UI copy: avoid em dashes.
- Money/units typed and centralized; no stringly-typed amounts.

---

## 16. In scope / out of scope

**In:** FP&A planning surfaces (the five layers), contained scenarios, Scout over the spine, **a Supabase backend** (single-tenant production prototype, §3/§4), **batch CSV/XLSX imports for every data domain** (TB + COA from the ERP; customers/contracts/pipeline from CRM; staff from HRIS; vendors from AP — `import-templates/`), **trial-balance-driven statements with sub-ledger reconciliation** (§4), **Flux Analysis** (variance review with reviewer notes saved per transaction — `flux_notes`; **the write store + the note card on the Expense Transactions register are BUILT and live on Supabase `[2026-06-21]` — the first user-write path; remaining surfaces (peek pane · TB/account grain · Scout flux tools · the decomposition table) per §17 / flux-analysis.md**), a **manual-override layer** on synced records, a seed that ties out.

**Out / deferred:**
- A **cap table** (Carta's job).
- **AP/AR subledger *operations*** and the **close itself** (the ERP's job — Dogfood *reads* a clean close; statements are TB-driven, never re-summed from a line-item feed).
- **Pure variance as its own module** — variance is the Budget/Actual/Forecast columns on every statement + Scout's narrative. **NOTE: Flux Analysis** (reviewer notes on transactions) is now IN scope, and is distinct from plain variance.
- **Live API connectors (Salesforce/Rippling/ERP) — `[ROADMAP]`, not this build (§18).** The mechanism today is CSV/XLSX batch import; a direct connection replaces the CSV step later behind the DataStore seam. The CSV template *is* the contract a connector fills.
- `[Deferred]` commission capitalization (ASC 340-40), capitalized software.

---

## 17. Open decisions & outstanding ideas  _(updated 2026-06-22)_

Most of the design is now locked. What remains:

**Decided 2026-06-22 (the Run — CSV importer architecture; Chris: a little more than a demo — 50-100 trial users over 3 days + a Loom recording, so the tie-out must be visibly, provably accurate) `[LOCKED]`:**
- **The trial balance is the single source of truth** for the statements' Actual — and already is at read time: post the override-layer slice, the Actual column rolls up from the GL at the account grain (`activityByStatementLine` → statement line), which IS the trial balance. The seed's drivers are only how the books were generated; what the statements PRESENT is the TB (it balances on its own — no plug). This formalizes the §4/§16 TB-driven model; it is not a rewrite.
- **The control total is the detail-to-TB reconciliation** (the back-check Chris asked for): for accounts with a sub-ledger (expenses↔vendor bills, revenue↔invoices, payroll↔paychecks, AR↔receipts), `Σ(detail per account, period) === the TB movement`, with a signed variance + a Σ|variance| control total + a BLOCKING "needs attention" flag over a materiality threshold (`max($1, 0.1%·line)`) — never a plug, fix-upstream (§16). Accounts with no sub-ledger (equity, D&A, manual JEs) are TB-only (authoritative; nothing to reconcile up → no false variance). It surfaces ON **Setup → Data Import** (Chris's call): a standing reconciliation control total + a TB upload that runs the same check + the import-time commit. The detailed-account tie-out is already proven by the gates (data-sweep "Vendor bills → GL sub-account" + "P&L Actual ← GL rollup", both Δ$0.00); the work is making it VISIBLE + wiring the importer.
- **The TB storage-overlay is DEFERRED** (a restatement engine where a DIFFERING imported TB moves a closed-month Actual). Accuracy comes from the reconciliation control total, not from letting imports rewrite Actuals; the overlay would create a 2nd source of truth, silently desync Cash Flow NI from P&L NI (`statements.ts:446`), and has zero data-sweep coverage. Stays behind a clean `TBOverlayStore` seam.
- **BUILT this session (the importer foundation):** the global as-of is now WRITABLE (`getCloseBoundary`/`setCloseBoundary` mutable + `DataStore.updateSettings`/`advanceClose`; proven tie-out-neutral by `importer-asof-check`), and trial-balance VALIDATION (`lib/import/{parse-csv,types,validate}.ts`; the real TB foots to the penny). **Next session builds the reconciliation control total** (the locked model above) — see `Handoff.md` ▶ NEXT.

**Also resolved 2026-06-22 `[LOCKED]`:** Scout's FULL scenario WRITE surface is wired (create/duplicate/setDriver/reset/delete — resolves the long-open Scout-scenario-scope item below), and the deferred QC finding **F4** (a flux note follows its account's statement-line re-point) is fixed.

**Decided 2026-06-21 (the Run — next-steps review + decision gate; Chris: "fully resolve, no defer") `[LOCKED]`:**
- **Guides truthful + a 7th guide (DONE).** `lib/guides/content.ts` is Scout's product-knowledge corpus; corrected the ERP-"one live integration" line (→ every domain batch-imports, connectors are roadmap, §16/§18), the Scout-`setDriver`-is-live implication, and the budget-lock framing; added `creating-a-flux-analysis` (guide #7), adapted to the `GuideBody` markdown subset. **§14 is now seven guides.**
- **Edge access gate (DONE).** `middleware.ts` Basic-Auth over all routes, production-only, fail-closed (a deploy with no creds → 503). RLS stays optional (the service-role key bypasses it); the real protection is at the edge. `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` per `.env.example`.
- **Scout scenario scope → FULL write surface** (create/duplicate/reset/`setDriver`, user-attributed, undoable, engine-validated, never touching Base/actuals). Resolves the long-open #5.
- **Budget → REAL frozen snapshot** (`lockBudget` implemented; synthetic `budgetFactor` retired; one budget seam; seed an initial FY26-Plan lock). Matches §8.
- **`scenario_inputs` → jsonb** (lossless typed `Adjustment`). **Importer → drives closed-month statements (option a).** **Override layer → field-level deltas.**
- **Build-order correction:** unify the split-brain scenario store (`lib/queries/scenarios.ts` reads a module `Map`; the `DataStore` scenario methods are unused + not Supabase-overridden) BEFORE scenario persistence — a "persisted" scenario is invisible today.

**Data-credibility hardening `[2026-06-21]` — a sub-ledger texture pass before the Supabase freeze (all gates green; §11 preserved exactly).** A 10-domain adversarial audit (each finding independently verified) on "what reads as FAKE to a Series-B CFO drilling the sub-ledger." ~26 distinct findings fixed, all tie-out-neutral or §11-preserving: staff title ladder + de-correlated names; an **anchor-vendor model** (recurring vendors bill every month at a stable share; one PEO); per-year doc numbers; realistic opening AR; per-customer collection lag; **ARR de-rounded to a $50 grain** (was all round thousands — unbiased, §11 unmoved) + multi-year contract terms; pipeline close-by-stage + probability jitter + a new-logo/expansion `kind`; renewal outcome magnitudes; churned-customer ARR zeroed; the **as-of register filter** (forecast-period logos no longer shown as active customers); per-metric budget factors. The seed export was regenerated. **Then the exec-comp / payroll re-baseline (audit #7) was done** (Chris's follow-up): comp is now realistic by seniority (per-dept title→comp ladder, renormalized to the dept envelope so per-function payroll is held; seniority spread across the hire timeline so exec pay doesn't front-load). Engineering rung-0 = "Co-founder & CEO". **Benchmark-validated** (research: Kruze/Carta/Pave/RepVue): founder-CEO corrected **$402K→$228K** (Series-B founder-CEO median ~$216K). **Sales OTE-envelope bump DONE (Chris's call):** sales plan.baseComp $130K→$145K + steeper curve → **VP Sales $287K is the company's top earner, out-earning the founder-CEO** (the research's "top seller is often the highest-paid person"); 4 reps clear the non-sales-VP line; SDRs ~$46–58K; median ~$120K. **#23 attrition + backfill DONE** — 23 departures (endMonth, all in the closed window; backfilled in-slot so headcount/payroll preserved; ASC 718 SBC forfeits on departure); `listStaff` shows the as-of roster, the export keeps all 163 records. **Eng-org fix** (independent review): added a **VP Engineering** rung + explicit eng comp shape so VP Eng ($264K) > founder-CEO ($235K) > line Engineering Managers ($209–234K) — was: line managers out-earned the founder and the R&D org had no head. **§11 at locked** (opening cash $6M→$7.5M; NI −$11.9M, magic 1.2x, runway 49mo, Rule of 40 25%). Also fixed a latent 3-path runway-rounding bug (all now use raw `cash/netBurn`). **Deferred with rationale (Chris to decide):** (a) founder hire-date spread (#22, penny rounding tolerance), a small state/franchise tax (#39/#42, $0 defensible under NOLs), #37 function tags / #31 consultant-week cap (LOW); (b) GL close-to-equity / monthly-summary GL / thin COA — **by design per §16** (the close itself is the ERP's job, OUT of scope; Dogfood reads a clean summary close); (c) forecast-month sub-ledger cut + new-logo cadence lumpiness — bundle with the **global-as-of control** work (cadence is highly timing-sensitive and would re-baseline §11). Details in `Handoff.md`.

**Decided 2026-06-20 (the Run — production-prototype pass) `[LOCKED]`:**
- **Posture:** single-client **production prototype** a CFO runs daily (not a throwaway demo). **Supabase ACTIVE** (was deferred), **single-tenant**, **trusted auth** (no login; server-side service-role behind a private deploy; RLS optional). §0/§3/§4.
- **Data model:** statements are **trial-balance-driven** (the TB balances on its own, which is NOT a plug); transaction detail rides alongside and **reconciles UP to the TB** (Σ(detail) === TB movement; a gap is flagged, never plugged; statements never go un-tied). **Reconciliation is fix-upstream-only `[2026-06-20, Chris]`: no plugs — everything must reconcile.** An unresolved detail-vs-TB gap is surfaced as a **blocking "unreconciled / needs attention" flag** with the dollar amount; the one honest path is to FIX UPSTREAM (pull the missing JE/accrual or correct the Account Mapping, then re-import). The old "auto-plug a visible uncategorized line" option is **removed** — a gap is never force-balanced with a plug line. Every domain **batch-imports (CSV/XLSX) on a stable-id upsert**; manual edits are a flagged **override layer** that survives re-import. One **global as-of date** drives the actual/forecast split; importing a month advances it; restatement re-imports + rolls forward without moving the as-of. **Live API connectors = roadmap (§18)** (CSV is the contract today). §4/§16.
- **Flux Analysis IN scope** — reviewer notes saved per transaction (`flux_notes`, keyed on the stable sub-ledger id, surviving re-import). The Expense Transactions register is the drill target (BUILT); the write store + note UI land with Supabase.
- **Built this session:** the **Customers** + **Expense Transactions** registers; Scout **streaming** commentary + 4 new tools (`getMonthlyPnL`, `getBookingsHistory`, `getCustomers`, `getCustomer`); the low-contrast nav scrollbar; the adversarial-review fixes (ARR run-rate labeling vs the Dashboard point-in-time tile, churned-ARR shows "—", deterministic-router hardening, `getCustomers` period-arg dropped). Gates green: data-sweep 43/43, scout-readiness 34/34, scout-eval structural+deterministic + LLM 28/28, tsc/lint/build clean.
- **Artifacts:** `import-templates/`, `data-export/` (+ `SCHEMA.md`), `schema.dbml`, `supabase/`, `connectors/salesforce.md` (see the appendix).
- **Still open / next:** the **Supabase setup is PAUSED** pending Chris's functionality/usability validation (cheap to change pre-backend). Then, in order: the seed-loader (`scripts/seed-supabase.ts`) → `SupabaseDataStore` + the `getDataStore()` env switch → the CSV importer (parse → validate → reconcile → flag) → the **global as-of control** (today `closeThrough` is a constant in ~12 sites — centralize + a Settings toggle) → the **flux-notes write path**. Plus the remaining registers/drivers, the Scenarios engine, and Board Package. **One usability question flagged:** the close is all-or-nothing per month (one global boundary) — confirm month-level close is enough (likely yes for single-entity FP&A).

**Still open**
- `[OPEN→LOCKED]` **Final seed parameters** (§11) — the ARR ramp, headcount curve (40→140), mix taper, Series B size ($20M), and the loss shape are set (2026-06-19 coherent-efficient recalibration, below). Parameters stay tunable in `lib/seed/params.ts`.

_(The Scout-as-Slackbot question is now closed — see "Decided this round" below.)_

**Unit-economics formula tightening + firm_id posture `[LOCKED — 2026-06-20, the Run, after a 4-agent progress-review]`** — gates stay green (43/43 tie-outs, 22/22 Scout-readiness, tsc/lint clean — these SaaS metrics aren't in the statement tie-out chain, so nothing reconciled moved):
  - **NRR → true i-12 cohort** (`lib/seed/dashboard-metrics.ts`): customers active 12 months ago, their ARR now ÷ ARR then (within-cohort expansion/contraction/churn; excludes new logos), reading the per-contract `recByContract` ARR timelines. Was whole-book TTM. FY26 NRR **111% → 109%** (cohort is the textbook definition; whole-book slightly overstated at 2026-06).
  - **Magic number + CAC → one-quarter S&M lag** (the textbook "spend precedes the bookings it generates" convention): trailing-12 net ΔARR / new logos ÷ S&M of the quarter prior. Magic **1.1x → 1.2x** (matches the `params.ts` S&M comment's ~1.2-1.4x target), CAC per logo **$143K → $129K**, LTV:CAC **3.9x → 4.3x** (still the healthy 3-5x band). LTV churn floor already 0.05.
  - **All metric basis strings** (`METRIC_CATALOG`) reconciled so every string Scout quotes is literally true (the relabel pass + these formula notes). Chris chose tighten-formulas over relabel-only.
  - **firm_id → single-tenant, documented plan** (Chris): demo-only, so firm scoping attaches at the **DataStore boundary** (+ Supabase RLS) if ever needed, not baked into 14k seed rows. Handoff open-decision #1 resolved.
  - **The Run progress:** the Sales + Reporting layer-1 query stubs (`listContracts`/`getContract`/`listCustomers`/`listProjects`/`listStaff`/`listExpenseTransactions` + `getHeadcount`/`getUtilization`/`getArr`/`getBookings`) now forward to the live DataStore (closed the "one source, two callers" gap the review flagged P0). The **Contracts register** (`app/sales/contracts`) is the first real module surface — register + Bookings/Deferred/RPO cards on the live spine.
  - **Scout is LIVE (the AI differentiator, was 100% scaffold):** a key-optional Anthropic tool-use loop over the spine (`lib/scout/` + `app/api/scout`; `SCOUT_MODEL = claude-sonnet-4-6`), with a click-through **receipt** per tool call. 9 tools wired against `registry.ts` (statements/dashboard/metrics + Contracts). Real LLM loop when `ANTHROPIC_API_KEY` is set; deterministic intent-router fallback otherwise (verifiable with no key). **Live loop verified** (Sonnet 4.6): both lanes work — multi-tool grounded answers with receipts (DATA) and product-map how-to answers with no tool call (PRODUCT-KNOWLEDGE).
  - **Routing gate + seed-texture pre-pass DONE:** `scripts/scout-eval.ts` (free structural+deterministic layers + a metered 17-case LLM routing set, weighted to fan-out overlap pairs; first run 9/9 · 4/4 · 17/17). Seed-texture pre-pass: Pipeline (46 opps) + Renewals (165) records seeded + staff name pool widened 24×24→40×41 (0 collisions) — all tie-out-neutral. **Next: fan out the remaining Reporting/Sales registers (Customers first), wiring each module's Scout tool + eval cases as it ships (Scout Follows Modules).**

**Audit-readiness + coherent-efficient recalibration `[LOCKED — 2026-06-19, after the milestone multi-agent progress-review]`** — three additions + a re-tune; all 38/38 tie-outs green by construction, 20/20 Scout-readiness, tsc clean:
  - **Stock-based compensation (ASC 718)** — new non-cash, equity-neutral driver (`lib/seed/sbc.ts`): grant-date fair value (function multiple × early-hire premium) recognized straight-line over a 48-mo vest, booked Dr SBC expense / Cr APIC, added back in OCF. Flows through P&L/BS/CF/GL; FY26 SBC ≈ $4.3M. Deepens the GAAP loss without moving cash or runway. Now IN scope (§11).
  - **GAAP→non-GAAP reconciliation + free cash flow** (`buildSeedNonGaap` / `getNonGaapReconciliation`) — reports profitability the way real SaaS does: GAAP −52% → non-GAAP (ex-SBC) −32% → FCF −15%.
  - **Runway reporting cleanup + Scout-readiness gate** — removed the stray Dec-2026 `runwayMonths`/`netBurn` off `BalanceSheetSeed`; every surface now reads `buildSeedRunway(asOf)` at the current period (matches the dashboard tile). `scripts/scout-readiness.ts` proves the spine is serializable + deterministic + cross-tool-consistent (20/20).
  - **Coherent-efficient recalibration** — a "funded grower" pass (S&M↑) overshot into an *inefficient burner* (43% S&M / 0.9x magic / −59% margin — the review's #1 credibility risk). **KEY:** Bearing is annual-prepay, so growth GENERATES cash → a low burn multiple + long runway are STRUCTURAL and cohort-accurate, not "outrageous"; don't over-spend to fake a higher burn rate. Final knobs: S&M programs `rate` 0.14, Series B $28M→$20M (right-sized) → revenue $23.4M, growth 61%, NRR 111%, GM 71%, magic 1.1x, Rule of 40 25%, LTV:CAC 3.9x, burn multiple 0.6x, runway 49mo, NI −$12.1M (−52% GAAP / −32% non-GAAP / −15% FCF), 140 heads. Reads as a credible capital-efficient upper-middle peer.
  - **Leases (ASC 842) — BUILT (2026-06-19):** `lib/seed/leases.ts` adds a right-of-use asset + lease liability to the balance sheet (ROU asset === lease liability each month → equity-neutral; the lease cost stays in Facilities so P&L / cash / net income / runway are unchanged). FY26 ROU/liability ≈ $1.6M; BS assets $22.5M → $24.1M (both sides). 40/40 tie-outs. **Still deferred:** commission capitalization (340-40 — legitimate eventually) and capitalized software (350-40 — likely never). The milestone review ranked these below the visible statement/register work — the "board-package" win is the Balance Sheet / Cash Flow pages + a monthly column view.

**Peer-profile retune `[LOCKED — 2026-06-18]`** — Bearing reshaped to read as a credible peer of the AI-native-finance cohort (Numeric / Campfire), from sourced research. All 35 tie-outs stay green by construction. Changes (`lib/seed/params.ts`, `names.ts`, `transactions.ts`, `dashboard-metrics.ts`, `metrics.ts`):
  - **Customer base → tech/AI/SaaS/fintech** (was old-economy industrial): 71-name `CUSTOMER_NAMES` pool re-themed; modern SaaS-stack `VENDOR_NAMES` (AWS/Anthropic/OpenAI/Datadog/Ramp). The 6 names in `revenue-drilldown.svg` re-themed index-stable (Northwind Cloud, Helix AI, …) — update that diagram's rows to match if refreshed.
  - **Services mix taper 25→19→15%** (TIERS bands +10% → subscription; `SERVICES_ATTACH_PCT` −38%); arc held at ~$22M FY26.
  - **Headcount trued 44→134 ⟹ 52→140** (§11 ~60→140), PS trimmed 20→15 and reallocated to Eng/Sales/CS → software-shaped org.
  - **Series B $9M → $28M** (cohort-credible); opening cash $7M→$8M (clears the pre-raise trough). S&M programs 0.11→0.20 to **deploy** the raise → NI ≈ −$8M (−35%), magic 1.1x, burn-multiple 0.6x, Rule-of-40 36%, runway ~50–70mo (capital-efficient + well-funded). Hosting 0.15→0.17 (AI inference COGS); GM 64→72% widening.
  - **Cheap metric fixes:** `cac_payback` relabelled "CAC per new logo" (formula unchanged — it computes dollar CAC); NRR documented "whole-book TTM"; LTV churn floor 0.02→0.05. `ltv_cac` ~9x remains first-pass-optimistic (Run).
  - **Realism audit + fixes `[LOCKED — 2026-06-18]`:** a 5-lens adversarial audit ("what reads as FAKE to a Series-B CFO/investor/auditor") drove a texture pass — the statements were believable but the sub-ledger drill-down surfaces gave it away. Fixed: customer names 71→180 (no suffix repeats); **partial contractions/downsells** in the NRR bridge + a module-launch expansion-wave story beat; paychecks now vary (shared `monthlyCompFor` merit raise + Dec bonus, FICA-capped/progressive withholding); timesheets ≤45h/wk (was 666h/mo); transactions carry full dates + doc#s + open/paid status + due dates; FIFO receipts + AR aging; vendor de-dup + annual lumps; LTV:CAC 9x→3.5x (5-yr lifetime cap); budget-variance dispersion. Recalibrated to a more realistic shape: FY24 softened (founding base 52→40, opex 133%→~115%), S&M 0.20→0.17, Series B $28M→$24M, runway ~53mo, NI −40% (the §11 140-heads-on-$22M deep loss). All 35 tie-outs green; typecheck/lint/build clean; dashboard verified. **Deferred** (lower-severity / deep-drill / scope-coupled): equity Preferred/Common split (GL-coupled, §16-adjacent), utilization smoothing, seasonality, odd-dollar ARR jitter, per-head OpEx fixed/variable, a small state/franchise tax provision, interest-rate variation, a Support activity ledger / PS bench, in-close-month texture, GL accrual accounts.
- `[DECIDED — built + LOCKED]` **AP / DPO is IN** as a driver: the step-5 seed (`lib/seed/balance-sheet.ts`) generates a DPO-driven AP balance + the cash-flow `change_ap`, so Cash Flow and working capital tie out (Assets = Liabilities + Equity by construction). No longer open — the build committed to it.
- `[DECIDED — Harness]` **Final per-driver keying + exact dashboard tile order** — lock when the Phase 1 Dashboard + P&L are built. (Structure decided; this is the last numeric tuning.)

**Decided this round `[LOCKED]`** (were open)
- **Demo company = Bearing** (§11) — AI-native FP&A SaaS + services; mix/scale/scope confirmed.
- **Budget = locked snapshot** of the layer-2 drivers; variance columns on the Forecasted P&L; lock/promote lifecycle (§8).
- **Two-axis cost model** (nature × function); **Cost of Revenue = assembled coupled driver** (`getCostOfRevenue`, reads Revenue + Personnel + a rate), not an Expense Forecast group (§8).
- **Personnel by department + function tag**; **Indirect Payroll = one P&L line**; full functional cut in the Total Payroll + Departmental P&L views (§8).
- **Employee Expenses (OpEx) = all payroll burden** (direct + indirect); gross margin on base direct labor + non-employee CoR.
- **Expense groups config-driven + typed** (classification CoR/OpEx + function sub-role); seed = the 8 OpEx groups (§7/§8).
- **Metrics layer (layer 4)** — four families incl. **Financial/profitability** (Revenue, gross profit, gross margin %, operating income, net income, net margin %). Surfaced through the Dashboard; not a nav item.
- **Peek vs Place** (§6) — peek where you read, navigate where you work; pure metrics pane-only.
- **Bookings folds into Contracts**; Sales = Pipeline · Contracts · Customers · Renewals (§7/§8).
- **Subscription forecast = contracted (from Contracts) + new-business**; services = capacity (§8).
- **Scout** = bottom-of-rail launcher, floating lower-right panel; **in-app only — Scout-as-Slackbot ("Flavor C") rejected, not deferred**, no Slack integration in scope (§10). `[LOCKED — 2026-06-19]`

**Notes**
- `[NOTE]` **Renewals** is the most trimmable Sales item (overlaps Contracts + Customers). Keep as the retention surface; first to cut if simplifying.
- `[NOTE]` **Prepaids / Fixed Asset** are plumbing, not dashboard tiles — keep them as deep drill targets only.

---

## 18. Roadmap (deferred — do not build now)

- `[ROADMAP]` **ERP ecosystem diagram.** A diagram with the **ERP as system-of-record hub**: *inputs* (write to ERP) = billing, payroll, expense management, banks, Sales/CRM **+ Numeric** (reads GL, posts JEs back); *outputs* (read from ERP) = BI tools **+ Dogfood** (read-only, plans off closed actuals). **Numeric = input + output; Dogfood = output-only.** One-line story: *"the ERP holds the books, Numeric keeps them clean, Dogfood plans the future off them."* Drawn later.
- `[ROADMAP]` **Optional Numeric enrichment link** (not a build connector): close-state signal to trigger the forecast roll-forward, flux/variance narrative as grounding, reconciliation-status assurance — over Numeric's MCP connector, behind the DataStore. Thin overlay, never a dependency.
- `[ROADMAP]` Graduating Dogsled tutorial module components into this shared spine.
- `[ROADMAP]` Commission plan rules (a small DSL, same shape as scenario adjustments) and **ASC 340-40 capitalization as a separate caller** on the Commissions register (clean "one source, two callers").
- `[ROADMAP]` Widen the scenario lens to global (scope widening, not a rewrite) if ever warranted.
- `[ROADMAP]` **Live source-system connectors** — Salesforce / Rippling / the ERP via API, replacing the CSV batch step **behind the DataStore seam** (no rewrite). The CSV templates (`import-templates/`) + the field maps (`connectors/`) are the contract a connector fills; the direct connection (auto-refresh, no manual export) is the target functionality. CSV/XLSX batch is the mechanism for *this* build. (Note: per §16 this supersedes the old "ERP is the only live connector" line — every domain is batch-import now, and any of them can graduate to a live connector later.)

---

## 19. Brand / design system

- **Sidebar (“Midnight”):** vertical gradient `#0E1726 → #0B121E`. Active nav = ember-tint highlight + 3px ember left bar. Collapsible parents use carets (▸ collapsed / ▾ expanded). The **Ask Scout launcher sits at the bottom of the rail** (ember-gradient button) and opens Scout as a floating panel, lower-right.
- **Content:** parchment `#FAF7F1` / `#F7F3EC`; row cards `#FFFFFF` / `#FBFAF6`, border `#ECE6DB`.
- **Palette:** Ember `#EC6D3F` / `#C9582E` (accent/active); Amber `#E7B23A` / `#B9852A`; Aurora/sage `#46C99A` / `#2FA37D` / `#2A8A66` (positive); Frost `#9DB8CC` / slate `#5A6B7A`; ink `#1c2530`.
- **Type:** **Fraunces** (serif) for titles/wordmarks; **Geist** (sans) for everything else.
- **Logo:** connected-trail chevron — three ascending “>” chevrons, top one ember. **Scout mark:** ember→amber gradient circle + parchment sparkle.

---

## Appendix — artifact index  _(updated 2026-06-20)_

Root docs: `CLAUDE.md` (this file — the spec) · `PRD.md` (product framing) · `README.md` (start here + SOP) · `kickoff-prompt.md` (Harness kickoff) · `Handoff.md` (build state) · `tie-out-audit.md` (the seed tie-out reconciliation + check classification, 2026-06-17) · `flux-analysis.md` (Flux Analysis design/build spec — note anchors, the one card, Scout read/write, user attribution; 2026-06-20) · `creating-a-flux-analysis.md` (the detailed Flux Analysis user guide, ready for `lib/guides/content.ts` as guide #7; 2026-06-20) · `budget-and-scenarios.md` (the detailed budget + scenarios user guide, deepens the budgets-and-forecasts + creating-scenarios guides; 2026-06-20) · `setting-up-a-new-period.md` (the detailed new-period / close-import user guide — TB-driven import, validation, reconciliation, the global as-of; 2026-06-20). **App-styled HTML guide renders** (self-contained, the Midnight-rail app shell + mock module UI, for look-and-feel review): `creating-a-flux-analysis.html`, `budget-and-scenarios.html`, `setting-up-a-new-period.html`. _(A visual `architecture.html` lands in the diagram/architecture refresh — the pass after this package.)_

`diagrams/` (architecture & IA):
- `nav-rail-expanded.svg` — the canonical left nav, every dropdown open (P&L drivers incl. **Cost of Revenue**; the **8 OpEx groups**; the six guides). Company chip = **Bearing**; **Ask Scout launcher at the bottom**. This is the authoritative IA reference; build the resting state from it (§7).
- `drilldowns-statements.svg` — P&L / Balance Sheet / Cash Flow drill targets, peek-flagged (§6).
- `drilldowns-dashboard.svg` — Dashboard tiles by metric family (Financial · Growth & Retention · Unit Economics · Cash & Efficiency); peek vs pane-only (§6).
- `scenarios-budget.svg` — the Scenarios **& Budget** model: plan versions, deterministic engine, adjustment anatomy, lever set, composition/validation, four surfaces (§8 Budget, §9).
- `cost-and-pl.svg` — the two-axis cost model + the locked P&L skeleton (Personnel-functional · CoR-assembled · OpEx-standalone) (§8). _(Added in the diagram/architecture refresh; the P&L skeleton it draws is specified in §8 today.)_
- `revenue-drilldown.svg` — the revenue drill spec (606 schedule + services % complete).
- `drilldown-rollup-map.svg` — the five-layer cascade with Scenario lens + Scout (§6).
- `lineage.svg` — "how every number connects" teaching diagram.
- `scout-dock.svg` — the Scout panel.
- `scenario-drivers.svg` — the Scenario Drivers board.
- `flux-notes-model.svg` `[2026-06-20]` — the Flux Analysis note model: the immutable-ERP → anchor-key → one-card flow, the three anchor grains, author/source attribution, and Scout reading + writing notes (§16/§17 0c; full spec in `flux-analysis.md`).

`import-templates/` (data-in contracts + the import model) `[2026-06-20]` — CSV/XLSX templates: `chart_of_accounts.csv` (the real 28-account COA = Account Mapping), `trial_balance.csv` (real May-2026, foots to $59,587,121.23, ties to the GL), `expense_transactions.csv` (real May AP detail), + customers/contracts/pipeline/headcount/vendors/ar_aging/ap_aging/budget/fx. `README.md` is the spec: the **new-month + restatement** flows, the **global as-of**, validation, **Reconciliation** (detail-vs-TB), and **Transaction detail & Flux Analysis** (the per-transaction note model).

`data-export/` (the full seed, dumped for Excel analysis) `[2026-06-20]` — 20 CSVs / ~18.6k rows (every record + sub-ledger txn, **rev rec per contract + per project**, monthly P&L, the driver-series master pivot, metrics) + **`SCHEMA.md`** (data dictionary + Mermaid ERD; base vs derived). Re-run `npx tsx scripts/export-data.ts`.

`schema.dbml` (root) `[2026-06-20]` — the DB schema for dbdiagram.io (base + the write tables `flux_notes`/`scenarios`/`budget_snapshots`).

`supabase/` `[2026-06-20]` — `migrations/0001_init.sql` (production schema, single-tenant) + `README.md` (the InMemory→Supabase swap plan + setup; the seed loads in once, statements stay TS-computed).

`connectors/` `[2026-06-20]` — `salesforce.md`, the worked connector field-map (Salesforce Account/Opportunity/Contract → customers/pipeline/contracts; upsert on the SF Id).

`scripts/` (dev tools, not the build): `data-sweep.ts` (43 tie-outs) · `scout-readiness.ts` (34) · `scout-eval.ts` (routing gate) · `peer-check.ts` · `export-data.ts` (the data export).

`brand/` (marketing, not part of the build): `infographic.png`, `infographic-vector.svg`, `infographic-prompt.md`.

`archive/` holds superseded nav iterations (v1–v16), older drafts (nav-before-after, scenario-workflow, shell-lineage), and the stale PRDs (v1–v3 — predate Bearing, the five-layer model, the cost/budget model, contained scenarios, the Sales merge, Account Mapping, ERP-only). Kept for history; this file supersedes them. **Do not read `archive/` during the build — it is reference history only and will just consume context.**

> **Session handoff:** a `Handoff.md` is created in the first build session and updated at the end of each session (current state + next steps). Read `Handoff.md` and this file at session start.
