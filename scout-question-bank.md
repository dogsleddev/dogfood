# Scout question-bank review (2026-06-20)

A test bank of **1181 questions** across 21 categories, each classified against Scout's real 13-tool surface and the built/stub module map. Full tagged corpus: `scout-question-bank.csv`. Live-sample validation appended at the end.

## Headline (by actual per-question tag)

| Class | Count | % |
|---|---:|---:|
| Answerable now | 562 | 48% |
| Gap (needs an unbuilt tool/module) | 389 | 33% |
| Should decline (out of scope) | 126 | 11% |
| Ambiguous (routing risk) | 104 | 9% |

Scout covers the cockpit well; the gap is concentrated in the unbuilt surfaces, not diffuse.

## By category

| Category | Total | Now | Gap | Decline | Ambiguous |
|---|---:|---:|---:|---:|---:|
| dashboard-overview | 60 | 41 | 11 | 4 | 4 |
| profitability-metrics | 60 | 46 | 7 | 4 | 3 |
| growth-retention-metrics | 60 | 40 | 11 | 3 | 6 |
| unit-economics | 55 | 30 | 17 | 4 | 4 |
| cash-efficiency | 55 | 38 | 8 | 4 | 5 |
| pnl-monthly-variance | 65 | 49 | 9 | 2 | 5 |
| balance-sheet-cashflow | 60 | 38 | 11 | 5 | 6 |
| contracts-bookings | 65 | 40 | 9 | 5 | 11 |
| customers-churn | 60 | 33 | 11 | 4 | 12 |
| pipeline | 50 | 3 | 41 | 3 | 3 |
| renewals-retention | 50 | 13 | 30 | 3 | 4 |
| projects-utilization | 50 | 11 | 33 | 3 | 3 |
| staff-headcount | 50 | 7 | 36 | 3 | 4 |
| forecast-drivers | 60 | 4 | 47 | 4 | 5 |
| scenarios-budget | 65 | 17 | 41 | 3 | 4 |
| flux-notes | 55 | 14 | 36 | 3 | 2 |
| period-import-actuals | 55 | 16 | 26 | 9 | 4 |
| board-package-export | 40 | 9 | 25 | 4 | 2 |
| how-to-product-knowledge | 60 | 53 | 4 | 3 | 0 |
| out-of-scope-decline | 50 | 0 | 0 | 50 | 0 |
| ambiguous-multitool | 55 | 30 | 9 | 1 | 15 |

## The gap backlog (what to address)

### [P0] Forecast drivers (Revenue/CoR/Personnel/Expense/AR/Fixed Asset/Prepaids) (~91 questions)

**Blocked by:** No Scout tools for any layer-2 driver surface. The forecast OUTPUT is exposed (getPnL forecast columns, getMetric runway/ARR), but the driver ASSUMPTIONS (hiring plan, CoR rate, opex-by-group, DSO/DPO, capex schedule) have no tool. Causes the 'why will X move / what drives it' questions to fall through.

**Fix:** Wire a getDriver(driverId, period, {dimension?}) family against registry.ts as each driver surface ships in the Run: getRevenueForecast, getCostOfRevenue, getPersonnelForecast, getExpenseForecast, getArForecast, getFixedAssetForecast, getPrepaidsForecast. Spine functions already specced in Â§8 - this is wiring, not redesign. Personnel + Expense + CoR first (they also unblock unit-economics decomposition).

### [P0] Scenarios engine + Budget lock (~59 questions)

**Blocked by:** Scenarios engine is a stub (no setDriver/compareScenarios wired) and lockBudget has no tool. Any create/duplicate/compare/what-if/lock request is a gap even when phrased simply. The typed scenario contract exists (Â§9) but the engine is unbuilt.

**Fix:** Build the deterministic scenario engine on the locked Â§9 contract, then wire group-scoped setDriver + compareScenarios + lockBudget. Budget-set/what-if asks span dashboard, profitability, cash, and BS/CF categories, so this lifts gap counts across the cockpit. Bundle lockBudget with it (10 of the 59 are budget-snapshot/lock).

### [P0] Renewals register + getNrr/getGrr wiring (~48 questions)

