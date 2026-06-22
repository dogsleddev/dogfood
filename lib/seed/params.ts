/**
 * ⚠️ FIRST-PASS SEED PARAMETERS — illustrative & tunable (kickoff-prompt.md; §11/§12/§17).
 * The deterministic generator is parameterized by these; swap them for the confirmed
 * fine seed parameters (exact ARR ramp, headcount curve, close state) without touching
 * the engine. Story events live here: churn spike Q3-2024, soft quarter Q1-2026, price
 * increase Jan-2026. (Hiring surge belongs to the later headcount step.)
 */
import { month, type Month } from "@/lib/types/period";
import type { PlanTier } from "@/lib/types/source";
import type { CostFunction } from "@/lib/types/common";

export const SEED_RNG_SEED = 20260617;

/** Timeline: Jan 2024 – Dec 2026 (36 months). Close boundary is read from AppSettings. */
export const SEED_MONTH_COUNT = 36;
// Handles negative indices too (the pre-existing book starts in 2023).
export const indexToMonth = (i: number): Month => month(2024 + Math.floor(i / 12), (((i % 12) + 12) % 12) + 1);
export const SEED_MONTHS: readonly Month[] = Array.from({ length: SEED_MONTH_COUNT }, (_, i) => indexToMonth(i));

export interface TierSpec {
  readonly tier: PlanTier;
  readonly weight: number;
  readonly arrLo: number;
  readonly arrHi: number;
}

// ARR bands scaled ~0.87 (2026-06-18 high-growth retune), then ~×1.10 (2026-06-18 peer-profile
// retune) — the services-mix taper to ~15% (below) shifts revenue from services INTO subscription
// to hold the §11 ~$22M arc, so per-deal subscription ARR scales up ~10% at the SAME logo count.
// Scaling deal SIZE is RNG-stable (between() is proportional, same draw sequence; trimming logo
// COUNT reshuffles the whole draw). NRR / retention are ratios, unaffected by this level scaling.
export const TIERS: readonly TierSpec[] = [
  { tier: "starter", weight: 0.6, arrLo: 33_000, arrHi: 71_000 },
  { tier: "growth", weight: 0.34, arrLo: 122_000, arrHi: 263_000 },
  { tier: "scale", weight: 0.06, arrLo: 607_000, arrHi: 1_214_000 },
];

/** Pre-existing book as of Jan 2024 (Bearing didn't start the window at zero ARR). */
export const INITIAL_BASE_COUNT = 26;

/** New logos per month index (0 = Jan 2024). Ramps UP over the arc (steeper growth) with a Q1-2026 soft dip.
 *  NOTE (audit #10/#25): the cadence reads smooth/monotonic, which is a mild synthetic tell, but the model
 *  is highly sensitive to logo TIMING (annual-prepay recognition + per-month churn draws) — reshuffling the
 *  per-month counts moves FY revenue several % and breaks the LOCKED §11 arc. Lumpifying it cleanly would
 *  require re-baselining the whole §11 calibration, so it is deliberately left smooth (deferred). */
export const NEW_LOGOS_BY_MONTH: readonly number[] = [
  // 2024 (founding ramp)
  2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  // 2025 (steady build)
  3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  // 2026 — a measured H2 ramp as the Series B deploys (soft Q1 dip)
  3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 5,
];

/** Baseline monthly logo churn probability. 0.7%/mo ≈ 8% annual logo churn (2026-06-18 retune,
 *  was 0.01 ≈ 11%) → logo retention ~90% / GRR ~92%, the high-growth-credible band. */
export const MONTHLY_CHURN = 0.007;

/** Story event: churn spike in Q3 2024 (month indices 6–8 = Jul–Sep 2024). Softened 0.045→0.030
 *  (2026-06-18) — keep the visible "rough Q3-24, then fixed it" narrative without cratering early NRR. */
export const CHURN_SPIKE = { fromIndex: 6, toIndex: 8, rate: 0.03 } as const;

/** Monthly probability a given active customer expands, and the expansion size range. Expansion
 *  motion strengthened (2026-06-18 retune: 0.014→0.028, size 8-25%→10-30%) so land-and-expand is a
 *  continuous contributor (not just the Jan-2026 price bump) → NRR ~108-112%, expansion ~30-40% of net-new. */
export const MONTHLY_EXPANSION = 0.028;
export const EXPANSION_PCT = { lo: 0.1, hi: 0.3 } as const;

