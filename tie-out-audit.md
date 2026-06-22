# Tie-out audit — Bearing seed (Harness step B)

> Date: 2026-06-17. Scope: every file that produces a number — `lib/seed/*`, `lib/target/model.ts`,
> `lib/queries/*`, `app/dev/seed/page.tsx`. Method: executed the generator for ground-truth numbers
> (`scripts/audit-dump.ts`), then a 16-agent adversarial sweep (classify → refute → reconcile → critique).
> This file is the Task-1 deliverable referenced by `Handoff.md`.

> **Update — steps 5 & 6 (2026-06-17):** both of the issues called out below are now **RESOLVED**. Step 5
> built the billings roll-forward (the one internal break) and the balance sheet + cash flow (A = L + E to
> 0.0000). Step 6 made the **seed the single live source** (the live queries read it; `lib/target/model.ts`
> is retired), so the model-vs-seed "central conflict" no longer exists, and recalibrated services (attach↑ +
> %-complete-in-arrears billing) to hit its targets (+7 / +11 / −2%) with realistic WIP. The seed grew to
> **26 classified checks**, all green. The sections below are preserved as the original audit record.

## Verdict

The seed is structurally sound and ties out by construction where it claims to. But the prior
"17 checks PASS" badge **overstated** the verification: ~7 of the on-screen checks were definitional
`x === x` identities or one-sided bounds that **cannot fail**, so a wall of green ✓ read as a wall of
reconciliations when several proved nothing. This pass makes every check **honestly labeled** (a typed
`kind` on `TieOutCheck`), **strengthens** the cheap ones that had teeth, and **surfaces** the real gaps
that no check gates. After the pass: **19 checks, all green, each classified**; 7 genuinely independent,
2 calibration, 5 definitional, 5 sanity.

There is exactly **one real internal tie-out break** (the closed-form deferred roll-forward, already
flagged for step 5) and **one central cross-surface conflict** (the model-vs-seed FY26 operating-margin
gap). Neither is a defect in the seed's internal consistency; both are documented below and tracked on
the dev QA page's new **Reconciliation watch** panel.

## What this pass changed

**Honest labeling (the core ask).** Added `CheckKind = "independent" | "calibration" | "definitional" | "sanity"`
to `TieOutCheck` (required field — the compiler now forces every check to declare what it proves). The dev
page renders the badge with a legend; "only independent and calibration can actually fail."

**Relabeled the tautologies** (kept green, now honest — `x === x` restatements of their own definition):
- `subscription` — "recognition uses the ratable divisor (ARR ÷ 12)" → **definitional** (was "Revenue recognized ratably (= MRR)", which overclaimed an independent recognition tie).
- `personnel` — "Direct + Indirect === Total payroll" → **definitional** (`indirect := total − direct`).
- `cost-of-revenue` — "Total CoR === Direct Payroll + Non-employee" → **definitional** (`totalCoR := direct + non-employee`).
- `opex` — "Total === Σ groups" and "Employee Expenses === rate × payroll" → **definitional**.
- `personnel` — "Services capacity === PS heads × rate" → relabeled **sanity** ("is positive at horizon"); the equality was structurally untestable (capacity *is* `psHeads × rate`).

**Added / strengthened independent checks (have teeth, currently green):**
- `subscription` — **new independent check**: Σ active `Customer.arr` (the shipped records) === exit ARR — a *third* data path distinct from both the bookings ledger and the active-base sum.
- `services` — **rewired** the value-accounting check from the per-project tautology (`field + remaining ≡ value`) to an independent triple: `Σ recognized[] (months series) === Σ recognizedToDate (project field) === value − backlog`. Catches a months-vs-field desync (e.g. the completion residual added to one accumulator but not the other).
- `cost-of-revenue` — **new calibration check**: gross margin widens each year (62.9 → 67.3 → 69.4%), falsifiable against a CoR-inflation regression even while FY26 stays in band.
- `cost-of-revenue` / `opex` — added `n > 0` guards so a zeroed series can't pass vacuously (`[].every()` is `true`).

**Doc fixes:** "21-tile catalog" → "19-tile" (`model.ts`, `queries/metrics.ts`, `placeholder.ts`; the catalog
has 6+5+4+4 = 19); DEPT_PLAN comment "≈ 57 → 147 heads" → "44 → 134" (matches the code's `134 === 134`
assertion); dev page header "steps 1–2" → "steps 1–4".

**Surfaced (not gated):** a **Reconciliation watch** panel on `app/dev/seed/page.tsx` listing the four open
gaps with live-computed magnitudes, and colored the combined-revenue tile by its *worst* stream so a +2%
subscription beat no longer masks a −24% services miss.

## Check inventory (after the pass)

