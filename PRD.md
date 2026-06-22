# PRD — Dogfood

> **What this is.** The product framing for **Dogfood**, an AI-native FP&A platform. It states the problem, the user, what the product is, and what it must do. For the engineering source of truth — architecture, naming, module specs, build order — see **`CLAUDE.md`**; where the two overlap, CLAUDE.md is authoritative on *how*, this doc on *why and what*. Section references like “§8” point into CLAUDE.md.

---

## 1. The problem

Strategic finance teams (CFOs, founders, FP&A) live in spreadsheets and backward-looking reports. The forecast is stale the day it's built, scenarios take a week to model, the three statements don't reconcile to each other, and the “AI” bolted onto incumbent tools is a chatbot doing retrieval over PDFs — it makes up numbers and never matches what's on screen. The result: finance reacts instead of steering.

## 2. Who it's for

Forward-looking finance at venture-backed companies: the **CFO / VP Finance / FP&A lead** who owns the plan, and the **founder** who reads it. Secondary: the board and investors who consume the output. Not the controller closing the books (that's record-to-report; see §2 positioning) — Dogfood plans *off* a clean close, it doesn't perform one.

## 3. What Dogfood is

An **AI-native FP&A platform for strategic finance**: a living forecast, scenarios in minutes, three statements that tie out, and **Scout** — an agent that works the *same* numbers the UI does, never a separate retrieval layer.

- **Positioning:** “Strategic finance, made AI-native.” Tagline: **“Know your next move.”** We say **native**, not “AI-powered.” (§2)
- **The bet (why the AI is trustworthy):** one **typed query spine** (`lib/queries/`) is the only thing that reads financial data, and it has **two callers** — the module UI and Scout's tools. The agent therefore never sees stale data and can't invent a number the UI wouldn't show. **Tool-use over RAG** for all structured data. (§4)
- **The demo is the proof:** Dogfood runs on a fictional company (**Bearing**, §7 below) whose books actually tie out — the credibility argument is a working product, not a deck.

## 4. Product principles

These are the bets the product is built on (full text in §4 of CLAUDE.md): **Register vs. Process · One Source, Two Callers · Tool-Use over RAG · Typed Contracts at Every Seam · Swap Don't Rewrite · Scout Follows Modules.** They exist to keep the agent honest and the model free of duplicated logic.

## 5. Scope — the product in five layers

Think in layers, not nav groups (§5). v1 covers all five:

1. **Source records** — Pipeline, Contracts (incl. the Bookings view), Customers, Renewals · Projects, Staff, Expense Transactions · GL/JEs underneath.
2. **Drivers (the forecast)** — Revenue Forecast, **Cost of Revenue**, Personnel, Expense Forecast · AR / Fixed Asset / Prepaids.
3. **Statements** — Forecasted P&L, Balance Sheet, Cash Flow Forecast.
4. **Metrics** — four families (below), surfaced *through* the Dashboard, not as a nav item.
5. **Summaries** — Dashboard, Board Package.

Wrapped by **Scenarios** (a contained lens over layers 2–5), **Scout** (across all layers), and **Setup** (ERP/Data Import, Account Mapping, Settings). The canonical nav is §7 / `diagrams/nav-rail-expanded.svg`.

## 6. What it must do (key requirements)

**R1 · Statements that tie out.** The three statements reconcile by construction. The Forecasted P&L shows **Budget · Actual · Variance · Forecast** columns. The locked P&L line layout is in §8 (Revenue → Cost of Revenue → Gross Profit → OpEx → Operating Income → Net Income, with margins). There is **no variance module** — variance is columns on every statement plus Scout's narrative.

**R2 · A forecast built from drivers, not typed cells.**
- **Revenue Forecast** — subscription = **contracted (read from Contracts) + a new-business / retention assumption**; services = capacity-driven.
- **Cost of Revenue** — an **assembled, coupled driver** (not a typed input): Direct payroll (from Personnel's Direct departments) **+ a cost-to-serve rate × revenue per stream**. The rate is swappable behind a stable line (% of revenue today → per-customer / per-usage later) with no change to the P&L or the margin tile. (§8)
- **Personnel** — payroll **by department + function tag** (Direct / R&D / S&M / G&A). The main P&L shows one **Indirect Payroll** line; the full functional cut lives in two off-statement views (Total Payroll; Departmental P&L). (§8)
- **Expense Forecast** — non-payroll **OpEx only**, by config-driven group (Employee Expenses burden, S&M programs, T&E, IT, HR, Admin, Facilities, Insurance). Groups, membership, labels, and order are owned by Account Mapping + Settings; each carries a typed CoR/OpEx classification + function sub-role. (§7/§8)

**R3 · Budget as a locked baseline.** Budget is a **frozen snapshot of the layer-2 drivers** taken at plan time — immutable, the yardstick for variance. Base keeps moving as actuals close; you set the Budget by **locking** a working plan or an approved scenario. (§8)

**R4 · Scenarios, contained and dynamic.** Users create / duplicate / reset their own scenarios from a closed, typed adjustment DSL (`lever + magnitude + monthly window + Step|Ramp shape`). Scenarios are **contained to the Scenarios group** — no global switcher; the rest of the app stays Base + actuals. Each scenario compares against **Base or Budget**. A deterministic engine re-derives only the Scenario P&L + Dashboard. (§9)

**R5 · Metrics that fall out of the model.** Four families surfaced as Dashboard tiles: **Financial / profitability** (Revenue, gross profit, gross margin %, operating income, net income, net margin %), **Growth & Retention** (ARR/MRR, NRR, logo retention, growth), **Unit Economics** (CAC/payback, LTV:CAC, magic number, utilization), **Cash & Efficiency** (Rule of 40, burn multiple, net burn, runway). The functional metrics read the Departmental P&L so CAC etc. are real, not near-zero. (§5/§6)

**R6 · Peek where you read, navigate where you work.** On the Dashboard + statements, the first tap opens a right-side **pane** (the lineage in place) with “Open full ↗” to the working surface. Actuals peek their register; forecasts peek their driver; pure metrics are pane-only. (§6)

**R7 · Scout — an agent over the spine.** Tool-use over `lib/queries/`, zero RAG for structured data, module-aware, walks any drill chain either direction. Launches from the bottom of the nav, opens as a floating panel (lower-right). Capabilities grow only as modules ship. (§10)

**R8 · One live connection.** A single `ErpConnector` is the only live integration; everything else is CSV/XLSX import templates or seed. Supabase sits behind a `DataStore` interface (InMemory now, Supabase later). (§3/§4)

## 7. The demo company — Bearing

**Bearing** is a Series B B2B SaaS company with a professional-services arm: ~75% subscription / 25% services, roughly $8M → $14M → $22M over three years, ~60 → 140 heads, calendar fiscal year. The meta-twist that makes the demo land: Bearing itself sells AI-native FP&A, so the product is shown running a believable mirror of its own buyer. The name is deliberately *not* a dog pun — a literal name would break the “this could be my company” spell that the demo depends on. (§11)

## 8. Out of scope (v1)

No cap table (Carta's job); no AP/AR subledger *operations* or the close *itself* (the ERP / a tool like Numeric — Dogfood reads actuals); no standalone variance module; no live connector other than the ERP; commission capitalization (ASC 340-40) and capitalized software are deferred. (§16)

## 9. What “done” looks like

The demo's success bar: a visitor can open the Dashboard, drill any tile down to a source record and back, watch the three statements reconcile, build a scenario in minutes and compare it to Budget, and ask Scout a question whose answer matches the screen exactly. That end-to-end loop — on books that tie out — is the product and the pitch.

## 10. How it gets built

A three-stage relay (§13): **Trailhead** (design — done; the company gate is closed) → **Harness** (build the spine + the example Dashboard/P&L, prepare the seed, fully define the scenario contract + metrics, draft ~80% of the guides) → **the Run** (build the remaining module surfaces + Scout, finish the guides). Start with `kickoff-prompt.md`. The full Definition of Done for each stage is in §13 of CLAUDE.md.
