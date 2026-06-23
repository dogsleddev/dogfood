/** Financial Statements (layer 3 — CLAUDE.md §8). First tap = peek pane (§6). */
import type { Month } from "@/lib/types/period";
import type {
  PnL,
  PnLLine,
  PnLLineId,
  MonthlyPnL,
  BudgetSnapshot,
  BalanceSheet,
  MonthlyBalanceSheet,
  CashFlow,
  MonthlyCashFlow,
  Runway,
  NonGaapReconciliation,
  CashBurnBridge,
} from "@/lib/types/statements";
import { usd, sumMoney } from "@/lib/types/money";
import { getDataStore } from "@/lib/datastore";
import { notImplemented, assertBaseScope, type ScenarioOpt } from "./util";

/**
 * Reads through the DataStore seam (§4 "Swap Don't Rewrite"); the InMemory store delegates to the
 * seed's tying-out reference impl, shared with getDashboardSummary so the surfaces tie out (one
 * source, two callers). A scenarioId is REJECTED (assertBaseScope) — the main P&L is always Base +
 * actuals; scenarios are contained to the Scenarios group (§9). Signatures unchanged from the
 * lib/target era.
 */
export async function getPnL(period: Month, opts: ScenarioOpt = {}): Promise<PnL> {
  assertBaseScope(opts, "getPnL");
  return getDataStore().getPnL(period);
}

/** Month-across-columns P&L for the fiscal year of `period` — the board-package reading view. */
export async function getMonthlyPnL(period: Month, opts: ScenarioOpt = {}): Promise<MonthlyPnL> {
  assertBaseScope(opts, "getMonthlyPnL");
  return getDataStore().getMonthlyPnL(period);
}

export async function getPnLLine(lineId: PnLLineId, period: Month, opts: ScenarioOpt = {}): Promise<PnLLine> {
  assertBaseScope(opts, "getPnLLine");
  const pnl = await getPnL(period);
  const line = pnl.lines.find((l) => l.id === lineId);
  if (!line) throw new Error(`unknown P&L line: ${lineId}`);
  return line;
}

// ── Budget = the locked snapshot of the layer-2 drivers (§8) ──
export async function getBudget(period: Month): Promise<BudgetSnapshot> {
  return getDataStore().getBudgetView(period);
}

export interface LockBudgetInput {
  /** lock the working forecast, or promote an approved scenario, into the Budget */
  readonly source: "base" | "scenario";
  readonly scenarioId?: string;
  readonly asOf: Month;
}

export async function lockBudget(input: LockBudgetInput): Promise<BudgetSnapshot> {
  if (input.source === "scenario") {
    // Promoting an approved scenario into the Budget freezes the scenario engine's P&L — deferred
    // with scenario-sourced locks. Freezing the current Base plan is the live path (§8, Chris 2026-06-22).
    return notImplemented("lockBudget(source=scenario)", { input });
  }
  return getDataStore().lockBudget({ asOf: input.asOf, sourcedFrom: "base" });
}

/** Reset the Budget to the default FY plan (re-freeze the current values) — the user-facing reset. */
export async function resetBudget(): Promise<BudgetSnapshot> {
  return getDataStore().resetBudget();
}

// ── Balance Sheet ──
export async function getBalanceSheet(period: Month, opts: ScenarioOpt = {}): Promise<BalanceSheet> {
  assertBaseScope(opts, "getBalanceSheet");
  return getDataStore().getBalanceSheet(period);
}

/** Month-across-columns Balance Sheet for the fiscal year of `period` — the board-package view. */
export async function getMonthlyBalanceSheet(period: Month, opts: ScenarioOpt = {}): Promise<MonthlyBalanceSheet> {
  assertBaseScope(opts, "getMonthlyBalanceSheet");
  return getDataStore().getMonthlyBalanceSheet(period);
}

// ── Cash Flow Forecast (indirect method) ──
export async function getCashFlow(period: Month, opts: ScenarioOpt = {}): Promise<CashFlow> {
  assertBaseScope(opts, "getCashFlow");
  return getDataStore().getCashFlow(period);
}

/** Month-across-columns Cash Flow for the fiscal year of `period` — the board-package view. */
export async function getMonthlyCashFlow(period: Month, opts: ScenarioOpt = {}): Promise<MonthlyCashFlow> {
  assertBaseScope(opts, "getMonthlyCashFlow");
  return getDataStore().getMonthlyCashFlow(period);
}

export async function getRunway(asOf: Month): Promise<Runway> {
  return getDataStore().getRunway(asOf);
}

// ── GAAP → non-GAAP reconciliation (SBC add-back + free cash flow), the way real SaaS reports ──
export async function getNonGaapReconciliation(period: Month): Promise<NonGaapReconciliation> {
  return getDataStore().getNonGaapReconciliation(period);
}

/**
 * The cash-burn bridge (§11): GAAP net loss → add-backs → the annual-prepay deferred-revenue inflow →
 * operating cash flow → free cash flow, plus the runway tile. Pure wiring over three existing spine
 * functions (one source, two callers — the Cash Flow callout + Scout). The bridge rows are the FY
 * cash-flow forecast figures (whole-FY26, tying to the Forecast column); the runway is TTM — callers
 * must label the window so the two frames are never conflated.
 */
export async function getCashBurnBridge(period: Month): Promise<CashBurnBridge> {
  const [cf, runway, nonGaap] = await Promise.all([
    getCashFlow(period),
    getRunway(period),
    getNonGaapReconciliation(period),
  ]);
  const fc = (id: string) => cf.lines.find((l) => l.id === id)?.values.forecast ?? usd(0);
  const dAndA = fc("depreciation");
  const sbc = fc("stock_based_comp");
  return {
    period,
    gaapNetIncome: fc("net_income"),
    dAndA,
    sbc,
    nonCashAddbacks: sumMoney([dAndA, sbc]),
    deferredRevenueInflow: fc("change_deferred_revenue"),
    otherWorkingCapital: sumMoney([fc("change_ar"), fc("change_ap"), fc("change_unbilled_wip"), fc("change_prepaids")]),
    operatingCashFlow: fc("operating_cash_flow"),
    capex: fc("capex"),
    freeCashFlow: fc("net_change_in_cash"),
    runway,
    gaapNetMargin: nonGaap.gaapNetMargin,
    nonGaapNetMargin: nonGaap.nonGaapNetMargin,
    freeCashFlowMargin: nonGaap.freeCashFlowMargin,
  };
}