| Module | Check | kind | What proves it / why it's labeled so |
|---|---|---|---|
| subscription | ARR ties to cumulative bookings | **independent** | flow ledger (Σ net bookings) vs active-base stock (Σ c.arr) — different accumulators; dropping a churn/expansion flips it |
| subscription | Active-customer records reconcile to exit ARR | **independent** | Σ active `Customer.arr` (shipped records) — a third path |
| subscription | Recognition uses the ratable divisor | definitional | `Σ(c.arr/12)` vs `(Σc.arr)/12` in one loop — pins the divisor only |
| subscription | Deferred non-negative | sanity | one-sided bound; closed-form, does not roll forward (see leaks) |
| services | Recognition reconciles (series === field === value−backlog) | **independent** | months series vs per-project field vs conservation |
| services | Completed projects fully recognized | **independent** | per-project equality on the 77 completed; under-recognizing $5 trips it |
| services | WIP never negative / Utilization ≤ 100% | sanity | one-sided bounds (the 100% pin is the capacity story, not asserted) |
| personnel | Payroll loop ties to the staff list | **independent** | closed-form Σ(baseComp/12 × months) vs month-by-month loop (structural-drift guard; shares hireIndex, so not a per-person tie) |
| personnel | Direct + Indirect === Total | definitional | `indirect := total − direct` |
| personnel | Direct payroll === PS+Support (function) | **independent** | DIRECT_DEPTS list vs the function-tag partition (config-consistency) |
| personnel | Every department reaches its plan | **independent** | `endHeadcount === planEnd` is falsifiable (dropping a dept → 129 ≠ 134) |
| personnel | Services capacity positive | sanity | positivity bound |
| cost-of-revenue | Total CoR === Direct + Non-employee | definitional | `totalCoR :=` that sum (n>0 guarded) |
| cost-of-revenue | FY26 GM in 69–75% band | **calibration** | generated GM vs the §8 band (thin — 0.4 pts of slack) |
| cost-of-revenue | GM widens each year | **calibration** | falsifiable margin trajectory |
| opex | Total === Σ groups / Employee Exp === rate×payroll | definitional | both `x===x` (n>0 guarded) |
| opex | Every group ≥ 0 | sanity | one-sided bound |

## Full-chain reconciliation (every total → its independent tie-out)

All figures reproduce from `scripts/audit-dump.ts`. Legend: **[INDEP]** genuinely different derivation ·
**[DEF]** definitional invariant · **[CALIB]** vs hand-set target · **[PLACEHOLDER]** first-pass constant.

**Layer 1→2 · subscription.** Exit ARR **18,967,000** — **[INDEP]**, reconciles three ways: active-base
stock = bookings flow ledger = Σ shipped `Customer.arr`, all delta 0. FY recognized 5,477,500 / 10,036,833
/ 16,878,333 (−8.7% / −4.4% / +2.3% vs targets). Deferred 2,494,750 → 10,013,750 reproduces but is
**closed-form, not a billings roll-forward** (the one real leak — below).

**Layer 1→2 · services.** Contract value **9,750,000** = recognized 9,244,954 + backlog 505,046, and the
months-recognition series independently equals the per-project field (9,244,954) — **[INDEP]** after the
rewire. FY recognized 1,781,915 / 3,278,000 / 4,185,038; **FY26 is −23.9% vs the 5.5M target** (capacity
gated — a leak, below).

**Layer 2 · personnel.** FY payroll 6,645,083 / 10,242,250 / 15,117,667 (direct 1.43M / 2.02M / 2.87M).
End headcount **134** (= plan). Payroll loop ties to the closed-form record recompute — **[INDEP]** (structural
drift). Direct/indirect split is **[DEF]**. No payroll calibration target exists (noted as a gap).

**Layer 2 · Cost of Revenue (assembled).** FY26 rev 21,063,372 · CoR 6,449,510 · GP 14,613,862 · **GM 69.38%**.
`CoR.totalRevenue` per FY === `sub + svc` recognized exactly (delta 0). Assembly identity is **[DEF]**; the GM
band and the widen-each-year trajectory are **[CALIB]**.

**Layer 2 · OpEx (non-payroll).** FY 3,201,396 / 5,141,756 / 7,726,016 (−5.8% / −1.1% / −0.3% vs targets) —
re-derives to the dollar from `OPEX_DRIVERS × driver-total`. Group footing is **[DEF]**.

**Layer 3 · implied operating P&L (seed, pre-D&A).** FY26 OI **−5,358,320 (−25.4%)** = GP − indirect payroll
− non-payroll OpEx — **[INDEP]**, the one genuine cross-driver assembly (three separate generators). This is
the seed's "truth," and what the live P&L will read at step 6.

**Layer 3 · `lib/target` model P&L (the other "truth").** FY26 revenue 22,000,000 · GP 15,840,000 (GM 72.0%)
· OI **−1,910,000 (−8.68%)**. Subtotals foot from leaves, but the model emits **zero** checks — its footing
is unasserted. Its leaf inputs duplicate the params targets (revenue 16.5M+5.5M; OpEx Σ 7.75M) with nothing
enforcing equality.

