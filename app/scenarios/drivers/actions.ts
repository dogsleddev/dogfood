"use server";
/**
 * Scenario Drivers write actions (CLAUDE.md §9): add / remove an adjustment. Mirrors the flux write
 * pattern; routes through lib/scenario/registry (the immutable-id guard) and validates the result
 * against the LIVE forecast horizon (from Settings, not the preset constants) BEFORE saving. On a
 * validation failure it surfaces the issue via ?error= rather than silently dropping the input.
 * Containment: every path stays within /scenarios/*.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMonth } from "@/lib/types/period";
import { percent } from "@/lib/types/money";
import type { ScenarioId, DepartmentId, ExpenseGroupId, Stream } from "@/lib/types/common";
import type { Adjustment, Magnitude, Scenario, AdjustmentShape, AdjustmentWindow } from "@/lib/types/scenario";
import { findScenario, upsertUserScenario } from "@/lib/scenario/registry";
import { validateScenario } from "@/lib/scenario/validation";
import { getDataStore } from "@/lib/datastore";

const PATH = "/scenarios/drivers";

/** The magnitude, by kind. Rate is entered as a percent (user types 25 → +25% → percent(0.25)). */
function buildMagnitude(formData: FormData): Magnitude {
  const kind = String(formData.get("magnitudeKind") ?? "rate");
  const raw = Number(String(formData.get("magnitudeValue") ?? "0"));
  const n = Number.isFinite(raw) ? raw : 0;
  switch (kind) {
    case "level": return { kind: "level", delta: n };
    case "absolute": return { kind: "absolute", value: n, unit: "days" };
    case "categorical": return { kind: "categorical", value: "freeze" };
    case "rate":
    default: return { kind: "rate", value: percent(n / 100) };
  }
}

/** Reconstruct one typed Adjustment from the Add form — the encode-side twin of the read deserializer. */
function buildAdjustmentFromForm(formData: FormData): Adjustment {
  const id = randomUUID();
  const shape: AdjustmentShape = formData.get("shape") === "ramp" ? "ramp" : "step";
  const start = parseMonth(String(formData.get("start") ?? "").trim());
  const endRaw = String(formData.get("end") ?? "").trim();
  const window: AdjustmentWindow = { start, ...(endRaw ? { end: parseMonth(endRaw) } : {}) };
  const base = { id, magnitude: buildMagnitude(formData), window, shape };
  switch (String(formData.get("lever") ?? "")) {
    case "personnel": {
      const d = String(formData.get("departmentId") ?? "").trim();
      return { ...base, lever: "personnel", ...(d ? { departmentId: d as DepartmentId } : {}) };
    }
    case "expense": return { ...base, lever: "expense", groupId: String(formData.get("groupId") ?? "") as ExpenseGroupId };
    case "direct_cost": return { ...base, lever: "direct_cost" };
    case "ar_dso": return { ...base, lever: "ar_dso" };
    case "revenue":
    default: return { ...base, lever: "revenue", stream: String(formData.get("stream") ?? "subscription") as Stream };
  }
}

export async function addAdjustmentAction(formData: FormData): Promise<void> {
  const scenarioId = String(formData.get("scenarioId") ?? "") as ScenarioId;
  if (!scenarioId) return;
  const sc = await findScenario(scenarioId);
  if (!sc) return;
  const next: Scenario = { ...sc, adjustments: [...sc.adjustments, buildAdjustmentFromForm(formData)] };
  const { forecastHorizon } = await getDataStore().getSettings();
  const result = validateScenario(next, forecastHorizon);
  if (!result.ok) {
    redirect(`${PATH}?scenario=${scenarioId}&error=${encodeURIComponent(result.issues[0].message)}`);
  }
  await upsertUserScenario(next); // throws on Base/preset — but the Add form is hidden for those
  revalidatePath(PATH);
  redirect(`${PATH}?scenario=${scenarioId}`); // clear any prior ?error and refresh
}

export async function removeAdjustmentAction(formData: FormData): Promise<void> {
  const scenarioId = String(formData.get("scenarioId") ?? "") as ScenarioId;
  const adjId = String(formData.get("adjId") ?? "");
  if (!scenarioId || !adjId) return;
  const sc = await findScenario(scenarioId);
  if (!sc) return;
  try {
    await upsertUserScenario({ ...sc, adjustments: sc.adjustments.filter((a) => a.id !== adjId) });
  } catch {
    return; // immutable scenario — no-op
  }
  revalidatePath(PATH);
}
