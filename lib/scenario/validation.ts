/**
 * Scenario validation (CLAUDE.md §9; contract in lib/types/scenario.ts).
 * Deterministic, pure. The engine rejects, per the typed ValidationCode union:
 *   end_before_start       window End precedes Start
 *   window_outside_horizon any window month falls outside the forecast horizon
 *   magnitude_out_of_range a slider past its lever limit
 *   lever_not_in_set       a lever / sub-dimension target outside the closed union
 *   lever_gated            a gated lever (AP▸DPO) used while it is still off (§17)
 */
import type { PeriodRange } from "@/lib/types/period";
import { compareMonth, monthsInRange } from "@/lib/types/period";
import type {
  Adjustment,
  Scenario,
  ValidationIssue,
  ValidationResult,
  LeverId,
} from "@/lib/types/scenario";
import { GATED_LEVERS } from "@/lib/types/scenario";

const ALL_LEVERS: ReadonlySet<LeverId> = new Set([
  "revenue",
  "personnel",
  "expense",
  "direct_cost",
  "ar_dso",
  "ap_dpo",
]);

/** Per-lever magnitude limits (sanity rails; tunable). Rate is a fraction (0.5 = ±50%). */
const RATE_LIMIT = 0.5; // revenue / direct_cost rate override, ±50%
const LEVEL_LIMIT = 5_000_000; // personnel / expense monthly $ delta, ±$5M
const DAYS_MIN = 0;
const DAYS_MAX = 180; // DSO/DPO absolute, 0–180 days

/** Validate one adjustment against the contract + horizon. Returns the issues it raises (may be 0). */
export function validateAdjustment(adj: Adjustment, horizon: PeriodRange): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // lever in the closed set
  if (!ALL_LEVERS.has(adj.lever)) {
    issues.push({ code: "lever_not_in_set", adjustmentId: adj.id, message: `unknown lever "${adj.lever}"` });
    return issues; // can't reason further about an unknown lever
  }
  // gated lever (AP▸DPO) while still off
  if (GATED_LEVERS.includes(adj.lever)) {
    issues.push({ code: "lever_gated", adjustmentId: adj.id, message: `lever "${adj.lever}" is gated (AP/DPO is off — §17)` });
  }

  // window sanity
  const { start, end } = adj.window;
  if (end && compareMonth(end, start) < 0) {
    issues.push({ code: "end_before_start", adjustmentId: adj.id, message: `window end ${end} precedes start ${start}` });
  } else {
    // window must sit inside the forecast horizon (every month of it)
    const win: PeriodRange = { start, end: end ?? horizon.end };
    const outside = monthsInRange(win).some(
      (mo) => compareMonth(mo, horizon.start) < 0 || compareMonth(mo, horizon.end) > 0,
    );
    if (outside) {
      issues.push({
        code: "window_outside_horizon",
        adjustmentId: adj.id,
        message: `window ${start}..${end ?? horizon.end} falls outside the forecast horizon ${horizon.start}..${horizon.end}`,
      });
    }
  }

  // magnitude range, by kind
  switch (adj.magnitude.kind) {
    case "rate":
      if (Math.abs(adj.magnitude.value) > RATE_LIMIT) {
        issues.push({ code: "magnitude_out_of_range", adjustmentId: adj.id, message: `rate ${adj.magnitude.value} exceeds ±${RATE_LIMIT}` });
      }
      break;
    case "level":
      if (Math.abs(adj.magnitude.delta) > LEVEL_LIMIT) {
        issues.push({ code: "magnitude_out_of_range", adjustmentId: adj.id, message: `level delta ${adj.magnitude.delta} exceeds ±${LEVEL_LIMIT}` });
      }
      break;
    case "absolute":
      if (adj.magnitude.value < DAYS_MIN || adj.magnitude.value > DAYS_MAX) {
        issues.push({ code: "magnitude_out_of_range", adjustmentId: adj.id, message: `${adj.magnitude.value} days outside ${DAYS_MIN}..${DAYS_MAX}` });
      }
      break;
    case "categorical":
      // "freeze" is the only categorical value (typed by the union) — nothing to range-check
      break;
  }

  return issues;
}

/** Validate a whole scenario (all its adjustments) against the horizon. */
export function validateScenario(scenario: Scenario, horizon: PeriodRange): ValidationResult {
  const issues = scenario.adjustments.flatMap((a) => validateAdjustment(a, horizon));
  return { ok: issues.length === 0, issues };
}

export { RATE_LIMIT, LEVEL_LIMIT, DAYS_MIN, DAYS_MAX };
