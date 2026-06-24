/**
 * schema-check — prove the LIVE Supabase schema matches what the app expects (CLAUDE.md §4). Schema is
 * applied to the live DB by hand (scripts/apply-schema.ts), so the files and the live DB can drift —
 * which has bitten the build twice (a stale add-column that didn't round-trip; a new write table left
 * unapplied). supabase-parity checks DATA drift; this checks SCHEMA drift: every table the app reads/
 * writes, and the load-bearing columns, must exist live. Read-only (information_schema), never prints
 * the password. Run after applying migrations and before a push/deploy.
 *
 * Run: npx tsx scripts/schema-check.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const mt = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2];
  }
}

// Same connection derivation as apply-schema.ts (kept independent so this read-only check never risks
// the proven apply path): parse SUPABASE_DB_URL into fields + honor the IPv4 Session-pooler overrides.
function pgConfig() {
  let conn = process.env.SUPABASE_DB_URL;
  if (!conn) throw new Error("SUPABASE_DB_URL is not set in .env.local (Project Settings → Database → Connection string → URI).");
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^https:\/\/([^.]+).*/, "$1");
  if (ref && conn.includes("<ref>")) conn = conn.replaceAll("<ref>", ref);
  const m = /^postgres(?:ql)?:\/\/([^:@/]+)(?::([^@]*))?@([^:/?]+)(?::(\d+))?(?:\/([^?]+))?/.exec(conn);
  if (!m) throw new Error("could not parse SUPABASE_DB_URL");
  let password = m[2] ?? "";
  if (/^<.*>$/.test(password) || /^\[.*\]$/.test(password)) password = password.slice(1, -1);
  return {
    user: process.env.SUPABASE_DB_USER || m[1],
    password,
    host: process.env.SUPABASE_DB_HOST || m[3],
    port: process.env.SUPABASE_DB_PORT ? Number(process.env.SUPABASE_DB_PORT) : m[4] ? Number(m[4]) : 5432,
    database: m[5] || "postgres",
    ssl: { rejectUnauthorized: false } as const,
  };
}

// The schema CONTRACT: every public table the app reads/writes (0001_init, with 0002–0007 folded in),
// plus the load-bearing columns that have drifted before or that the importer/write paths depend on.
const EXPECTED_TABLES = [
  "firm", "settings", "departments", "expense_groups", "gl_accounts",
  "customers", "contracts", "projects", "staff", "pipeline", "renewals",
  "journal_entries", "journal_lines", "vendor_bills", "paychecks", "timesheets",
  "customer_invoices", "cash_receipts", "monthly_series", "revrec_by_contract", "revrec_by_project",
  "flux_notes", "scenarios", "scenario_inputs", "budget_snapshots", "account_overrides", "import_runs",
  "scout_rate_limit", // 0008 — the public-Scout rate limiter (table + the scout_rate_check function)
];
const EXPECTED_COLUMNS: Record<string, string[]> = {
  settings: ["close_through", "in_close_month", "forecast_horizon_start"],
  vendor_bills: ["sub_code"], // a17f1e2 added it to the generator; the column has drifted before
  scenarios: ["adjustments"], // jsonb (0004) — the lossless scenario store
  account_overrides: ["code", "statement_line", "source"], // 0005
  flux_notes: ["account_code", "source"], // 0003
  import_runs: ["status", "advanced_as_of", "unreconciled_total"], // 0007 (the importer audit trail)
};

async function main() {
  loadEnvLocal();
  const client = new Client(pgConfig());
  await client.connect();
  let fail = 0;
  const ok = (b: boolean) => (b ? "PASS" : "FAIL");
  try {
    const cfg = pgConfig();
    console.log(`\n===== SCHEMA-CHECK — live DB ${cfg.host} =====\n`);

    const { rows: tRows } = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const live = new Set(tRows.map((r) => r.table_name));
    const missingTables = EXPECTED_TABLES.filter((t) => !live.has(t));
    console.log("TABLES");
    for (const t of EXPECTED_TABLES) {
      const present = live.has(t);
      if (!present) fail++;
      console.log(`  ${ok(present)}  ${t}`);
    }
    const extra = [...live].filter((t) => !EXPECTED_TABLES.includes(t));
    if (extra.length) console.log(`  (note: ${extra.length} live table(s) not in the contract: ${extra.join(", ")})`);

    console.log("\nLOAD-BEARING COLUMNS");
    const { rows: cRows } = await client.query<{ table_name: string; column_name: string }>(
      "select table_name, column_name from information_schema.columns where table_schema = 'public'",
    );
    const colsByTable = new Map<string, Set<string>>();
    for (const r of cRows) {
      if (!colsByTable.has(r.table_name)) colsByTable.set(r.table_name, new Set());
      colsByTable.get(r.table_name)!.add(r.column_name);
    }
    for (const [table, cols] of Object.entries(EXPECTED_COLUMNS)) {
      for (const col of cols) {
        const present = colsByTable.get(table)?.has(col) ?? false;
        if (!present) fail++;
        console.log(`  ${ok(present)}  ${table}.${col}`);
      }
    }

    if (missingTables.length) {
      console.log(`\n⚠ ${missingTables.length} missing table(s): ${missingTables.join(", ")}`);
      console.log("  Apply the migration that creates it, e.g.:");
      console.log("    npx tsx scripts/apply-schema.ts supabase/migrations/0007_import_runs.sql");
    }
    console.log(`\n================ SCHEMA-CHECK: ${fail === 0 ? "PASS — live schema matches the contract" : `${fail} DRIFT`} ================\n`);
  } finally {
    await client.end();
  }
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error("\n✗ schema-check failed:", (e as Error).message, "\n"); process.exitCode = 1; });
