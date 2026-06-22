/**
 * Layer 2 — Drivers: forward assumptions that generate the forecast (CLAUDE.md §5, §8).
 * Scenario adjustments apply here; every driver query takes an optional scenarioId.
 */
import type { Money, Percent, Days } from "./money";
import type { Month } from "./period";
import type { Stream, CostFunction, DepartmentId, ExpenseGroupId, ContractId } from "./common";

/**
 * Subscription forecast = contracted (read from Contracts) + new-business/retention
 * assumption — it does NOT re-derive contracted revenue (one source, two callers — §8).
 */
export interface RevenueForecastLine {
  readonly period: Month;
  readonly stream: Stream;
  readonly contracted: Money;
  readonly newBusiness: Money;
  readonly total: Money;
}

// ── Recognized revenue (the "by period" cross-section — revenue-drilldown.svg) ──

export interface RecognizedSubscriptionRow {
  readonly contractId: ContractId;
  readonly customerName: string;
  readonly plan: string;
  readonly arr: Money;
  readonly recognized: Money;
  /** point-in-time deferred balance (contract liability), not a flow */
  readonly deferred: Money;
}

export interface RecognizedServicesRow {
  readonly engagementName: string;
  readonly customerName: string;
  readonly pctCompleteDelta: Percent;
  readonly recognized: Money;
  readonly wip: Money;
  readonly marginPct: Percent;
}

export interface RecognizedRevenue {
  readonly period: Month;
  readonly subscription: { readonly rows: readonly RecognizedSubscriptionRow[]; readonly subtotal: Money };
  readonly services: { readonly rows: readonly RecognizedServicesRow[]; readonly subtotal: Money };
  readonly total: Money;
}

/**
 * Cost of Revenue = ASSEMBLED coupled driver (§8): Direct Payroll (from Personnel's
 * Direct-function depts) + rate × revenue per stream. The rate is the only new input,
 * and is what the "Direct cost" scenario lever perturbs.
 */
export interface CostOfRevenueLine {
  readonly period: Month;
  readonly stream?: Stream;
  readonly directPayroll: Money;
  readonly nonEmployee: Money;
  readonly total: Money;
  /** non-employee cost-to-serve rate (% of stream revenue) — the swappable input */
  readonly rate: Percent;
}

export interface PersonnelForecastLine {
  readonly period: Month;
  readonly departmentId?: DepartmentId;
  readonly function?: CostFunction;
  readonly heads: number;
  /** base comp only; burden lives in the Employee Expenses OpEx group (§8) */
  readonly baseComp: Money;
}

export interface ExpenseForecastLine {
  readonly period: Month;
  readonly groupId?: ExpenseGroupId;
  readonly amount: Money;
}

export interface ArForecastLine {
  readonly period: Month;
  readonly dso: Days;
  readonly balance: Money;
}

export interface FixedAssetForecastLine {
  readonly period: Month;
  readonly capex: Money;
  readonly depreciation: Money;
  readonly netBookValue: Money;
}

export interface PrepaidsForecastLine {
  readonly period: Month;
  readonly additions: Money;
  readonly amortization: Money;
  readonly balance: Money;
}
