# Dogfood/Bearing â€” Project Status Review
_2026-06-20 Â· synthesized from a verified module map, data-sanity audit, functionality audit, and per-guide alignment reports_

## 1. Executive summary

**What works.** The financial spine is real and honest. All gates are green: data-sweep 43/43 tie-outs, scout-readiness 34/34, `tsc` exit 0, peer-check coherent (FY26 revenue $23.4M, GM 71%, NRR 109%, magic 1.2x, LTV:CAC 4.3x, Rule of 40 25%, burn multiple 0.6x, runway 49mo). Eight pages are genuinely built on live `getDataStore()` queries and tie out by construction: Dashboard (+19 metric tiles), all three statements (P&L with FY/Monthly toggle, Balance Sheet, Cash Flow), the Contracts/Customers/Expense Transactions registers, and the User Guides route. Scout is live end to end â€” key-optional Anthropic tool-use with a deterministic-router fallback, 13 wired tools, a click-through receipt per call, and streaming commentary. "One source, two callers" holds for everything shipped.

**The headline gap.** The guides describe the *intended* product; large parts of that product are stubs. Of ~25 nav surfaces, **14 are 13-line `PlaceholderPage` stubs**: all 7 Forecast drivers, all 4 Scenarios surfaces, Board Package, Projects, Staff, Pipeline, Renewals, and all 3 Setup config pages. Every **write path is unbuilt** â€” `lockBudget`, the scenario engine, flux notes, and the CSV importer all throw `notImplemented` or do not exist. The result: the four guides that teach *acting* on the product (budgets-and-forecasts 38%, updating-actuals 32%, creating-scenarios 8%, flux-analysis 26%, new-period 9%) are mostly aspirational, while the two that teach *reading* (reading-the-statements 88%, asking-scout 62%) are accurate. This is the expected state per CLAUDE.md Â§17 (Supabase + importer + write paths PAUSED pending Chris's validation), but the guides do not caveat it, so a CFO reading them will believe capabilities exist that do not.

**Important nuance the handoff missed:** several **driver queries are LIVE behind stub pages** â€” `getRevenueForecast`, `getRecognizedRevenue`, `getArForecast`, `getUtilization`, `getHeadcount`, `getArr`, `getBookings`, `getDeferredWaterfall`, `getContractedRevenue`. So "stub page" â‰  "no data." Five of those pages can ship cheaply.

## 2. Data sanity

**Verdict: the numbers are credible; the texture is not yet.** The headline financials and all 19 dashboard metrics are internally consistent and would survive a Series-B CFO/auditor reading the *statements*. Interest income correctly bridges OI âˆ’$12.8M to NI âˆ’$12.1M at $0 tax (NOLs); A=L+E by construction. No data issue moves a reconciled number â€” all five findings are display/record/texture, exactly where a buyer drills past the summary.

| # | Severity | Issue | Location | Fix |
|---|---|---|---|---|
| 1 | **High** | Churned contracts show stale pre-churn ARR (not "â€”"). Inconsistent half-fix: Customers was already patched, Contracts + Scout were not. Scout would quote a dead logo's ARR as current. | `components/sales/contracts-table.tsx:98` (`fmt(c.arr)` no guard); `lib/scout/tools.ts:247` getContracts, `:272` getContract | Apply the churned guard already in customers-table.tsx:108 / getCustomers:322 (`status==="churned" ? "â€”" : â€¦`). One decision drives both surfaces. |
| 2 | **High** | Pipeline deal owners come from a hardcoded `REPS` roster that does not reconcile to the Staff sales roster â€” drill pipeline-by-rep, open Staff, the reps aren't employees. | `lib/seed/pipeline.ts:29` | Source owners from actual `function:'sm'` StaffMembers (sales/CS depts), same one-source discipline as the rest of the spine. |
| 3 | Med | Every staff title is literally the department name across 140 employees (all 39 engineers titled "Engineering"). Reads as placeholder. | `lib/seed/personnel.ts:107` (`title: dept.name`) | Per-dept ordered title ladder, deterministic draw. Cosmetic; pairs with the Staff register build. |
| 4 | Med | Generated names march alphabetically within each department (Avery, Bianca, Calebâ€¦) â€” a synthetic-data tell. | `lib/seed/names.ts` (sequential cursor) | Permute the cursor with a deterministic RNG. No tie-out impact. |
| 5 | Low | Project `pct_complete`/`margin_pct` exported as raw 16-digit floats (0.957422169916555) next to clean rounded ARR. | `data-export/projects.csv` / presentation layer | Round at the presentation/export layer; keep full precision internally. |

None block the functionality-validation pass; #1 and #2 are the items most likely to read as "fake" in a live demo and should land before one.

## 3. Functionality vs modules

**Verdict: VERIFIED HEALTHY â€” no broken functionality.** Every built module reads live queries and renders correctly; peek panes (`?inspect=`), the P&L FY/Monthly toggle, and register filters all work; Scout is wired end to end behind a module-load assertion. STUBs are genuine placeholders, not half-built breakage. The findings below are coverage gaps, not bugs.

### Built vs stub

| Module | Page | Query state | Scout tool |
|---|---|---|---|
| Dashboard (+19 metrics) | **built** | live (DS-forward) | `getDashboard`, `explainTile`, `getMetric` âœ… |
| Forecasted P&L (+Monthly) | **built** | live | `getPnL`, `getMonthlyPnL`, `explainVariance` âœ… |
| Balance Sheet | **built** | live | `getBalanceSheet` âœ… (`getBalanceSheetLine` declared, not wired) |
| Cash Flow (+runway strip) | **built** | live | `getCashFlow` âœ… (`getRunway` live, no tool) |
| Contracts | **built** | live (DS-compose) | `getContracts`, `getContract`, `getBookingsHistory` âœ… |
| Customers | **built** | live | `getCustomers`, `getCustomer` âœ… |
| Expense Transactions | **built** | live | **none** â† only built register w/o a tool |
| User Guides | **built** | content.ts | `getProductMap`/`describeModule` declared, not wired |
| Board Package | stub | `notImplemented` | declared, not wired |
| Projects | stub | **live** (`getUtilization`) | none |
| Staff | stub | **live** (`getHeadcount`) | none |
| Pipeline | stub | `listPipeline` live; `getPipelineCoverage` notImpl | none |
| Renewals | stub | `listRenewals` live; `getNrr`/`getGrr` **notImpl** | none |
| Revenue Forecast | stub | **live** (`getRevenueForecast`) | none |
| AR Forecast | stub | **live** (`getArForecast`) | none |
| Cost of Revenue Â· Personnel Â· Expense Forecast Â· Fixed Asset Â· Prepaids | stub | `notImplemented` | none |
| Scenarios (Manager/Drivers/P&L/Dashboard) | all 4 stub | engine unbuilt | `setDriver`/`compareScenarios` declared, not wired |
| Account Mapping | stub | **live** (`getAccountMap`/`listExpenseGroups`) | `getExpenseGroups` declared, not wired |
| Data Import | stub | none | none |
| Settings | stub | `getSettings` live | none |

**Scout registry: 13 wired** (all data-lane, all with impls, asserted at module load) Â· **10 declared-not-wired** (`getBoardPackage`, `getBalanceSheetLine`, `getCashFlowLine`, `getPeriodConfig`, `getExpenseGroups`, `setDriver`, `compareScenarios`, `getProductMap`, `describeModule`).

### Coverage gaps (not broken)
- **Expense Transactions is the only built register with no Scout tool** â€” expense questions misroute to `getPnL`.
- **Live queries on built pages with no Scout tool:** `getRunway`, `getNonGaapReconciliation`, `getBudget` â€” candidate thin wirings (queries already exist).
- **Divergent-source risk:** `getNrr`/`getGrr` throw `notImplemented` in `sales.ts`, but NRR/GRR flow live through `getMetric` (computed in `lib/seed/dashboard-metrics.ts`). Document `getMetric` as canonical; delegate the sales.ts versions when Renewals ships.
- **Honesty-report under-report:** `getExpenseGroups`/`getPeriodConfig` are marked `query:null` though `listExpenseGroups`/`getSettings` are live â€” point the bindings at the real queries so the report shows "ready to wire."
- **Silent scenario-id:** driver/statement queries accept `scenarioId` and ignore it. Until the engine lands, throw `notImplemented()` on a non-null `scenarioId` rather than silently dropping it.

## 4. Guide alignment

| Guide | Alignment | Key things it promises that are NOT yet doable |
|---|---|---|
| reading-the-statements | **88%** | "Open full â†—" lands on stub pages for ~half the drill targets (all 7 drivers, Projects); Budget column is read-only (lock lifecycle unbuilt). |
| asking-scout | **62%** | Module-awareness / "context pill" does not exist (no `usePathname`); how-tos come from a prompt-baked product map, NOT the guides (so "one source for guide text" is false); scenario tools unwired; Q4-revenue and expansion-customers examples not answerable (no Revenue-Forecast or Renewals tool). |
| getting-started | **62%** | Claims first-tap peek pane on **the Dashboard** â€” false (Dashboard tiles are links/static basis strings; the pane is statements-only); presents all nav surfaces as live when 14 are stubs; "scenarios in minutes" unbuilt. |
| budgets-and-forecasts | **38%** | All 7 driver edit surfaces are stubs; `lockBudget` throws (Budget shown is a seed snapshot, not user-locked); no driver-level Scout tool, so "why is CoR up vs budget" is unanswerable. |
| updating-actuals | **32%** | Data Import, live ERP, Account Mapping editor, Settings close-boundary control, as-of roll-forward all unbuilt; close boundary is a hardcoded constant in ~12 sites; attributes the state-shaded monthly view to Board Package (a stub) â€” it actually lives on the P&L `?view=monthly`. |
| flux-analysis | **26%** | The entire feature is unbuilt: `getFluxNotes`/`addFluxNote`/`getFluxDetail` exist only in docs/schema; no note card, thread, Resolve, marker, drawer, decomposition table, or flux Scout tools. |
| creating-scenarios / budget-and-scenarios | **8% / 22%** | All 4 Scenario pages stub; engine non-existent; no presets seeded (25% Profit/Capacity/Breakeven are label strings only); `setDriver`/`compareScenarios` unwired. Typed contract in `lib/types/scenario.ts` is accurate spec, but nothing consumes it. |
| setting-up-a-new-period | **9%** | New-period loop entirely unbuilt; claims "statements are trial-balance-driven" â€” **inaccurate**: statements are built from seed driver series, not an imported TB. |

### Consolidated claims to fix or caveat

**Inaccurate (factually wrong against the build â€” fix the text or the code):**
1. getting-started: Dashboard opens a right-side peek pane on first tap. **It does not** â€” pane is statements-only. (Most user-visible inaccuracy.)
2. asking-scout: how-tos are answered "from these User Guides." **They are not** â€” sourced from the product map in `config.ts`; Scout never reads `lib/guides/content.ts`. The file's "one source, two callers for guide text" header comment is unrealized.
3. asking-scout: Scout is module-aware / shows a context pill. **Neither exists.**
4. updating-actuals: close boundary "is config, not hardcoded" and rolls forward. **It is a hardcoded constant; no roll-forward mechanism exists.**
5. updating-actuals: the state-shaded monthly view is in **Board Package** (a stub). It is on the **P&L `?view=monthly`**.
6. creating-scenarios: three seed presets ship as editable starting points. **No presets are seeded** â€” names are label strings only.
7. new-period: "statements are trial-balance-driven." **They are seed-driver-driven.**

**Designed-only (accurate spec, zero current capability â€” caveat in-guide as "coming"):** all driver-editing workflows; `lockBudget` / Budget-lock lifecycle; the entire Scenarios system (engine, 4 surfaces, levers, validation, composition, `setDriver`/`compareScenarios`); the entire Flux Analysis feature incl. all three flux functions and Scout write path; Data Import / live ERP / CSV templates as an in-app action; Account Mapping editor; the as-of/period-advance control; Scout's Q4-revenue and "walk Renewals" examples.

## 5. Prioritized backlog

Ordered to close the biggest guide-vs-reality and data gaps first, cheapest-credible-win to largest.

1. **Data credibility before any demo (S, no tie-out risk).** Fix the churned-ARR half-fix in Contracts + Scout (#1) and re-source pipeline owners from the Staff roster (#2). These are the two things that read as "fake" when a buyer drills. Then the cosmetic trio: title ladder (#3), name shuffle (#4), float rounding (#5).

2. **Ship the live-query-behind-stub pages (M, queries already done).** Revenue Forecast, AR Forecast, Projects (utilization), Staff (headcount), Account Mapping (read-only) all have live queries today â€” render the pages. This alone moves reading-the-statements from 88% (dead drill targets) toward 100% and recovers a chunk of budgets-and-forecasts/updating-actuals, because the "Open full â†—" destinations stop being placeholders.

3. **Close Scout coverage gaps (S, wiring not redesign).** Add `getExpenseTransactions` (only built register without a tool), fold `getRunway` into `getCashFlow` (or add thin tools for `getRunway`/`getNonGaapReconciliation`/`getBudget`), and point `getExpenseGroups`/`getPeriodConfig` bindings at their real live queries. Document `getMetric` as the canonical NRR/GRR source.

4. **Caveat the guides to match reality NOW (S, copy-only â€” highest honesty ROI).** Fix the 7 inaccurate claims in Â§4, and add a "coming soon" marker to every designed-only workflow. This is the cheapest way to close the guide-vs-reality gap for a CFO validation pass and should not wait for the features. Pair with making Scout actually read the guides (wire `getProductMap`/`describeModule` to `content.ts`) so the asking-scout "one source" claim becomes true.

5. **Centralize the as-of / close boundary (M, unblocks updating-actuals).** Replace the ~12-site `closeThrough` constant with one source + a Settings toggle. Prerequisite for the importer and the period roll-forward, and it makes the updating-actuals boundary claims true.

6. **Then the big builds, in CLAUDE.md Â§17 order (L, gated on Chris's validation):** Supabase swap (`SupabaseDataStore` + seed loader) â†’ CSV importer (parse/validate/reconcile/flag) â†’ flux-notes write path (closes flux-analysis, the lowest-aligned built-page-adjacent guide) â†’ Scenarios engine + 4 surfaces + `setDriver`/`compareScenarios` (closes the two lowest guides) â†’ `lockBudget` lifecycle â†’ Board Package â†’ remaining registers (Pipeline/Renewals) with their Scout tools.

**Honest bottom line:** the spine, the statements, and Scout are production-quality and tie out. The project's real risk is not correctness â€” it is that the guides currently promise a product roughly twice as built as it is. Closing that gap is one-third copy edits (step 4), one-third cheap page renders over queries that already exist (step 2), and one-third the genuinely large write-path/scenario builds that are correctly paused.