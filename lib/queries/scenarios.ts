/**
 * Scenarios — the contained read API (CLAUDE.md §9). The four Scenario surfaces (Manager, Drivers,
 * Scenario P&L, Scenario Dashboard) consume ONLY this. It reads the in-memory registry (Base +
 * presets + user scenarios) and runs the deterministic engine over each, comparing against the
 * chosen baseline (Base working forecast, or the locked Budget snapshot).
 *
 * Containment (§9): these reads APPLY the scenario lens; every OTHER spine read stays Base + actuals.
 * One source, two callers: the engine reuses the same Base leaf series the live P&L is built from,
 * so Scenario(Base) ties to the live surfaces exactly (the hard invariant).
 */
import type { Month, PeriodRange } from "@/lib/types/period";
import { monthYear, month } from "@/lib/types/period";
import type { Money, Percent } from "@/lib/types/money";
import { subMoney, zeroMoney } from "@/lib/types/money";
import type { ScenarioId } from "@/lib/types/common";
import type { Scenario, ScenarioBaseline, ValidationResult } from "@/lib/types/scenario";
import type { PnL, PnLLine, PnLLineId } from "@/lib/types/statements";
import type { DashboardSummary, KpiTile } from "@/lib/types/dashboard";
import { getDataStore } from "@/lib/datastore";
import { allScenarios, findScenario } from "@/lib/scenario/registry";
import { runScenario } from "@/lib/scenario/engine";
import { validateScenario } from "@/lib/scenario/validation";
import { buildSeedPnL } from "@/lib/seed/statements";

// ── shapes the pages depend on ──────────────────────────────────────────────────────────

/** A row in the Scenario Manager list. */
export interface ScenarioListItem {
  readonly id: ScenarioId;
  readonly name: string;
  readonly baseline: ScenarioBaseline;
  readonly adjustmentCount: number;
  readonly isPreset: boolean;
  readonly isBase: boolean;
}

/** A P&L line with the scenario value, the baseline value, and their delta. */
export interface ScenarioPnLLine {
  readonly id: PnLLineId;
  readonly label: string;
  readonly level: 0 | 1 | 2;
  readonly scenario: Money;
  readonly baseline: Money;
  readonly delta: Money;
  /** scenario margin % on the headline lines (gross/operating/net) */
  readonly marginPct?: Percent;
}

/** The contained Scenario P&L + the side-by-side comparison (Scenario P&L surface). */
export interface ScenarioPnLResult {
  readonly scenarioId: ScenarioId;
  readonly scenarioName: string;
  readonly period: Month;
  /** which baseline the scenario compares against (its own setting, overridable per request) */
  readonly comparedTo: ScenarioBaseline;
  readonly lines: readonly ScenarioPnLLine[];
}

/** One scenario's KPI column in the side-by-side dashboard. */
export interface ScenarioDashboardColumn {
  readonly scenarioId: ScenarioId;
  readonly scenarioName: string;
  readonly isBase: boolean;
  readonly dashboard: DashboardSummary;
}

/** The compare/board view: 2–3 scenarios' KPIs side by side (Scenario Dashboard surface). */
export interface ScenarioDashboardResult {
  readonly period: Month;
  readonly columns: readonly ScenarioDashboardColumn[];
}

// ── horizon / period resolution ──

async function resolveContext(): Promise<{ period: Month; horizon: PeriodRange }> {
  const settings = await getDataStore().getSettings();
  // The contained surfaces report the current fiscal year (the year the forecast tail lives in).
  const period = month(monthYear(settings.forecastHorizon.start), 6);
  return { period, horizon: settings.forecastHorizon };
}

// ── reads ───────────────────────────────────────────────────────────────────────────────

/** Base + the presets + user scenarios, as list rows (Scenario Manager). */
export async function listScenarios(): Promise<readonly ScenarioListItem[]> {
  return allScenarios().map((s) => ({
    id: s.id,
    name: s.name,
    baseline: s.baseline,
    adjustmentCount: s.adjustments.length,
    isPreset: s.isPreset === true,
    isBase: s.adjustments.length === 0 && s.id === ("base" as ScenarioId),
  }));
}

