"use server";
/**
 * Flux line-note write actions for the Balance Sheet peek pane (flux-analysis.md). A line note anchors
 * to (statementLine, period) — the headline explanation for a line in the close period. Same write
 * path as the P&L pane and the Expense register; only the revalidated path differs.
 */
import { revalidatePath } from "next/cache";
import { addFluxNote, resolveFluxNote, deleteFluxNote } from "@/lib/queries";
import type { Month } from "@/lib/types/period";

const PATH = "/statements/balance-sheet";

export async function addLineFluxNoteAction(formData: FormData): Promise<void> {
  const statementLine = String(formData.get("statementLine") ?? "");
  const period = String(formData.get("period") ?? "") as Month;
  const body = String(formData.get("body") ?? "").trim();
  const resolved = formData.get("resolved") === "on";
  if (!statementLine || !period || !body) return;
  await addFluxNote({ anchor: { statementLine, period }, body, resolved, source: "ui" });
  revalidatePath(PATH);
}

export async function resolveBsFluxNoteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await resolveFluxNote(id, String(formData.get("resolved")) === "true");
  revalidatePath(PATH);
}

export async function deleteBsFluxNoteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteFluxNote(id);
  revalidatePath(PATH);
}
