/**
 * make-trial-balance — regenerate the committed sample trial balances from the CURRENT generator so the
 * shipped "contract" TB always matches the books (CLAUDE.md §16). The seed is recalibrated over time
 * (exec-comp / attrition / eng-org passes), so a committed snapshot drifts — and importing a stale TB
 * would show a FALSE reconciliation exception. Uses the same `sampleTrialBalanceCsv` the live Data
 * Import quick-import buttons use (lib/import/sample-tb.ts), so the files and the on-screen demos can
 * never diverge from the generator. importer-check guards the contract file against future drift.
 *
 *   trial_balance.csv             — the close-month TB (the contract; a clean re-import = a restatement)
 *   trial_balance_next-month.csv  — the next in-close month, clean → advances the as-of
 *   trial_balance_broken.csv      — a contradicting figure → a blocking "needs attention" exception
 *
 * Run: npx tsx scripts/make-trial-balance.ts
 */
process.env.DATASTORE = "in-memory";

import { writeFileSync } from "node:fs";
import { getCloseBoundary } from "@/lib/target/placeholder";
import { sampleTbFor } from "@/lib/import/sample-tb";
import { parseTrialBalanceCsv } from "@/lib/import/validate";

const close = getCloseBoundary().closeThrough;
console.log("Regenerating trial balances from the current generator:");
for (const [kind, file] of [["current", "trial_balance.csv"], ["next-month", "trial_balance_next-month.csv"], ["broken", "trial_balance_broken.csv"]] as const) {
  const { period, csv } = sampleTbFor(kind, close);
  writeFileSync(`import-templates/${file}`, csv);
  const rows = parseTrialBalanceCsv(csv).rows;
  const d = rows.reduce((s, r) => s + r.debit, 0), c = rows.reduce((s, r) => s + r.credit, 0);
  console.log(`  ${file.padEnd(30)} ${period}  Σdebit ${d.toFixed(2)} / Σcredit ${c.toFixed(2)} (Δ ${(d - c).toFixed(2)})`);
}
console.log("\n✓ wrote the contract TB + the next-month (advances) and broken (exception) demo samples.");
