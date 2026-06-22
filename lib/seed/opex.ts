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
import { opexSubAccounts } from "./opex-accounts";
import type { Month } from "@/lib/types/period";
import type { TieOutCheck } from "./subscription";

const r2 = (x: number): number => Math.round(x * 100) / 100;

/** A GL sub-account's monthly series — group.monthly split by its fixed share (last absorbs residual). */
export interface OpExSubAccountSeries {
  readonly id: string;
  readonly subCode: string;
  readonly label: string;
  readonly monthly: readonly number[];
}

export interface OpExGroupSeries {
  readonly groupId: string;
  readonly label: string;
  readonly monthly: readonly number[];
  readonly fyTotal: Readonly<Record<number, number>>;
  /** the group total split across its GL sub-accounts (§7); Σ subAccounts[*].monthly[i] === monthly[i]. */
  readonly subAccounts: readonly OpExSubAccountSeries[];
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

    // Split the group total across its GL sub-accounts by fixed share, per month. The LAST sub-account
    // absorbs the rounding residual so Σ sub-accounts === group monthly EXACTLY (tie-out-neutral, §7).
    const subs = opexSubAccounts(g.id);
    const subAccounts: OpExSubAccountSeries[] = subs.map((sa) => ({ id: sa.id, subCode: sa.subCode, label: sa.label, monthly: [] as number[] }));
    for (let i = 0; i < n; i++) {
      let acc = 0;
      for (let k = 0; k < subs.length; k++) {
        const amt = k === subs.length - 1 ? r2(monthly[i] - acc) : r2(monthly[i] * subs[k].share);
        (subAccounts[k].monthly as number[]).push(amt);
        acc = r2(acc + amt);
      }
    }
    return { groupId: g.id, label: g.label, monthly, fyTotal, subAccounts };
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
  // Σ sub-account monthly === group monthly, every month (the group->account split, §7). Definitional:
  // the last sub-account absorbs the residual (above), so this holds by construction — it guards a
  // future share-vector / ordering regression. Groups with no sub-accounts are vacuously fine.
  const subTotal = (sas: readonly OpExSubAccountSeries[], i: number) => sas.reduce((s, sa) => s + sa.monthly[i], 0);
  const subAccountPartitionOk =
    n > 0 && groups.every((g) => g.subAccounts.length === 0 || g.monthly.every((t, i) => Math.abs(subTotal(g.subAccounts, i) - t) < 1));
  const subCount = groups.reduce((s, g) => s + g.subAccounts.length, 0);

  const checks: TieOutCheck[] = [
    { label: "Total non-payroll OpEx === Σ group amounts", ok: sumsToTotal, detail: `definitional — total := Σ group (${groups.length} groups)`, kind: "definitional" },
    { label: "Employee Expenses === burden rate × total payroll", ok: burdenOk, detail: "definitional — group := rate × payroll; the lookup is a group-existence guard", kind: "definitional" },
    { label: "Σ sub-account monthly === group monthly, every month", ok: subAccountPartitionOk, detail: `definitional — group->account split, last absorbs residual (${subCount} sub-accounts across ${groups.length} groups)`, kind: "definitional" },
    { label: "Every expense group ≥ 0", ok: allNonNeg, detail: "no negative OpEx; one-sided bound", kind: "sanity" },
  ];

  return { series: { months: SEED_MONTHS, groups, total }, fyTotal, checks };
}
