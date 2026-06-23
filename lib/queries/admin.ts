/**
 * Demo self-heal (CLAUDE.md §17). The public trial lets anyone add flux notes + build scenarios (both
 * contained — they never move Base/actuals), so the shared sandbox accumulates. resetDemo() reverts it
 * to the seed baseline: clears the user-write tables and resets the global as-of. Run on a schedule
 * (Vercel cron → /api/reset) and on demand from the admin "Reset demo" button.
 */
import { getDataStore } from "@/lib/datastore";
import { month } from "@/lib/types/period";

export interface ResetResult {
  scenarios: number;
  fluxNotes: number;
  overrides: number;
}

export async function resetDemo(): Promise<ResetResult> {
  const store = getDataStore();

  const scenarios = await store.listScenarios();
  for (const s of scenarios) await store.deleteScenario(s.id);

  const notes = await store.listFluxNotes();
  for (const n of notes) await store.deleteFluxNote(n.id);

  const overrides = await store.listAccountOverrides();
  for (const o of overrides) await store.clearAccountOverride(o.code);

  await store.resetBudget(); // re-freeze the default FY plan

  // reset the global as-of to the §11 default (May 2026 closed, June in close, Jul–Dec forecast)
  await store.updateSettings({
    closeThrough: month(2026, 5),
    inCloseMonth: month(2026, 6),
    forecastHorizon: { start: month(2026, 7), end: month(2026, 12) },
  });

  return { scenarios: scenarios.length, fluxNotes: notes.length, overrides: overrides.length };
}