/** Monthly probability an active customer DOWNSELLS — a partial contraction that reduces ARR but
 *  keeps the logo active (seat reduction / module drop), distinct from full churn. Real B2B NRR is
 *  expansion MINUS partial contraction; a book with only binary churn-to-zero reads as fake to a VC
 *  drilling the NRR/GRR bridge (realism audit 2026-06-18). Mirrors the expansion path; refunds the
 *  prorated unused prepaid so the deferred roll-forward stays clean. */
export const MONTHLY_CONTRACTION = 0.005;
export const CONTRACTION_PCT = { lo: 0.05, hi: 0.2 } as const;

/** Story beat: a product/module launch (mid-2025) that triggers an expansion wave across the active
 *  base — the "compound startup" narrative real peers (Numeric/Campfire) tell. Boosts the expansion
 *  rate inside the window, then reverts to Base. */
export const EXPANSION_WAVE = { fromIndex: 16, toIndex: 21, multiplier: 1.8 } as const;

/** Story event: price increase on the active base in Jan 2026 (index 24). */
export const PRICE_INCREASE = { monthIndex: 24, pct: 0.07 } as const;

/** Subscription billing/recognition: annual upfront, recognized ratably over 12 months. */
export const BILLING_MONTHS = 12;

/** Reconciliation targets (first-pass, §11) — what the dev QA page checks the seed against. */
export const SUBSCRIPTION_REVENUE_TARGETS = {
  2024: 6_000_000,
  2025: 10_900_000,
  2026: 19_100_000,
} as const;

// ── Services / projects (step 2): capacity-driven % complete + WIP (§8, §11) ──

export const SERVICES_RNG_SEED = SEED_RNG_SEED + 1;

/** Probability a new logo of a given tier buys implementation services. */
export const SERVICES_ATTACH_RATE: Record<PlanTier, number> = { starter: 0.4, growth: 1.0, scale: 1.0 };

/** Implementation project value as a fraction of the customer's first-year ARR.
 *  Weighted toward the many growth deals (smooth) over the few lumpy scale deals. Cut ~38%
 *  (2026-06-18 peer-profile retune) to taper the services mix toward ~15% by FY26 (the software
 *  norm for an AI-native FP&A peer of Numeric/Campfire) — "services-led early, product-led as it
 *  matures". Project value = arr × this; arr is now ~10% higher (TIERS), so net services ≈ ×0.68. */
export const SERVICES_ATTACH_PCT: Record<PlanTier, number> = { starter: 0.28, growth: 0.69, scale: 0.45 };

/** Nominal delivery duration (months) by tier — stretches when capacity binds. */
export const SERVICES_DURATION: Record<PlanTier, number> = { starter: 2, growth: 4, scale: 6 };

/** Services gross margin range (diagrams/revenue-drilldown.svg shows ~29–42%). */
export const SERVICES_MARGIN = { lo: 0.28, hi: 0.42 } as const;

/**
 * Services delivery is capacity-gated — when demand exceeds capacity, delivery stretches
 * (backlog): the "implementation capacity gates go-lives" coupling (§11). As of step 3 the
 * capacity curve is DERIVED from PS headcount (see DELIVERY_PER_HEAD_PER_MONTH below),
 * not a standalone parameter.
 *
 * Per-year shape RETUNED (2026-06-18 high-growth retune): the 28k capacity delivers near-nominal
 * pace, and the up-nudged services attach holds the §11 ~75/25 mix against the now-stronger
 * recurring (subscription) growth. Total 3-yr services ≈ $11.1M; the §11 ~$22M FY26 total arc holds.
 */
export const SERVICES_REVENUE_TARGETS = {
  2024: 2_000_000,
  2025: 2_600_000,
  2026: 3_400_000,
} as const;

// ── Personnel + two-axis cost model → Cost of Revenue (step 3; §8) ──

export const PERSONNEL_RNG_SEED = SEED_RNG_SEED + 2;

export interface DeptPlan {
  /** headcount at month 0 (the founding base) */
  readonly start: number;
  /** headcount at the end of the window */
  readonly end: number;
  /** average annual base comp (per-head varies ±COMP_VARIATION) */
  readonly baseComp: number;
}

