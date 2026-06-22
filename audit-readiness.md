# Audit-readiness plan — Bearing seed (Big 4 financial-statement grade)

> **Goal.** Make the Bearing dataset survive a Big 4 financial-statement audit: complete US-GAAP
> account coverage, a real rollforward behind every balance, and a transaction population that passes
> analytical procedures + data-analytics (Benford / ratio / trend) testing. The bar — an examiner finds
> **no open questions**. Method unchanged (CLAUDE.md §12): deterministic drivers → balanced JEs → GL →
> statements, so every addition **ties out by construction**. This expands the locked scope (§11/§16) — see §6.

## 0. The lens — what a financial-statement audit actually tests

A FS audit tests **fair presentation under GAAP**, not investor attractiveness. Three test types we must pass:

1. **Completeness** — every account a real VC-backed SaaS carries actually exists (no missing SBC, leases, tax, contra/estimate accounts).
2. **Substantive / vouching** — each balance ties to a subledger and a rollforward (opening + activity = closing), traceable to source.
3. **Analytical procedures + data analytics** — ratios/trends are reasonable and *vary like real life*; transaction digits conform to Benford; nothing is flat/round/constant.

Consequence: non-GAAP investor metrics (burn multiple, Rule of 40) are **not** audited — the earlier cash-vs-accrual "dissonance" is not an audit finding. The findings are **missing accounts** and **synthetic-looking data**.

## 1. Status today

**Present & correct:** ASC 606 core (ratable subscription, %-complete services, deferred = contract liability, unbilled WIP = contract asset), ASC 360 (PP&E + depreciation), ASC 230 (indirect cash flow), AR/DSO, AP/DPO, payroll, prepaids, the Series-B financing event. Ties out 35/35; A = L + E to $0.01 every month.

**Gap:** a *clean but thin* set of books. It lacks the equity-comp, lease, tax, commission, capitalized-software, and estimate/contra accounts every audited SaaS carries, and several expense lines are byte-flat across 36 months.

## 2. ASC coverage map — what's missing (answer to "what else?")

| Standard | Area | Status | Build | Slots into |
|---|---|---|---|---|
| **ASC 718** | Stock-based comp | **MISSING · HIGH** | Option grants per hire + graded vesting; SBC expense by function; APIC credit; forfeitures. **Non-cash → OCF add-back** (legitimizes the accrual-vs-cash gap). | new driver `sbc.ts` |
| **ASC 842** | Leases | **MISSING · HIGH** | Office lease(s): ROU asset + lease liability, straight-line operating-lease cost, liability amortization (interest/principal), short-term exemption. Recharacterize Facilities opex. | new driver `leases.ts`, new BS lines |
| **ASC 340-40** | Costs to obtain a contract (commissions) | **MISSING · was deferred · HIGH** | Capitalize commissions on new/expansion bookings; amortize over expected customer life; commission asset + amortization. | couples Bookings + S&M |
| **ASC 350-40** | Internal-use (capitalized) software | **MISSING · was deferred · HIGH** | Capitalize application-development-stage R&D; intangible + amortization; reduces opex, adds an asset. | couples Engineering payroll |
| **ASC 740** | Income taxes | **MISSING · HIGH** | Deferred tax assets (NOLs + temp diffs) with a **full valuation allowance**; current state minimum/franchise tax provision; rate-rec footnote. Net tax ≈ 0 but the DTA/VA exist. | new driver `tax.ts` |
| **ASC 326** | Credit losses (CECL) | **MISSING · MED** | Allowance for credit losses on AR (rolled), bad-debt expense, write-offs. | contra-AR |
| **ASC 710-10** | Compensated absences (PTO) | **MISSING · MED** | Accrued vacation liability: earned vs used; builds H1, drawn down summer + December (→ seasonality §4). | accrued-liability line |
| — | Accrued liabilities | **MISSING · MED** | Accrued payroll, accrued bonus (Dec bonus accrues before it pays), accrued expenses. Real BS line. | balance-sheet |
| **ASC 480** | Temporary equity / preferred | **REFINE · MED** | Cap-table rollforward (§4) carries Seed/A/B preferred; redeemable preferred → **temporary (mezzanine) equity**, not permanent. | equity rollforward |
| **ASC 606** | SSP allocation | **REFINE · MED** | Bundled SaaS + implementation: allocate transaction price to performance obligations by standalone selling price → defensible sub/services split at contract level. | sub/services coupling |
| **ASC 470** | Debt (venture debt) | OPTIONAL | A venture-debt facility → interest expense (fills "Interest / Other" beyond interest income) + warrants. | optional driver |
| **ASC 450** | Contingencies | LOW | Modest accrued legal/other reserve + disclosure. | accrued liabilities |
| **ASC 220** | Comprehensive income (OCI) | CONDITIONAL | Only if foreign ops / FX CTA (CLAUDE.md mentions FX import templates). Skip unless multi-currency is in the story. | n/a default |

