/**
 * Scenario store access (CLAUDE.md §9). The SINGLE source for "which scenarios exist": the
 * code-defined Base + presets, composed with the USER scenarios held in the DataStore (the contained
 * `scenario_inputs` store — InMemory now, Supabase later, §4). The read API (lib/queries/scenarios.ts)
 * and the write actions both go through here, so there is no second in-memory copy to drift out of sync.
 *
 * Base + presets are immutable code constants (§9 — presets are example bundles you duplicate to edit);
 * ONLY user-created scenarios persist in the store. So the DataStore's scenario methods manage user
 * scenarios exclusively, and an attempt to write a Base/preset id is rejected loudly.
 */
import type { Scenario } from "@/lib/types/scenario";
import type { ScenarioId } from "@/lib/types/common";
import { getDataStore } from "@/lib/datastore";
import { PRESET_SCENARIOS, BASE_SCENARIO, getPresetScenario } from "./presets";

const BASE_ID = "base" as ScenarioId;

/** True if `id` names an immutable code scenario (Base or a preset) — never a user scenario. */
function isImmutable(id: ScenarioId): boolean {
  return id === BASE_ID || getPresetScenario(id) !== undefined;
}

/** Base + presets (code) + user scenarios (store), in display order. */
export async function allScenarios(): Promise<readonly Scenario[]> {
  const userScenarios = await getDataStore().listScenarios();
  return [BASE_SCENARIO, ...PRESET_SCENARIOS, ...userScenarios];
}

/** Resolve any scenario id: Base, a preset, or a user scenario from the store. */
export async function findScenario(id: ScenarioId): Promise<Scenario | undefined> {
  if (id === BASE_ID) return BASE_SCENARIO;
  return getPresetScenario(id) ?? (await getDataStore().getScenario(id));
}

/**
 * Create / replace a USER scenario. Base + presets are immutable (duplicate them to a new id to edit),
 * so writing one of those ids throws rather than silently shadowing the code constant.
 */
export async function upsertUserScenario(scenario: Scenario): Promise<void> {
  if (isImmutable(scenario.id)) {
    throw new Error(`Cannot modify the immutable scenario "${scenario.id}" — duplicate it to a new id first.`);
  }
  await getDataStore().upsertScenario(scenario);
}

export async function deleteUserScenario(id: ScenarioId): Promise<void> {
  if (isImmutable(id)) {
    throw new Error(`Cannot delete the immutable scenario "${id}".`);
  }
  await getDataStore().deleteScenario(id);
}

/** Reset the user store (tests / a fresh session): remove every user scenario, leaving Base + presets. */
export async function resetUserScenarios(): Promise<void> {
  const store = getDataStore();
  const userScenarios = await store.listScenarios();
  await Promise.all(userScenarios.map((s) => store.deleteScenario(s.id)));
}