/** Per-department hiring plan, keyed by the SEED_DEPARTMENTS ids. Founding base Σ start = 40 →
 *  Σ end = 140 heads. Founding base softened 52→40 (realism audit 2026-06-18) — 52 heads on $8M
 *  FY24 revenue read as an over-built ~$20M cost base (FY24 opex 133% of revenue); a leaner ~40-head
 *  founding team with a steeper 2025-26 ramp lands FY24 opex ~115% of revenue, the believable
 *  early-stage shape. End still trued to the LOCKED §11 ~140; PS 15 (services taper to ~15%),
 *  software-shaped org (R&D 37% · S&M 32% · Direct 19% · G&A 12%). */
export const DEPT_PLAN: Record<string, DeptPlan> = {
  "professional-services": { start: 6, end: 15, baseComp: 120_000 }, // Direct (trimmed as services taper toward ~15%)
  support: { start: 3, end: 11, baseComp: 78_000 }, // Direct
  engineering: { start: 9, end: 39, baseComp: 165_000 }, // R&D (deepened — AI-native product investment)
  "product-design": { start: 3, end: 13, baseComp: 155_000 }, // R&D
  sales: { start: 6, end: 22, baseComp: 145_000 }, // S&M — envelope reflects OTE (base + commission), so VP Sales reaches the $300-380K OTE band and top reps out-earn non-sales VPs (research-validated; 2026-06-21)
  marketing: { start: 3, end: 10, baseComp: 120_000 }, // S&M
  "customer-success": { start: 4, end: 13, baseComp: 100_000 }, // S&M (retention/expansion motion)
  finance: { start: 2, end: 7, baseComp: 130_000 }, // G&A
  people: { start: 2, end: 5, baseComp: 110_000 }, // G&A
  ops: { start: 2, end: 5, baseComp: 105_000 }, // G&A
};

export const COMP_VARIATION = 0.15;

/**
 * Employee attrition (audit #23 — a 140-person company with ZERO departures in 30 months reads fake).
 * A fraction of each department's slots turn over across the arc: the incumbent leaves after a
 * realistic tenure and a BACKFILL takes the SAME slot when they go — so the headcount trajectory and
 * the per-function payroll envelope are preserved (only the backfill's merit tenure resets, a small
 * effect). ~12–15% annual voluntary+involuntary turnover is typical for a Series-B SaaS startup, so
 * ~16% cumulative over the ~2.5-year ramp. The founding seat (rung 0) never churns.
 */
export const ATTRITION_FRACTION = 0.16;
export const ATTRITION_TENURE = { lo: 8, hi: 22 } as const; // months an incumbent stays before departing

/**
 * Per-department job-title ladder — DISPLAY ONLY (title never enters payroll/GL math; verified by
 * the data audit 2026-06-21). A bare department-name title across 140 staff (39 people all titled
 * "Engineering") was the single most obvious synthetic tell on the Staff register. Each ladder is
 * ordered senior→junior with a fractional share of the department per rung; the earliest hires (the
 * founders, lowest within-dept index) take the senior rungs, so seniority tracks tenure. Tie-out
 * neutral — assigned deterministically by within-dept rank, consumes no RNG.
 */
