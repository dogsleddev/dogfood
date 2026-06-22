# Scout — build context & plan

> Context pack for a Scout-focused discussion. Snapshot as of **2026-06-19**.
> Source of truth is `CLAUDE.md` (esp. §4, §8, §10, §13) and the current code; this file distills the
> Scout-relevant parts. Where this lags `CLAUDE.md`, `CLAUDE.md` wins.

---

## 1. What Scout is

**Scout is the persistent AI agent inside Dogfood** (the AI-native FP&A app for the fictional company **Bearing**).
It answers finance questions and walks the numbers the same way a user does — by calling the app's **typed query
spine**, never by doing its own math.

- **Posture:** an in-app "finance analyst" that reads the live forecast/statements/metrics and explains them.
- **Mechanism:** **Anthropic Claude API, tool-use pattern.** Each Scout tool is a thin wrapper over a `lib/queries/`
  function. **Zero RAG over structured financial data** — structured data is served only through typed tool calls.
  (RAG is acceptable *only* for unstructured help/guide text.)
- **Why this is safe:** a finance tool-use agent does no arithmetic — it repeats what its tools return. So Scout's
  trust reduces to the spine being correct, serializable, and deterministic (see §4, the readiness gate).

## 2. Locked decisions (don't relitigate)

- **`[LOCKED 2026-06-19]` Scout is IN-APP ONLY. No Slackbot, no proactive Slack alerts.** The former "Flavor C"
  (proactive alerts via Slack) is **rejected, not deferred.** The prior Slack hackathon work is **not** carried into
  this build. Both reactive Q&A *and* any proactive nudges surface **in-app**. This keeps Scout's whole surface on the
  query spine with a single delivery channel.
- **Delivery surface:** an **"Ask Scout" launcher at the bottom of the nav rail** (ember-gradient button) that opens
  Scout as a **floating panel, lower-right.** (Reference mock: `diagrams/scout-dock.svg`.)
- **Tool-Use over RAG** for structured data (above).
- **Scout Follows Modules** (principle 6): Scout capabilities expand **only as the grounding module ships.** Never
  build an agent tool ahead of the module whose data it reads.
- **Scenario tools are group-scoped:** Scout's scenario tools operate only inside the Scenarios group (scenarios are
  "contained" — the rest of the app is always Base + actuals). See `CLAUDE.md` §9.
- **Module-aware:** Scout knows which surface the user is on and can walk any drill chain in either direction (each
  arrow is a typed query it can call).

## 3. The architecture Scout runs on — the query spine

Everything reads financial data through **`lib/queries/`**, which has exactly two callers: the **module UI** (React
server components) and **Scout's tools**. This is **"one source, two callers"** — no duplicated data logic, ever.

```
   Module UI  ─────────▶┐
   (server components)  │   lib/queries/ (typed)  ─▶  DataStore (interface)  ─▶  InMemory (now) / Supabase (later)
   Scout tools ────────▶┘                              delegates to the seed (the tying-out reference impl)
   (Anthropic tool-use)
```

### The Scout-ready bar (what makes wiring a tool trivial)

The spine already satisfies this bar, so adding a Scout tool in the Run is **wiring, not redesign**:

1. Every `lib/queries/` function has a **typed I/O contract**, and its **output type is the basis the Scout tool's
   result schema derives from** ("one source, two callers" at the type level).
2. Query functions are **pure + deterministic with serializable I/O** (no UI-only concerns leaking in), so tool-use
   can call them directly and the result JSON round-trips to the model.
3. The **query ↔ Scout-tool mapping is an explicit named seam** — a registry (`lib/queries/registry.ts`).
4. **Scout Follows Modules** holds — the tool *surface* is declared, but no tool is built ahead of its module.

## 4. Current state of the build (Scout-relevant)

**Overall:** the "Harness" stage (the spine + the tying-out seed + the target Dashboard/P&L) is essentially complete
and **the Run (building the remaining modules + Scout) has started.** The data foundation is solid: the seed **ties
out by construction** (data-sweep **43/43**: statements, GL/trial-balance, the AR/AP sub-ledger-to-Balance-Sheet
foots, dashboard↔P&L, monthly↔FY). `tsc`/`lint`/`build` are green.

**Scout itself is NOT yet wired.** What exists today:

- **The registry seam — DEFINED, all `wired: false`** (`lib/queries/registry.ts`). The declared per-module tool
  surface:

  | Module | Tool | Backing query | Status |
  |---|---|---|---|
  | Dashboard | `getDashboard` | `getDashboardSummary` | live query, ready to wire |
  | Dashboard | `explainTile` | `getKpiTile` | live query, ready to wire |
  | Board Package | `getBoardPackage` | `getBoardPackage` | query not built yet |
  | Forecasted P&L | `getPnL` | `getPnL` | live query, ready to wire |
  | Forecasted P&L | `explainVariance` | `getPnLLine` | live query, ready to wire |
  | Balance Sheet | `getBalanceSheet` | `getBalanceSheet` | live query, ready to wire |
  | Cash Flow Forecast | `getCashFlow` | `getCashFlow` | live query, ready to wire |
  | Scenarios | `setDriver` | (scenario engine) | engine not built yet (Run) |
  | Scenarios | `compareScenarios` | (scenario engine) | engine not built yet (Run) |

  Reporting / Sales / Forecasts (drivers) tools are added per **Scout Follows Modules** as each module ships.

