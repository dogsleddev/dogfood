"use server";
/**
 * Scenario Manager write actions (CLAUDE.md §9). Server Actions invoked from <form action={…}>,
 * mirroring the flux write pattern (FormData in, registry write, revalidate). ALL writes go through
 * lib/scenario/registry (upsert/deleteUserScenario), whose isImmutable() guard is the only thing
 * stopping a user from shadowing Base or a preset — so never call getDataStore() directly here.
 * Base + presets stay code-defined; only USER scenarios persist. Containment: paths stay in /scenarios/*.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ScenarioId } from "@/lib/types/common";
import type { Adjustment, ScenarioBaseline } from "@/lib/types/scenario";
import { findScenario, upsertUserScenario, deleteUserScenario } from "@/lib/scenario/registry";

const MANAGER = "/scenarios/manager";
const DRIVERS = "/scenarios/drivers";

const newId = (): ScenarioId => randomUUID() as ScenarioId;

export async function createScenarioAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const baseline: ScenarioBaseline = formData.get("baseline") === "budget" ? "budget" : "base";
  if (!name) return; // empty submit — no-op, don't error the page
  const id = newId();
  await upsertUserScenario({ id, name, baseline, adjustments: [] });
  revalidatePath(MANAGER);
  redirect(`${DRIVERS}?scenario=${id}`); // land on what you just made
}

export async function duplicateScenarioAction(formData: FormData): Promise<void> {
  const sourceId = String(formData.get("sourceId") ?? "") as ScenarioId;
  if (!sourceId) return;
  const src = await findScenario(sourceId); // resolves Base, a preset, or a user scenario
  if (!src) return;
  const id = newId();
  // Fresh per-adjustment ids — preset adjustment ids ("p25-freeze") are not globally unique.
  const adjustments: Adjustment[] = src.adjustments.map((a) => ({ ...a, id: randomUUID() }));
  await upsertUserScenario({ id, name: `${src.name} (copy)`, baseline: src.baseline, adjustments });
  revalidatePath(MANAGER);
  redirect(`${DRIVERS}?scenario=${id}`);
}

export async function deleteScenarioAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "") as ScenarioId;
  if (!id) return;
  try {
    await deleteUserScenario(id); // throws on Base/preset → degrade to a no-op, never 500 the page
  } catch {
    return;
  }
  revalidatePath(MANAGER);
}

export async function resetScenarioAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "") as ScenarioId;
  if (!id) return;
  const sc = await findScenario(id);
  if (!sc) return;
  try {
    // Reset a USER scenario = clear ITS adjustments (NOT registry.resetUserScenarios — that wipes all).
    await upsertUserScenario({ ...sc, adjustments: [] });
  } catch {
    return;
  }
  revalidatePath(MANAGER);
}
