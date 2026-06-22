# dogfood.cafe — PRD v2
## AI-native Close + FP&A + Board Reporting
**Demo company:** Beacon Devices (hardware + SaaS)
**Build target:** buildable surfaces functional by Sunday; Accounting scaffolded
**For:** a Claude Code session — `docs/PRD.md` (supersedes v1)

> v2 adopts the information architecture from Chris's module table. The five surfaces in
> OVERVIEW + FINANCIAL STATEMENTS + FORECASTS are this week's build. The ACCOUNTING group
> folds in every other module as stub pages over seeded data.

---

## 0. What this is

A working finance platform across **Accounting Close**, **FP&A**, and **Board reporting**, running one fictional company on seeded data. This week's slice: a **single Forecasted P&L (actual + forecast)**, a **Balance Sheet**, and a **Cash Flow** surface — each with drill-downs — fed by a **Forecasts engine** and summarized on a **Dashboard**, with a module-aware **Scout** answering and walking the drills.

The bet, unchanged: **one query spine, two callers.** `lib/queries/*` typed functions serve both the UI and Scout's tools. No RAG for structured data.

---

## 1. Goals / Non-goals (this week)

**Goals**
- **Forecasted P&L**: actual + forecast columns; drill actuals → transactions, forecast → inputs.
- **Forecasts roll up**: Revenue + Personnel + Expenses → Forecasted P&L; AR + Waterfall + Fixed Asset + Operating Cash → Balance Sheet / Cash Flow.
- **Statements first-class**: Balance Sheet and Cash Flow visible, read-only, with drill-downs.
- **Cross-referencing forecasts**: a drill-down target and its Forecasts module are the *same function*.
- **Dashboard** rolls up P&L (actual + forecast), cash, KPIs, Scout briefing.
- **Functioning, module-aware Scout.**

**Non-goals (stub / defer)**
- The whole **Accounting** group as built *pages* (Month-End Close, subledgers, standards). Data is seeded; pages are stubs.
- Real Supabase / auth → `InMemoryDataStore`.
- Real integrations → stubs.
- Fully budgeted Balance Sheet → `—` on BS budget columns.

---

## 2. Architecture (locked)

