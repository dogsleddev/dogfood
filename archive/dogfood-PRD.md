# dogfood.cafe — PRD
## AI-native Accounting Close + FP&A + Board Reporting
**Demo company:** Beacon Devices (venture-backed hardware + SaaS)
**Build target:** functional vertical slice by Sunday, rest scaffolded
**For:** a Claude Code session — drop this in as `docs/PRD.md` (or `CLAUDE.md`)

---

## 0. What this is

A working AI-native finance platform spanning three pillars — **Accounting Close**, **FP&A**, and **Board reporting** — running one fictional company on seeded data. The hackathon emphasis is the FP&A spine: **actuals roll up into the P&L, forecasts roll up into the P&L, both roll into the Dashboard, and everything drills down** — actuals to the transaction, forecasts to their inputs. A module-aware agent (**Scout**) answers questions and walks the drill-downs in chat.

The central bet (carried from prior architecture work): **one query spine, two callers.** Typed functions in `lib/queries/` are consumed by both the module UI and Scout's tools. No RAG for structured data. If a module ships a typed function, Scout gets the capability for free.

---

## 1. Goals / Non-goals

**Goals (this week)**
- Income Statement with Actual + Budget/Forecast columns; **drill: actual → transaction, budget → assumptions**.
- Forecasts (staff, direct, indirect, revenue) **roll up to a Forecasted P&L**; drill to the inputs.
- P&L actual + forecast, cash, and KPIs **roll into the Dashboard**.
- Statements (P&L, Balance Sheet, Cash Flow) are **first-class, individually visible, read-only views** over the GL, with drill-down.
- **Cross-referencing forecasts**: Revenue Forecast and AR Forecast feed the Cash Flow Forecast; schedules feed the P&L and Balance Sheet.
- A **functioning Scout** that is module-aware and can drill.

**Non-goals (this week — stub or defer)**
- Real Supabase / auth. Use `InMemoryDataStore`.
- Real integrations (QuickBooks, Stripe). Stub pages.
- Full multi-currency consolidation beyond one 830 example.
- A fully budgeted Balance Sheet — show `—` on BS budget columns (see §6).
- Polished UI on stub modules.

---

## 2. Architecture (locked)

- **Query spine** — `lib/queries/*` typed functions. One source, two callers (UI + Scout). Zero RAG. Presentation logic (chart shaping, grouping) stays in module folders; anything that answers a business question lives in the spine.
- **DataStore interface** — `InMemoryDataStore` for the hackathon, `SupabaseDataStore` later. Swap, don't rewrite. Every row carries `firm_id` even in memory, so the Supabase cutover is an env change.
- **Module types** — `[R]` register (owns a standing body of data), `[P]` process (owns a checklist/workflow), `[V]` view (read-only over the spine, owns nothing).
- **Stack** — Next.js 15 App Router · TypeScript · Tailwind + shadcn/ui · Anthropic Claude API (Sonnet for reasoning, Haiku for lookups) · Vercel. **Design tokens inherit from the existing dogsled theme already in the repo; this PRD does not redefine them.**

```
app/
  (shell)/layout.tsx              # nav rail + Scout dock + topbar (all persistent)
  dashboard/page.tsx
  statements/
    income-statement/page.tsx
    balance-sheet/page.tsx
    cash-flow/page.tsx
    transactions/page.tsx         # Transaction Details — the drill target
  fpa/
    forecast-pl/page.tsx          # Forecasted P&L (hub)
    revenue-forecast/page.tsx
    ar-forecast/page.tsx
    cash-forecast/page.tsx
    staff-budget/page.tsx
    direct-expenses/page.tsx
    indirect-expenses/page.tsx
    drivers/page.tsx
  revenue/rev-rec/page.tsx
  schedules/prepaids/page.tsx
  schedules/fixed-assets/page.tsx
  ...stubs (pipeline, contracts, commissions, lease, fx, sbc, close, recon, flux, bva, board, system)
lib/
  queries/                        # THE SPINE
    statements.ts forecast.ts expenses.ts revenue.ts schedules.ts metrics.ts transactions.ts
  data/
    store.ts                      # DataStore interface
    in-memory.ts                  # InMemoryDataStore (hackathon)
    seed/                         # Beacon Devices seed generators
  scout/
    tools.ts                      # wraps lib/queries as Claude tool schemas
    registry.ts                   # per-module tool activation + seeded prompts
    dock.tsx
types/index.ts
```

---

## 3. Data model + Beacon seed

