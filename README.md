# Dogfood — Project Kit

**Dogfood**, an AI-native FP&A platform, built on the fictional demo company **Bearing**. **Build state (2026-06-21):** Harness + most of the Run are done and tying out — the typed query spine, the Dashboard + 19 metric tiles, all three statements, all seven layer-1 registers, the forecast drivers, Board Package, the Scenarios engine + 4 surfaces, **Scout (34 wired tools)**, a **live Supabase backend** (`DATASTORE=supabase`), and the first write path (**Flux Analysis** notes). **`Handoff.md` is authoritative for where the build stands; `CLAUDE.md` for the spec — read both at the start of every session.** (The "Start here / SOP" below is the original project-kit plan, kept for the build-order map; most phases are now complete — see `Handoff.md`.)

> The diagrams in `diagrams/` are the latest from the design sessions and are being **refreshed in the next pass** (P&L-drivers reorder on the rail, a new `cost-and-pl.svg`, a browsable `architecture.html`). They're accurate enough to build against now; `CLAUDE.md` is the authority wherever a diagram lags.

---

## Start here (3 steps)

1. **Read `CLAUDE.md` top to bottom.** It's the source of truth — every locked decision, the open threads, the build order. It supersedes everything in `archive/`.
2. **Skim `PRD.md`** for the product framing (problem, users, requirements, the demo company, what “done” looks like).
3. **Read `Handoff.md`** for the current build state and the next steps, and continue from there. (Historical: `kickoff-prompt.md` started the original Harness stage from an empty repo; the build is now well past Phase 0.)

---

## SOP — the build path

The work runs as a three-stage relay (full Definition of Done per stage in `CLAUDE.md` §13). **Trailhead** (design) and **Harness** (spine + targets + seed) are done; **the Run** is well underway (phases 4–7 below largely complete). The original phase plan follows as a map — `Handoff.md` tracks actual progress + the next steps.

**0 · Confirm the fine seed parameters.** The only thing still open: the exact ARR ramp + headcount curve, the fiscal close state, and whether AP/DPO is in (`CLAUDE.md` §11/§17). Have these ready to paste when the build reaches the Phase 0 → Phase 1 boundary. Nothing else is gated.

**1 · Phase 0 — scaffold (unblocked now).** Next.js 15 + TS + Tailwind + shadcn; brand tokens (§19); the left nav per §7; core domain types; the `DataStore` interface + `InMemoryDataStore`; the empty `lib/queries/` shape with typed signatures (§8); the `ErpConnector` stub. No business numbers yet.

**2 · Phase 1 — the target.** Stand up the example **Dashboard + Forecasted P&L** as real components on the spine — the target the seed reconciles up to. Wire the Peek-vs-Place pane (§6).

**3 · Seed Bearing.** Generate the dataset drivers → balanced JEs → GL → statements, so it ties out by construction (§12). Deterministic TS; Claude only for texture (names, descriptions).

**4 · Reporting + Sales.** Projects, Staff, Expense Transactions; Pipeline, Contracts (with the Bookings view), Customers, Renewals.

**5 · Forecast drivers + Budget.** Revenue Forecast, Cost of Revenue (the coupled driver), Personnel (by dept/function), Expense Forecast; the Budget snapshot + the variance columns.

**6 · Scenarios.** The deterministic engine + the four surfaces + the seed presets (§9).

**7 · Scout, per module.** Tool-use over the spine, wired as each module ships — never ahead of it (§10).

**8 · Guides + Board Package.** Finish the six user guides (§14).

Cadence note: if you're following the tutorial pattern, a module can ship as a standalone Dogsled tutorial first, then graduate its component code into the shared spine.

---

## What's in the kit

**Root — the start-the-project docs**
- `CLAUDE.md` — the source of truth (spec, decisions, build order). Read first.
- `PRD.md` — product framing (problem, users, requirements, demo company, success).
- `README.md` — this file (start here + the SOP).
- `kickoff-prompt.md` — the Harness kickoff prompt for Claude Code.

**`diagrams/` — architecture & IA reference** _(refreshed in the next pass)_
- `nav-rail-expanded.svg` — the canonical nav, every dropdown open (P&L drivers incl. Cost of Revenue; the 8 OpEx groups; the six guides). Company chip = Bearing; Ask Scout launcher at the bottom.
- `nav-rail-v16.svg` — the resting nav (build the collapsed state from this).
- `drilldowns-statements.svg` — P&L / Balance Sheet / Cash Flow drill targets, peek-flagged.
- `drilldowns-dashboard.svg` — Dashboard tiles by metric family (Financial · Growth & Retention · Unit Economics · Cash & Efficiency); peek vs pane-only.
- `scenarios-budget.svg` — the Scenarios & Budget model: plan versions, the deterministic engine, adjustment anatomy, lever set, composition/validation, four surfaces.
- `revenue-drilldown.svg` — the revenue drill spec (606 schedule + services % complete).
- `drilldown-rollup-map.svg` — the five-layer cascade with the Scenario lens + Scout.
- `lineage.svg` — the “how every number connects” teaching diagram.
- `scout-dock.svg` — the Scout panel.
- `scenario-drivers.svg` — the Scenario Drivers board.
- _Coming in the refresh:_ `cost-and-pl.svg` (the two-axis cost model + P&L skeleton — specified in `CLAUDE.md` §8 today) and a browsable `architecture.html`.

**`brand/` — marketing (not part of the build)**
- `infographic-vector.svg` — the “trail to the summit” poster as an editable vector (exact brand palette + type).
- `infographic-prompt.md` — the image-gen prompt that renders the painterly poster, plus format-swap notes.

**`archive/` — superseded, kept for history**
Old nav iterations (v1–v15), earlier scenario-workflow / shell-lineage / before-after drafts, and the stale PRDs (v1–v3). These predate Bearing, the five-layer model, the cost/budget model, contained scenarios, the Sales merge, and Account Mapping. `CLAUDE.md` wins wherever they disagree. **The build ignores this folder** — `CLAUDE.md` and `kickoff-prompt.md` both tell Claude Code not to read it, so it won't eat context. It's here for your reference only; delete it if you'd rather it not ship.

---

## Session handoff

**`Handoff.md`** documents the current build state and the next steps; it's updated at the end of each session. **At session start, read `Handoff.md` and `CLAUDE.md` first** — `CLAUDE.md` is authoritative on the spec, `Handoff.md` on where the build stands. (The seed-parameter gate that originally lived here is closed — §11 is locked and the seed ties out.)