**Blocked by:** The renewals worklist (date-ordered upcoming/at-risk renewals by customer/owner) has no tool; getNrr/getGrr are composed-not-wired. Cohort NRR via getMetric IS wired, so book-level metric reads answer now, but anything needing per-renewal rows, owners, dates, risk flags, or a renewal-by-renewal bridge is a gap.

**Fix:** Wire getRenewals(window, {owner?,risk?}) over the seeded 165 renewal records, plus surface the composed getNrr/getGrr as wired tools. Highest single-category concentration after the deep-gap registers; also resolves spillover in customers-churn, contracts-bookings, and growth-retention.

### [P0] Pipeline register (~47 questions)

**Blocked by:** No getPipeline / getPipelineCoverage tool. The 46 seeded opportunities are not query-exposed, so open-pipeline, coverage, by-stage, by-rep, and single-deal questions are gaps. Only bookings-history (getBookingsHistory) and closed-won-now-a-contract (getContracts) overlap to wired tools.

**Fix:** Wire getPipeline({byStage?,byRep?}), getPipelineCoverage(), and getOpportunity(id) over the seeded opps. Nearly all 47 pipeline-category gaps unlock from one register. Pairs naturally with Renewals as the two unbuilt Sales registers.

### [P1] Staff / headcount register + Personnel detail (~46 questions)

**Blocked by:** No getHeadcount and no listStaff/getStaff tool; Staff register unbuilt. Almost every staff-specific ask (count by dept, per-person comp, hiring plan, attrition, open reqs) is a gap. Only payroll P&L lines and the utilization metric carry any staff signal today.

**Fix:** Wire getHeadcount(period,{byDept?,byFunction?}) and listStaff/getStaff over the seeded 140-person register (spine queries exist). 6 of the 46 belong with the Personnel forecast driver. Deepest people-data gap; core to board/headcount asks.

### [P1] Flux notes write/read path (~45 questions)