**Core tables**
- `chart_of_accounts` — id, name, type (asset/liability/equity/revenue/expense), parent (rollup), normal_sign
- `departments` — Eng, Sales, G&A, Ops, Marketing
- `periods` — monthly. **Actuals Jan–May 2026 (closed), June 2026 in close. Forecast June–Dec 2026.** (Optionally FY25 for YoY.)
- `journal_entries` — header + lines. Each line: account_id, dept_id, period, amount, **source_module**, memo, **doc_ref**, status (draft/pending/approved). **This table is the single source of actuals.**
- `budget` — amount by account × dept × period (this is the plan; also the near-term forecast baseline)
- `employees` — role, dept, comp, start_date, (planned hires flagged)
- `customers`, `vendors`
- `entities` + `fx_rates` — parent USD + one EUR sub (830 example)

**Schedules (registers feeding both actuals and forecast)**
- `prepaid_schedule` — prepaid item, total, term, monthly amortization → indirect expense + BS prepaid balance
- `fixed_asset_schedule` — asset, cost, life, depreciation → P&L D&A + BS NBV (includes capitalized software, 350-40)
- `revenue_schedule` — 606 recognition rows → recognized revenue + deferred-revenue waterfall
- *(later: `lease_schedule` 842, `sbc_schedule` 718)*

**Config**
- `account_statement_map` — GL account → statement line, with sign. **Drives the statements and the drill-down.** Build this early; the statements are computed from it, never hand-entered.

**THE TIE-OUT RULE (non-negotiable):** generate downstream rows from their source and make everything reference the same ids so it foots. The revenue schedule generates from contract terms; the JE generates from the schedule; the statements compute from the JEs via the map. If the GL, schedules, and statements all reconcile, Scout's answers are correct and can't be broken in Q&A. Internal consistency beats another module.

**Beacon shape (for realistic numbers):** ~40 employees; two revenue streams — device hardware (606 point-in-time) and SaaS subscription (606 ratable); a warehouse lease (842); a small EUR sub (830); prepaid insurance + software (prepaids); capitalized tooling + cap software (fixed assets); sales commissions (340-40); a burn / runway / headcount story for the board.

---

## 4. The left rail (full app — ● build this week, ○ stub)

```
dogfood.cafe · Close + FP&A + Board        ⌂ Scout  pinned · module-aware

OVERVIEW
  ● Dashboard

FINANCIAL STATEMENTS            [V]  read-only · actual vs budget · drill to txn
  ● Income Statement (P&L)
  ● Balance Sheet
  ● Cash Flow (indirect)
  ● Transaction Details              GL register · the drill target

FP&A — FORECAST
  ● Forecasted P&L            ◆hub
  ● Revenue Forecast
  ● AR Forecast
  ● Cash Flow Forecast
  ○ Scenarios & What-If

FP&A — PLANNING (expense inputs)
  ● Staff Budget
  ● Direct Expenses
  ● Indirect Expenses
  ● Drivers & Assumptions            shared assumption store

REVENUE
  ● Revenue Recognition · 606
  ○ Contracts   ○ Pipeline   ○ Commissions · 340-40

SCHEDULES & SUBLEDGERS          [R]
  ● Prepaids Schedule
  ● Fixed Assets Schedule
  ○ Accounts Receivable   ○ Accounts Payable (+ freight accrual)
  ○ Lease · 842   ○ Foreign Currency · 830   ○ Stock-Based Comp · 718

CLOSE                           [P]
  ○ Period Close   ○ Reconciliations   ○ Flux / Variance

BOARD & ANALYTICS
  ○ Budget vs Actuals   ○ Metrics & KPIs   ○ Board Package

SYSTEM
  ○ Settings   ○ Users & Roles   ○ Integrations   ○ Audit Log
```

Note: `getAging` (AR) and `getMetrics` (KPIs) are built this week even though their pages are stubs, because AR Forecast and the Dashboard consume them.

---

## 5. Module specs (must-haves)

