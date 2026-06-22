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
