/**
 * Layer 3 — Statements: the tie-out (CLAUDE.md §5, §8).
 * Forecasted P&L carries Budget · Actual · Variance · Forecast columns (§8, PRD R1).
 * Variance is a column, never a module (§16).
 */
import type { Money, Percent } from "./money";
import type { Month, PeriodRange } from "./period";
import type { ScenarioId, StatementClassification } from "./common";

export type StatementColumn = "budget" | "actual" | "variance" | "forecast";

export type ColumnValues = Partial<Record<StatementColumn, Money>>;

/**
 * Peek behavior on the reading surfaces (CLAUDE.md §6, drilldowns-statements.svg):
 * - "peek": first tap opens the right-side pane, then "Open full ↗" navigates to the
 *    register (actual months → layer 1) or the driver (forecast months → layer 2).
 * - "pane_only": pure derived metric; the pane decomposes it into component lines,
 *    with no register/driver to open (the one exception to peek-then-navigate).
 */
export type FirstTap = "peek" | "pane_only";

/** The locked Forecasted P&L line set (§8). */
export type PnLLineId =
  | "subscription"
  | "services"
  | "total_revenue"
  | "direct_payroll"
  | "non_employee_cor"
  | "total_cor"
  | "gross_profit"
  | "indirect_payroll"
  | "employee_expenses"
  | "sales_marketing"
  | "travel_entertainment"
  | "it"
  | "hr"
  | "admin"
  | "facilities"
  | "insurance"
  | "stock_based_comp"
  | "depreciation_amortization"
  | "total_opex"
  | "operating_income"
  | "interest_other"
  | "taxes"
  | "net_income";

/** Drives variance coloring: higher-is-better vs lower-is-better vs no color. */
export type LinePolarity = "positive" | "cost" | "neutral";

export interface PnLLine {
  readonly id: PnLLineId;
  readonly label: string;
  /** 0 = section total / headline, 1 = line, 2 = nested (e.g. dept within Indirect Payroll) */
  readonly level: 0 | 1 | 2;
  readonly classification?: StatementClassification;
  readonly firstTap: FirstTap;
  readonly values: ColumnValues;
  readonly polarity?: LinePolarity;
  /** present on the margin/headline lines (gross/operating/net margin %) */
  readonly marginPct?: Percent;
  readonly children?: readonly PnLLine[];
}

export interface PnL {
  readonly period: Month;
  /** headline label for the columns, e.g. "FY2026" */
  readonly label?: string;
  readonly scenarioId?: ScenarioId;
  readonly lines: readonly PnLLine[];
}

// ── Monthly (month-across-columns) P&L — the board-package view (P0 #3) ──

/** Where a month sits relative to the close boundary (drives actual/forecast styling). */
export type MonthStatus = "actual" | "in_close" | "forecast";

/** One month column in a monthly statement view. */
export interface MonthlyColumn {
  readonly month: Month;
  /** short header label, e.g. "Jan" */
  readonly label: string;
  readonly status: MonthStatus;
}

/**
 * A P&L line spread across the months of a fiscal year. Same line set + order as the FY {@link PnL}
 * (so the 8 OpEx groups stay broken out); `total` equals the FY P&L Forecast column by construction.
 */
export interface MonthlyPnLLine {
  readonly id: PnLLineId;
  readonly label: string;
  readonly level: 0 | 1 | 2;
  readonly classification?: StatementClassification;
  readonly polarity?: LinePolarity;
  readonly firstTap: FirstTap;
  readonly isSubtotal: boolean;
  /** one value per column in {@link MonthlyPnL.months}, aligned by index */
  readonly monthly: readonly Money[];
  /** fiscal-year total (= Σ monthly = the FY P&L Forecast column) */
  readonly total: Money;
  /** FY margin on the headline margin lines (gross/operating/net) */
  readonly marginPct?: Percent;
}

export interface MonthlyPnL {
  readonly period: Month;
  /** headline label, e.g. "FY2026" */
  readonly label?: string;
  readonly scenarioId?: ScenarioId;
  readonly months: readonly MonthlyColumn[];
  readonly lines: readonly MonthlyPnLLine[];
}

/** Budget = a frozen snapshot of the layer-2 drivers, taken at lock time (§8). */
export interface BudgetSnapshot {
  readonly lockedAt?: Month;
  readonly sourcedFrom: "base" | "scenario";
  readonly horizon: PeriodRange;
  readonly lines: readonly PnLLine[];
}

// ── Balance Sheet (indirect-method-friendly line set — drilldowns-statements.svg) ──

export type BalanceSheetLineId =
  | "cash"
  | "accounts_receivable"
  | "unbilled_wip" // contract asset
  | "prepaid_expenses"
  | "fixed_assets_net"
  | "rou_asset" // right-of-use asset (ASC 842 operating lease)
  | "deferred_revenue" // contract liability
  | "accounts_payable" // AP/DPO is now IN (built in the step-5 seed)
  | "lease_liability" // operating lease liability (ASC 842)
  | "paid_in_capital"
  | "accumulated_deficit";

