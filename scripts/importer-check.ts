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

let fail = 0;
const ok = (b: boolean) => (b ? "PASS" : "FAIL");
function check(name: string, pass: boolean, detail = "") {
  if (!pass) fail++;
  console.log(`  ${ok(pass)}  ${name}${detail ? `  ${detail}` : ""}`);
}

console.log("\n===== IMPORTER-CHECK — parse + validate the real trial balance =====\n");

// ── 1. the real shipped trial_balance.csv parses, foots, and validates clean ──
const realCsv = readFileSync("import-templates/trial_balance.csv", "utf8");
const parsed = parseTrialBalanceCsv(realCsv);
const result = validateTrialBalance(parsed);

console.log("REAL trial_balance.csv (the contract — must be import-ready)");
check("parsed all 28 accounts", parsed.rows.length === 28, `${parsed.rows.length} rows`);
check("a quoted field with a comma parsed intact", parsed.rows.some((r) => r.accountName === "Fixed Assets, net"));
const may = result.footing.find((f) => f.period === "2026-05");
check("May 2026 foots to $59,567,335.23 each side", !!may && Math.round(may.debit * 100) === 5_956_733_523 && Math.round(may.credit * 100) === 5_956_733_523, may ? `Σdebit ${may.debit.toFixed(2)} · Σcredit ${may.credit.toFixed(2)}` : "no May period");
check("the TB balances (no unbalanced_period issue)", !!may?.balanced);
check("validates clean — zero issues", result.ok, result.issues.map((i) => i.code).join(", ") || "(none)");

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

console.log(`\n================ IMPORTER-CHECK: ${fail === 0 ? "PASS" : `${fail} FAILING`} ================\n`);
process.exitCode = fail === 0 ? 0 : 1;
