/**
 * importer-check — the CSV importer gate (CLAUDE.md §16). Proves the parse + validate front door works
 * on Bearing's REAL trial balance (the standing tripwire: the shipped contract import-templates/
 * trial_balance.csv must foot to the penny and validate clean against the chart), and that the
 * validator catches a broken TB (unbalanced period, unknown account, both-sides-nonzero).
 *
 * Run: npx tsx scripts/importer-check.ts
 */
process.env.DATASTORE = "in-memory";

import { readFileSync } from "node:fs";
import { parseTrialBalanceCsv, validateTrialBalance } from "@/lib/import/validate";
import { reconcileSeedBooks, reconcile } from "@/lib/import/reconcile";
import { CHART_OF_ACCOUNTS, accountTrialBalanceAt, isDebitNormal } from "@/lib/seed/gl";
import { runTrialBalanceImport } from "@/lib/queries/import";
import { sampleTbFor } from "@/lib/import/sample-tb";
import { PLACEHOLDER_SETTINGS, getCloseBoundary, setCloseBoundary } from "@/lib/target/placeholder";
import { month, type Month } from "@/lib/types/period";

let fail = 0;
const ok = (b: boolean) => (b ? "PASS" : "FAIL");
function check(name: string, pass: boolean, detail = "") {
  if (!pass) fail++;
  console.log(`  ${ok(pass)}  ${name}${detail ? `  ${detail}` : ""}`);
}

const closePeriod = PLACEHOLDER_SETTINGS.closeThrough as Month;

console.log("\n===== IMPORTER-CHECK — parse + validate the real trial balance =====\n");

// ── 1. the real shipped trial_balance.csv parses, foots, and validates clean ──
const realCsv = readFileSync("import-templates/trial_balance.csv", "utf8");
const parsed = parseTrialBalanceCsv(realCsv);
const result = validateTrialBalance(parsed);

console.log("REAL trial_balance.csv (the contract — must be import-ready)");
check("parsed all 28 accounts", parsed.rows.length === 28, `${parsed.rows.length} rows`);
check("a quoted field with a comma parsed intact", parsed.rows.some((r) => r.accountName === "Fixed Assets, net"));
const may = result.footing.find((f) => f.period === closePeriod);
check(`${closePeriod} foots to the penny (Σdebit === Σcredit)`, !!may?.balanced, may ? `Σdebit ${may.debit.toFixed(2)} · Σcredit ${may.credit.toFixed(2)}` : "no close period");
check("validates clean — zero issues", result.ok, result.issues.map((i) => i.code).join(", ") || "(none)");
// the shipped contract MUST stay in sync with the generator — else importing it shows a false exception
// (the exact staleness this importer surfaced). A future seed recalibration → re-run make-trial-balance.
const genTb = accountTrialBalanceAt(closePeriod);
let contractDrift = 0;
for (const row of parsed.rows) {
  const a = CHART_OF_ACCOUNTS.find((x) => x.code === row.accountCode);
  if (!a) continue;
  const natural = isDebitNormal(a.accountType) ? row.debit - row.credit : row.credit - row.debit;
  contractDrift = Math.max(contractDrift, Math.abs(natural - (genTb.get(row.accountCode) ?? 0)));
}
check("the contract TB matches the current generator (no drift → no false exception)", contractDrift < 2, `max Δ $${contractDrift.toFixed(2)}  ${contractDrift < 2 ? "" : "→ run scripts/make-trial-balance.ts"}`);

// ── 2. a broken TB lights up the right issues ──
console.log("\nBROKEN trial_balance — the validator must catch each fault");
const broken = [
  "period,account_code,account_name,debit,credit",
  "2026-05,1000,Cash,100.00,0.00", // leaves the period unbalanced (no offsetting credit)
  "2026-05,9999,Mystery Account,0.00,50.00", // unknown account
  "2026-05,6200,Sales & Marketing,10.00,10.00", // both sides non-zero
].join("\n");
const bres = validateTrialBalance(parseTrialBalanceCsv(broken));
const codes = new Set(bres.issues.map((i) => i.code));
check("flags the unbalanced period", codes.has("unbalanced_period"));
check("flags the unknown account 9999", codes.has("unknown_account"));
check("flags the both-sides-non-zero row", codes.has("both_sides_nonzero"));
check("a broken TB is NOT ok", !bres.ok);

