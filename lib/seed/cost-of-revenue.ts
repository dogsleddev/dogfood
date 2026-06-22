/**
 * Cost of Revenue — step 3, the ASSEMBLED coupled driver (§8). NOT a standalone input:
 *   Total CoR = Direct Payroll (from Personnel's Direct-function depts)
 *             + non-employee rate × revenue per stream (hosting % of sub + pass-through % of svc).
 * Gross Profit = Total Revenue − Total CoR. The rate is the only new input (the "Direct cost"
 * scenario lever perturbs it); the % model is swappable behind this stable line.
 *
 * Tie-out BY CONSTRUCTION: Total CoR === Direct Payroll + Non-employee; GM% in the §8 band.
 *
 * Note: burden on DIRECT labor lives in OpEx Employee Expenses (§8), NOT in CoR — so the GM
 * here is a base-direct-labor margin. Don't move direct burden into CoR; it would break §8's GM.
 */
import { SEED_MONTHS, SUBSCRIPTION_HOSTING_RATE, SERVICES_PASSTHROUGH_RATE, GROSS_MARGIN_BAND } from "./params";
import type { Month } from "@/lib/types/period";
import type { TieOutCheck } from "./subscription";

export interface CostOfRevenueSeries {
  readonly months: readonly Month[];
  readonly subscriptionRevenue: readonly number[];
  readonly servicesRevenue: readonly number[];
  readonly totalRevenue: readonly number[];
  readonly directPayroll: readonly number[];
  readonly nonEmployee: readonly number[];
  readonly totalCoR: readonly number[];
  readonly grossProfit: readonly number[];
}

export interface CostOfRevenueSeed {
  readonly series: CostOfRevenueSeries;
  readonly fyTotalRevenue: Readonly<Record<number, number>>;
  readonly fyTotalCoR: Readonly<Record<number, number>>;
  readonly fyGrossProfit: Readonly<Record<number, number>>;
  readonly fyGrossMarginPct: Readonly<Record<number, number>>;
  readonly checks: readonly TieOutCheck[];
}

export function assembleCostOfRevenue(
  subRecognized: readonly number[],
  svcRecognized: readonly number[],
  directPayroll: readonly number[],
): CostOfRevenueSeed {
  const n = subRecognized.length;
  const totalRevenue: number[] = [];
  const nonEmployee: number[] = [];
  const totalCoR: number[] = [];
  const grossProfit: number[] = [];

  for (let i = 0; i < n; i++) {
    const sub = subRecognized[i];
    const svc = svcRecognized[i];
    const rev = sub + svc;
    const ne = SUBSCRIPTION_HOSTING_RATE * sub + SERVICES_PASSTHROUGH_RATE * svc;
    const cor = directPayroll[i] + ne;
    totalRevenue.push(rev);
    nonEmployee.push(ne);
    totalCoR.push(cor);
    grossProfit.push(rev - cor);
  }

  const fyTotalRevenue: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  const fyTotalCoR: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  const fyGrossProfit: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  for (let i = 0; i < n; i++) {
    const fy = 2024 + Math.floor(i / 12);
    fyTotalRevenue[fy] += totalRevenue[i];
    fyTotalCoR[fy] += totalCoR[i];
    fyGrossProfit[fy] += grossProfit[i];
  }
  const fyGrossMarginPct: Record<number, number> = {};
  for (const fy of [2024, 2025, 2026]) fyGrossMarginPct[fy] = fyGrossProfit[fy] / fyTotalRevenue[fy];

  // Definitional: totalCoR[i] := directPayroll[i] + nonEmployee[i] (line 53). The `n > 0`
  // guard stops a zeroed series from passing vacuously (`[].every()` is true).
  const assembledOk = n > 0 && totalCoR.every((c, i) => Math.abs(c - (directPayroll[i] + nonEmployee[i])) < 1);
  const gm26 = fyGrossMarginPct[2026];
  const gmInBand = gm26 >= GROSS_MARGIN_BAND.lo && gm26 <= GROSS_MARGIN_BAND.hi;
  // Falsifiable trajectory: gross margin must widen year over year (the §11 "converging" story).
  // A regression that inflates CoR in a later year trips this even while FY26 stays in band.
  const gmImproves = fyGrossMarginPct[2024] < fyGrossMarginPct[2025] && fyGrossMarginPct[2025] < fyGrossMarginPct[2026];

  const checks: TieOutCheck[] = [
    { label: "Total CoR === Direct Payroll + Non-employee", ok: assembledOk, detail: "definitional — assembled (totalCoR := direct + non-employee), not entered; not a reconciliation", kind: "definitional" },
    {
      label: `FY26 gross margin in ${(GROSS_MARGIN_BAND.lo * 100).toFixed(0)}–${(GROSS_MARGIN_BAND.hi * 100).toFixed(0)}% band`,
      ok: gmInBand,
      detail: `${(gm26 * 100).toFixed(1)}% (${((gm26 - GROSS_MARGIN_BAND.lo) * 100).toFixed(1)} pts above floor — sensitive to the hosting/pass-through rates)`,
      kind: "calibration",
    },
    {
      label: "Gross margin widens each year",
      ok: gmImproves,
      detail: `FY24 ${(fyGrossMarginPct[2024] * 100).toFixed(1)}% < FY25 ${(fyGrossMarginPct[2025] * 100).toFixed(1)}% < FY26 ${(fyGrossMarginPct[2026] * 100).toFixed(1)}% (the §11 "converging" story)`,
      kind: "calibration",
    },
  ];

  return {
    series: { months: SEED_MONTHS, subscriptionRevenue: subRecognized, servicesRevenue: svcRecognized, totalRevenue, directPayroll, nonEmployee, totalCoR, grossProfit },
    fyTotalRevenue,
    fyTotalCoR,
    fyGrossProfit,
    fyGrossMarginPct,
    checks,
  };
}
