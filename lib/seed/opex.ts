/**
 * OpEx seed — step 4 of the §12 generator. The NON-PAYROLL side of the two-axis cost
 * model (§7/§8): the 8 expense groups, each driven deterministically:
 *   Employee Expenses = payroll burden (taxes/medical/benefits) × total payroll
 *   Sales & Marketing (programs) and Insurance = % of revenue
 *   Travel & Entertainment, IT, HR, Admin, Facilities = per-head × headcount
 * (Indirect Payroll comes from Personnel; D&A comes from Fixed Assets in step 5 — neither
 * is part of this step.)
 *
 * Tie-out BY CONSTRUCTION: total non-payroll OpEx === Σ group amounts; Employee Expenses
 * === burden rate × payroll; every group ≥ 0.
 */
import { SEED_MONTHS, OPEX_DRIVERS } from "./params";
import { SEED_EXPENSE_GROUPS } from "@/lib/target/placeholder";
import type { Month } from "@/lib/types/period";
import type { TieOutCheck } from "./subscription";

export interface OpExGroupSeries {
  readonly groupId: string;
  readonly label: string;
  readonly monthly: readonly number[];
  readonly fyTotal: Readonly<Record<number, number>>;
}

export interface OpExSeries {
  readonly months: readonly Month[];
  readonly groups: readonly OpExGroupSeries[];
  readonly total: readonly number[];
}

export interface OpExSeed {
  readonly series: OpExSeries;
  readonly fyTotal: Readonly<Record<number, number>>;
  readonly checks: readonly TieOutCheck[];
}

export function generateOpExSeed(
  totalPayroll: readonly number[],
  totalHeadcount: readonly number[],
  totalRevenue: readonly number[],
): OpExSeed {
  const n = totalRevenue.length;

  const groups: OpExGroupSeries[] = SEED_EXPENSE_GROUPS.map((g) => {
    const driver = OPEX_DRIVERS[g.id];
    const monthly: number[] = [];
    for (let i = 0; i < n; i++) {
      let amount = 0;
      if (driver) {
        if (driver.kind === "payroll_burden") amount = driver.rate * totalPayroll[i];
        else if (driver.kind === "revenue_pct") amount = driver.rate * totalRevenue[i];
        else amount = driver.rate * totalHeadcount[i];
      }
      monthly.push(amount);
    }
    const fyTotal: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
    monthly.forEach((a, i) => {
      fyTotal[2024 + Math.floor(i / 12)] += a;
    });
    return { groupId: g.id, label: g.label, monthly, fyTotal };
  });

  const total: number[] = [];
  for (let i = 0; i < n; i++) total.push(groups.reduce((sum, g) => sum + g.monthly[i], 0));

  const fyTotal: Record<number, number> = { 2024: 0, 2025: 0, 2026: 0 };
  total.forEach((a, i) => {
    fyTotal[2024 + Math.floor(i / 12)] += a;
  });

  // checks (all guarded with n > 0 so a zeroed series cannot pass vacuously via `[].every()`)
  // Definitional: total[i] := Σ group.monthly[i] (line 64).
  const sumsToTotal = n > 0 && total.every((t, i) => Math.abs(groups.reduce((s, g) => s + g.monthly[i], 0) - t) < 1);
  const employee = groups.find((g) => g.groupId === "employee-expenses");
  // Definitional: the employee-expenses group's monthly := rate × totalPayroll (line 50). The
  // `!!employee` is a structural guard (fails only if the group id is renamed/removed).
  const burdenOk =
    !!employee && n > 0 && employee.monthly.every((a, i) => Math.abs(a - (OPEX_DRIVERS["employee-expenses"]?.rate ?? 0) * totalPayroll[i]) < 1);
  const allNonNeg = n > 0 && groups.every((g) => g.monthly.every((a) => a >= 0));

  const checks: TieOutCheck[] = [
    { label: "Total non-payroll OpEx === Σ group amounts", ok: sumsToTotal, detail: `definitional — total := Σ group (${groups.length} groups)`, kind: "definitional" },
    { label: "Employee Expenses === burden rate × total payroll", ok: burdenOk, detail: "definitional — group := rate × payroll; the lookup is a group-existence guard", kind: "definitional" },
    { label: "Every expense group ≥ 0", ok: allNonNeg, detail: "no negative OpEx; one-sided bound", kind: "sanity" },
  ];

  return { series: { months: SEED_MONTHS, groups, total }, fyTotal, checks };
}