| Module | Route | Type | Key queries (owns / exposes) | Upstream cross-refs | Scout tools · sample prompts |
|---|---|---|---|---|---|
| Dashboard | /dashboard | V | `getDashboard` (composes) | IncomeStmt, CashForecast, Metrics | getDashboard · "how's the month tracking?" · "what's our runway?" |
| Income Statement | /statements/income-statement | V | `getIncomeStatement(period)`, `getStatementLineDetail(ref)` | GL, Budget | getIncomeStatement, getStatementLineDetail · "why is COGS over budget?" (drills to JE lines) |
| Balance Sheet | /statements/balance-sheet | V | `getBalanceSheet(period)` | GL, subledgers, schedules | getBalanceSheet, getStatementLineDetail · "what's in prepaids?" |
| Cash Flow (stmt) | /statements/cash-flow | V | `getCashFlowStatement(period)` | IncomeStmt, BS movements | getCashFlowStatement · "where did cash go in May?" |
| Transaction Details | /statements/transactions | R (GL view) | `getTransactions(filter)` | GL (source of actuals) | getTransactions · "show all freight entries in May" |
| Forecasted P&L | /fpa/forecast-pl | V ◆hub | `getForecastedPL(horizon)` | RevenueFc, Staff, Direct, Indirect, Deprec, PrepaidAmort | getForecastedPL + input tools · "what's driving Q3 opex?" (drills to staff plan) |
| Revenue Forecast | /fpa/revenue-forecast | V | `getRevenueForecast` | Pipeline(stub-weighted), RevSchedule(606 in-force), actuals | getRevenueForecast, getRevenueSchedule · "what if we win the top 3 deals?" |
| AR Forecast | /fpa/ar-forecast | V | `getARForecast` | RevenueFc (billings), `getAging`, DSO | getARForecast, getAging · "re-forecast cash if AR slips 15 days" |
| Cash Flow Forecast | /fpa/cash-forecast | V | `getCashForecast` | ForecastedPL, ARForecast, AP, Deprec | getCashForecast · "when do we dip below $2M?" |
| Staff Budget | /fpa/staff-budget | R | `getStaffForecast` | employees, planned hires, Drivers | getStaffForecast · "cost of 3 more engineers in Q3?" |
| Direct Expenses | /fpa/direct-expenses | R | `getDirectExpenseForecast` | Drivers (unit cost × volume), actuals | getDirectExpenseForecast · "COGS at 2x device volume?" |
| Indirect Expenses | /fpa/indirect-expenses | R | `getIndirectExpenseForecast` | recurring, `getPrepaidAmortization`, Drivers | getIndirectExpenseForecast · "opex run-rate next quarter?" |
| Drivers & Assumptions | /fpa/drivers | R | `getDrivers`, `setDriver` | (shared — every forecast reads this) | getDrivers, setDriver · "set growth to 8% and re-forecast" |
| Revenue Rec · 606 | /revenue/rev-rec | R | `getRevenueSchedule`, `getDeferredWaterfall` | Contracts (stub) | getRevenueSchedule, getDeferredWaterfall · "why did deferred jump?" · "what recognizes next month?" |
| Prepaids Schedule | /schedules/prepaids | R | `getPrepaidSchedule`, `getPrepaidAmortization(period)` | feeds Indirect + BS | getPrepaidSchedule · "remaining prepaid insurance?" |
| Fixed Assets Schedule | /schedules/fixed-assets | R | `getFixedAssetSchedule`, `getDepreciation(period)` | feeds P&L D&A + BS NBV | getFixedAssetSchedule, getDepreciation · "depreciation next quarter?" |

Stubs (Phase 5): Pipeline, Contracts, Commissions·340-40, AR, AP, Lease·842, FX·830, SBC·718, Period Close, Reconciliations, Flux/Variance, Scenarios, Budget vs Actuals, Metrics & KPIs (page), Board Package, System.

---

## 6. Statement drill-down contract

This is the part most likely to be built wrong if unstated. The actual side and the budget side are **not symmetric.**

```
GRAIN:   Statement → Line → Account → Transaction
COLUMNS: Actual · Budget · Variance (A−B, %)   at every level

ACTUAL drills all the way to a transaction:
  P&L line       → JE lines posted to those accounts this period
                   (each carries source_module, date, memo, doc_ref)
  Balance Sheet  → subledger / schedule detail where one exists
                   (AR aging, prepaid schedule, fixed-asset register, 606 deferred);
                   else beginning balance + JE activity
  Cash Flow      → "drill to driver": Net Income → P&L; ΔAR/ΔAP/Δdeferred/Δprepaid →
                   that BS account's movement → its subledger/schedule;
                   depreciation → fixed-asset schedule; financing/investing → cash JEs

BUDGET has no transactions — it drills to ASSUMPTIONS, not entries:
  any line → budget line items (account × dept × period) + their driver refs
             (pulled from Drivers & Assumptions)

SCOPE:
  P&L fully budgeted (account/dept/period).  Cash Flow budget = the cash plan.
  Balance Sheet budget columns show "—" this week (a fully budgeted BS is rare;
  derive later or leave blank — do NOT hand-seed one).
```

Spine functions this implies: `getIncomeStatement / getBalanceSheet / getCashFlowStatement(period)` each return lines carrying `actual`, `budget`, and a `drillRef`; plus `getStatementLineDetail(drillRef, period)` that resolves to JE lines, subledger items, schedule rows, or a driver ref depending on the line.

---

## 7. Forecast roll-up (the cross-reference engine)

