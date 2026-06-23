/**
 * supabase-parity — "Verify the swap" (Handoff step 4 / supabase/README.md).
 *
 * Proves the Supabase round-trip is byte-faithful to the deterministic generator: for every
 * collection the DataStore serves, the SupabaseDataStore read must equal the InMemoryDataStore read
 * (order-independent — callers sort their own views). If parity holds, swapping the store changes
 * storage, not numbers — so the gates (which run the unchanged TS builders + these record reads)
 * pass identically under DATASTORE=supabase.
 *
 * Prereq: schema applied + `npx tsx scripts/seed-supabase.ts` has run.
 * Run: npx tsx scripts/supabase-parity.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { InMemoryDataStore } from "@/lib/datastore/in-memory";
import { SupabaseDataStore } from "@/lib/datastore/supabase";
import type { StatementLineId, StatementClassification, CostFunction } from "@/lib/types/common";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const mt = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2];
  }
}

let fail = 0;
const ok = (b: boolean) => (b ? "PASS" : "FAIL");

/**
 * Canonical JSON: recursively sort object keys (so key ORDER never false-flags), and round
 * non-integer numbers to 9 dp. Money is integer cents (minor) → untouched and EXACT; the only
 * non-integers are display ratios (probability / pct_complete / margin_pct), where Postgres
 * `double precision` text output rounds past ~14 sig digits. 9 dp is far finer than any display or
 * tie-out, so this tolerates float-representation noise without masking a material difference.
 */
function stable(x: unknown): string {
  return JSON.stringify(x, (_k, v) => {
    if (typeof v === "number") return Number.isInteger(v) ? v : Math.round(v * 1e9) / 1e9;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, (v as Record<string, unknown>)[k]]));
    }
    return v;
  });
}

/** Order-independent deep compare: canonical-stringify each element, sort, compare. Reports the first diff. */
function compareList(name: string, mem: readonly unknown[], sup: readonly unknown[]) {
  const sa = mem.map(stable).sort();
  const sb = sup.map(stable).sort();
  let firstDiff = -1;
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    if (sa[i] !== sb[i]) { firstDiff = i; break; }
  }
  const pass = sa.length === sb.length && firstDiff === -1;
  if (!pass) fail++;
  console.log(`  ${ok(pass)}  ${name.padEnd(24)} mem ${String(mem.length).padStart(6)} · supabase ${String(sup.length).padStart(6)}`);
  if (!pass && firstDiff >= 0) {
    console.log(`        first diff @${firstDiff}:`);
    console.log(`          mem: ${sa[firstDiff]?.slice(0, 240)}`);
    console.log(`          sup: ${sb[firstDiff]?.slice(0, 240)}`);
  } else if (!pass) {
    console.log(`        count mismatch (${sa.length} vs ${sb.length})`);
  }
}

function compareOne(name: string, mem: unknown, sup: unknown) {
  const a = stable(mem), b = stable(sup);
  const pass = a === b;
  if (!pass) fail++;
  console.log(`  ${ok(pass)}  ${name}`);
  if (!pass) { console.log(`        mem: ${a?.slice(0, 240)}`); console.log(`        sup: ${b?.slice(0, 240)}`); }
}

