/** Reporting — Projects · Staff · Expense Transactions (layer 1 — CLAUDE.md §8). */
import { type Month, monthYear, monthIndex } from "@/lib/types/period";
import { percent, type Percent } from "@/lib/types/money";
import type { DepartmentId } from "@/lib/types/common";
import type { Project, StaffMember, ExpenseTransaction } from "@/lib/types/source";
import type { ExpenseTransactionFilter } from "@/lib/datastore";
import { getDataStore } from "@/lib/datastore";
import { PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";

const monthToIndex = (m: Month): number => (monthYear(m) - 2024) * 12 + (monthIndex(m) - 1);
/** A staff member is on the books in `period` if they've started and not yet left. */
const activeIn = (s: StaffMember, period: Month): boolean => {
  const i = monthToIndex(period);
  const start = monthToIndex(s.startMonth);
  const end = s.endMonth ? monthToIndex(s.endMonth) : Infinity;
  return start <= i && i <= end;
};

// ── Projects (services delivery) ──
export async function listProjects(): Promise<readonly Project[]> {
  return getDataStore().listProjects();
}
export async function getProject(id: string): Promise<Project | undefined> {
  return getDataStore().getProject(id);
}
export interface Utilization {
  readonly period: Month;
  readonly utilization: Percent;
}
export async function getUtilization(period: Month): Promise<Utilization> {
  const svc = await getDataStore().getServicesModel();
  return { period, utilization: percent(svc.series.utilization[monthToIndex(period)] ?? 0) };
}

// ── Staff (the people register) ──
export async function listStaff(): Promise<readonly StaffMember[]> {
  // The register is the CURRENT roster as-of the in-close period: departed employees (attrition) and
  // not-yet-started future hires are excluded (their records persist in the seed/export with start/end
  // months). Mirrors the Customers as-of filter (audit #8/#23).
  const asOf = PLACEHOLDER_SETTINGS.inCloseMonth ?? PLACEHOLDER_SETTINGS.closeThrough;
  return (await getDataStore().listStaff()).filter((s) => activeIn(s, asOf));
}
export interface HeadcountByDept {
  readonly departmentId: DepartmentId;
  readonly heads: number;
}
export interface Headcount {
  readonly period: Month;
  readonly heads: number;
  readonly byDepartment?: readonly HeadcountByDept[];
}
export async function getHeadcount(period: Month, opts: { byDept?: boolean } = {}): Promise<Headcount> {
  const staff = (await getDataStore().listStaff()).filter((s) => activeIn(s, period));
  const heads = staff.reduce((n, s) => n + s.fte, 0);
  if (!opts.byDept) return { period, heads };
  const byDept = new Map<DepartmentId, number>();
  for (const s of staff) byDept.set(s.departmentId, (byDept.get(s.departmentId) ?? 0) + s.fte);
  return {
    period,
    heads,
    byDepartment: [...byDept.entries()].map(([departmentId, n]) => ({ departmentId, heads: n })),
  };
}

// ── Expense Transactions (GL-level detail) ──
export async function listExpenseTransactions(filter: ExpenseTransactionFilter = {}): Promise<readonly ExpenseTransaction[]> {
  return getDataStore().listExpenseTransactions(filter);
}
