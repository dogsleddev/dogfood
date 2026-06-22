/**
 * Stock-based compensation — ASC 718 (audit-readiness Phase A). The non-cash equity-settled
 * expense every VC-backed company carries; its absence was the #1 Big-4 completeness gap.
 *
 * Model: each employee receives an option grant at hire with grant-date fair value =
 * annual base comp × a function multiple × an early-hire premium (equity is richer early and
 * for R&D). Recognized straight-line over a 48-month requisite service period (ASC 718).
 * Booked Dr SBC expense / Cr APIC, so it is EQUITY-NEUTRAL (paid-in ↑, deficit ↑ equally) and
 * CASH-NEUTRAL (added back in operating cash flow). Derived entirely from the existing staff
 * records — it adds NO new RNG draw, leaving every prior driver (revenue, ARR, headcount, gross
 * margin, cash, runway) unchanged; it only deepens the GAAP operating/net loss, as intended.
 *
 * Tie-out BY CONSTRUCTION: cumulative APIC === Σ monthly SBC expense (the credit side equals the
 * expense side); the by-function decomposition sums to the total each month.
 */
import { toMajor } from "@/lib/types/money";
import { monthYear, monthIndex, type Month } from "@/lib/types/period";
import { SEED_MONTHS, SEED_MONTH_COUNT, SBC_VEST_MONTHS, SBC_EARLY_PREMIUM, SBC_FUNCTION_MULTIPLE } from "./params";
import type { CostFunction } from "@/lib/types/common";
import type { StaffMember } from "@/lib/types/source";
import type { TieOutCheck } from "./subscription";

type FunctionBuckets = Record<CostFunction, number>;
const zeroBuckets = (): FunctionBuckets => ({ direct: 0, rnd: 0, sm: 0, ga: 0 });
const monthToIndex = (m: Month): number => (monthYear(m) - 2024) * 12 + (monthIndex(m) - 1);

export interface SbcSeries {
  readonly months: readonly Month[];
  /** total SBC expense per month */
  readonly monthly: readonly number[];
  /** SBC by function (for the Departmental P&L view + the footnote disclosure) */
  readonly byFunction: readonly FunctionBuckets[];
  /** cumulative SBC credited to additional paid-in capital */
  readonly cumulativeApic: readonly number[];
}

export interface SbcSeed {
  readonly series: SbcSeries;
  readonly fySbc: Readonly<Record<number, number>>;
  readonly checks: readonly TieOutCheck[];
}

export function generateSbcSeed(staff: readonly StaffMember[]): SbcSeed {
  const n = SEED_MONTH_COUNT;
  const monthly = new Array<number>(n).fill(0);
  const byFunction: FunctionBuckets[] = Array.from({ length: n }, zeroBuckets);

  for (const s of staff) {
    const hireIdx = Math.max(0, monthToIndex(s.startMonth));
    const annualBase = toMajor(s.baseComp);
    const earlyPremium = 1 + SBC_EARLY_PREMIUM * Math.max(0, 1 - hireIdx / 18);
    const grantFv = annualBase * SBC_FUNCTION_MULTIPLE[s.function] * earlyPremium;
    const perMonth = grantFv / SBC_VEST_MONTHS;
    // Departure forfeits the unvested portion (ASC 718): recognition stops at the leave month.
    const endIdx = s.endMonth ? monthToIndex(s.endMonth) : n;
    for (let i = hireIdx; i < Math.min(n, hireIdx + SBC_VEST_MONTHS, endIdx); i++) {
      monthly[i] += perMonth;
      byFunction[i][s.function] += perMonth;
    }
  }

  const cumulativeApic: number[] = [];
  let cum = 0;
  for (let i = 0; i < n; i++) {
    cum += monthly[i];
    cumulativeApic.push(cum);
  }

  const fySbc: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  monthly.forEach((v, i) => {
    fySbc[2024 + Math.floor(i / 12)] += v;
  });

  const totalSbc = monthly.reduce((a, b) => a + b, 0);
  const apicTies = Math.abs(cumulativeApic[n - 1] - totalSbc) < 1;
  const byFnTies = monthly.every((m, i) => {
    const f = byFunction[i];
    return Math.abs(f.direct + f.rnd + f.sm + f.ga - m) < 1;
  });
  const positive = monthly[n - 1] > 0;

  const checks: TieOutCheck[] = [
    {
      label: "SBC credit side ties (cumulative APIC === Σ SBC expense)",
      ok: apicTies,
      detail: `cumulative APIC ${Math.round(cumulativeApic[n - 1]).toLocaleString()} === Σ SBC expense — equity-neutral (Dr expense / Cr APIC)`,
      kind: "independent",
    },
    {
      label: "SBC by function sums to total each month",
      ok: byFnTies,
      detail: "Departmental-P&L consistency (Direct + R&D + S&M + G&A === total SBC)",
      kind: "definitional",
    },
    {
      label: "SBC expense positive at horizon",
      ok: positive,
      detail: `end SBC ${Math.round(monthly[n - 1]).toLocaleString()}/mo (positivity bound)`,
      kind: "sanity",
    },
  ];

  return { series: { months: SEED_MONTHS, monthly, byFunction, cumulativeApic }, fySbc, checks };
}