**Blocked by:** getFluxNotes/addFluxNote/getFluxDetail are designed-not-built and land with the Supabase write path (currently PAUSED pending Chris's validation). explainVariance IS wired so pure 'why did X move' answers now; reading/writing a NOTE, listing unexplained/outstanding flux items, or persisting reviewer commentary is a gap.

**Fix:** Land the flux-notes write path with the Supabase swap: getFluxNotes/getFluxDetail (read) + addFluxNote (write), keyed on the stable sub-ledger id. Gated on the Supabase decision, so sequence after the importer. ~4 of these also need the period/import reconciliation surface.

### [P1] Board Package assembly/export (~29 questions)

**Blocked by:** app/board-package/page.tsx is a PlaceholderPage; no getBoardPackage tool. Any request to assemble, generate, export, or roll up the board deck (deck/PDF/PPTX, multi-section narrative, QoQ packaging) is a gap. Single board-bound numbers already route to wired tools and are 'now'.

**Fix:** Build the Board Package roll-up over already-wired statement/metric tools and wire getBoardPackage(period). Mostly composition of existing reads, so lower build risk; export/format generation is the net-new piece. A visible 'board deliverable' win once statements are done.

### [P1] Projects register + utilization detail (~26 questions)

**Blocked by:** No listProjects/getProject tool. The firm-level utilization metric is wired (getMetric), but individual projects, % complete, WIP/unbilled, billing status, and by-person/by-team utilization need the Projects register (+ the Staff tool for the people axis).

**Fix:** Wire listProjects()/getProject(id) and getUtilization(period,{byPerson?,byProject?}) over the seeded projects. Best done alongside the Staff register since by-person utilization needs both. Smaller blast radius than the Sales registers.

### [P2] Period / import / reconciliation / as-of control (~22 questions)

**Blocked by:** CSV importer (parse/validate/reconcile/flag) is a stub, the global as-of is a closeThrough constant in ~12 sites (not centralized), and detail-vs-TB reconciliation + restatement/roll-forward flows are unbuilt. 'How does the close/import work' answers now via the Updating-actuals guide; actually importing/reconciling/advancing is a gap.

**Fix:** Centralize the global as-of into one Settings control, then build the CSV importer (parse to validate to reconcile to flag) and the detail-vs-TB reconciliation surface. Gated on the Supabase decision. These are operator actions more than Scout Q&A, so lower question-yield per unit of build.

### [P2] Guides-coverage / segment breakouts (small residuals) (~8 questions)

**Blocked by:** Four how-to questions (Board Package export, keyboard nav, FX/multi-currency) are not documented in any of the six guides, so the product-knowledge lane cannot answer. Three customer/segment breakouts go beyond the current getCustomers shape.

**Fix:** Add guide sections for the undocumented behaviors as those features ship (export, FX); extend getCustomers with segment/cohort dimensions. Cheap, incremental; do opportunistically alongside the owning module.

## Prioritized actions

- **[P0]** Wire the Forecast-driver tool family (getRevenueForecast, getCostOfRevenue, getPersonnelForecast, getExpenseForecast, getArForecast, getFixedAssetForecast, getPrepaidsForecast) against registry.ts as each driver surface ships - Personnel/Expense/CoR first.
  - _Unlocks:_ ~91 gap questions, the single largest cluster; also unblocks unit-economics decomposition (CAC-by-channel, payback-by-segment) and 'what drives the forecast' across dashboard, profitability, cash, and BS/CF.
- **[P0]** Build the deterministic Scenarios engine on the locked Â§9 contract and wire group-scoped setDriver + compareScenarios, plus lockBudget.
  - _Unlocks:_ ~59 gap questions across scenarios-budget, dashboard, profitability, cash, and BS/CF; turns every what-if/compare/lock ask from a gap into a real answer.
- **[P0]** Wire the two unbuilt Sales registers: Pipeline (getPipeline/getPipelineCoverage/getOpportunity) and Renewals (getRenewals + surface getNrr/getGrr) over the already-seeded opps and renewals.
  - _Unlocks:_ ~95 gap questions combined (47 pipeline + 48 renewals) and clears the two heaviest-gap Sales categories plus spillover in customers-churn and contracts-bookings.
- **[P0]** Add the routing guards to the Scout eval: qualifier-forces-register (ARR/churn), waterfall-vs-balance (deferred rev), month-vs-FY (P&L), YoY-vs-single-month (bookings), runway canonicalization, and what-if-vs-variance. Weight new cases toward the high-frequency pairs.
  - _Unlocks:_ Protects the ~102 ambiguous questions and the existing 'now' answers from mis-routing as the new tools widen the fan-out surface (more tools = more collisions).
- **[P1]** Wire the Staff/headcount register (getHeadcount, listStaff/getStaff) and the Projects register (listProjects/getProject, getUtilization by person/project) together - by-person utilization needs both.
  - _Unlocks:_ ~72 gap questions (46 staff + 26 projects); fills the deepest people/delivery data gaps and the by-person/by-dept decomposition unit-economics needs.
- **[P1]** Build the Board Package roll-up over wired statement/metric tools and wire getBoardPackage; add the missing guide sections (export, FX, keyboard nav).
  - _Unlocks:_ ~33 gap questions (29 board + 4 guide-coverage residuals); delivers the visible board deliverable and closes the undocumented-how-to holes.
- **[P2]** After Chris greenlights Supabase: centralize the global as-of into a Settings control, build the CSV importer + detail-vs-TB reconciliation, then land the flux-notes write/read path (getFluxNotes/getFluxDetail/addFluxNote).
  - _Unlocks:_ ~67 gap questions (45 flux + 22 period/import); gated on the Supabase decision, so sequenced last despite the volume.

## Routing risks (guard the ambiguous bucket as tools widen)

- **Bare metric vs by-segment/by-customer breakout - phrasing forks getMetric and getCustomers**
  - Example: 'ARR' alone should hit getMetric (arr_mrr), but 'ARR by segment' / 'ARR by customer' must hit getCustomers; routing 'ARR by segment' to getMetric returns a single firm-level number and silently drops the breakdown.
  - Fix: Router rule: presence of a grouping qualifier (by/per/each/top/which customer|segment|tier) forces the register tool (getCustomers); bare metric noun defaults to getMetric. Add eval cases pairing each metric noun with and without a qualifier.
- **Churn RATE vs churned LOGOS - same word 'churn', two tools**
  - Example: 'What's our churn rate?' is getMetric (logo_retention), but 'Which customers churned?' / 'how many logos churned' is getCustomers; routing the count question to getMetric returns a percentage instead of the logo list.
  - Fix: Rate/percent/% phrasing routes to getMetric; who/which/how-many/list phrasing routes to getCustomers. Guard with paired eval cases (rate vs roster).
- **Deferred revenue - getContracts deferred waterfall vs getBalanceSheet liability line**
  - Example: 'Show the deferred revenue waterfall / schedule' is getContracts; 'what's deferred revenue on the balance sheet' is getBalanceSheet. Crossing them returns either a single liability number when a schedule was wanted, or a waterfall when the BS line was wanted.
  - Fix: Waterfall/schedule/roll-forward/by-contract -> getContracts; balance/as-of/on the balance sheet/liability -> getBalanceSheet. Add both phrasings to the routing eval (this pair recurs in BS/CF, contracts, and period-import categories).
- **Runway - three wired tools (getMetric vs getCashFlow vs getDashboard)**
  - Example: 'What's our runway?' can hit getMetric (runway), getCashFlow, or getDashboard; inconsistent routing yields three differently-framed answers and undermines the tie-out story.
  - Fix: Canonicalize bare 'runway/burn/net burn' to getMetric (single source for the figure); route to getCashFlow only when the ask is for the cash-flow detail/derivation, getDashboard only for the cockpit tile framing. Pin with eval cases.
- **Annual vs monthly P&L (getPnL vs getMonthlyPnL)**
  - Example: 'P&L for 2026' -> getPnL (annual); 'P&L by month' / 'which month did opex spike' -> getMonthlyPnL. Routing a 'which month' question to getPnL collapses the monthly detail the user needs.
  - Fix: Month/monthly/by month/which month/month-over-month -> getMonthlyPnL; FY/annual/full-year/bare year -> getPnL. High-frequency pair across pnl-monthly-variance and profitability.
- **Single-month bookings vs YoY/TTM bookings (getContracts vs getBookingsHistory)**
  - Example: 'Bookings in May' -> getContracts (the bookings view); 'bookings YoY / trailing twelve months / vs last year' -> getBookingsHistory. Routing a YoY ask to getContracts returns one lumpy month and misreads the trend (the original lumpy-single-month bug).
  - Fix: YoY/year-over-year/TTM/trailing/trend/vs last year -> getBookingsHistory; a single named period -> getContracts. This is the most common ambiguity in contracts-bookings (11 cases) - weight the eval set toward it.
- **Variance/'what changed' vs scenario what-if (explainVariance vs scenario engine)**
  - Example: 'Why is opex over budget?' -> explainVariance (wired); 'what if we cut opex 10%?' -> scenario engine (stub). Routing a what-if to explainVariance answers about the past instead of modeling the hypothetical.
  - Fix: What if/if we/assume/model/scenario/sensitivity -> scenario tools (decline gracefully until engine is wired); why/explain/driver of the actual variance -> explainVariance. Until the engine ships, return a clear 'scenarios not yet available' rather than a wrong variance answer.
- **'What changed since last month' / 'show me May actuals' - explainVariance vs getMonthlyPnL vs a register**
  - Example: 'What changed since last month' could hit explainVariance or getMonthlyPnL; 'show me May actuals' could hit getMonthlyPnL or the Expense Transactions register. Wrong pick returns either a narrative when numbers were wanted or statement totals when line detail was wanted.
  - Fix: Narrative/why -> explainVariance; statement numbers by month -> getMonthlyPnL; transaction-level detail -> the register. Add these as period-import eval cases.

## Narrative

Across the 21 categories the test bank totals 1,180 questions: 532 answerable now (45%), 422 gap (36%), 124 decline (11%), and 102 ambiguous (9%). Scout already covers the cockpit well - the statement, metric, dashboard, contracts/customers, and product-knowledge categories sit at 67-88% now, because getPnL/getMonthlyPnL/explainVariance, the getMetric catalog, getBalanceSheet/getCashFlow, the Contracts/Customers tools, and the User Guides lane carry the headline reads. The gap is concentrated, not diffuse: just three build areas - Forecast drivers (91), Scenarios+Budget-lock (59), and the two unbuilt Sales registers Pipeline (47) and Renewals (48) - account for ~245 of the 422 gaps, more than half. Adding Staff (46), Flux notes (45), Board Package (29), and Projects (26) covers another ~146. The deepest-gap categories are exactly the unwired surfaces: forecast-drivers (47/60 gap), pipeline (41/50), staff-headcount (36/50), flux-notes (36/55), projects (33/50), renewals (30/50), and scenarios (41/65). Most of these have spine queries already specced or seed data already loaded - the blocker is tool wiring against registry.ts and, for flux/import, the paused Supabase write path - so this is largely 'wire as the module ships' (Scout Follows Modules), not redesign. The 124 declines are healthy: an entire 50-question out-of-scope category plus scattered cap-table/close/JE/tax/external-market/beyond-horizon asks that Scout should redirect (to the ERP, Carta, or an accountant), not answer. The 102 ambiguous cases are the live risk during the build-out: every new tool widens the fan-out surface, so the wrong-tool collisions (ARR bare-vs-by-segment, churn rate-vs-logos, deferred-rev waterfall-vs-balance, runway across three tools, month-vs-FY P&L, single-month-vs-YoY bookings, what-if-vs-variance) must be guarded with paired eval cases in lockstep with each tool you wire. Recommended order: wire the Forecast-driver family and the Scenarios engine first (largest yield and cross-category lift), wire Pipeline + Renewals together as the two seeded Sales registers, harden the router eval alongside, then Staff+Projects and Board Package, and finally - gated on Chris's Supabase greenlight - the importer, as-of control, and flux-notes write path."

## Live-sample validation

Ran 89 of the bank (weighted across all 21 categories) through the **real Scout loop (Sonnet 4.6)**. All 89 executed in live mode.

- **NOW routing: 36/40 strict, ~39/40 effective.** Most "misses" are judge-strictness, not errors: "FY26 revenue" routed to `getPnL` (correct, revenue is on the P&L) and "utilization now" to `getDashboard` (the tile is there). **One real miss: "What's MRR?" called no tool** (the `arr_mrr` metric should fire) — fix the `getMetric` description/router and add an eval case.
- **DECLINE: 7/10 clean.** The 3 that touched tools read context then explained rather than acting (e.g. "close out June and roll forward" read `getPnL`/`getCashFlow` then explained it cannot run the close; "preferred vs common split" hit `getBalanceSheet`, which carries equity but not the cap-table split). Acceptable, but a cleaner up-front decline is better.
- **GAP: handled gracefully.** 9/20 admitted cleanly ("NRR cohort curves by signup month aren't available in my current toolset; my tools cover NRR/GRR as a single rate metric"); 11/20 gave the closest grounded answer with a caveat ("blended CAC is $129.3K; by-channel granularity isn't exposed"). It even composed a credible board package from the wired statement/metric tools. **One concern:** what-if questions ("if we cut S&M 20%, what happens to operating income?") get **hand-improvised math off `getPnL`** instead of deferring to the unbuilt scenario engine. Add the what-if guard so Scout says scenarios are not available yet rather than computing a hypothetical that does not flow through the model.
- **AMBIGUOUS: routes correctly today.** Every documented risk pair resolved right in the live run: runway to `getMetric(runway)` (consistent across 4 phrasings), ARR-by-segment to `getCustomers`, deferred revenue to `getBalanceSheet`, churn rate to `getMetric(logo_retention)`, bookings to `getContracts`, month-vs-FY to `getMonthlyPnL`. The risk is future: each new tool widens the fan-out surface, so add paired eval cases as tools land.

**Verdict:** the classification holds. Scout is correct and useful on the ~48% it covers, and declines or admits gracefully on most of the rest. Two concrete fixes fall out of the live run: the **MRR routing miss** and the **what-if-improvises-math guard**. Full per-question trace: `scout-live-results.json`.