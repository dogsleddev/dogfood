"use server";
/**
 * Flux line-note write actions for the P&L peek pane (flux-analysis.md). A line note anchors to
 * (statementLine, period) — the headline explanation for a line in the close period. Server Actions
 * from <form action>, the same write path as the Expense register's transaction notes.
 */
import { revalidatePath } from "next/cache";
import { addFluxNote, resolveFluxNote, deleteFluxNote, resetBudget } from "@/lib/queries";
import type { Month } from "@/lib/types/period";

const PATH = "/statements/pnl";

/**
 * Reset the Budget to the current FY plan (re-freeze) — §8 lock lifecycle (Chris 2026-06-22: freeze
 * current values, but resettable). The P&L Budget/Variance columns and the dashboard variance tiles
 * both read the same locked snapshot, so revalidate both.
 */
export async function resetBudgetAction(_formData: FormData): Promise<void> {
  await resetBudget();
  revalidatePath(PATH);
  revalidatePath("/dashboard");
}

export async function addLineFluxNoteAction(formData: FormData): Promise<void> {
  const statementLine = String(formData.get("statementLine") ?? "");
  const period = String(formData.get("period") ?? "") as Month;
  const body = String(formData.get("body") ?? "").trim();
  const resolved = formData.get("resolved") === "on";
  if (!statementLine || !period || !body) return;
  await addFluxNote({ anchor: { statementLine, period }, body, resolved, source: "ui" });
  revalidatePath(PATH);
}

export async function resolvePnlFluxNoteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await resolveFluxNote(id, String(formData.get("resolved")) === "true");
  revalidatePath(PATH);
}

export async function deletePnlFluxNoteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteFluxNote(id);
  revalidatePath(PATH);
}
