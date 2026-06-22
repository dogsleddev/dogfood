"use server";
/**
 * Flux-note write actions for the Account Mapping / trial-balance account grain (flux-analysis.md).
 * A note here anchors to (accountCode, period) — the trial-balance account in the close period. The
 * query denormalizes the statement line from Account Mapping at write, so an account note ALSO rolls
 * up into the P&L / BS / CF peek pane for whichever line the account maps to. Same write path as the
 * P&L pane and the Expense register; only the revalidated path differs.
 */
import { revalidatePath } from "next/cache";
import { addFluxNote, resolveFluxNote, deleteFluxNote, setAccountOverride, clearAccountOverride } from "@/lib/queries";
import type { Month } from "@/lib/types/period";

const PATH = "/setup/account-mapping";

// A re-point moves the ACTUAL columns on every statement that rolls up through the map (§17). Revalidate
// the account-mapping page itself plus the three statements + the board package (its monthly board views
// read the override-aware cells). The Dashboard reads Budget/Forecast, not Actual, so it is unaffected.
function revalidateMappingSurfaces() {
  for (const p of ["/setup/account-mapping", "/statements/pnl", "/statements/balance-sheet", "/statements/cash-flow", "/board-package"]) {
    revalidatePath(p);
  }
}

/** Re-point an account's statement line (the override layer). Validated + merged by the query layer. */
export async function setAccountLineAction(formData: FormData): Promise<void> {
  const code = String(formData.get("accountCode") ?? "");
  const statementLineId = String(formData.get("statementLineId") ?? "");
  if (!code || !statementLineId) return;
  await setAccountOverride(code, { statementLineId }); // throws on an incoherent re-point; surfaced to the user
  revalidateMappingSurfaces();
}

/** Edit an expense account's descriptive classification / function tags (number-neutral metadata). */
export async function setAccountTagsAction(formData: FormData): Promise<void> {
  const code = String(formData.get("accountCode") ?? "");
  if (!code) return;
  const delta: { classification?: string; function?: string } = {};
  const cls = formData.get("classification");
  const fn = formData.get("function");
  if (cls) delta.classification = String(cls);
  if (fn) delta.function = String(fn);
  if (!delta.classification && !delta.function) return;
  await setAccountOverride(code, delta);
  revalidateMappingSurfaces();
}

/** Reset an account to its default (immutable-chart) mapping — clears the whole override. */
export async function resetAccountMappingAction(formData: FormData): Promise<void> {
  const code = String(formData.get("accountCode") ?? "");
  if (!code) return;
  await clearAccountOverride(code);
  revalidateMappingSurfaces();
}

export async function addAccountFluxNoteAction(formData: FormData): Promise<void> {
  const accountCode = String(formData.get("accountCode") ?? "");
  const period = String(formData.get("period") ?? "") as Month;
  const body = String(formData.get("body") ?? "").trim();
  const resolved = formData.get("resolved") === "on";
  if (!accountCode || !period || !body) return;
  await addFluxNote({ anchor: { accountCode, period }, body, resolved, source: "ui" });
  revalidatePath(PATH);
}

export async function resolveAccountFluxNoteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await resolveFluxNote(id, String(formData.get("resolved")) === "true");
  revalidatePath(PATH);
}

export async function deleteAccountFluxNoteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteFluxNote(id);
  revalidatePath(PATH);
}
