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
import { randomUUID } from "node:crypto";
import type { Month, PeriodRange } from "@/lib/types/period";
import { monthYear, month, parseMonth } from "@/lib/types/period";
import type { Money, Percent } from "@/lib/types/money";
import { subMoney, zeroMoney, percent } from "@/lib/types/money";
import type { ScenarioId, Stream, DepartmentId, ExpenseGroupId } from "@/lib/types/common";
import type {
  Scenario,
  ScenarioBaseline,
  ValidationResult,
  Adjustment,
  Magnitude,
  AdjustmentShape,
  AdjustmentWindow,
  LeverId,
} from "@/lib/types/scenario";
import type { PnL, PnLLine, PnLLineId } from "@/lib/types/statements";
import type { DashboardSummary, KpiTile } from "@/lib/types/dashboard";
import { getDataStore } from "@/lib/datastore";
import { allScenarios, findScenario, upsertUserScenario, deleteUserScenario } from "@/lib/scenario/registry";
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
  return (await allScenarios()).map((s) => ({
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
  const scenario = await findScenario(id);
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
  const scenario = await findScenario(id);
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
    const scenario = await findScenario(id);
    if (!scenario) continue;
    const dashboard = runScenario({ scenario, period, horizon }).dashboard;
    columns.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      isBase: scenario.adjustments.length === 0 && scenario.id === ("base" as ScenarioId),
      dashboard,
    });
  }
  return { period, columns };
}

/** Convenience: a single scenario's KPI tiles (the engine dashboard for one scenario). */
export async function getScenarioKpis(id: ScenarioId): Promise<readonly KpiTile[] | undefined> {
  const scenario = await findScenario(id);
  if (!scenario) return undefined;
  const { period, horizon } = await resolveContext();
  return runScenario({ scenario, period, horizon }).dashboard.families.flatMap((f) => f.tiles);
}

// ── writes (CLAUDE.md §9/§17) ─────────────────────────────────────────────────────────────
// The contained scenario WRITE surface: the spine the Scenario Manager/Drivers Server Actions AND
// Scout's write tools both call (one source, two callers). Every write goes through the registry's
// immutable-id guard (Base + presets are code constants — duplicate to edit) and validates against
// the LIVE forecast horizon before persisting. Containment: only USER scenarios in scenario_inputs
// change; Base/actuals are never touched.

const newScenarioId = (): ScenarioId => randomUUID() as ScenarioId;

/** The outcome of a scenario write — never throws to the caller; surfaces a friendly error instead. */
export interface ScenarioWriteResult {
  readonly ok: boolean;
  readonly scenarioId?: ScenarioId;
  readonly scenarioName?: string;
  readonly error?: string;
  /** present on setScenarioDriver — the engine validation verdict (ok=false carries the first issue). */
  readonly validation?: ValidationResult;
}

/** A typed driver input (the Scout/UI-agnostic shape). Magnitude meaning is lever-dependent, §9. */
export interface DriverInput {
  readonly lever: LeverId;
  /** window start, YYYY-MM */
  readonly start: string;
  /** optional window end, YYYY-MM (omit to run start-through-horizon) */
  readonly end?: string;
  readonly shape?: AdjustmentShape;
  /** % for rate levers (revenue/direct_cost), $/mo delta for level (personnel/expense), days for absolute (ar_dso/ap_dpo); ignored for a freeze */
  readonly magnitude?: number;
  // lever sub-dimensions
  readonly stream?: Stream; // revenue
  readonly departmentId?: string; // personnel (optional — omit for all departments)
  readonly freeze?: boolean; // personnel hiring freeze (categorical)
  readonly groupId?: string; // expense
}

/** Create an empty user scenario (baseline defaults to Base). */
export async function createScenario(name: string, baseline: ScenarioBaseline = "base"): Promise<ScenarioWriteResult> {
  const nm = name.trim();
  if (!nm) return { ok: false, error: "a scenario name is required" };
  const id = newScenarioId();
  await upsertUserScenario({ id, name: nm, baseline, adjustments: [] });
  return { ok: true, scenarioId: id, scenarioName: nm };
}