/** One scenario's full adjustment stack (Scenario Drivers). */
export async function getScenario(id: ScenarioId): Promise<Scenario | undefined> {
  return findScenario(id);
}

/** Validate a scenario's adjustments against the forecast horizon (Scenario Drivers gate). */
export async function validateScenarioById(id: ScenarioId): Promise<ValidationResult | undefined> {
  const scenario = findScenario(id);
  if (!scenario) return undefined;
  const { horizon } = await resolveContext();
  return validateScenario(scenario, horizon);
}

const lineMoney = (line: PnLLine): Money => line.values.forecast ?? zeroMoney();

/**
 * The contained Scenario P&L + comparison (Scenario P&L surface). `baseline` defaults to the
 * scenario's own setting; pass it to override (the version dropdown: Base vs Budget). The
 * comparison column is the Base forecast P&L (baseline "base") or the locked Budget snapshot
 * (baseline "budget").
 */
export async function getScenarioPnL(
  id: ScenarioId,
  baseline?: ScenarioBaseline,
): Promise<ScenarioPnLResult | undefined> {
  const scenario = findScenario(id);
  if (!scenario) return undefined;
  const { period, horizon } = await resolveContext();
  const comparedTo = baseline ?? scenario.baseline;

  const scenarioPnl: PnL = runScenario({ scenario, period, horizon }).pnl;
  const basePnl: PnL =
    comparedTo === "budget" ? budgetAsForecastPnl(await getDataStore().getBudgetView(period)) : buildSeedPnL(period);

  const baseLineById = new Map<PnLLineId, PnLLine>(basePnl.lines.map((l) => [l.id, l]));
  const lines: ScenarioPnLLine[] = scenarioPnl.lines.map((l) => {
    const baseLine = baseLineById.get(l.id);
    const scenarioVal = lineMoney(l);
    const baselineVal = baseLine ? lineMoney(baseLine) : zeroMoney();
    return {
      id: l.id,
      label: l.label,
      level: l.level,
      scenario: scenarioVal,
      baseline: baselineVal,
      delta: subMoney(scenarioVal, baselineVal),
      marginPct: l.marginPct,
    };
  });

  return { scenarioId: scenario.id, scenarioName: scenario.name, period, comparedTo, lines };
}

/** Treat a Budget snapshot's lines as a comparison P&L (its forecast column is the locked plan). */
function budgetAsForecastPnl(budget: { lines: readonly PnLLine[] }): PnL {
  // The Budget snapshot stores the same PnLLine[]; its BUDGET column is the locked plan we compare to.
  const lines = budget.lines.map((l) => ({
    ...l,
    values: { forecast: l.values.budget ?? l.values.forecast ?? zeroMoney() },
  }));
  return { period: "" as Month, lines };
}

/**
 * 2–3 scenarios' dashboards side by side (Scenario Dashboard / compare surface). Pass scenario ids
 * (include "base" to anchor the comparison). Unknown ids are skipped.
 */
export async function getScenarioDashboard(ids: readonly ScenarioId[]): Promise<ScenarioDashboardResult> {
  const { period, horizon } = await resolveContext();
  const columns: ScenarioDashboardColumn[] = [];
  for (const id of ids) {
    const scenario = findScenario(id);
    if (!scenario) continue;
    const dashboard = runScenario({ scenario, period, horizon }).dashboard;
    columns.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      isBase: scenario.adjustments.length === 0,
      dashboard,
    });
  }
  return { period, columns };
}

/** Convenience: a single scenario's KPI tiles (the engine dashboard for one scenario). */
export async function getScenarioKpis(id: ScenarioId): Promise<readonly KpiTile[] | undefined> {
  const scenario = findScenario(id);
  if (!scenario) return undefined;
  const { period, horizon } = await resolveContext();
  return runScenario({ scenario, period, horizon }).dashboard.families.flatMap((f) => f.tiles);
}
