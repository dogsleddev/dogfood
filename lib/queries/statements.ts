/** Financial Statements (layer 3 — CLAUDE.md §8). First tap = peek pane (§6). */
import type { Month } from "@/lib/types/period";
import type {
  PnL,
  PnLLine,
  PnLLineId,
  MonthlyPnL,
  BudgetSnapshot,
  BalanceSheet,
  CashFlow,
  Runway,
  NonGaapReconciliation,
} from "@/lib/types/statements";
import { getDataStore } from "@/lib/datastore";
import { notImplemented, type ScenarioOpt } from "./util";

/**
 * Reads through the DataStore seam (§4 "Swap Don't Rewrite"); the InMemory store delegates to the
 * seed's tying-out reference impl, shared with getDashboardSummary so the surfaces tie out (one
 * source, two callers). scenarioId is ignored — the main P&L is always Base + actuals
 * (containment, §9). Signatures unchanged from the lib/target era.
 */
export async function getPnL(period: Month, _opts: ScenarioOpt = {}): Promise<PnL> {
  return getDataStore().getPnL(period);
}

/** Month-across-columns P&L for the fiscal year of `period` — the board-package reading view. */
export async function getMonthlyPnL(period: Month, _opts: ScenarioOpt = {}): Promise<MonthlyPnL> {
  return getDataStore().getMonthlyPnL(period);
}

export async function getPnLLine(lineId: PnLLineId, period: Month, _opts: ScenarioOpt = {}): Promise<PnLLine> {
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
  return notImplemented("lockBudget", { input });
}

// ── Balance Sheet ──
export async function getBalanceSheet(period: Month, _opts: ScenarioOpt = {}): Promise<BalanceSheet> {
  return getDataStore().getBalanceSheet(period);
}

// ── Cash Flow Forecast (indirect method) ──
export async function getCashFlow(period: Month, _opts: ScenarioOpt = {}): Promise<CashFlow> {
  return getDataStore().getCashFlow(period);
}

export async function getRunway(asOf: Month): Promise<Runway> {
  return getDataStore().getRunway(asOf);
}

// ── GAAP → non-GAAP reconciliation (SBC add-back + free cash flow), the way real SaaS reports ──
export async function getNonGaapReconciliation(period: Month): Promise<NonGaapReconciliation> {
  return getDataStore().getNonGaapReconciliation(period);
}