async function main() {
  loadEnvLocal();
  console.log("\n===== SUPABASE PARITY — round-trip vs the generator =====\n");
  const mem = new InMemoryDataStore();
  const sup = new SupabaseDataStore();

  // config
  compareOne("getFirm", await mem.getFirm(), await sup.getFirm());
  // Snapshot the in-memory settings to a PLAIN object BEFORE reading Supabase: mem.getSettings() returns
  // PLACEHOLDER_SETTINGS by reference (lazy getters over the global close boundary), and sup.getSettings()
  // read-repairs that same global — so serializing mem after sup would adopt the Supabase as-of and mask a
  // real closeThrough/inCloseMonth divergence (the exact fields the importer persists).
  const memSettings = { ...(await mem.getSettings()) };
  compareOne("getSettings", memSettings, await sup.getSettings());
  compareList("departments", await mem.listDepartments(), await sup.listDepartments());
  compareList("expense_groups", await mem.listExpenseGroups(), await sup.listExpenseGroups());
  compareList("gl_accounts", await mem.listGlAccounts(), await sup.listGlAccounts());

  // layer 1 · source records
  compareList("customers", await mem.listCustomers(), await sup.listCustomers());
  compareList("contracts", await mem.listContracts(), await sup.listContracts());
  compareList("pipeline", await mem.listPipeline(), await sup.listPipeline());
  compareList("renewals", await mem.listRenewals(), await sup.listRenewals());
  compareList("projects", await mem.listProjects(), await sup.listProjects());
  compareList("staff", await mem.listStaff(), await sup.listStaff());

  // GL
  compareList("journal_entries", await mem.listJournalEntries(), await sup.listJournalEntries());

  // sub-ledger
  compareList("vendor_bills", await mem.listExpenseTransactions(), await sup.listExpenseTransactions());
  compareList("paychecks", await mem.listPaychecks(), await sup.listPaychecks());
  compareList("timesheets", await mem.listTimesheets(), await sup.listTimesheets());
  compareList("customer_invoices", await mem.listCustomerInvoices(), await sup.listCustomerInvoices());
  compareList("cash_receipts", await mem.listCashReceipts(), await sup.listCashReceipts());

  // spot-check a filtered read + a single-record lookup go through identically
  compareList("expenses (2026-05)", await mem.listExpenseTransactions({ period: "2026-05" as never }), await sup.listExpenseTransactions({ period: "2026-05" as never }));
  compareOne("getContract(first)", await mem.getContract((await mem.listContracts())[0].id), await sup.getContract((await mem.listContracts())[0].id));

  // ── Account-Mapping OVERRIDE write→read→compose→clear round-trip on the REAL backend ──
  // The empty-override path returns base by reference, so rowToAccountOverride + setAccountOverride + the
  // NON-empty composeGlAccounts branch are otherwise never exercised against Supabase — exactly the
  // blind-spot class that shipped the subCode bug. Re-points IT (6400) → the Admin line (same OpEx group).
  // `finally` cleans up so no stray override is ever left in the live table.
  {
    const CODE = "6400";
    const before = (await sup.listGlAccounts()).find((a) => a.code === CODE)!;
    let roundtripOk = false;
    let composeOk = false;
    let clearedOk = false;
    try {
      await sup.setAccountOverride(CODE, {
        statementLineId: "admin" as StatementLineId,
        classification: "operating_expense" as StatementClassification,
        function: "ga" as CostFunction,
        source: "ui",
      });
      const ovr = (await sup.listAccountOverrides()).find((o) => o.code === CODE);
      roundtripOk = !!ovr && ovr.statementLineId === "admin" && ovr.classification === "operating_expense" && ovr.function === "ga" && ovr.source === "ui";
      composeOk = (await sup.listGlAccounts()).find((a) => a.code === CODE)!.statementLineId === ("admin" as StatementLineId);
    } finally {
      await sup.clearAccountOverride(CODE);
      const after = (await sup.listGlAccounts()).find((a) => a.code === CODE)!;
      const residue = (await sup.listAccountOverrides()).filter((o) => o.code === CODE);
      clearedOk = after.statementLineId === before.statementLineId && residue.length === 0;
    }
    const allOk = roundtripOk && composeOk && clearedOk;
    if (!allOk) fail++;
    console.log(`  ${ok(allOk)}  account_overrides round-trip (write→read→compose→clear)`);
    if (!allOk) console.log(`        roundtrip=${roundtripOk} compose=${composeOk} cleared=${clearedOk}`);
  }

  console.log(`\n================ SUPABASE PARITY: ${fail === 0 ? "PASS — Supabase round-trips the generator exactly" : `${fail} MISMATCH`} ================\n`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => { console.error("\n✗ parity failed:", (e as Error).message, "\n"); process.exitCode = 1; });
