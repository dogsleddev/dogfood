# dogfood.cafe — PRD v3
## AI-native Close + FP&A + Board Reporting · with Forecast Scenarios
**Demo company:** Beacon Devices (hardware + SaaS)
**Build target:** buildable surfaces + scenario compare functional by Sunday
**For:** a Claude Code session — `docs/PRD.md` (supersedes v2)

> v3 adds **forecast save-state / scenario comparison** (a Scenario P&L and Scenario Dashboard
> rolling up from saved scenarios) and bakes in the **Transaction Details / GL Close split**.

---

## 0. What this is

A working finance platform across **Accounting Close**, **FP&A**, and **Board reporting** on seeded data, plus a **scenario layer**: save the forecast as named versions and compare them. The week's slice: a single **Forecasted P&L** (actual + forecast), **Balance Sheet**, **Cash Flow**, and **Transaction Details**, fed by a **Forecasts engine**, comparable across **scenarios**, summarized on a **Dashboard**, with a module-aware **Scout** that can answer, drill, and drive scenarios.

Bet, unchanged: **one query spine, two callers.** `lib/queries/*` serves both UI and Scout's tools. No RAG for structured data. New seam: **the forecast layer is scenario-aware; the actuals layer is not.**

---

## 1. Goals / Non-goals (this week)

**Goals**
- **Forecasted P&L**: actual + forecast; drill actuals → transactions, forecast → inputs.
- **Forecasts roll up**: Revenue + Personnel + Expenses → P&L; AR + Waterfall + Fixed Asset + Operating Cash → Balance Sheet / Cash Flow.
- **Scenarios**: save the forecast as named versions; **Scenario P&L** (columns per scenario) and **Scenario Dashboard** (KPI compare) roll up from them. Seeded scenarios ship; live save/fork is the stretch.
- **Statements first-class** with drill-down; **Transaction Details** is the universal drill target.
- **Functioning, module-aware, scenario-aware Scout.**

**Non-goals (stub / defer)**
- The **Accounting** group as built pages (Month-End Close, subledgers, standards). Data seeded; pages stub.
- **Live scenario CRUD + lock/baseline UI** — stretch. Demo runs on seeded scenarios + scenario-aware reads.
- Real Supabase / auth → `InMemoryDataStore`. Real integrations → stub.
- Fully budgeted Balance Sheet → `—`.

---

## 2. Architecture (locked)

- **Query spine** — `lib/queries/*`, one source two callers, zero RAG.
- **Scenario-aware seam** — forecast functions take an optional `scenarioId` (default = active working scenario). Actuals functions take none. This is the entire branch point for comparison.
- **DataStore** — `InMemoryDataStore` now, `SupabaseDataStore` later. `firm_id` on every row.
- **Module types** — `[R]` register, `[P]` process, `[V]` view.
- **Page ⊥ query** — a stub page can still expose a working query (the GL Close page is a stub, but `getTransactions` is live).
- **Stack** — Next.js 15 · TS · Tailwind + shadcn (inherit dogsled theme) · Claude API (Sonnet + Haiku) · Vercel.

```
app/(shell)/layout.tsx            # nav rail + Scout dock + topbar (topbar holds the scenario switcher)
app/dashboard/page.tsx
app/statements/{forecasted-pl,balance-sheet,cash-flow,transactions}/page.tsx
app/forecasts/{revenue,personnel,expenses,ar,revenue-waterfall,fixed-assets,operating-cash,assumptions}/page.tsx
app/scenarios/{manager,scenario-pl,scenario-dashboard}/page.tsx     # NEW
app/accounting/...                # Month-End Close + subledgers + standards — STUBS
lib/queries/  statements.ts forecast.ts scenarios.ts actuals.ts expenses.ts revenue.ts cash.ts metrics.ts transactions.ts
lib/data/  store.ts in-memory.ts seed/
lib/scout/  tools.ts registry.ts dock.tsx
```

---

## 3. Data model + Beacon seed

**Core (seed):** `chart_of_accounts`, `departments`, `periods` (actuals Jan–May 2026 closed, June in close; forecast June–Dec 2026), `journal_entries` (header+lines: account, dept, period, amount, source_module, memo, doc_ref, status) — **single source of actuals**, `budget`, `employees` (incl. planned hires), `customers`, `vendors`, `entities` + `fx_rates`.