## 3. Defeating analytical procedures — "so the auditor doesn't notice" (answer to #1)

The tells that scream *synthetic*, each with its fix:

- **Flat/round per-unit rates held 36 months** (T&E $400, IT $333, insurance exactly 1.0%) → per-period variation + ~3%/yr drift + seasonality (§4). No ratio perfectly constant.
- **Missing contra/estimate accounts** → every asset carries its valuation account (AR → allowance, deferred tax → VA, intangibles/fixed → accumulated amortization).
- **No rollforwards** → every balance gets opening + activity = closing, with subledger = GL = statement (deferred-rev roll exists today; add the same for SBC/APIC, lease liability, commission asset, cap-software, PTO, equity).
- **Benford's Law** → Big 4 data-analytics (IDEA/ACL) run leading-digit tests on the JE population; formula-round numbers fail. Generate invoice/JE amounts with realistic distributions and **verify Benford conformance as a check**.
- **Round-number clustering / uniform dates** → cluster activity at realistic dates (month-end billing, payroll dates, renewal anniversaries); vary amounts off round numbers.
- **Cutoff** → clean period boundaries at the close date.

## 4. Seasonality map (answer to #3)

Apply a monthly seasonal signature to every series that has one in real life:

- **PTO / vacation usage** → spikes Jul–Aug + late December; lowers billable **services utilization** those months; builds the **PTO liability** H1, draws it down H2.
- **Bookings / new logos** → Q4 enterprise push, slow Q1, summer lull → flows to ARR, deferred, commissions.
- **S&M programs + T&E** → event/conference spikes (Q1 kickoff, Q2/Q3 conferences), holiday dip.
- **Hiring** → Q1 ramp (post-budget), Q4/holiday slowdown → headcount, payroll, recruiting, capex-per-head.
- **Commissions** → track bookings seasonality (Q4-heavy).
- **Collections / cash** → cluster around annual renewal anniversaries.
- **Year-end** → December bonus (present); audit/tax fees spike Q1 (prior-year); insurance annual renewal in its month.

Principle: a real monthly series = **trend + seasonality + noise**. Pure trend, or flat, is the tell.

## 5. Build sequence (each phase ties out by construction + gets a check)

- **Phase A — SBC (718).** Biggest materiality; non-cash; reconciles the cash-vs-accrual story.
- **Phase B — Leases (842) + capitalized software (350-40) + commissions (340-40).** The three capital/deferral accounts; each = driver + BS line + amortization.
- **Phase C — Taxes (740) + CECL allowance (326) + PTO (710) + accrued liabilities.** The estimate/contra accounts.
- **Phase D — Equity / cap-table rollforward (480 / temp equity)** replacing the opening plug; optional venture debt (470).
- **Phase E — Seasonality pass** across all series (§4) + de-synthesize the opex rates.
- **Phase F — the audit-readiness gate.** Extend the tie-out harness with (1) **completeness** asserts (each account exists & non-trivial), (2) **rollforward** ties for every new account, (3) **analytical** asserts (no flat line, ratios in band, Benford conformance). The 35 tie-outs prove *articulation*; this proves *no hole + no synthetic tell*.

## 6. Scope change (must update CLAUDE.md)

This pulls **commissions (340-40)** and **capitalized software (350-40)** into scope — both currently listed OUT in §11/§16. Update §11 (accounting scope) + §16, plus the drift reconciliation already owed from the prior audit (Series B $24M, founding heads 40, Rule of 40 11%, net margin −40%, S&M 0.17, expansion-wave-implemented).

## 7. Caveats

- A deliberate **driver-addition pass**: it reshuffles the RNG and **deepens the GAAP loss** (SBC, amortization, tax footnote) — intended; the **cash story barely moves** (most additions are non-cash).
- Every new account must keep A = L + E green and add its own tie-out + analytical check.
- The seed files are currently **externally owned** (the realism-audit sync). Execute only once that session is confirmed finished, to avoid conflicts / OneDrive overwrites.
