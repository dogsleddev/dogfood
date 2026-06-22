/**
 * seed-supabase — load the deterministic generator into Supabase ONCE (CLAUDE.md §4, supabase/README.md).
 *
 * Reads the RAW generator collections (the FULL sets — not the as-of-filtered lib/queries, so FKs
 * resolve and a SupabaseDataStore round-trip is byte-faithful to the generator), clears the tables in
 * reverse-FK order for idempotency, then inserts in FK-safe order. Money → numeric dollars; periods →
 * 'YYYY-MM' text; dates → real dates. Re-runnable (deterministic). The write tables (flux_notes /
 * scenarios / budget_snapshots / account_overrides) are left empty/untouched — that's the CFO's work,
 * and the override layer (§17) must survive a re-seed.
 *
 * Prereq: the schema is applied (supabase/migrations/0001_init.sql) and the 3 keys are in .env.local.
 * Run: npx tsx scripts/seed-supabase.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSubscriptionSeed, getServicesSeed, getPersonnelSeed, getCostOfRevenueSeed,
  getOpExSeed, getBalanceSheetSeed, getSbcSeed, getLeaseSeed, getPipelineSeed, getRenewalsSeed,
} from "@/lib/seed";
import { CHART_OF_ACCOUNTS, getLedger } from "@/lib/seed/gl";
import { getTransactionsSeed } from "@/lib/seed/transactions";
import { PLACEHOLDER_FIRM, PLACEHOLDER_SETTINGS, SEED_DEPARTMENTS, SEED_EXPENSE_GROUPS } from "@/lib/target/placeholder";
import { toMajor, type Money } from "@/lib/types/money";
import type { Month } from "@/lib/types/period";

// tsx doesn't auto-load .env.local the way Next does.
function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const mt = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2];
  }
}

const $ = (m?: Money): number | null => (m == null ? null : Number(toMajor(m).toFixed(2)));
const r4 = (x: number): number => Number(x.toFixed(4));

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(`\nSeeding Supabase ${url.replace(/^https:\/\/([^.]+).*/, "$1")} …\n`);

  // ── pull the full generator collections ──
  const sub = getSubscriptionSeed();
  const svc = getServicesSeed();
  const per = getPersonnelSeed();
  const cor = getCostOfRevenueSeed();
  const opx = getOpExSeed();
  const bs = getBalanceSheetSeed();
  const sbc = getSbcSeed();
  const lease = getLeaseSeed();
  const ledger = getLedger();
  const tx = getTransactionsSeed();
  const MONTHS = sub.series.months as readonly Month[];

  // ── helpers ──
  async function clear(table: string, idCol = "id") {
    // delete-all (PostgREST requires a filter): match every non-null id.
    const { error } = await db.from(table).delete().not(idCol, "is", null);
    if (error && !/does not exist/i.test(error.message)) throw new Error(`clear ${table}: ${error.message}`);
  }
  async function insert(table: string, rows: Record<string, unknown>[], onConflict?: string) {
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const q = db.from(table).upsert(chunk, onConflict ? { onConflict } : undefined);
      const { error } = await q;
      if (error) throw new Error(`insert ${table}: ${error.message}`);
    }
    console.log(`  ${table.padEnd(22)} ${String(rows.length).padStart(6)} rows`);
  }

  // ── clear in reverse-FK order (idempotent re-seed; the write tables are left alone) ──
  for (const [t, col] of [
    ["cash_receipts", "id"], ["customer_invoices", "id"], ["timesheets", "id"], ["paychecks", "id"], ["vendor_bills", "id"],
    ["journal_lines", "id"], ["journal_entries", "id"], ["revrec_by_project", "project_id"], ["revrec_by_contract", "contract_id"],
    ["monthly_series", "period"], ["renewals", "id"], ["pipeline", "id"], ["projects", "id"], ["contracts", "id"], ["staff", "id"],
    ["customers", "id"], ["gl_accounts", "code"], ["expense_groups", "id"], ["departments", "id"], ["settings", "id"], ["firm", "id"],
  ] as const) {
    await clear(t, col);
  }

  // ── config ──
  await insert("firm", [{ id: PLACEHOLDER_FIRM.id, name: PLACEHOLDER_FIRM.name, short_code: PLACEHOLDER_FIRM.shortCode }]);
  await insert("settings", [{
    id: 1, currency: PLACEHOLDER_SETTINGS.currency, fiscal_year_start_month: PLACEHOLDER_SETTINGS.fiscalYearStartMonth,
    close_through: PLACEHOLDER_SETTINGS.closeThrough, in_close_month: PLACEHOLDER_SETTINGS.inCloseMonth ?? null,
    forecast_horizon_start: PLACEHOLDER_SETTINGS.forecastHorizon.start, forecast_horizon_end: PLACEHOLDER_SETTINGS.forecastHorizon.end,
  }]);
  await insert("departments", SEED_DEPARTMENTS.map((d) => ({ id: d.id, name: d.name, function: d.function })));
  await insert("expense_groups", SEED_EXPENSE_GROUPS.map((g) => ({
    id: g.id, label: g.label, classification: g.classification, function: g.function ?? null, sort_order: g.order,
  })));
  await insert("gl_accounts", CHART_OF_ACCOUNTS.map((a) => ({
    code: a.code, name: a.name, account_type: a.accountType, classification: a.classification ?? null,
    function: a.function ?? null, statement_line: a.statementLineId,
  })));

  // ── layer 1 · source records (FULL sets) ──
  await insert("customers", sub.customers.map((c) => ({
    id: c.id, name: c.name, segment: c.segment ?? null, start_month: c.startMonth, status: c.status, arr: $(c.arr), churn_month: c.churnMonth ?? null,
  })));
  await insert("contracts", sub.contracts.map((c) => ({
    id: c.id, customer_id: c.customerId, customer_name: c.customerName, stream: c.stream, plan_tier: c.planTier ?? null,
    arr: $(c.arr), start_month: c.startMonth, term_months: c.termMonths, status: c.status, booking_type: c.bookingType,
  })));
  await insert("projects", svc.projects.map((p) => ({
    id: p.id, name: p.name, customer_id: p.customerId, status: p.status, pct_complete: p.pctComplete,
    contract_value: $(p.contractValue), wip: $(p.wip), margin_pct: p.marginPct,
  })));
  await insert("staff", per.staff.map((st) => ({
    id: st.id, name: st.name, department_id: st.departmentId, function: st.function, title: st.title,
    start_month: st.startMonth, end_month: st.endMonth ?? null, fte: st.fte, annual_base_comp: $(st.baseComp),
  })));
  await insert("pipeline", getPipelineSeed().opportunities.map((o) => ({
    id: o.id, customer_name: o.customerName, kind: o.kind, stream: o.stream, stage: o.stage,
    arr: $(o.arr), owner: o.owner, expected_close: o.expectedClose, probability: o.probability,
  })));
  await insert("renewals", getRenewalsSeed().renewals.map((rn) => ({
    id: rn.id, contract_id: rn.contractId, customer_id: rn.customerId, due_month: rn.dueMonth,
    arr_up_for_renewal: $(rn.arrUpForRenewal), new_arr: $(rn.newArr), status: rn.status,
  })));

  // ── general ledger ──
  await insert("journal_entries", ledger.journalEntries.map((je) => ({
    id: je.id, period: je.period, memo: je.memo, doc_ref: je.docRef, source: je.source,
  })));
  const jeLines: Record<string, unknown>[] = [];
  for (const je of ledger.journalEntries)
    for (const l of je.lines) jeLines.push({ entry_id: je.id, account_id: l.glAccountId, debit: $(l.debit), credit: $(l.credit) });
  await insert("journal_lines", jeLines); // bigserial id; cleared above so insert order = generator order

  // ── sub-ledger ──
  await insert("vendor_bills", tx.vendorBills.map((b) => ({
    id: b.id, doc_number: b.docNumber, period: b.period, date: b.date, due_date: b.dueDate, status: b.status,
    account_id: b.glAccountId, sub_code: b.subCode ?? null, group_id: b.groupId, function: b.function, vendor: b.vendor ?? null, amount: $(b.amount), memo: b.memo ?? null,
  })));
  await insert("paychecks", tx.paychecks.map((p) => ({
    id: p.id, doc_number: p.docNumber, staff_id: p.staffId, period: p.period, period_label: p.periodLabel, date: p.date,
    gross_pay: $(p.grossPay), employee_taxes: $(p.employeeTaxes), benefits: $(p.benefits), net_pay: $(p.netPay),
  })));
  await insert("timesheets", tx.timesheets.map((t) => ({
    id: t.id, doc_number: t.docNumber, staff_id: t.staffId, project_id: t.projectId, period: t.period, date: t.date, week_label: t.weekLabel,
    hours: t.hours, bill_rate: $(t.billRate), cost_rate: $(t.costRate), billable_value: $(t.billableValue), labor_cost: $(t.laborCost),
  })));
  await insert("customer_invoices", tx.customerInvoices.map((v) => ({
    id: v.id, doc_number: v.docNumber, customer_id: v.customerId, contract_id: v.contractId ?? null, project_id: v.projectId ?? null,
    period: v.period, date: v.date, due_date: v.dueDate, status: v.status, stream: v.stream, kind: v.kind, amount: $(v.amount),
  })));
  await insert("cash_receipts", tx.cashReceipts.map((rc) => ({
    id: rc.id, doc_number: rc.docNumber, customer_id: rc.customerId, period: rc.period, date: rc.date,
    applied_invoice_id: rc.appliedInvoiceId ?? null, applied_doc_number: rc.appliedDocNumber ?? null, amount: $(rc.amount),
  })));

  // ── derived series (stored for completeness + future statements-over-Supabase work) ──
  const og = (id: string) => opx.series.groups.find((g) => g.groupId === id)?.monthly ?? [];
  const driverCols: [string, readonly number[]][] = [
    ["subscription_recognized", sub.series.recognized], ["subscription_billings", sub.series.billings],
    ["subscription_deferred", sub.series.deferred], ["arr", sub.series.arr], ["mrr", sub.series.mrr],
    ["services_recognized", svc.series.recognized], ["services_billed", svc.series.billed], ["services_wip", svc.series.wip],
    ["direct_payroll", cor.series.directPayroll], ["indirect_payroll", per.series.indirectPayroll],
    ["total_headcount", per.series.totalHeadcount], ["non_employee_cor", cor.series.nonEmployee], ["gross_profit", cor.series.grossProfit],
    ["opex_employee_expenses", og("employee-expenses")], ["opex_sales_marketing", og("sales-marketing")],
    ["opex_travel_entertainment", og("travel-entertainment")], ["opex_it", og("it")], ["opex_hr", og("hr")],
    ["opex_admin", og("admin")], ["opex_facilities", og("facilities")], ["opex_insurance", og("insurance")],
    ["stock_based_comp", sbc.series.monthly],
    ["bs_cash", bs.series.cash], ["bs_accounts_receivable", bs.series.accountsReceivable], ["bs_unbilled_wip", bs.series.unbilledWip],
    ["bs_prepaid_expenses", bs.series.prepaidExpenses], ["bs_fixed_assets_net", bs.series.fixedAssetsNet], ["bs_rou_asset", lease.series.rouAsset],
    ["bs_accounts_payable", bs.series.accountsPayable], ["bs_deferred_revenue", bs.series.deferredRevenue], ["bs_lease_liability", lease.series.leaseLiability],
    ["bs_paid_in_capital", bs.series.paidInCapital], ["bs_accumulated_deficit", bs.series.accumulatedDeficit],
  ];
  const seriesRows: Record<string, unknown>[] = [];
  for (const [name, arr] of driverCols)
    MONTHS.forEach((mo, i) => seriesRows.push({ period: mo, name, value: r4(arr[i] ?? 0) }));
  await insert("monthly_series", seriesRows, "period,name");

  const recC: Record<string, unknown>[] = [];
  for (const c of sub.recByContract)
    MONTHS.forEach((mo, i) => {
      const rec = c.recognized[i] ?? 0, def = c.deferred[i] ?? 0, arr = c.arr[i] ?? 0;
      if (rec || def || arr) recC.push({ contract_id: c.contractId, period: mo, customer_id: c.customerId, customer_name: c.customerName, tier: c.tier, recognized: Number(rec.toFixed(2)), deferred: Number(def.toFixed(2)), arr: Number(arr.toFixed(2)) });
    });
  await insert("revrec_by_contract", recC, "contract_id,period");

  const projName = new Map(svc.projects.map((p) => [p.id as string, p.name] as const));
  const recP: Record<string, unknown>[] = [];
  for (const p of svc.recByProject)
    MONTHS.forEach((mo, i) => { const rec = p.monthly[i] ?? 0; if (rec) recP.push({ project_id: p.projectId, period: mo, project_name: projName.get(p.projectId) ?? "", recognized: Number(rec.toFixed(2)) }); });
  await insert("revrec_by_project", recP, "project_id,period");

  console.log(`\n✓ Seed loaded. Set DATASTORE=supabase to read from it; verify with scripts/supabase-parity.ts.\n`);
}

main().catch((e) => { console.error("\n✗ seed-supabase failed:", (e as Error).message, "\n"); process.exitCode = 1; });