**Schedules (seed; pages stub):** `prepaid_schedule`, `fixed_asset_schedule` (+ depreciation, cap sw 350-40), `revenue_schedule` (606 + deferred waterfall). Later: `lease_schedule` 842, `sbc_schedule` 718.

**Config:** `account_statement_map` (GL account → statement line + sign).

**Scenarios (NEW):**
- `scenarios` — id, name, description, status (`working` | `saved` | `locked`), is_baseline (bool), parent_id (fork lineage), created_at, updated_at, firm_id
- `scenario_inputs` — scenario_id, input_key, value, dept?, period? — the **override set** (deltas from base). `input_key` namespaces every forecast-editable assumption: `revenue.growth`, `revenue.deal.{id}.included`, `personnel.hire.{id}.startMonth`, `personnel.merit.pct`, `expense.{cat}.driver`, `ar.dso`, `capex.{id}.amount`, etc. Assumptions writes here.
- `scenario_snapshots` (optional) — scenario_id, frozen computed outputs; written only on **lock**, for immutable baselines.

**TIE-OUT RULE:** generate downstream from source so it foots (revenue schedule → JE → statements via the map). GL + schedules + statements reconcile.

**Seed 3 scenarios (for an instant compare demo):**
- **Base** (`is_baseline`) — current plan.
- **Aggressive Hiring** — 3 extra Eng hires pulled earlier; higher revenue attach.
- **Soft Q3** — revenue miss, hiring freeze, DSO slips.
Each is `scenario_inputs` deltas off Base.

**WIP note (still open):** Balance Sheet drills to **WIP Aging** → unbilled/services WIP or inventory WIP? Decides the seed.

---

## 4. Information architecture (`●` build · `○` stub · `↳` drill-downs)

```
OVERVIEW
  ● Dashboard            ↳ Forecasted P&L · Balance Sheet · Cash Flow

FINANCIAL STATEMENTS
  ● Forecasted P&L       ↳ Revenue drivers (fcst vs actual) · Revenue Forecast ·
                            Personnel Actuals · Personnel Forecast · Expense Summary
  ● Balance Sheet        ↳ WIP Aging · AR Aging · AP Aging · Deferred Revenue
  ● Cash Flow            ↳ AR Forecast · Revenue Waterfall Forecast · Fixed Asset Budget
  ● Transaction Details      seeded GL · read-only · universal drill target

FORECASTS
  ● P&L                  Revenue · Personnel · Expenses
  ● Balance Sheet        AR Forecast · Waterfall Revenue Forecast · Fixed Asset Budget · Operating Cash Forecast
  ● Assumptions          shared driver store (writes scenario_inputs for the active scenario)

SCENARIOS                                                            ◄ NEW
  ● Scenario Manager     save · fork (Save As) · lock · set baseline · lineage
  ● Scenario P&L         Forecasted P&L, one column per scenario, variance vs baseline
  ● Scenario Dashboard   KPI compare: Net Income · Gross Margin · Ending Cash · Runway · Headcount · ARR

ACCOUNTING               ○ stub pages over seeded data
  Month-End Close [P]     Revenue (606) · Prepaids · Depreciation · Accruals · GL Close · Variance Analysis · Reconciliations
  Subledgers & Standards  AR · AP · Lease·842 · FX·830 · SBC·718 · Commissions·340-40 · Contracts · Pipeline

SYSTEM                   ○ Settings · Users & Roles · Integrations · Audit Log

[TOP BAR]  Working: <scenario> ▾  ·  Save  ·  Save As  ·  Compare        # respected by every forecast surface
```

**GL split:** *Transaction Details* (the data, browsable, built) lives in Financial Statements; *GL Close* (the process that locks periods) is a stub under Month-End Close. Same `journal_entries` table; one reads, one changes period status.

---

## 5. Surface + module specs

