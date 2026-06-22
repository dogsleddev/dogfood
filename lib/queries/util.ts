/**
 * lib/queries/ — THE query spine (CLAUDE.md §4). The ONLY way anything reads financial
 * data, consumed by BOTH the module UI and Scout (one source, two callers). Every
 * function here has a typed I/O contract; the output type is the basis a Scout tool's
 * result schema derives from (the Scout-ready bar, §4). Functions are pure + deterministic
 * with serializable I/O.
 *
 * Phase 0 ships SIGNATURES ONLY — bodies throw. No business numbers (kickoff-prompt.md).
 */
import type { ScenarioId, Stream } from "@/lib/types/common";

/** Optional scenario lens — accepted by driver/statement reads but APPLIED only inside
 *  the Scenarios group (containment, §9). Outside that group callers pass no scenarioId. */
export interface ScenarioOpt {
  readonly scenarioId?: ScenarioId;
}

export interface StreamOpt extends ScenarioOpt {
  readonly stream?: Stream;
}

export function notImplemented(fn: string, _ctx?: unknown): never {
  throw new Error(
    `${fn}() is a Harness spine signature with no implementation yet (CLAUDE.md §13 — built in the Run).`,
  );
}

/**
 * Containment guard (§9). The Base reads (Dashboard / Statements / Drivers) accept a ScenarioOpt for
 * signature symmetry but never APPLY it — the scenario lens lives ONLY inside the Scenarios group
 * (lib/queries/scenarios.ts + the engine), so these surfaces are always Base + actuals. A caller that
 * passes a scenarioId here would otherwise silently get Base back; reject it loudly instead, so the
 * (upcoming) Scout scenario-write surface can't quietly read Base when it means a hypothetical.
 */
export function assertBaseScope(opts: ScenarioOpt, fn: string): void {
  if (opts.scenarioId != null) {
    throw new Error(
      `${fn}() is a Base + actuals read and does not apply a scenario (containment, §9). ` +
        `For a contained scenario result use the Scenarios group (getScenarioPnL / compareScenarios); ` +
        `scenarioId "${opts.scenarioId}" is not valid here.`,
    );
  }
}
