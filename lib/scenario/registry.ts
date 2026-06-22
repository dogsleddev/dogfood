/**
 * In-memory scenario registry (CLAUDE.md §9 — the contained `scenario_inputs` store, pre-Supabase).
 * Holds Base + the seed presets + any user-created scenarios. Mirrors the DataStore scenario seam
 * (listScenarios / getScenario / upsert / delete) so the Supabase swap is one file later (§4).
 *
 * This module is the single source of truth for "which scenarios exist". The read API
 * (lib/queries/scenarios.ts) reads through it and runs the engine over what it returns.
 */
import type { Scenario } from "@/lib/types/scenario";
import type { ScenarioId } from "@/lib/types/common";
import { PRESET_SCENARIOS, BASE_SCENARIO } from "./presets";

/** Base first, then the presets, then user scenarios (insertion order). */
const userScenarios = new Map<ScenarioId, Scenario>();

/** Base + presets + user scenarios, in display order. */
export function allScenarios(): readonly Scenario[] {
  return [BASE_SCENARIO, ...PRESET_SCENARIOS, ...userScenarios.values()];
}

export function findScenario(id: ScenarioId): Scenario | undefined {
  return allScenarios().find((s) => s.id === id);
}

/** Create / replace a user scenario. Base + presets are immutable here (duplicate them to edit). */
export function upsertUserScenario(scenario: Scenario): void {
  userScenarios.set(scenario.id, scenario);
}

export function deleteUserScenario(id: ScenarioId): void {
  userScenarios.delete(id);
}

/** Reset the user store (tests / a fresh session). */
export function resetUserScenarios(): void {
  userScenarios.clear();
}