| Surface | Route | Type | Key queries | Reads from | Scout |
|---|---|---|---|---|---|
| Dashboard | /dashboard | V | `getDashboard(scenarioId?)` | ForecastedPL, BalanceSheet, CashFlow, Metrics | "how are we tracking?" |
| Forecasted P&L | /statements/forecasted-pl | V | `getForecastedPL(h, scenarioId?)`, `getPLLineDetail(ref)` | Forecasts P&L + actuals | "why is COGS over budget?" |
| Balance Sheet | /statements/balance-sheet | V | `getBalanceSheet(p)`, `getBSLineDetail(ref)` | GL + agings + deferred + schedules | "what's in prepaids?" |
| Cash Flow | /statements/cash-flow | V | `getCashFlow(h, scenarioId?)`, `getCFLineDetail(ref)` | OperatingCashForecast + statement | "when do we dip below $2M?" |
| Transaction Details | /statements/transactions | R (GL view) | `getTransactions(filter)` | GL (source) | "show all freight entries in May" |
| Forecast · Revenue/Personnel/Expenses | /forecasts/* | R | `getRevenueForecast / getPersonnelForecast / getExpenseForecast(scenarioId?)` | Assumptions, actuals, schedules | "cost of 3 more engineers?" |
| Forecast · AR/Waterfall/FixedAsset/OperatingCash | /forecasts/* | R | `getARForecast / getRevenueWaterfallForecast / getFixedAssetBudget / getOperatingCashForecast(scenarioId?)` | upstream forecasts + actuals | "re-forecast cash if AR slips 15 days" |
| Assumptions | /forecasts/assumptions | R | `getDrivers(scenarioId?)`, `setDriver(scenarioId, key, val)` | scenario_inputs | "set growth to 8% and re-forecast" |
| **Scenario Manager** | /scenarios/manager | P | `listScenarios`, `createScenario(name, fromId)`, `saveScenario(id)`, `forkScenario(id,name)`, `lockScenario(id)`, `setBaseline(id)`, `deleteScenario(id)` | scenarios | "save this as 'Soft Q3'" |
| **Scenario P&L** | /scenarios/scenario-pl | V | `getScenarioPL(scenarioIds[])` (calls `getForecastedPL` per id) | scenarios + forecasts | "where do Base and Soft Q3 diverge?" |
| **Scenario Dashboard** | /scenarios/scenario-dashboard | V | `getScenarioDashboard(scenarioIds[])`, `compareScenarios(ids, metric)` | scenarios + forecasts + metrics | "compare runway across all three" |

Actuals (no page; feed drills): `getRevenueActuals, getPersonnelActuals, getExpenseSummary, getAging, getAPAging, getWIPAging, getDeferredRevenue, getTransactions`. `getMetrics` builds this week (Dashboards need it).

ACCOUNTING stub pages (data seeded): Month-End Close (Revenue/Prepaids/Depreciation/Accruals/GL Close/Variance/Recon), AR, AP, Lease·842, FX·830, SBC·718, Commissions·340-40, Contracts, Pipeline.

---

## 6. Drill-down contract

```
GRAIN:   Surface → Line → Account → Transaction
COLUMNS: Actual · Forecast/Budget · Variance   at every level

ACTUAL → transaction:   P&L → JE lines (getTransactions); BS → aging/schedule detail;
                        Cash Flow → forecast drivers
FORECAST/BUDGET → assumptions:  any line → the Forecasts module + driver refs (Assumptions)
SCENARIO P&L → differing assumptions:  a line's scenario delta → the scenario_inputs that differ vs baseline
SCOPE:   P&L fully forecasted · Cash Flow = operating cash forecast · BS budget cols = "—"
```

`get*` statement fns return lines with `actual`, `forecast`, `drillRef`; `get*LineDetail(ref)` resolves to JE lines, an aging/actuals panel, a Forecasts module + driver, or (Scenario P&L) the differing inputs.

---

## 7. Forecast roll-up (scenario-parameterized)

Same roll-up, branched only by `scenarioId`. Actuals shared.

```
getForecastedPL(h, scenarioId) =
    Revenue            ← getRevenueForecast(scenarioId)        (+ getRevenueActuals to-date, shared)
  − Direct + Indirect  ← getExpenseForecast(scenarioId)         (+ getExpenseSummary actuals, shared)
  − Personnel          ← getPersonnelForecast(scenarioId)       (+ getPersonnelActuals to-date, shared)
  − D&A                ← getFixedAssetBudget(scenarioId) + prepaid amort
  = Net Income

getOperatingCashForecast(scenarioId) =
    Net Income(scenarioId) + D&A − ΔAR(getARForecast,sc) ± Δdeferred(getRevenueWaterfallForecast,sc)
    − capex(getFixedAssetBudget,sc) ± ΔAP  → running cash / runway

Scenario P&L      = getForecastedPL(h, id) for each id, aligned into columns + variance vs baseline
Scenario Dashboard= per scenario: Net Income, Gross Margin %, Ending Cash, Runway (mo), Headcount, ARR + deltas
Balance Sheet     ← GL + agings + schedules (actuals, scenario-independent for the historical view)
Dashboard         ← getForecastedPL(sc) + getCashFlow(sc) + getMetrics
```

---

## 8. Scout (module- and scenario-aware)

Global pinned dock. Opening a surface activates its query tools + drill/upstream tools + seeds prompts. **Scenario-aware:** Scout reads any scenario and **drives the engine** — `forkScenario`, `setDriver`, `compareScenarios`, `lockScenario`. The dock's "What if we delay the hires?" chip becomes a real action. `lib/scout/registry.ts` maps surface → tools + prompts. Sonnet reasons, Haiku looks up. Voice: analyst first, numbers over charm.

**Demo beat:** Forecasted P&L → "save this as 'Soft Q3', freeze new hires, and show runway vs Base" → Scout `forkScenario` → `setDriver(personnel.hires=0)` → `compareScenarios(['base','soft-q3'],'runway')` → "Soft Q3 extends runway to 17 months vs 14, but ARR exits 11% lower. Want the P&L side by side?"

---

## 9. Scenario system (the new core)

**A scenario = a named version of the forecast.** Actuals are shared and immutable; only forward assumptions branch.

- **What Save stores:** the *assumption/override set* (`scenario_inputs`), not a frozen picture. The forecast re-derives from inputs via the spine, so saved scenarios stay consistent with the latest actuals and logic.
- **Lock / Set Baseline:** the opt-in exception — freeze a `scenario_snapshot` of outputs so a board-approved plan doesn't move when a period closes.
- **Two layers:** the live **working draft** (unsaved edits to the active scenario) and **saved scenarios**. **Save** commits the draft; **Save As** forks a new scenario from current state (the save-state action). `parent_id` records lineage.
- **Comparison:** `getScenarioPL(ids[])` and `getScenarioDashboard(ids[])` call the scenario-aware forecast per id and align the outputs. Variance is always vs the `is_baseline` scenario unless told otherwise.
- **Switcher:** a top-bar control (`Working: <scenario> ▾ · Save · Save As · Compare`) that every forecast surface and Dashboard reads; the Scenario surfaces show multiple at once.

---

## 10. Build plan

**P0 — Foundation.** Spine + `InMemoryDataStore` + Beacon seed (GL=actuals, COA, depts, periods, budget, map, schedules, **3 scenarios**) + Scout shell + nav scaffolded (Accounting/System stub).

**P1 — Forecasted P&L · actuals.** Actual column from GL via map + drill-downs.

**P2 — Forecasts · P&L + Assumptions.** Revenue/Personnel/Expenses → forecast column; driver changes re-flow.

**P2.5 — Scenarios (NEW).** Make the forecast spine scenario-aware (`scenarioId` threading + `scenario_inputs`); ship **Scenario Dashboard** + **Scenario P&L** over the 3 seeded scenarios + the top-bar switcher. *Stretch:* live Scenario Manager (Save / Save As / lock / baseline) and Scout-driven scenario edits. *Done:* Base / Aggressive Hiring / Soft Q3 compare on the Scenario Dashboard; Scout compares them.

**P3 — Dashboard.** Scenario-selectable P&L + cash + KPIs + Scout briefing.

**P4 — Balance Sheet + Cash Flow.** + Forecasts→BS (AR, Waterfall, Fixed Asset, Operating Cash). Transaction Details drill target wired.

**P5 — Accounting (tail).** Month-End Close + subledgers + standards; functioning vs placeholder as time allows.

---

## 11. Open decisions

1. **WIP Aging** = unbilled/services or inventory WIP? (Drives the seed.)
2. Confirm **InMemoryDataStore** + **Beacon Devices**.
3. P0 seed depth: GL totals first vs schedules up front (default: totals-first, schedules in P4).
4. Forecast horizon: monthly through **Dec 2026**.
5. Scenario depth for the demo: confirm the three (**Base / Aggressive Hiring / Soft Q3**) and whether live Save As lands this week or stays stretch.
```