export interface TitleRung {
  readonly title: string;
  /** share of the department at this rung (the rungs of a dept sum to ~1) */
  readonly frac: number;
}
export const DEPT_TITLE_LADDER: Record<string, readonly TitleRung[]> = {
  engineering: [
    { title: "Co-founder & CEO", frac: 0.03 }, // the founding seat (cash discount; equity-heavy)
    { title: "VP Engineering", frac: 0.03 }, // the senior eng leader — a 39-person R&D org needs a head
    { title: "Engineering Manager", frac: 0.12 }, // line managers — sit BELOW the founder-CEO
    { title: "Staff Software Engineer", frac: 0.13 },
    { title: "Senior Software Engineer", frac: 0.34 },
    { title: "Software Engineer", frac: 0.35 },
  ],
  "product-design": [
    { title: "VP Product & Design", frac: 0.08 },
    { title: "Principal Designer", frac: 0.15 },
    { title: "Senior Product Manager", frac: 0.22 },
    { title: "Product Manager", frac: 0.3 },
    { title: "Product Designer", frac: 0.25 },
  ],
  sales: [
    { title: "VP Sales", frac: 0.05 },
    { title: "Sales Manager", frac: 0.13 },
    { title: "Senior Account Executive", frac: 0.27 },
    { title: "Account Executive", frac: 0.3 },
    { title: "Sales Development Rep", frac: 0.25 },
  ],
  marketing: [
    { title: "VP Marketing", frac: 0.1 },
    { title: "Senior Marketing Manager", frac: 0.2 },
    { title: "Demand Generation Manager", frac: 0.25 },
    { title: "Product Marketing Manager", frac: 0.2 },
    { title: "Marketing Associate", frac: 0.25 },
  ],
  "customer-success": [
    { title: "VP Customer Success", frac: 0.08 },
    { title: "Customer Success Manager", frac: 0.17 },
    { title: "Senior CSM", frac: 0.3 },
    { title: "Mid-Market CSM", frac: 0.45 },
  ],
  "professional-services": [
    { title: "Director, Professional Services", frac: 0.07 },
    { title: "Engagement Manager", frac: 0.18 },
    { title: "Senior Implementation Consultant", frac: 0.35 },
    { title: "Implementation Consultant", frac: 0.4 },
  ],
  support: [
    { title: "Support Manager", frac: 0.1 },
    { title: "Senior Support Engineer", frac: 0.3 },
    { title: "Support Engineer", frac: 0.6 },
  ],
  finance: [
    { title: "CFO", frac: 0.14 },
    { title: "Controller", frac: 0.16 },
    { title: "Senior Accountant", frac: 0.3 },
    { title: "Financial Analyst", frac: 0.4 },
  ],
  people: [
    { title: "Head of People", frac: 0.2 },
    { title: "People Operations Manager", frac: 0.3 },
    { title: "Recruiter", frac: 0.5 },
  ],
  ops: [
    { title: "Head of Operations", frac: 0.2 },
    { title: "Operations Manager", frac: 0.4 },
    { title: "Operations Analyst", frac: 0.4 },
  ],
};

/** Annual merit raise applied at each hire anniversary, and a December target bonus (% of annual
 *  base, paid in month-index % 12 === 11). Makes payroll grow with tenure and spike at year-end, so
 *  paychecks vary month-to-month AND year-over-year instead of being byte-identical for 36 months
 *  (realism audit 2026-06-18). Revenue (the arc) is unaffected; this deepens cost/NI and lifts burn. */
export const MERIT_RAISE_PCT = 0.035;
export const DEC_BONUS_PCT = 0.05;

/** Stock-based compensation (ASC 718; audit-readiness Phase A). Grant-date fair value =
 *  annual base × function multiple × early-hire premium, recognized straight-line over the vest.
 *  Derived from the staff records (NO new RNG draw) and booked Dr SBC expense / Cr APIC — so it is
 *  EQUITY-neutral (paid-in ↑, deficit ↑ equally) and CASH-neutral (added back in OCF). It deepens
 *  the GAAP operating/net loss (the realistic shape) without moving cash, runway, or any driver. */
export const SBC_VEST_MONTHS = 48; // 4-year straight-line requisite service period
export const SBC_EARLY_PREMIUM = 0.6; // founders/early hires up to +60% richer, fading by ~month 18
export const SBC_FUNCTION_MULTIPLE: Record<CostFunction, number> = {
  direct: 0.5, // PS / Support — leaner equity
  rnd: 1.1, // Engineering / Product — richest (retention of scarce AI talent)
  sm: 0.7,
  ga: 0.7,
};

/** Operating leases (ASC 842; audit-readiness — board-package completeness). Office space as an
 *  operating lease → a right-of-use ASSET + a lease LIABILITY on the balance sheet (the §11
 *  completeness gap a Big-4 auditor expects for a 140-person company). The lease COST stays in the
 *  Facilities OpEx line (GAAP-acceptable on the face; a footnote breaks it out), so the P&L, net
 *  income, cash, and runway are UNCHANGED — pure balance-sheet recognition. ROU asset === lease
 *  liability each month (even-payment operating lease) → equity-neutral, A=L+E holds by construction.
 *  Carried balance = office-rent run-rate × the PV-adjusted remaining term. */
export const LEASE_RENT_PER_HEAD_MONTH = 350; // office-rent portion of Facilities (rest = utilities/supplies)
export const LEASE_OBLIGATION_MONTHS = 33; // PV-adjusted remaining lease term carried on the BS (a renewing ~3-yr footprint)

