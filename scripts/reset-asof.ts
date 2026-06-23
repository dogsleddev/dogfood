/**
 * reset-asof — restore the global as-of to the §11 default (May 2026 closed, June in-close, Jul–Dec
 * forecast). The CSV importer advances the as-of on a clean new-month commit, and the seed loader is
 * upsert-IF-ABSENT for settings (a re-seed preserves an advanced as-of, by design), so this is the
 * explicit way to roll the close boundary back after a demo. Defaults to the Supabase backend (the
 * persisted store the app reads); override with DATASTORE=in-memory for a process-local reset.
 *
 * Run: npx tsx scripts/reset-asof.ts        (resets Supabase — the live store)
 */
process.env.DATASTORE = process.env.DATASTORE ?? "supabase";

import { getDataStore } from "@/lib/datastore";
import { month } from "@/lib/types/period";

async function main() {
  const store = getDataStore();
  await store.updateSettings({
    closeThrough: month(2026, 5),
    inCloseMonth: month(2026, 6),
    forecastHorizon: { start: month(2026, 7), end: month(2026, 12) },
  });
  const s = await store.getSettings();
  console.log(`\n✓ as-of reset (${process.env.DATASTORE}) → closed through ${s.closeThrough}, in close ${s.inCloseMonth}, forecast ${s.forecastHorizon.start}…${s.forecastHorizon.end}\n`);
}

main().catch((e) => { console.error("\n✗ reset-asof failed:", (e as Error).message, "\n"); process.exitCode = 1; });