/** Duplicate any scenario (Base, a preset, or a user one) into a fresh, editable user scenario. */
export async function duplicateScenario(sourceId: ScenarioId, name?: string): Promise<ScenarioWriteResult> {
  const src = await findScenario(sourceId);
  if (!src) return { ok: false, error: `no scenario "${sourceId}" — list ids with getScenarios` };
  const id = newScenarioId();
  // Fresh per-adjustment ids — preset adjustment ids ("p25-freeze") are not globally unique.
  const adjustments: Adjustment[] = src.adjustments.map((a) => ({ ...a, id: randomUUID() }));
  const nm = name?.trim() || `${src.name} (copy)`;
  await upsertUserScenario({ id, name: nm, baseline: src.baseline, adjustments });
  return { ok: true, scenarioId: id, scenarioName: nm };
}

/** Clear a user scenario's adjustments (reset to its baseline). Rejects Base/presets. */
export async function resetScenario(id: ScenarioId): Promise<ScenarioWriteResult> {
  const sc = await findScenario(id);
  if (!sc) return { ok: false, error: `no scenario "${id}"` };
  try {
    await upsertUserScenario({ ...sc, adjustments: [] });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, scenarioId: id, scenarioName: sc.name };
}

/** Delete a user scenario. Rejects Base/presets. */
export async function deleteScenario(id: ScenarioId): Promise<ScenarioWriteResult> {
  const sc = await findScenario(id);
  try {
    await deleteUserScenario(id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, scenarioId: id, scenarioName: sc?.name };
}

/** The magnitude, DERIVED from the lever (the kind is coupled to the lever — §9 / the Drivers form). */
function magnitudeFor(lever: LeverId, value: number, freeze?: boolean): Magnitude {
  switch (lever) {
    case "expense":
      return { kind: "level", delta: value };
    case "ar_dso":
    case "ap_dpo":
      return { kind: "absolute", value, unit: "days" };
    case "personnel":
      return freeze ? { kind: "categorical", value: "freeze" } : { kind: "level", delta: value };
    case "revenue":
    case "direct_cost":
    default:
      return { kind: "rate", value: percent(value / 100) }; // 25 → +25%
  }
}

/** Build one typed Adjustment from a DriverInput (throws on a malformed month → caught by the caller). */
function buildAdjustment(input: DriverInput): Adjustment {
  const id = randomUUID();
  const shape: AdjustmentShape = input.shape === "ramp" ? "ramp" : "step";
  const start = parseMonth(input.start.trim());
  const window: AdjustmentWindow = { start, ...(input.end?.trim() ? { end: parseMonth(input.end.trim()) } : {}) };
  const magnitude = magnitudeFor(input.lever, input.magnitude ?? 0, input.freeze);
  const base = { id, magnitude, window, shape };
  switch (input.lever) {
    case "personnel":
      return { ...base, lever: "personnel", ...(input.departmentId ? { departmentId: input.departmentId as DepartmentId } : {}) };
    case "expense":
      return { ...base, lever: "expense", groupId: (input.groupId ?? "") as ExpenseGroupId };
    case "direct_cost":
      return { ...base, lever: "direct_cost" };
    case "ar_dso":
      return { ...base, lever: "ar_dso" };
    case "ap_dpo":
      return { ...base, lever: "ap_dpo" };
    case "revenue":
    default:
      return { ...base, lever: "revenue", stream: (input.stream ?? "subscription") as Stream };
  }
}

/**
 * Add one driver adjustment to a user scenario (the engine "set a driver"). Validates the WHOLE
 * scenario (existing + the new adjustment) against the live horizon before persisting; rejects a
 * Base/preset id (duplicate first). Returns the validation verdict either way (ok=false → not saved).
 */
export async function setScenarioDriver(scenarioId: ScenarioId, input: DriverInput): Promise<ScenarioWriteResult> {
  const sc = await findScenario(scenarioId);
  if (!sc) return { ok: false, error: `no scenario "${scenarioId}" — list ids with getScenarios, or create one first` };
  let adjustment: Adjustment;
  try {
    adjustment = buildAdjustment(input);
  } catch (e) {
    return { ok: false, error: `could not read the driver: ${(e as Error).message}` };
  }
  const next: Scenario = { ...sc, adjustments: [...sc.adjustments, adjustment] };
  const { horizon } = await resolveContext();
  const validation = validateScenario(next, horizon);
  if (!validation.ok) {
    return { ok: false, scenarioId: sc.id, scenarioName: sc.name, error: validation.issues[0].message, validation };
  }
  try {
    await upsertUserScenario(next); // immutable id (Base/preset) throws → surfaced as an error
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, scenarioId: sc.id, scenarioName: sc.name, validation };
}
