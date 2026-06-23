"use server";
/**
 * Data Import Server Actions (CLAUDE.md §16). Import a trial balance — from an uploaded file, a pasted
 * CSV, or a built-in demo sample — through the importer orchestrator (parse → validate → reconcile →
 * commit). A clean reconcile of the next in-close month advances the GLOBAL as-of, so the whole app
 * re-renders against the new boundary; hence the layout-wide revalidation. No client JS (native form).
 */
import { revalidatePath } from "next/cache";
import { getDataStore } from "@/lib/datastore";
import { runTrialBalanceImport } from "@/lib/queries/import";
import { sampleTbFor, type SampleTbKind } from "@/lib/import/sample-tb";

export async function importTrialBalanceAction(formData: FormData): Promise<void> {
  let csv = "";

  const sample = formData.get("sample");
  if (sample) {
    const settings = await getDataStore().getSettings();
    csv = sampleTbFor(String(sample) as SampleTbKind, settings.closeThrough).csv;
  } else {
    const file = formData.get("tb");
    if (file && typeof file === "object" && "text" in file && (file as File).size > 0) {
      csv = await (file as File).text();
    } else {
      csv = String(formData.get("tbText") ?? "");
    }
  }
  if (!csv.trim()) return;

  try {
    await runTrialBalanceImport(csv);
  } catch (e) {
    // A store-layer failure (constraint / RLS / transient network on Supabase) must surface as a clean
    // rejected outcome, not an unhandled 500. Best-effort record; if even that write throws, swallow so
    // the page still renders. The in-memory backend never reaches here.
    try {
      await getDataStore().recordImportRun({
        kind: "trial_balance",
        period: "—",
        status: "rejected",
        advancedAsOf: false,
        unreconciledTotal: 0,
        note: `Import failed: ${(e as Error).message}`,
      });
    } catch {
      /* audit write also failed — nothing more we can do; the page re-renders with the prior state */
    }
  }
  // The as-of is global — a committed advance re-renders every surface. Revalidate the whole app.
  revalidatePath("/", "layout");
}
