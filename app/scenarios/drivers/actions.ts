"use server";
/**
 * Scenario Drivers write actions (CLAUDE.md §9): add / remove an adjustment. Mirrors the flux write
 * pattern; routes through lib/scenario/registry (the immutable-id guard) and validates the result
 * against the LIVE forecast horizon (from Settings, not the preset constants) BEFORE saving. On any
 * bad input — a validation failure, a malformed month, an unknown lever, or a crafted immutable-id
 * POST — it surfaces the issue via ?error= and never 500s. Containment: every path stays in /scenarios/*.
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

/** True for Next's redirect()/notFound() control-flow throws (re-throw these, don't treat as errors). */
function isRedirectError(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "digest" in e &&
    typeof (e as { digest: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * The magnitude, DERIVED from the lever — the kind is coupled to the lever, not a free choice, so the
 * form can never produce a lever/kind pairing the engine silently no-ops (validation also rejects one,
 * for the hand-edited-JSONB path). Rate is entered as a percent (type 25 → +25%); Personnel is a $/mo
 * headcount delta unless "freeze" mode is chosen.
 */
function buildMagnitude(formData: FormData, lever: string): Magnitude {
  const raw = Number(String(formData.get("magnitudeValue") ?? "0"));
  const n = Number.isFinite(raw) ? raw : 0;
  switch (lever) {
    case "expense":
      return { kind: "level", delta: n };
    case "ar_dso":
    case "ap_dpo":
      return { kind: "absolute", value: n, unit: "days" };
    case "personnel":
      return formData.get("personnelMode") === "freeze"
        ? { kind: "categorical", value: "freeze" }
        : { kind: "level", delta: n };
    case "revenue":
    case "direct_cost":
    default:
      return { kind: "rate", value: percent(n / 100) };
  }
}

/** Reconstruct one typed Adjustment from the Add form — the encode-side twin of the read deserializer. */
function buildAdjustmentFromForm(formData: FormData): Adjustment {
  const id = randomUUID();
  const shape: AdjustmentShape = formData.get("shape") === "ramp" ? "ramp" : "step";
  const start = parseMonth(String(formData.get("start") ?? "").trim()); // throws on a bad month → caught
  const endRaw = String(formData.get("end") ?? "").trim();
  const window: AdjustmentWindow = { start, ...(endRaw ? { end: parseMonth(endRaw) } : {}) };
  const lever = String(formData.get("lever") ?? "");
  const base = { id, magnitude: buildMagnitude(formData, lever), window, shape };
  switch (lever) {
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
  try {
    const next: Scenario = { ...sc, adjustments: [...sc.adjustments, buildAdjustmentFromForm(formData)] };
    const { forecastHorizon } = await getDataStore().getSettings();
    const result = validateScenario(next, forecastHorizon);
    if (!result.ok) {
      redirect(`${PATH}?scenario=${scenarioId}&error=${encodeURIComponent(result.issues[0].message)}`);
    }
    await upsertUserScenario(next); // immutable ids (a crafted preset POST) throw → caught below
  } catch (e) {
    if (isRedirectError(e)) throw e; // re-throw Next's redirect sentinel — it is control flow, not an error
    redirect(`${PATH}?scenario=${scenarioId}&error=${encodeURIComponent((e as Error).message || "could not add the adjustment")}`);
  }
  revalidatePath("/scenarios", "layout"); // refresh the whole contained group (manager counts + compare)
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
  revalidatePath("/scenarios", "layout");
}