**Layer 4 · 19 dashboard metrics.** The **Financial family (6)** is derived from the same `computeLines()`
the P&L uses — **[INDEP]** vs the leaves, **[DEF]** vs the P&L ("one source, two callers"). `growth_rate` /
`rule_of_40` are derived but anchored to a hardcoded `FY25_REVENUE = 14M` (seed FY25 is 13.31M). The **other
11** (arr_mrr, bookings, nrr, logo_retention, cac_payback, ltv_cac, magic_number, utilization, net_burn,
runway, burn_multiple) are **[PLACEHOLDER]** constants — several already contradict the seed (arr_mrr 16.8M
vs exit ARR 18.97M; utilization 0.78 vs peak 1.00). PY / sparkline trail are synthesized from arbitrary
`PY_RULES` factors — the YoY arrows are illustrative, not a real prior year. All honestly labeled in the
model header; they tie out only once their basis formulas are implemented against the seed (the Run).

## The model-vs-seed decision

**Single source of truth = the SEED.** Per CLAUDE.md §12/§13 the model is an explicit first-pass target the
example surfaces render against "until the seed lands"; the seed "becomes the source of truth at step 6."
The model's −8.68% is a hand-set optimistic story; the seed's −25.4% is the calibrated reality. Keep the
model only as the basis for the locked **Budget** snapshot once intentionally promoted, never as the working
forecast.

**FY26 operating-margin gap, normalized:** the seed implied OI is *pre-D&A*; the model OI is *post-D&A*.
Subtracting the model's ~$0.5M D&A leaf gives a comparable seed OI ≈ **−5,858,000 / −27.8%**, so the true gap
is **~19 pts** (wider than the headline 17). The gap lives in cost: the seed runs ~$2.6M more payroll +
non-payroll OpEx in FY26 than the model, and is ~$0.94M light on revenue (services −24%).

**Step-6 reconciliation plan:**
1. Add the missing layer-3 leaves to the seed (D&A, interest/other, taxes) so the seed P&L is comparable.
2. Repoint `lib/queries/{dashboard,statements}.ts` (and the metric path) from `lib/target/model.ts` to the
   seed series — the "swap, don't rewrite" seam is the query layer; signatures don't change.
3. Retune params toward the §11 arc (raise services capacity to recover the −24%; add a payroll band and trim
   the headcount/comp curve) so the seed converges up to the agreed shape.
4. Unify the model leaves and params targets into one constants source so they cannot silently desync.
5. Once the seed is the single source, the within-model "Dashboard revenue === P&L revenue" becomes a *genuine*
   two-caller regression guard — add it then.

## The four leaks / remaining gaps (tracked, out of scope for this pass)

1. **Deferred roll-forward — RESOLVED in step 5 (2026-06-17).** Was: deferred was closed-form (`rate ×
   months-remaining` off *current* ARR), not `Σbillings − Σrecognized`; implied billings went negative in one
   month. Now: `subscription.ts` emits a real billings series (annual upfront at each anniversary + prorated
   mid-term increments + pro-rata refund on churn) and `deferred[t] = openingDeferred + Σbillings − Σrecognized`,
   verified by the independent "Deferred ties to the billings roll-forward" check. The balance sheet's
   `change_deferred_revenue` now ties to cash, and the master "Assets === Liabilities + Equity" check holds to
   0.0000 every month. Recognized / ARR / bookings were unchanged.
2. **Services capacity / FY26 services — RESOLVED in step 6 + the post-audit retune (2026-06-18).** The
   capacity-gating *mechanism* was always correct; the *magnitude* was a miscalibration (PS delivery capacity
   structurally too small → services dragged + projects stranded). Step 6 recovered the per-year targets via
   attach↑ + %-complete billing; the 2026-06-18 watch-out audit then retuned `DELIVERY_PER_HEAD_PER_MONTH`
   26k→28k (total capacity now broadly covers demand) and fixed a completion-threshold bug (absolute $0.5 cutoff
   never reached under proportional throttling, stranding ~31 finished projects as "in_progress"; now a
   value-relative 0.1% bound). Result: 77 complete / 8 in-progress (all started ≤3mo before the horizon), no
   stranding, utilization eased off the 100% pin in the forecast tail, FY26 total $22.15M on the §11 arc, GM
   still in band, all 29 checks green. (Utilization now measures capacity-throttled DELIVERY; the sub-0.1%
   completion-closure residual is recognized as revenue but excluded from utilization so it cannot read >100%.)
3. **Model-vs-seed ~19-pt operating-margin gap** — the central conflict above; resolves at step 6.
4. **Thin FY26 GM band** — 69.38% sits 0.38 pts above the 69% floor; a small hosting/pass-through nudge flips
   the `gmInBand` check red. Sensitivity is a feature, but the band is FY26-only (FY24/25 are below the mature
   floor by design). The new "GM widens each year" check covers the trajectory.

**Also deferred (not gaps in the audited code):** AP/DPO driver (§17, needed for cash-flow tie-out); the 11
placeholder dashboard metrics (the Run); PY/variance synthesis (real only once prior-year comes from a prior-year
P&L); project-level `marginPct` (deliberately unreconciled to assembled services CoR — surface in guide prose);
latent cent-rounding in `metricValueFromMagnitude` (cosmetic).

**Not gated at CI:** the checks live on a dev-only page (not in nav); nothing runs them on `npm run build`. If
they should be a real gate, add a test that asserts every module's `checks.every(c => c.ok)` — flagged for the Run.
