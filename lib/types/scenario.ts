/**
 * The scenario contract (CLAUDE.md §9; diagrams/scenarios-budget.svg).
 * Scenarios are CONTAINED to the Scenarios group: no global state, no top-bar switcher.
 * Dynamic by design but a CLOSED typed contract — Harness DEFINES it in full here;
 * the Run BUILDS the engine + wires Scout's group-scoped tools.
 *
 * adjustment = lever (+ optional sub-dimension) + magnitude + window + shape.
 */
import type { Percent } from "./money";
import type { Month, PeriodRange } from "./period";
import type { ScenarioId, Stream, DepartmentId, ExpenseGroupId } from "./common";
import type { PnL } from "./statements";
import type { DashboardSummary } from "./dashboard";

/** The closed lever union — no free-form levers (§9). AP▸DPO is gated (see GATED_LEVERS). */
export type LeverId = "revenue" | "personnel" | "expense" | "direct_cost" | "ar_dso" | "ap_dpo";

/** Levers gated behind the still-open AP/DPO decision (§17). */
export const GATED_LEVERS: readonly LeverId[] = ["ap_dpo"];

/** The lever + its (typed, lever-specific) sub-dimension target. */
export type LeverTarget =
  | { readonly lever: "revenue"; readonly stream: Stream }
  | { readonly lever: "personnel"; readonly departmentId?: DepartmentId }
  | { readonly lever: "expense"; readonly groupId: ExpenseGroupId }
  | { readonly lever: "direct_cost" } // the Cost-of-Revenue rate / target margin
  | { readonly lever: "ar_dso" }
  | { readonly lever: "ap_dpo" };

/**
 * Magnitude semantics are lever-dependent (scenario-drivers.svg):
 * - rate: a % override applied IN-window (e.g. Revenue +25%, Expense +15%)
 * - level: a count/amount delta applied IN-window (e.g. Personnel +12 heads)
 * - absolute: a target with units, override IN-window (e.g. AR DSO 50 days)
 * - categorical: a named mode (e.g. Personnel hiring "freeze")
 */
export type Magnitude =
  | { readonly kind: "rate"; readonly value: Percent }
  | { readonly kind: "level"; readonly delta: number }
  | { readonly kind: "absolute"; readonly value: number; readonly unit: "days" }
  | { readonly kind: "categorical"; readonly value: "freeze" };

export type AdjustmentShape = "step" | "ramp";

/** Monthly granularity (locked, §9). End is optional — most run start-through-horizon. */
export interface AdjustmentWindow {
  readonly start: Month;
  readonly end?: Month;
}

export type Adjustment = LeverTarget & {
  readonly id: string;
  readonly magnitude: Magnitude;
  readonly window: AdjustmentWindow;
  readonly shape: AdjustmentShape;
};

/** Each scenario compares against either the working forecast or the locked plan (§9). */
export type ScenarioBaseline = "base" | "budget";

export interface Scenario {
  readonly id: ScenarioId;
  readonly name: string;
  readonly baseline: ScenarioBaseline;
  readonly adjustments: readonly Adjustment[];
  /** seed presets are editable starting points, not part of the model (§9) */
  readonly isPreset?: boolean;
}

/** Seed preset bundles that ship in the seed (§9) — labels only; contents lock in Harness. */
export const PRESET_SCENARIO_NAMES = ["25% Profit", "Capacity", "Breakeven"] as const;

/**
 * Composition / precedence (scenarios-budget.svg): when two adjustments hit the SAME
 * lever with overlapping windows, the LATER window overrides the earlier in the overlap;
 * separate levers compose independently. The engine must be deterministic about this.
 */
export const COMPOSITION_RULE = "later_window_overrides" as const;
export type CompositionRule = typeof COMPOSITION_RULE;

/** Validation rejections the engine must enforce (§9). */
export type ValidationCode =
  | "end_before_start"
  | "magnitude_out_of_range"
  | "magnitude_kind_mismatch" // a magnitude kind the lever can't apply (the engine would silently no-op it)
  | "lever_not_in_set"
  | "window_outside_horizon"
  | "lever_gated"; // AP▸DPO used while AP/DPO is still off

export interface ValidationIssue {
  readonly code: ValidationCode;
  readonly adjustmentId?: string;
  readonly message: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

/**
 * The deterministic engine contract (§9): ONE pure operation —
 * Base + the scenario's active adjustments for the period → re-derive layers 2–5
 * (Scenario P&L + Scenario Dashboard) only. Nothing outside the Scenarios group changes.
 * Built in the Run.
 */
export interface ScenarioEngineInput {
  readonly scenario: Scenario;
  readonly period: Month;
  readonly horizon: PeriodRange;
}

export interface ScenarioEngineResult {
  readonly scenarioId: ScenarioId;
  readonly pnl: PnL;
  readonly dashboard: DashboardSummary;
}

export type ScenarioEngine = (input: ScenarioEngineInput) => ScenarioEngineResult;