/** Cumulative hiring fraction by month index (0 → 1), with the H1-2025 surge (§11/§12). */
export const HIRING_CURVE: readonly number[] = [
  // 2024 — slow (heads track early revenue; ~58 heads by end-FY24 at ~$8M)
  0.0, 0.015, 0.03, 0.045, 0.06, 0.075, 0.09, 0.105, 0.12, 0.135, 0.15, 0.16,
  // 2025 — visible H1 hiring surge, then moderating (~91 heads by end-FY25)
  0.2, 0.25, 0.29, 0.33, 0.36, 0.39, 0.41, 0.43, 0.44, 0.45, 0.46, 0.47,
  // 2026 — fill to plan as revenue scales
  0.52, 0.57, 0.62, 0.67, 0.72, 0.77, 0.82, 0.87, 0.91, 0.95, 0.98, 1.0,
];

/** Departments whose payroll is Direct (Cost of Revenue) vs the delivery-billable subset. */
export const DIRECT_DEPTS = ["professional-services", "support"] as const;
/** Only Professional Services delivers billable services (drives capacity). */
export const DELIVERY_DEPTS = ["professional-services"] as const;

/** Monthly billable services capacity per PS head — couples capacity to headcount (§11).
 *  Calibrated (step 6; retuned post-audit 2026-06-18) so total 36-month capacity broadly covers
 *  demand and projects complete near their nominal schedule rather than the org running
 *  perpetually maxed. At the old 26k the model ran ~2% capacity-short every month, pinning
 *  utilization at 100% for 32/36 months and leaving ~28 projects still in flight at the horizon;
 *  28k eases utilization off the pin in the forecast tail (Oct–Dec 2026 ≈ 84/57/58%) and drops
 *  the in-progress count to ~8 (all genuinely young), while keeping FY26 revenue on the ~$22M arc
 *  (28k → $22.15M; 30k over-corrects to $21.81M and pulls FY26 services 10% under target). */
export const DELIVERY_PER_HEAD_PER_MONTH = 28_000;

// Cost of Revenue = Direct Payroll + non-employee rate × revenue per stream (§8).
export const SUBSCRIPTION_HOSTING_RATE = 0.17; // infra/hosting + model INFERENCE as % of subscription revenue (0.15→0.17, 2026-06-18 — an AI-native product carries real inference COGS)
export const SERVICES_PASSTHROUGH_RATE = 0.25; // pass-through as % of services revenue
// Widened (2026-06-18 peer-profile retune): the services taper lifts the subscription weight (higher
// GM) while the higher hosting rate offsets it; FY26 lands in the upper-60s/low-70s. Re-anchor to the
// generated value after calibration. The check verifies FY26 in-band AND GM widening each year.
export const GROSS_MARGIN_BAND = { lo: 0.67, hi: 0.78 } as const;

// ── Non-payroll OpEx — the 8 expense groups (step 4; §7/§8) ──
// Each group is driven by payroll burden, a % of revenue, or a per-head monthly cost.
// "rate" units: payroll_burden/revenue_pct = fraction; per_head = $/head/month.

export type OpExDriverKind = "payroll_burden" | "revenue_pct" | "per_head";

export interface OpExDriver {
  readonly kind: OpExDriverKind;
  readonly rate: number;
}

/** Keyed by SEED_EXPENSE_GROUPS ids. Employee Expenses = all payroll burden (direct+indirect). */
export const OPEX_DRIVERS: Record<string, OpExDriver> = {
  "employee-expenses": { kind: "payroll_burden", rate: 0.22 }, // taxes + medical + benefits on total payroll
  "sales-marketing": { kind: "revenue_pct", rate: 0.14 }, // programs only (not S&M payroll); dialed to 0.14 (coherent-efficient recalibration, post milestone review) — total S&M ~low-30s% of revenue, magic ~1.2-1.4x, non-GAAP margin shallower; embraces the structural annual-prepay cash-efficiency rather than over-spending to fake a higher burn multiple
  "travel-entertainment": { kind: "per_head", rate: 400 },
  it: { kind: "per_head", rate: 333 },
  hr: { kind: "per_head", rate: 200 },
  admin: { kind: "per_head", rate: 267 },
  facilities: { kind: "per_head", rate: 467 },
  insurance: { kind: "revenue_pct", rate: 0.01 },
};

/** First-pass FY targets for total non-payroll OpEx (= lib/target OpEx − Indirect Payroll − D&A). */
export const OPEX_TARGETS = {
  2024: 3_400_000,
  2025: 5_200_000,
  2026: 7_750_000,
} as const;

// ── Balance sheet + cash flow drivers (step 5; §8) ──────────────────────────────
// AR/DSO, prepaids, fixed assets + depreciation, AP/DPO, opening balances, and the
// Series-B financing event. The seed assembles a balance sheet that balances and an
// indirect cash flow that ties to it BY CONSTRUCTION (see lib/seed/balance-sheet.ts).

