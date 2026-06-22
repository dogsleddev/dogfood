/**
 * The three seed-preset scenarios (CLAUDE.md §9). Each is a SAVED BUNDLE of time-bounded
 * adjustments a user could have built themselves from the typed lever set — presets, not part
 * of the model. They are editable/duplicable/ignorable; this file just ships sensible defaults.
 *
 * IMPORTANT containment fact: scenarios branch ONLY the forecast horizon (Bearing: Jul–Dec 2026,
 * ~57% of the fiscal year — Jan–May closed, June in close stay on Base). So a preset cannot
 * reshape the WHOLE fiscal year; it moves the headline KPIs in its named direction by reshaping
 * the forecast tail. The magnitudes below are tuned against the Base FY2026 leaves
 * (revenue ~$23.4M, operating income ~−$12.8M, ~−55% op margin) so each preset MOVES its target
 * KPI the right way (verified in scripts/scenario-check.ts), not to hit an exact number the
 * 6-month horizon can't reach.
 *
 * Every lever used is from the closed typed union — no free-form levers (§9).
 */
import { percent } from "@/lib/types/money";
import type { Month } from "@/lib/types/period";
import type { Scenario, Adjustment } from "@/lib/types/scenario";
import type { ScenarioId, DepartmentId, ExpenseGroupId } from "@/lib/types/common";

const sid = (s: string): ScenarioId => s as ScenarioId;
const dept = (s: string): DepartmentId => s as DepartmentId;
const grp = (s: string): ExpenseGroupId => s as ExpenseGroupId;

/** The forecast horizon the presets target (Bearing FY2026 tail — §11). Read from Settings at runtime. */
const HORIZON_START = "2026-07" as Month;
const HORIZON_END = "2026-12" as Month;

const fullWindow = { start: HORIZON_START, end: HORIZON_END };

/**
 * "25% Profit" — push the forecast tail toward profitability: cut discretionary opex hard, freeze
 * indirect hiring, trim the non-employee CoR rate, and lift subscription a little. Moves operating
 * income / operating margin UP sharply (toward break-even-and-better in the forecast tail).
 */
const PROFIT_25: Scenario = {
  id: sid("preset-25-profit"),
  name: "25% Profit",
  baseline: "budget",
  isPreset: true,
  adjustments: [
    // freeze G&A / R&D hiring (the biggest cost line) — hold indirect payroll flat at the Jul level
    { id: "p25-freeze", lever: "personnel", magnitude: { kind: "categorical", value: "freeze" }, window: fullWindow, shape: "step" },
    // cut S&M programs ~40% (−$0.75M/mo off the ~$0.31M… use the actual H2 run-rate ~$311K/mo)
    { id: "p25-sm", lever: "expense", groupId: grp("sales-marketing"), magnitude: { kind: "level", delta: -180_000 }, window: fullWindow, shape: "ramp" },
    // trim travel & admin
    { id: "p25-te", lever: "expense", groupId: grp("travel-entertainment"), magnitude: { kind: "level", delta: -40_000 }, window: fullWindow, shape: "step" },
    { id: "p25-admin", lever: "expense", groupId: grp("admin"), magnitude: { kind: "level", delta: -25_000 }, window: fullWindow, shape: "step" },
    // tighten the non-employee CoR rate 12% (better gross margin)
    { id: "p25-cor", lever: "direct_cost", magnitude: { kind: "rate", value: percent(-0.12) }, window: fullWindow, shape: "step" },
    // modest subscription upside (+8%)
    { id: "p25-sub", lever: "revenue", stream: "subscription", magnitude: { kind: "rate", value: percent(0.08) }, window: fullWindow, shape: "ramp" },
  ],
};

/**
 * "Capacity" — the services-capacity-constrained story (§11: implementation capacity gates ARR).
 * Add Professional Services + Support direct heads to expand delivery, ramp services revenue with
 * the new capacity, and let subscription follow (capacity-gated go-lives). Grows revenue + services
 * mix; deepens burn near-term (the capacity investment), so net burn rises and Rule of 40 leans on
 * growth. The honest tradeoff a CFO weighs.
 */
const CAPACITY: Scenario = {
  id: sid("preset-capacity"),
  name: "Capacity",
  baseline: "base",
  isPreset: true,
  adjustments: [
    // add PS delivery capacity (direct payroll +$220K/mo, ramped)
    { id: "cap-ps", lever: "personnel", departmentId: dept("professional-services"), magnitude: { kind: "level", delta: 220_000 }, window: fullWindow, shape: "ramp" },
    // add Support (direct) too
    { id: "cap-support", lever: "personnel", departmentId: dept("support"), magnitude: { kind: "level", delta: 90_000 }, window: fullWindow, shape: "ramp" },
    // services revenue expands with the new capacity (+28%, ramped)
    { id: "cap-svc", lever: "revenue", stream: "services", magnitude: { kind: "rate", value: percent(0.28) }, window: fullWindow, shape: "ramp" },
    // capacity-gated SaaS go-lives lift subscription (+10%, ramped, lagging the capacity add)
    { id: "cap-sub", lever: "revenue", stream: "subscription", magnitude: { kind: "rate", value: percent(0.10) }, window: { start: "2026-09" as Month, end: HORIZON_END }, shape: "ramp" },
    // more delivery → a bit more non-employee CoR (services pass-through)
    { id: "cap-cor", lever: "direct_cost", magnitude: { kind: "rate", value: percent(0.06) }, window: fullWindow, shape: "step" },
  ],
};

/**
 * "Breakeven" — steer the forecast tail toward net-income breakeven without the all-out cuts of the
 * 25%-profit case: freeze hiring, moderate S&M trim, small CoR-rate tightening, modest revenue lift.
 * Net income moves UP toward zero (in the forecast tail) more gently than 25% Profit.
 */
const BREAKEVEN: Scenario = {
  id: sid("preset-breakeven"),
  name: "Breakeven",
  baseline: "base",
  isPreset: true,
  adjustments: [
    { id: "be-freeze", lever: "personnel", magnitude: { kind: "categorical", value: "freeze" }, window: fullWindow, shape: "step" },
    { id: "be-sm", lever: "expense", groupId: grp("sales-marketing"), magnitude: { kind: "level", delta: -120_000 }, window: fullWindow, shape: "ramp" },
    { id: "be-cor", lever: "direct_cost", magnitude: { kind: "rate", value: percent(-0.08) }, window: fullWindow, shape: "step" },
    { id: "be-sub", lever: "revenue", stream: "subscription", magnitude: { kind: "rate", value: percent(0.05) }, window: fullWindow, shape: "ramp" },
    // collect faster to help cash/runway (DSO 45 → 35)
    { id: "be-dso", lever: "ar_dso", magnitude: { kind: "absolute", value: 35, unit: "days" }, window: fullWindow, shape: "step" },
  ],
};

/** The seed presets, in display order. Each is a coherent stack from the typed lever set. */
export const PRESET_SCENARIOS: readonly Scenario[] = [PROFIT_25, CAPACITY, BREAKEVEN];

/** Look up a preset by id. */
export function getPresetScenario(id: ScenarioId): Scenario | undefined {
  return PRESET_SCENARIOS.find((s) => s.id === id);
}

/** The Base scenario (no adjustments) — the working forecast every surface defaults to (§9). */
export const BASE_SCENARIO: Scenario = {
  id: sid("base"),
  name: "Base",
  baseline: "base",
  adjustments: [],
};

/** Adjustment count helper for the manager list view. */
export function adjustmentCount(s: Scenario): number {
  return s.adjustments.length;
}

export type { Adjustment };
