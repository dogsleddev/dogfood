"use server";
/**
 * Flux-note write actions for the Account Mapping / trial-balance account grain (flux-analysis.md).
 * A note here anchors to (accountCode, period) — the trial-balance account in the close period. The
 * query denormalizes the statement line from Account Mapping at write, so an account note ALSO rolls
 * up into the P&L / BS / CF peek pane for whichever line the account maps to. Same write path as the
 * P&L pane and the Expense register; only the revalidated path differs.
 */
import { revalidatePath } from "next/cache";
import { addFluxNote, resolveFluxNote, deleteFluxNote } from "@/lib/queries";
import type { Month } from "@/lib/types/period";

const PATH = "/setup/account-mapping";

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