export interface BalanceSheetLine {
  readonly id: BalanceSheetLineId;
  readonly label: string;
  readonly firstTap: FirstTap;
  readonly values: ColumnValues;
  /** asset / liability / equity grouping for section subtotals */
  readonly section: "asset" | "liability" | "equity";
  /** retained from the AP/DPO [OPEN] era; now always false (AP is locked IN) */
  readonly gated?: boolean;
}

export interface BalanceSheet {
  readonly period: Month;
  readonly scenarioId?: ScenarioId;
  readonly lines: readonly BalanceSheetLine[];
}

// ── Monthly (month-across-columns) Balance Sheet — the board-package view ──
/**
 * A balance-sheet line spread across the months of a fiscal year (month-END snapshot per column).
 * Same line set + order as the FY {@link BalanceSheet}; `total` is the FY-end balance (= the FY BS
 * Forecast column) — a point-in-time value, NOT a sum (the balance sheet is a snapshot, not a flow).
 */
export interface MonthlyBalanceSheetLine {
  readonly id: BalanceSheetLineId;
  readonly label: string;
  readonly firstTap: FirstTap;
  readonly section: "asset" | "liability" | "equity";
  /** one value per column in {@link MonthlyBalanceSheet.months} — the month-end balance */
  readonly monthly: readonly Money[];
  /** fiscal-year-end balance (= the FY Balance Sheet Forecast column) */
  readonly total: Money;
}

export interface MonthlyBalanceSheet {
  readonly period: Month;
  readonly label?: string;
  readonly scenarioId?: ScenarioId;
  readonly months: readonly MonthlyColumn[];
  readonly lines: readonly MonthlyBalanceSheetLine[];
}

// ── Cash Flow Forecast (indirect method — drilldowns-statements.svg) ──

export type CashFlowLineId =
  | "net_income"
  | "depreciation" // non-cash addback
  | "stock_based_comp" // non-cash addback (ASC 718)
  | "change_ar"
  | "change_deferred_revenue"
  | "change_unbilled_wip"
  | "change_prepaids"
  | "change_ap"
  | "operating_cash_flow" // subtotal
  | "capex"
  | "financing" // equity raises (Series B)
  | "net_change_in_cash"; // subtotal

export type CashFlowSection = "operating" | "investing" | "financing" | "total";

export interface CashFlowLine {
  readonly id: CashFlowLineId;
  readonly label: string;
  readonly firstTap: FirstTap;
  readonly values: ColumnValues;
  readonly section: CashFlowSection;
  /** true for subtotal/total rows (operating CF, net change) */
  readonly isSubtotal?: boolean;
}

export interface CashFlow {
  readonly period: Month;
  readonly scenarioId?: ScenarioId;
  readonly lines: readonly CashFlowLine[];
}

// ── Monthly (month-across-columns) Cash Flow — the board-package view ──
/**
 * A cash-flow line spread across the months of a fiscal year (the month's FLOW per column). Same line
 * set + order as the FY {@link CashFlow} (including the operating-CF and net-change subtotals); `total`
 * is Σ months = the FY Cash Flow Forecast column (flows sum; the working-capital deltas telescope).
 */
export interface MonthlyCashFlowLine {
  readonly id: CashFlowLineId;
  readonly label: string;
  readonly firstTap: FirstTap;
  readonly section: CashFlowSection;
  readonly isSubtotal: boolean;
  /** one value per column in {@link MonthlyCashFlow.months} — that month's flow */
  readonly monthly: readonly Money[];
  /** fiscal-year total (= Σ monthly = the FY Cash Flow Forecast column) */
  readonly total: Money;
}

export interface MonthlyCashFlow {
  readonly period: Month;
  readonly label?: string;
  readonly scenarioId?: ScenarioId;
  readonly months: readonly MonthlyColumn[];
  readonly lines: readonly MonthlyCashFlowLine[];
}

export interface Runway {
  readonly asOf: Month;
  readonly cash: Money;
  readonly netBurn: Money;
  /** months of runway; null when cash-flow positive (infinite runway) */
  readonly months: number | null;
}

/**
 * GAAP → non-GAAP reconciliation (the table every public SaaS company publishes alongside its
 * statements). The GAAP statements carry stock-based comp (ASC 718); the non-GAAP measures add it
 * back, and free cash flow is the cash-basis profitability headline. Investors read the non-GAAP /
 * FCF lines; GAAP net margin including SBC is expected to be the deepest of the three.
 */
export interface NonGaapReconciliation {
  readonly period: Month;
  readonly revenue: Money;
  readonly stockBasedComp: Money; // the add-back reconciling GAAP → non-GAAP
  readonly gaapOperatingIncome: Money;
  readonly gaapOperatingMargin: Percent;
  readonly nonGaapOperatingIncome: Money;
  readonly nonGaapOperatingMargin: Percent;
  readonly gaapNetIncome: Money;
  readonly gaapNetMargin: Percent;
  readonly nonGaapNetIncome: Money;
  readonly nonGaapNetMargin: Percent;
  readonly freeCashFlow: Money; // operating cash flow − capex
  readonly freeCashFlowMargin: Percent;
}
