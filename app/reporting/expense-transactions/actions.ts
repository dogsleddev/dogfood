"use server";
/**
 * Flux-note write actions for the Expense Transactions register (flux-analysis.md).
 * Server Actions invoked from <form action={…}> — the first user-write path. Each forwards to the
 * lib/queries flux write (which routes through the DataStore seam) then revalidates the register.
 */
import { revalidatePath } from "next/cache";
import { addFluxNote, resolveFluxNote, deleteFluxNote } from "@/lib/queries";

const PATH = "/reporting/expense-transactions";

export async function addFluxNoteAction(formData: FormData): Promise<void> {
  const transactionId = String(formData.get("transactionId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const resolved = formData.get("resolved") === "on";
  if (!transactionId || !body) return; // empty submit — no-op, don't error the page
  await addFluxNote({ anchor: { transactionId }, body, resolved, source: "ui" });
  revalidatePath(PATH);
}

export async function resolveFluxNoteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await resolveFluxNote(id, String(formData.get("resolved")) === "true");
  revalidatePath(PATH);
}

export async function deleteFluxNoteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await deleteFluxNote(id);
  revalidatePath(PATH);
}
