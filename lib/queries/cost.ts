/** Cost of Revenue (assembled) · Personnel · Expense Forecast (layer 2 — CLAUDE.md §8). */
import { type Month, monthYear } from "@/lib/types/period";
import type { CostFunction, DepartmentId, ExpenseGroupId } from "@/lib/types/common";
import type {
  CostOfRevenueLine,
  PersonnelForecastLine,
  ExpenseForecastLine,
} from "@/lib/types/drivers";
import { usd, percent, toMajor } from "@/lib/types/money";
import { getDataStore } from "@/lib/datastore";
import { monthlyCompFor } from "@/lib/seed/personnel";
import { opexSubAccountById } from "@/lib/seed/opex-accounts";
import { PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import { SUBSCRIPTION_HOSTING_RATE, SERVICES_PASSTHROUGH_RATE } from "@/lib/seed/params";
import { assertBaseScope, type ScenarioOpt, type StreamOpt } from "./util";

/**
 * Cost of Revenue = ASSEMBLED coupled driver (§8): Direct Payroll (from Personnel's Direct-
 * function depts) + non-employee rate × revenue per stream. Reads the seed's CoR series (the
 * same series the P&L Total Cost of Revenue line is built from), so directPayroll + nonEmployee
 * === totalCoR === the P&L line by construction (one source, two callers).
 *
 * Without a stream filter: one combined line per month (rate = blended non-employee ÷ total revenue).
 * With a stream filter: that stream's non-employee cost (hosting % of subscription, pass-through %
 * of services) plus direct payroll allocated by the stream's share of revenue; rate = the stream's
 * own cost-to-serve rate (the swappable input the "Direct cost" scenario lever perturbs).
 */
export async function getCostOfRevenue(period: Month, opts: StreamOpt = {}): Promise<readonly CostOfRevenueLine[]> {
  assertBaseScope(opts, "getCostOfRevenue");
  const cor = (await getDataStore().getCostOfRevenueModel()).series;
  const months = cor.months;
  const fyStart = (monthYear(period) - 2024) * 12;
  const lines: CostOfRevenueLine[] = [];

  for (let m = fyStart; m <= fyStart + 11; m++) {
    const mo = months[m];
    if (!mo) continue;
    const totalRev = cor.totalRevenue[m] ?? 0;
    const directPay = cor.directPayroll[m] ?? 0;

    if (!opts.stream) {
      const ne = cor.nonEmployee[m] ?? 0;
      lines.push({
        period: mo,
        directPayroll: usd(directPay),
        nonEmployee: usd(ne),
        total: usd((cor.totalCoR[m] ?? 0)),
        rate: percent(totalRev > 0 ? ne / totalRev : 0),
      });
    } else {
      const streamRev = (opts.stream === "subscription" ? cor.subscriptionRevenue[m] : cor.servicesRevenue[m]) ?? 0;
      // Non-employee cost is the seed's per-stream contribution; the blended series splits exactly
      // into hosting-on-subscription + pass-through-on-services, so reconstruct the stream share.
      const subNe = SUBSCRIPTION_HOSTING_RATE * (cor.subscriptionRevenue[m] ?? 0);
      const svcNe = SERVICES_PASSTHROUGH_RATE * (cor.servicesRevenue[m] ?? 0);
      const streamNe = opts.stream === "subscription" ? subNe : svcNe;
      const streamDirect = totalRev > 0 ? directPay * (streamRev / totalRev) : 0;
      lines.push({
        period: mo,
        stream: opts.stream,
        directPayroll: usd(streamDirect),
        nonEmployee: usd(streamNe),
        total: usd(streamDirect + streamNe),
        rate: percent(streamRev > 0 ? streamNe / streamRev : 0),
      });
    }
  }
  return lines;
}

export interface PersonnelOpt extends ScenarioOpt {
  readonly departmentId?: DepartmentId;
  readonly function?: CostFunction;
}

/**
 * Personnel — payroll by department + function tag, per month (§8). Reads the seed personnel
 * series (heads + base comp). Default: one rolled-up line per month for the period's fiscal year
 * (total heads + total base comp). A `function` filter narrows to that cost-function bucket
 * (Direct / R&D / S&M / G&A). A `departmentId` filter narrows to one department by re-aggregating
 * the staff records active each month (base comp grown by merit/bonus — same `monthlyCompFor` the
 * payroll series uses, so a dept slice reconciles to the total). Comp here is base only; burden
 * lives in the Employee Expenses OpEx group.
 */
export async function getPersonnelForecast(period: Month, opts: PersonnelOpt = {}): Promise<readonly PersonnelForecastLine[]> {
  assertBaseScope(opts, "getPersonnelForecast");
  const store = getDataStore();
  const per = await store.getPersonnelModel();
  const series = per.series;
  const months = series.months;
  const fyStart = (monthYear(period) - 2024) * 12;
  const lines: PersonnelForecastLine[] = [];

  // departmentId filter: re-aggregate the staff records (the series carries function/total cuts,
  // not per-department, so a dept slice is built from the people active that month).
  const deptStaff = opts.departmentId
    ? per.staff
        .filter((s) => s.departmentId === opts.departmentId)
        .map((s) => ({ hireIndex: monthToIndexLocal(s.startMonth), baseComp: s.baseComp.minor / 100 }))
    : undefined;

  for (let m = fyStart; m <= fyStart + 11; m++) {
    const mo = months[m];
    if (!mo) continue;

    if (deptStaff) {
      let heads = 0;
      let comp = 0;
      for (const s of deptStaff) {
        if (s.hireIndex > m) continue;
        heads += 1;
        comp += monthlyCompFor(s.baseComp, s.hireIndex, m);
      }
      lines.push({ period: mo, departmentId: opts.departmentId, heads, baseComp: usd(comp) });
    } else if (opts.function) {
      lines.push({
        period: mo,
        function: opts.function,
        heads: series.headcountByFunction[m]?.[opts.function] ?? 0,
        baseComp: usd(series.payrollByFunction[m]?.[opts.function] ?? 0),
      });
    } else {
      lines.push({
        period: mo,
        heads: series.totalHeadcount[m] ?? 0,
        baseComp: usd(series.totalPayroll[m] ?? 0),
      });
    }
  }
  return lines;
}

const monthToIndexLocal = (mo: Month): number => (monthYear(mo) - 2024) * 12 + (Number(mo.slice(5, 7)) - 1);

export interface ExpenseOpt extends ScenarioOpt {
  readonly groupId?: ExpenseGroupId;
  /** drill depth: 'group' (default, back-compatible) · 'account' (GL sub-accounts) · 'vendor'. §7 */
  readonly breakdown?: "group" | "account" | "vendor";
}

const r2 = (x: number): number => Math.round(x * 100) / 100;

/**
 * Expense Forecast — non-payroll OpEx, per month, drillable group -> account -> vendor (§7/§8). Reads
 * the seed OpEx series (the 8 groups + their GL sub-accounts). `breakdown`:
 *   'group'   (default): one line per group per month — today's behavior, unchanged for existing callers.
 *   'account': one line per GL sub-account per month (group total × the account's fixed share; the seed's
 *              subAccounts series, so Σ accounts === group === the P&L OpEx line by construction).
 *   'vendor':  FORECAST months show recurring vendors at a stable run-rate + one "Other — <account>"
 *              residual line per sub-account (a planning lens, never a sampled vendor name); CLOSED months
 *              (period ≤ closeThrough) show the REAL sub-ledger bills bucketed by sub-account (Peek-vs-Place
 *              §6: actuals = register detail, forecast = driver projection).
 * Σ per group-month is identical across all three breakdowns (one source, two callers).
 */
export async function getExpenseForecast(period: Month, opts: ExpenseOpt = {}): Promise<readonly ExpenseForecastLine[]> {
  assertBaseScope(opts, "getExpenseForecast");
  const opx = (await getDataStore().getOpExModel()).series;
  const months = opx.months;
  const fyStart = (monthYear(period) - 2024) * 12;
  const groups = opts.groupId ? opx.groups.filter((g) => g.groupId === opts.groupId) : opx.groups;
  const breakdown = opts.breakdown ?? "group";
  const closeThrough = PLACEHOLDER_SETTINGS.closeThrough;
  const lines: ExpenseForecastLine[] = [];

  // vendor breakdown · closed months: prefetch the real bills once, bucket in memory by (period, subCode, vendor)
  let actualBills: readonly { period: Month; subCode?: string; groupId: string; vendor?: string; amount: number }[] = [];
  if (breakdown === "vendor") {
    const bills = await getDataStore().listExpenseTransactions(opts.groupId ? { groupId: opts.groupId } : {});
    actualBills = bills.map((b) => ({ period: b.period, subCode: b.subCode, groupId: b.groupId as string, vendor: b.vendor, amount: toMajor(b.amount) }));
  }

  for (let m = fyStart; m <= fyStart + 11; m++) {
    const mo = months[m];
    if (!mo) continue;
    const isClosed = mo <= closeThrough;
    for (const g of groups) {
      const groupId = g.groupId as ExpenseGroupId;

      if (breakdown === "group") {
        lines.push({ period: mo, groupId, amount: usd(g.monthly[m] ?? 0) });
        continue;
      }

      for (const sa of g.subAccounts) {
        const amt = sa.monthly[m] ?? 0;
        if (breakdown === "account") {
          lines.push({ period: mo, groupId, accountId: sa.id, accountLabel: sa.label, subCode: sa.subCode, amount: usd(amt) });
          continue;
        }

        // breakdown === "vendor"
        if (isClosed) {
          // real sub-ledger bills for this sub-account this month, one line per (vendor)
          const billsHere = actualBills.filter((b) => b.period === mo && b.subCode === sa.subCode);
          const byVendor = new Map<string, number>();
          for (const b of billsHere) byVendor.set(b.vendor ?? "—", (byVendor.get(b.vendor ?? "—") ?? 0) + b.amount);
          for (const [vendor, vAmt] of byVendor) {
            lines.push({ period: mo, groupId, accountId: sa.id, accountLabel: sa.label, subCode: sa.subCode, vendor, amount: usd(vAmt), isActual: true });
          }
          continue;
        }

        // forecast month: anchors at run-rate + one "Other — <account>" residual (rounding-absorbed)
        const cfg = opexSubAccountById(sa.id);
        let anchorAcc = 0;
        for (const [vendor, w] of cfg?.anchors ?? []) {
          const vAmt = r2(amt * w);
          if (vAmt <= 0.005) continue;
          lines.push({ period: mo, groupId, accountId: sa.id, accountLabel: sa.label, subCode: sa.subCode, vendor, amount: usd(vAmt) });
          anchorAcc = r2(anchorAcc + vAmt);
        }
        const residual = r2(amt - anchorAcc);
        if (residual > 0.005 || anchorAcc === 0) {
          lines.push({
            period: mo, groupId, accountId: sa.id, accountLabel: sa.label, subCode: sa.subCode,
            vendor: `Other — ${sa.label}`, amount: usd(Math.max(0, residual)), isResidual: true,
          });
        }
      }
    }
  }
  return lines;
}
