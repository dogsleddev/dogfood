/**
 * Operating leases — ASC 842 (audit-readiness; board-package completeness). Recognizes Bearing's
 * office footprint as a right-of-use ASSET + a lease LIABILITY on the balance sheet (the gap a
 * Big-4 auditor expects for a 140-person company). Office space scales with headcount.
 *
 * Treatment: an OPERATING lease keeps a single straight-line lease COST in operating expenses —
 * which already lives in the Facilities OpEx line (GAAP-acceptable on the face of the statement; a
 * footnote breaks it out). So this driver touches ONLY the balance sheet: P&L, net income, cash,
 * and runway are UNCHANGED. For an even-payment operating lease there is no prepaid/accrued
 * adjustment, so the ROU asset === the lease liability every month — recognizing the lease is
 * EQUITY-NEUTRAL and A = L + E holds by construction (the two are literally the same series).
 *
 * Derived from the headcount series, so it adds NO new RNG draw and leaves every prior driver and
 * metric unchanged; it only adds two lines to the balance sheet.
 */
import { roundTo } from "./prng";
import { SEED_MONTHS, SEED_MONTH_COUNT, LEASE_RENT_PER_HEAD_MONTH, LEASE_OBLIGATION_MONTHS } from "./params";
import type { Month } from "@/lib/types/period";
import type { TieOutCheck } from "./subscription";

export interface LeaseSeries {
  readonly months: readonly Month[];
  readonly rouAsset: readonly number[];
  readonly leaseLiability: readonly number[];
}

export interface LeaseSeed {
  readonly series: LeaseSeries;
  /** opening ROU asset === opening lease liability (the pre-window office) */
  readonly opening: number;
  readonly checks: readonly TieOutCheck[];
}

export function generateLeaseSeed(totalHeadcount: readonly number[]): LeaseSeed {
  const n = SEED_MONTH_COUNT;
  // Carried lease balance = office-rent run-rate × the PV-adjusted remaining term (a renewing
  // ~3-yr footprint that grows with the org). ROU asset and lease liability are the SAME series.
  const value: number[] = [];
  for (let i = 0; i < n; i++) {
    value.push(roundTo(totalHeadcount[i] * LEASE_RENT_PER_HEAD_MONTH * LEASE_OBLIGATION_MONTHS, 1000));
  }
  const opening = value[0];

  const checks: TieOutCheck[] = [
    {
      label: "Operating lease: ROU asset === lease liability, every month",
      ok: true, // identical series by construction → recognizing the lease is equity-neutral
      detail: `end ROU/liability ${Math.round(value[n - 1]).toLocaleString()} — ASC 842 operating lease (even payments, no prepaid/accrued adjustment)`,
      kind: "definitional",
    },
    {
      label: "Lease liability positive at horizon",
      ok: value[n - 1] > 0,
      detail: `${Math.round(value[n - 1]).toLocaleString()} (office footprint scales with headcount)`,
      kind: "sanity",
    },
  ];

  return { series: { months: SEED_MONTHS, rouAsset: value, leaseLiability: value }, opening, checks };
}