- **The readiness gate — `scripts/scout-readiness.ts` (20/20 PASS).** This is *not* the agent; it proves the
  deterministic spine Scout will call is sound, so wiring tool-use later is wiring, not a numbers risk. It checks the
  live tool surface for three properties:
  1. **Serializable** — every live tool result JSON round-trips.
  2. **Consistent** — the same number agrees across every tool that reports it (e.g. net income via `getPnL`,
     `getCashFlow`, and `getMetric` all tie; balance sheet Assets == Liabilities + Equity *through the query*).
  3. **Deterministic** — same tool + same args → identical bytes.
  It also prints a **registry-honesty report**: which declared tools are backed by a *live* query today (the
  Dashboard + P&L + Balance Sheet + Cash Flow queries are live; Board Package + the Scenario engine are not).

- **The panel scaffold — `components/scout/`.** `scout-panel.tsx` (the floating lower-right panel chrome: header,
  context pill, thread, composer) and `scout-context.tsx` (open/close React context). **Phase-0 chrome only — no
  tool-use is wired.** The launcher lives at the bottom of the nav rail.

## 5. Future plans for Scout (the Run)

Scout is built in **the Run** on the Harness artifacts. Plan:

1. **Wire tools per shipped module (Scout Follows Modules).** As each module's query surface lands, wire its Scout
   tool against the registry. The mechanics each time:
   - Take the query's **output type → derive the Scout tool's result schema** from it (typed contract at the seam).
   - Register the tool with the Anthropic tool-use loop; the tool body just calls the `lib/queries/` function.
   - Flip the registry binding to `wired: true`.
   The first tools to wire are the already-live ones (Dashboard, P&L, Balance Sheet, Cash Flow). New module tools
   (Reporting/Sales registers, the driver Forecasts) wire as those surfaces ship.
2. **Drill in both directions.** Because every drill arrow (summary → metric/statement → driver → source record) is a
   typed query, Scout can walk any chain up or down — e.g. a dashboard tile → its P&L line → its driver → the
   originating contract/invoice. The AR/AP sub-ledger now **foots to the statements**, so a Scout "show me the AR
   aging behind this number" answer ties out.
3. **Scenario tools (`setDriver`, `compareScenarios`) — group-scoped, built after the Scenario engine.** The Run
   builds the deterministic scenario engine (against the locked typed contract in `lib/types/scenario.ts`), then
   wires these two tools; they only touch the contained Scenarios group.
4. **In-app delivery only.** Both reactive Q&A and any proactive nudges render in the floating panel / in-app — no
   external channel.
5. **Module-awareness.** Scout receives the current surface as context so it can scope answers and suggest the right
   drill.

## 6. Known Scout-specific quirks / hardening items

- **`registry.ts` is loosely typed (a known nit to harden when tools land).** `ScoutToolBinding.query` is a plain
  `string` with no compile-time link to the real `lib/queries/` exports, and `scout-readiness.ts` keeps a parallel
  `TOOL_THUNKS` string map. Renaming a query wouldn't break compilation — it would silently drop a tool from the live
  set. Plan: type `query` against a `QueryName` union (or `keyof typeof import("@/lib/queries")`) that both the
  registry and the thunks reference, so a rename is a compile error. Do this as the first tools are wired.
- **GL drill floor:** the general ledger is **monthly-summary** (one JE per source per month), so Scout can drill the
  **sub-ledger** (individual invoices/bills/paychecks/timesheets/receipts, which reconcile to the monthly drivers) OR
  the GL, but **not GL → originating transaction**. If Scout must drill the GL itself to a single transaction, that
  needs per-transaction JE posting (a deferred refinement). Today the sub-ledger gives record-level drill.
- **The agent is not built yet** — no Anthropic tool-use loop, system prompt, or conversation handling exists. The
  spine + registry + readiness gate + panel chrome are the foundation; the agent loop is net-new Run work.

## 7. Key files to reference

- `lib/queries/registry.ts` — the query↔tool seam (the tool surface table above).
- `scripts/scout-readiness.ts` — the readiness gate (serializable / consistent / deterministic + registry honesty).
- `components/scout/scout-panel.tsx`, `scout-context.tsx` — the panel scaffold.
- `lib/queries/*` — the spine (statements, dashboard, metrics, revenue, sales, balance-drivers, account-mapping).
- `lib/datastore/*` — the DataStore seam (Swap Don't Rewrite).
- `lib/types/scenario.ts` — the locked typed scenario contract (what `setDriver`/`compareScenarios` build against).
- `CLAUDE.md` §4 (architecture + Scout-ready bar), §8 (per-module proposed Scout tools), §10 (Scout, in-app-only
  lock), §13 (build plan / Scout Follows Modules).
- `diagrams/scout-dock.svg` — the Scout panel mock.

## 8. One-paragraph summary (paste-ready)

> Scout is Dogfood's in-app finance agent: Anthropic tool-use over a typed query spine (`lib/queries/`), zero RAG for
> structured data, so it never does its own math — it repeats what its tying-out tools return. It's **in-app only**
> (bottom-of-rail launcher + floating lower-right panel) — the Slackbot idea is rejected, not deferred. The spine
> already satisfies the "Scout-ready bar" (typed, pure, serializable, deterministic; proven by a 20/20 readiness
> gate), and a registry (`lib/queries/registry.ts`) declares the per-module tool surface with everything `wired:
> false`. Nothing of the agent is built yet beyond a panel scaffold — per **Scout Follows Modules**, each tool gets
> wired against the registry as its grounding module ships, deriving the tool's result schema from the query's output
> type. First to wire: Dashboard, P&L, Balance Sheet, Cash Flow (already live). Scenario tools come after the
> Scenario engine. Known nit: type-safe the registry when the first tool lands.
