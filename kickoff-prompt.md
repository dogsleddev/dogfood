You are starting HARNESS — stage (B) of the Dogfood build (the three-stage relay: Trailhead → Harness → the Run, §13). Dogfood is an AI-native FP&A web app.

The repo root contains CLAUDE.md — that file is the source of truth for product,
architecture, naming, scope, and build order. Read it in full now, along with
everything in diagrams/, before doing anything else. Do NOT read archive/ — it is
superseded history that CLAUDE.md already replaces; opening it only wastes context.
If anything in this prompt
seems to conflict with CLAUDE.md, CLAUDE.md wins — flag the conflict and stop.

NON-NEGOTIABLES (from CLAUDE.md §4 — do not violate without asking):
- One Source, Two Callers: all financial data flows through typed functions in
  lib/queries/, consumed by BOTH the module UI and Scout. Never duplicate data logic.
- Tool-Use over RAG for structured data.
- Typed Contracts at Every Seam (query I/O, tool schemas, the DataStore).
- Swap Don't Rewrite: read through a DataStore interface (InMemoryDataStore now,
  Supabase later). The ONLY live integration is an ErpConnector stub — no other connectors.
- Scenarios are CONTAINED to the Scenarios group: no global scenario state, no top-bar
  switcher. Dashboard / P&L / statements are always Base + actuals.
- Scout Follows Modules: never build an agent tool ahead of the module that grounds it.
- Deterministic math in TypeScript; the LLM is only for language/texture, never for
  numbers that must tie out.

WHAT HARNESS OWNS (per §13): build the spine + the target Dashboard/P&L, prepare the seed,
fully DEFINE the scenario contract and the metrics design, leave the spine Scout-ready, and
draft ~80% of the guides. See Harness's full Definition of Done in §13 — the Run does not start
until that DoD is met.

THIS SESSION'S GOAL (Phase 1 is the North Star):
Stand up the example Dashboard + Forecasted P&L as real components on the query spine —
the target the seed will later reconcile up to. Reaching that requires Phase 0 first.

PHASE 0 — SCAFFOLD (do this first; not gated on anything):
- Next.js 15 (App Router, server components, TS), Tailwind + shadcn/ui.
- Brand tokens from §19: Midnight sidebar gradient, parchment content, ember/amber/sage,
  Fraunces (titles) + Geist (everything else).
- The left nav exactly per §7 and diagrams/nav-rail-v16.svg (respect the groups-vs-dropdowns
  rule: groups = co-equal surfaces, dropdowns = variants of one surface).
- Core domain types; the DataStore interface + InMemoryDataStore; the empty lib/queries/
  shape with typed function signatures per §8; the ErpConnector stub.
- No business numbers yet.

THE GATE — the company is LOCKED; only fine seed parameters remain:
The demo company is Bearing (§11) — a Series B AI-native FP&A SaaS with a services arm,
~75% subscription / 25% services. Architecture, types, the spine, the DataStore, and the
nav are fully UNBLOCKED. What is NOT yet pinned is the fine seed detail: the exact ARR ramp
+ headcount curve, the fiscal close state, and whether AP/DPO is in. Do NOT generate the
seed dataset or hardcode those specific target numbers until I confirm them (or I'll paste
them). Until then build company-agnostic structure; if you need values to render the example
Dashboard / P&L, put clearly-labeled placeholders in one file (e.g. lib/target/placeholder.ts)
so they're trivially swapped when the seed lands.

WORKING AGREEMENT:
- Before writing code, propose a concrete Phase 0 task breakdown + file/folder plan and
  wait for my go.
- Work in small, reviewable steps; explain decisions briefly; keep types tight; ask
  before any scope creep or new dependency.
- Do NOT build anything marked [OPEN] or [ROADMAP] in CLAUDE.md (AP/DPO, Scout-as-Slackbot,
  the ERP ecosystem diagram, commissions, ASC 340-40, etc.) unless I ask. (The Metrics layer is
  design-decided, not do-not-build — its design is part of Harness; the surface is built in the Run.)

DEFINITION OF DONE (this first session — Harness's full DoD is in §13):
Repo scaffolded per Phase 0; nav renders on-brand; DataStore + InMemoryDataStore + typed
lib/queries signatures in place; ErpConnector stub; the fine seed parameters (ramp / headcount
curve, close state, AP in/out) surfaced to me; and a short written plan for Phase 1 (the
example Dashboard + P&L) ready to run once I confirm those parameters.

FIRST ACTION:
Confirm you've read CLAUDE.md and diagrams/, summarize the build order back to me in
3–5 lines, then propose the Phase 0 task breakdown. Do not write code until I approve it.