/** Days sales outstanding — receivables lag on billings (subscription annual + services at completion). */
export const DSO_DAYS = 45;
/** Days payable outstanding — payables lag on the cash-settled expense base (non-payroll OpEx + non-employee CoR). */
export const DPO_DAYS = 30;
/** Average days in a month, for the DSO/DPO balance conversion. */
export const DAYS_PER_MONTH = 30.4;

/** Prepaid expenses carried as N days of the non-payroll OpEx run-rate (insurance/software/etc. paid upfront). */
export const PREPAID_DAYS = 40;

/** Capex: per new hire (equipment/onboarding) + a base monthly build-out that scales with the org. */
export const CAPEX_PER_NEW_HEAD = 6_000;
export const CAPEX_BASE_PER_HEAD_MONTH = 230; // office/infra build-out, $/head/month
/** Straight-line depreciation life (months). Calibrated so FY26 D&A ≈ the model's ~$0.5M/yr leaf. */
export const DEPREC_LIFE_MONTHS = 30;

/** Interest income earned on the prior-month cash balance (annualized); taxes are 0 (net operating losses). */
export const INTEREST_ON_CASH_RATE = 0.04;

/** Opening balance sheet as of the start of Jan 2024 (month 0). Opening deferred is computed from the
 *  pre-existing subscription base, not set here. Equity is the plug that balances the opening sheet. */
export const OPENING_BALANCES = {
  // Bumped $6M→$7.5M (2026-06-21) so runway holds the §11 ~49-50mo target after realistic exec comp + the
  // sales OTE envelope deepened the ramp-year burn (an exec-heavy team + market-rate sales cost more; the
  // company simply started with a bit more capital). Deeper P&L losses are kept — this funds them, not hides them.
  cash: 7_500_000,
  accountsReceivable: 520_000,
  prepaidExpenses: 180_000,
  fixedAssetsNet: 420_000,
  accountsPayable: 300_000,
  /** Of the opening equity plug, how much is contributed capital (the rest is the accumulated deficit). */
  paidInCapital: 14_000_000,
} as const;

/** Series-B financing: an equity raise that funds the spending-ahead-of-revenue arc (§11).
 *  Sized up $9M→$28M (2026-06-18 peer-profile retune) to read like a real AI-native-finance
 *  Series B (Numeric $51M, Campfire $65M, FP&A-native Aleph $29M). Bearing is near cash-flow
 *  breakeven on a TTM basis (annual-prepay billing + NRR ~109% i-12 cohort), so this is a war chest, not a
 *  burn-to-survive raise — runway reads "default alive", the strong 2025 posture. Trimmed
 *  $28M→$24M (realism audit 2026-06-18) so the cash pile doesn't push runway past ~7yr; still
 *  cohort-credible (Aleph $29M, the FP&A-native comp). */
export const SERIES_B = { monthIndex: 14, amount: 20_000_000 } as const; // Mar 2025 (coherent-efficient recalibration: right-sized for a capital-efficient $23M-revenue company — a $28M war chest left an implausible ~80mo runway; $20M lands ~55mo, well-funded but not hoarding)

/** First-pass FY target for depreciation & amortization (the P&L line absent before step 5). */
export const DA_TARGETS = {
  2024: 250_000,
  2025: 380_000,
  2026: 470_000,
} as const;

// Fail loud (not silent NaN) if the still-open per-month parameter arrays (§17) drift out of
// lockstep with SEED_MONTH_COUNT, or if the hiring curve doesn't end fully ramped.
if (NEW_LOGOS_BY_MONTH.length !== SEED_MONTH_COUNT) {
  throw new Error(`NEW_LOGOS_BY_MONTH length ${NEW_LOGOS_BY_MONTH.length} !== SEED_MONTH_COUNT ${SEED_MONTH_COUNT}`);
}
if (HIRING_CURVE.length !== SEED_MONTH_COUNT) {
  throw new Error(`HIRING_CURVE length ${HIRING_CURVE.length} !== SEED_MONTH_COUNT ${SEED_MONTH_COUNT}`);
}
if (HIRING_CURVE[SEED_MONTH_COUNT - 1] !== 1) {
  throw new Error(`HIRING_CURVE must end at 1.0 (got ${HIRING_CURVE[SEED_MONTH_COUNT - 1]})`);
}