Actuals flow up; plan flows the other way. Each arrow is **one `lib/queries` function calling another** — nothing is re-derived in two places.

```
Forecasted P&L (getForecastedPL) =
    Revenue            ← getRevenueForecast  (pipeline-weighted + 606 in-force + actuals-to-date)
  − Direct Expenses    ← getDirectExpenseForecast (unit cost × volume; drill to Drivers)
  = Gross Margin
  − Staff              ← getStaffForecast (roster + planned hires × comp)
  − Indirect           ← getIndirectExpenseForecast (recurring + getPrepaidAmortization + Drivers)
  − D&A                ← getDepreciation + getPrepaidAmortization
  = Operating Income → Net Income (simplified)

Cash Flow Forecast (getCashForecast) =
    Net Income (from getForecastedPL)
  + D&A (non-cash addback)
  − ΔAR              ← getARForecast (collections timing / DSO on forecast billings)
  ± ΔAP, Δdeferred, Δprepaid
  − capex
  = net cash → running cash balance / runway

AR Forecast (getARForecast)   ← getRevenueForecast (billings) + getAging + DSO pattern
Balance Sheet (actual)        ← GL; balances explained by AR aging, prepaid + fixed-asset schedules, 606 deferred
Dashboard                     ← getForecastedPL + getCashForecast + getMetrics
```

Income Statement's budget column and Forecasted P&L's near-term forecast **read the same budget/forecast source**, so the two P&L surfaces reconcile.

---

## 8. Scout (module-aware)

Global, pinned dock. Opening a module **(a)** activates that module's query tools **plus its upstream cross-reference tools** (from §5/§7), and **(b)** seeds the suggested prompts for that module. Because the cross-references are themselves tools, Scout can walk upstream without the user leaving the chat — open Forecasted P&L, drill into the staff plan driving it.

- `lib/scout/tools.ts` wraps each `lib/queries` function as a Claude tool schema.
- `lib/scout/registry.ts` maps module → active tools + seeded prompts (see the last column of §5).
- Models: Sonnet for reasoning/multi-step, Haiku for cheap lookups.
- Personality: analyst first, numbers over charm, light dog theme only when it lands. No pun spirals.

**Demo beat:** open Income Statement → "why is COGS over budget?" → Scout calls `getIncomeStatement` then `getStatementLineDetail`, answers "freight accrual true-up plus higher device unit costs," and shows the four entries. Statement → transactions → explanation, in the dock.

---

## 9. Build plan (Phase 0–5, sized for the week)

**Phase 0 — Foundation (prerequisite).** Spine + `DataStore` (InMemory) + Beacon seed (GL, COA, departments, periods, budget, `account_statement_map`) + **Transaction Details** + Scout shell + nav scaffolded with every module as a stub.
*Done when:* you can browse the seeded GL and the nav looks like the full app.

**Phase 1 — P&L Actuals + drill.** Income Statement actual columns computed from the GL via the map; drill to Transaction Details.
*Done when:* a P&L line opens its JE detail. *Scout:* "why is COGS over budget?" drills to entries.

**Phase 2 — Forecast layer.** Staff, Direct, Indirect, Revenue forecasts → roll into Forecasted P&L → drill to inputs. Drivers & Assumptions as the shared store.
*Done when:* changing a driver re-flows the Forecasted P&L. *Scout:* "what's driving Q3 opex?" drills to the staff plan.

**Phase 3 — Dashboard.** Rolls up P&L (actual + forecast), cash position, KPIs, Scout briefing.
*Done when:* the landing page summarizes the month + forecast + runway. *Scout:* "how are we tracking?"

**Phase 4 — Statements + forward cash/revenue.** Balance Sheet, Cash Flow (statement), Cash Flow Forecast, AR Forecast, Revenue Rec 606, Prepaids Schedule, Fixed Assets Schedule.
*Done when:* the three statements drill per §6 and the cash forecast reconciles to the P&L. *Scout:* "when do we dip below $2M?"

**Phase 5 — The rest (your call).** Decide functioning vs placeholder for Pipeline, Contracts, Commissions, Lease 842, FX 830, SBC 718, Close, Reconciliations, Flux, BvA, Board Package, System.

---

## 10. Open decisions (need Chris)

1. Confirm **Beacon Devices** (hardware + SaaS) as the demo company.
2. Confirm **InMemoryDataStore** for the week (Supabase deferred).
3. Phase 0 seed depth: start with **GL totals only** and layer the 606 / prepaid / fixed-asset detail in Phase 4, or seed the schedules up front? (Totals-first is faster to a rendering P&L.)
4. Forecast horizon to show: **monthly through Dec 2026** assumed.
```