// ── 3. THE RECONCILIATION CONTROL TOTAL — the seed's own books reconcile to $0 (Loom credibility) ──
// Σ(sub-ledger detail) === the TB figure for every account WITH a sub-ledger, within materiality
// max($1, 0.1%·line). The penny drift (sum-of-rounded vs rounded-sum across ~thousands of transactions)
// must stay well under $1 so the displayed (dollar-rounded) variance reads as $0 — the on-camera claim.
console.log("\nRECONCILIATION control total — the seed's books reconcile to $0");
const recon = reconcileSeedBooks(closePeriod);
const worstGap = Math.max(0, ...recon.findings.map((f) => Math.abs(f.gap)));
check(`every detailed account reconciles at ${closePeriod} (within materiality)`, recon.reconciled, `${recon.findings.length} detailed · ${recon.tbOnly.length} TB-only`);
check("the books reconcile to $0 — max raw gap < $1 (displays as $0)", worstGap < 1, `worst Δ $${worstGap.toFixed(4)}`);
check("13 detailed accounts + 15 TB-only = 28 (no false-flag on equity / D&A / sub-revenue)", recon.findings.length === 13 && recon.tbOnly.length === 15, `${recon.findings.length} + ${recon.tbOnly.length}`);
// holds across FYTD boundaries (the penny drift accumulates over a full FY but stays under threshold)
for (const p of [month(2024, 12), month(2025, 12), month(2026, 5)] as Month[]) {
  const r = reconcileSeedBooks(p);
  check(`reconciled at ${p} (Σ|gap| $${r.unreconciledTotal.toFixed(2)})`, r.reconciled);
}

// ── 4. a CONTRADICTING TB is BLOCKED — never plugged, the gap is flagged on the right account (§16) ──
console.log("\nCONTRADICTING TB — the gap blocks, no plug");
const brokenTb = new Map(accountTrialBalanceAt(closePeriod));
brokenTb.set("6200", (brokenTb.get("6200") ?? 0) + 100_000); // overstate S&M by $100K vs the detail
const brokenRecon = reconcile(closePeriod, brokenTb);
const f6200 = brokenRecon.findings.find((f) => f.accountCode === "6200");
check("a contradicting TB does NOT reconcile (blocking)", !brokenRecon.reconciled);
check("the $100K gap lands on 6200, over its threshold", !!f6200 && !f6200.reconciled && Math.abs(f6200.gap - 100_000) < 1, f6200 ? `gap $${f6200.gap.toFixed(0)} · threshold $${f6200.threshold.toFixed(0)}` : "no 6200 finding");
check("ONLY the contradicting account is flagged (no false positives)", brokenRecon.findings.filter((f) => !f.reconciled).length === 1);

// ── 5. the orchestrator end-to-end — the real TB imports clean (a closed-month restatement, no advance) ──
(async () => {
  console.log("\nORCHESTRATOR — real TB parses → validates → reconciles → (restatement, as-of unmoved)");
  const outcome = await runTrialBalanceImport(realCsv);
  check("real May TB imports OK (parse → validate → reconcile clean)", outcome.ok, outcome.message);
  check("a re-import of the already-closed month does NOT advance the as-of", outcome.advancedAsOf === false);
  check("the orchestrator recorded a 'reconciled' audit run", outcome.run.status === "reconciled");

  // the COMMIT path (the Loom climax): a clean next-in-close-month TB advances the global as-of. Reset
  // afterward so the gate is idempotent (it forces in-memory, so this only mutates the process boundary).
  const before = getCloseBoundary();
  const adv = await runTrialBalanceImport(sampleTbFor("next-month", closePeriod).csv);
  check("a clean next-month TB advances the as-of (commit)", adv.ok && adv.advancedAsOf === true, adv.message);
  check("the close boundary moved forward one month", getCloseBoundary().closeThrough !== before.closeThrough, `${before.closeThrough} → ${getCloseBoundary().closeThrough}`);
  // a contradicting TB is blocked end-to-end (rejected commit) and does NOT advance
  const brk = await runTrialBalanceImport(sampleTbFor("broken", before.closeThrough).csv);
  check("a contradicting TB is blocked end-to-end (needs_attention, no advance)", !brk.ok && brk.run.status === "needs_attention" && !brk.advancedAsOf);

  // degenerate inputs are REJECTED, never falsely "reconciled" (review findings: header-only + multi-period)
  const emptyOut = await runTrialBalanceImport("period,account_code,account_name,debit,credit\n");
  check("a header-only TB is REJECTED (not a false green)", !emptyOut.ok && emptyOut.run.status === "rejected" && !emptyOut.advancedAsOf, emptyOut.message);
  const twoMonths = sampleTbFor("current", before.closeThrough).csv + sampleTbFor("next-month", before.closeThrough).csv.split("\n").slice(1).join("\n");
  const multiOut = await runTrialBalanceImport(twoMonths);
  check("a multi-period TB is REJECTED (earlier-period gaps can't bypass the reconcile)", !multiOut.ok && multiOut.run.status === "rejected" && !multiOut.advancedAsOf, multiOut.message);

  setCloseBoundary(before); // reset the process boundary

  console.log(`\n================ IMPORTER-CHECK: ${fail === 0 ? "PASS" : `${fail} FAILING`} ================\n`);
  process.exitCode = fail === 0 ? 0 : 1;
})();