- **Query spine** — `lib/queries/*` typed functions, one source two callers, zero RAG. Presentation logic stays in module folders.
- **DataStore interface** — `InMemoryDataStore` now, `SupabaseDataStore` later (swap, don't rewrite). Every row carries `firm_id`.
- **Module types** — `[R]` register (owns data), `[P]` process (owns a workflow), `[V]` view (read-only over the spine).
- **Page ⊥ query** — a stub *page* can still expose a working *query*. The GL page is a stub this week, but `getTransactions` is live so the statement drill-downs resolve.
- **Stack** — Next.js 15 App Router · TypeScript · Tailwind + shadcn · Claude API (Sonnet reasoning, Haiku lookups) · Vercel. **Design tokens inherit the existing dogsled theme in the repo.**

```
app/(shell)/layout.tsx            # nav rail + Scout dock + topbar
app/dashboard/page.tsx
app/statements/
  forecasted-pl/page.tsx          # the P&L (actual + forecast)
  balance-sheet/page.tsx
  cash-flow/page.tsx
app/forecasts/
  revenue/page.tsx  personnel/page.tsx  expenses/page.tsx        # P&L side
  ar/page.tsx  revenue-waterfall/page.tsx  fixed-assets/page.tsx  operating-cash/page.tsx   # BS side
  assumptions/page.tsx
app/accounting/...                # MONTH-END CLOSE + subledgers + standards — STUBS
lib/queries/  statements.ts forecast.ts actuals.ts expenses.ts revenue.ts cash.ts metrics.ts transactions.ts
lib/data/  store.ts  in-memory.ts  seed/
lib/scout/  tools.ts  registry.ts  dock.tsx
```

---

## 3. Data model + Beacon seed

**Core (seed):** `chart_of_accounts`, `departments` (Eng/Sales/G&A/Ops/Marketing), `periods` (monthly: **actuals Jan–May 2026 closed, June in close; forecast June–Dec 2026**), `journal_entries` (header + lines: account, dept, period, amount, source_module, memo, doc_ref, status) — **the single source of actuals**, `budget` (account × dept × period), `employees` (role, dept, comp, start; planned hires flagged), `customers`, `vendors`, `entities` + `fx_rates`.

**Schedules (seed; pages stubbed):** `prepaid_schedule`, `fixed_asset_schedule` (+ depreciation, incl. cap software 350-40), `revenue_schedule` (606 + deferred waterfall). Later: `lease_schedule` 842, `sbc_schedule` 718.

**Config:** `account_statement_map` — GL account → statement line + sign. Drives statements + drill.

**TIE-OUT RULE:** generate downstream from source so it foots — revenue schedule from contract terms, JE from schedule, statements computed from JEs via the map. The GL + schedules + statements must reconcile; then Scout can't be broken in Q&A.

**WIP note (needs Chris):** Balance Sheet drills to **WIP Aging**. WIP implies either *unbilled/services revenue* or *inventory work-in-process*. This changes the seed — a hardware-only Beacon has inventory WIP; a services line has unbilled WIP. Decide before seeding.

---

## 4. Information architecture (from Chris's table)

`●` build this week · `○` stub · `↳` drill-downs (in-context panels, not separate nav)

```
OVERVIEW
  ● Dashboard            ↳ Forecasted P&L · Balance Sheet · Cash Flow Statement

FINANCIAL STATEMENTS
  ● Forecasted P&L       ↳ Revenue drivers (fcst vs actual) · Revenue Forecast ·
                            Personnel Actuals · Personnel Forecast · Expense Summary
  ● Balance Sheet        ↳ WIP Aging · AR Aging · AP Aging · Deferred Revenue
  ● Cash Flow            ↳ AR Forecast · Revenue Waterfall Forecast · Fixed Asset Budget

FORECASTS
  ● P&L                  Revenue · Personnel · Expenses
  ● Balance Sheet        AR Forecast · Waterfall Revenue Forecast · Fixed Asset Budget · Operating Cash Forecast
  ● Assumptions          shared driver store (every forecast reads this)

ACCOUNTING               ○ stub pages over seeded data
  Month-End Close [P]     Revenue (606) · Prepaids · Depreciation (Fixed Assets) ·
                          Accruals (freight) · GL / Journal Entries · Variance Analysis · Reconciliations
  Subledgers & Standards  AR · AP · Lease·842 · FX·830 · SBC·718 · Commissions·340-40 · Contracts · Pipeline

SYSTEM                   ○ Settings · Users & Roles · Integrations · Audit Log
```

**Key:** a drill-down target and its Forecasts module are the same function. Drilling from Cash Flow → AR Forecast lands on the module under Forecasts → Balance Sheet → AR Forecast. The drills are pointers, not duplicates.

---

## 5. Surface + module specs

| Surface / module | Route | Type | Key queries | Reads from | Scout tools · sample prompts |
|---|---|---|---|---|---|
| Dashboard | /dashboard | V | `getDashboard` | ForecastedPL, BalanceSheet, CashFlow, Metrics | "how are we tracking?" · "runway?" |
| **Forecasted P&L** | /statements/forecasted-pl | V | `getForecastedPL(h)`, `getPLLineDetail(ref)` | Forecasts P&L (Rev/Pers/Exp) + actuals (GL) | "what's driving Q3 opex?" (drills to Personnel) · "why is COGS over budget?" (drills to JE) |
| **Balance Sheet** | /statements/balance-sheet | V | `getBalanceSheet(p)`, `getBSLineDetail(ref)` | GL + agings + deferred + schedules | "what's in prepaids?" · "AR aging detail?" |
| **Cash Flow** | /statements/cash-flow | V | `getCashFlow(h)`, `getCFLineDetail(ref)` | OperatingCashForecast + statement | "when do we dip below $2M?" |
| Forecast · Revenue | /forecasts/revenue | R | `getRevenueForecast` | Pipeline(stub), 606 in-force, actuals | "what if we win top 3 deals?" |
| Forecast · Personnel | /forecasts/personnel | R | `getPersonnelForecast` | employees, planned hires, Assumptions | "cost of 3 more engineers?" |
| Forecast · Expenses | /forecasts/expenses | R | `getExpenseForecast` (direct+indirect → Expense Summary) | Assumptions, prepaid amort, actuals | "opex run-rate?" |
| Forecast · AR | /forecasts/ar | R | `getARForecast` | RevenueForecast (billings), getAging, DSO | "re-forecast cash if AR slips 15 days" |
| Forecast · Rev Waterfall | /forecasts/revenue-waterfall | R | `getRevenueWaterfallForecast` | revenue_schedule (606), bookings | "what recognizes next quarter?" |
| Forecast · Fixed Asset | /forecasts/fixed-assets | R | `getFixedAssetBudget` | capex plan, fixed_asset_schedule | "capex + depreciation next 2 quarters?" |
| Forecast · Operating Cash | /forecasts/operating-cash | R | `getOperatingCashForecast` | ForecastedPL, ARForecast, Waterfall, FixedAssetBudget, AP | "operating cash by month?" |
| Assumptions | /forecasts/assumptions | R | `getDrivers`, `setDriver` | (shared) | "set growth to 8% and re-forecast" |
| Actuals (no page; feed drills) | — | — | `getRevenueActuals`, `getPersonnelActuals`, `getExpenseSummary`, `getAging`, `getAPAging`, `getWIPAging`, `getDeferredRevenue`, `getTransactions(filter)` | GL seed | — |

ACCOUNTING (stub pages, data seeded): Month-End Close (Revenue/Prepaids/Depreciation/Accruals/GL/Variance/Recon), AR, AP, Lease·842, FX·830, SBC·718, Commissions·340-40, Contracts, Pipeline. `getMetrics` builds this week (Dashboard needs it) even though Metrics has no dedicated page.

---

## 6. Drill-down contract

Actual and budget/forecast are **not symmetric.**

```
GRAIN:   Surface → Line → Account → Transaction
COLUMNS: Actual · Forecast/Budget · Variance   at every level

ACTUAL drills to a transaction:
  P&L line       → JE lines (source_module, date, memo, doc_ref) via getTransactions
                   also: Personnel Actuals, Revenue Actuals, Expense Summary panels
  Balance Sheet  → subledger / schedule detail: WIP Aging, AR Aging, AP Aging, Deferred Revenue
  Cash Flow      → forecast drivers: AR Forecast, Revenue Waterfall Forecast, Fixed Asset Budget

FORECAST/BUDGET drills to ASSUMPTIONS, not entries:
  any line → the Forecasts module that produced it + its driver refs (Assumptions)

SCOPE:  P&L fully forecasted.  Cash Flow = operating cash forecast.
        Balance Sheet budget columns = "—" this week.
```

`getForecastedPL / getBalanceSheet / getCashFlow` return lines carrying `actual`, `forecast`, and a `drillRef`; `get*LineDetail(ref)` resolves to JE lines, an aging/actuals panel, or a Forecasts module + driver ref.

---

## 7. Forecast roll-up (the cross-reference engine)

Each arrow is one `lib/queries` function calling another. Drill-down navigation follows these same edges.

```
Forecasted P&L (getForecastedPL) =
    Revenue            ← getRevenueForecast        (+ getRevenueActuals to-date)
  − Direct + Indirect  ← getExpenseForecast         (Expense Summary; + getExpenseSummary actuals)
  − Personnel          ← getPersonnelForecast       (+ getPersonnelActuals to-date)
  − D&A                ← getFixedAssetBudget (deprec) + prepaid amort
  = Net Income

Operating Cash Forecast (getOperatingCashForecast) =
    Net Income (getForecastedPL)  + D&A
  − ΔAR              ← getARForecast (collections / DSO)
  ± Δdeferred        ← getRevenueWaterfallForecast
  − capex            ← getFixedAssetBudget
  ± ΔAP
  = operating cash → runway        → presented on the Cash Flow surface

Balance Sheet (getBalanceSheet) ← GL balances; explained by getWIPAging, getAging,
                                    getAPAging, getDeferredRevenue, schedules
Dashboard (getDashboard)        ← getForecastedPL + getBalanceSheet + getCashFlow + getMetrics
```

---

## 8. Scout (module-aware)

Global pinned dock. Opening a surface activates its query tools **plus its drill-down / upstream tools** and seeds that surface's prompts. Because the drills are tools, Scout walks upstream in chat — open Cash Flow, drill into the AR Forecast driving it. `lib/scout/registry.ts` maps surface → tools + prompts (last column, §5). Sonnet reasons, Haiku looks up. Voice: analyst first, numbers over charm, light dog theme only when it lands.

**Demo beat:** Forecasted P&L → "what's driving the Q3 opex jump?" → Scout calls `getForecastedPL` then `getPersonnelForecast`, answers "three planned eng hires in August plus the comp merit cycle," shows the rows.

---

## 9. Build plan (Phase 0–5)

**P0 — Foundation.** Spine + `InMemoryDataStore` + Beacon seed (GL = actuals, COA, depts, periods, budget, `account_statement_map`, schedules) + Scout shell + nav scaffolded (Accounting stubbed). *Done:* seeded GL queryable, app looks complete.

**P1 — Forecasted P&L · actuals.** Actual column from GL via the map + drill-downs (Revenue drivers, Personnel Actuals, Expense Summary). *Scout:* "why is COGS over budget?" → JE detail.

**P2 — Forecasts · P&L + Assumptions.** Revenue + Personnel + Expenses forecasts → forecast column of Forecasted P&L; drill to inputs; driver changes re-flow. *Scout:* "what's driving Q3 opex?"

**P3 — Dashboard.** P&L (actual + forecast) + cash + KPIs + Scout briefing.

**P4 — Balance Sheet + Cash Flow.** Balance Sheet (+ WIP/AR/AP aging, deferred) and Cash Flow (+ Forecasts→BS: AR Forecast, Revenue Waterfall Forecast, Fixed Asset Budget, Operating Cash Forecast). *Scout:* "when do we dip below $2M?"

**P5 — Accounting (the tail).** Month-End Close (Revenue/Prepaids/Depreciation/Accruals/GL/Variance/Recon) + subledgers + standards. Functioning vs placeholder as time allows; data already seeded behind the stubs.

---

## 10. Open decisions (need Chris)

1. **WIP Aging** = unbilled/services or inventory WIP? (Drives the Beacon seed.)
2. Confirm **InMemoryDataStore** + **Beacon Devices** for the week.
3. P0 seed depth: GL totals first (fastest to a rendering P&L) vs schedules seeded up front. Default: totals-first, schedules feed Phase 4.
4. Forecast horizon: monthly through **Dec 2026** assumed.
```
