/**
 * export-data — dump ALL seeded Bearing data to CSV (one file per collection) under data-export/,
 * for analysis in Excel. Lowest-level detail: every sub-ledger transaction (vendor bills, paychecks,
 * timesheets, invoices, receipts), plus revenue recognition broken out by contract AND by project,
 * the full GL + monthly activity, the monthly statements, the driver series, and the dashboard tiles.
 *
 * Run: npx tsx scripts/export-data.ts   (re-run any time; deterministic).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDataStore } from "@/lib/datastore";
import {
  getSubscriptionSeed, getServicesSeed, getPersonnelSeed, getCostOfRevenueSeed,
  getOpExSeed, getBalanceSheetSeed, getSbcSeed, getLeaseSeed,
} from "@/lib/seed";
import { getLedger } from "@/lib/seed/gl";
import { METRIC_CATALOG, formatMetricValue } from "@/lib/types/metrics";
import { month, type Month } from "@/lib/types/period";
import { toMajor, type Money } from "@/lib/types/money";
import type { MetricId } from "@/lib/types/common";
import type { VendorBill } from "@/lib/types/transactions";

/** Ratio (Percent/fraction) formatted to 4 decimals — keeps full precision internally, clean in the export. */
const ratio4 = (x: number): string => Number(x).toFixed(4);

const OUT = "data-export";
mkdirSync(OUT, { recursive: true });

// ── CSV helpers ──
const cell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const usd = (m?: Money): string => (m ? toMajor(m).toFixed(2) : "");
const manifest: { file: string; rows: number; desc: string }[] = [];
function write(file: string, headers: string[], rows: unknown[][], desc: string) {
  const body = [headers.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n") + "\n";
  writeFileSync(join(OUT, file), body, "utf8");
  manifest.push({ file, rows: rows.length, desc });
  console.log(`  ${file.padEnd(38)} ${String(rows.length).padStart(6)} rows`);
}

const CURRENT: Month = month(2026, 6);

async function main() {
  console.log(`\nExporting Bearing seed → ${OUT}/\n`);
  const ds = getDataStore();
  const sub = getSubscriptionSeed();
  const svc = getServicesSeed();
  const per = getPersonnelSeed();
  const cor = getCostOfRevenueSeed();
  const opx = getOpExSeed();
  const bs = getBalanceSheetSeed();
  const sbc = getSbcSeed();
  const lease = getLeaseSeed();
  const ledger = getLedger();
  const MONTHS = sub.series.months as readonly Month[]; // 36 month strings

  // ── Layer 1 · source records ──
  write("customers.csv", ["id", "name", "segment", "start_month", "status", "arr", "churn_month"],
    (await ds.listCustomers()).map((c) => [c.id, c.name, c.segment ?? "", c.startMonth, c.status, usd(c.arr), c.churnMonth ?? ""]),
    "Accounts: segment, cohort, status, run-rate ARR");

  write("contracts.csv", ["id", "customer_id", "customer_name", "stream", "plan_tier", "arr", "start_month", "term_months", "status", "booking_type"],
    (await ds.listContracts()).map((c) => [c.id, c.customerId, c.customerName, c.stream, c.planTier ?? "", usd(c.arr), c.startMonth, c.termMonths, c.status, c.bookingType]),
    "Signed agreements (606/deferred pivot)");

  write("pipeline.csv", ["id", "customer_name", "kind", "stream", "stage", "arr", "owner", "expected_close", "probability"],
    (await ds.listPipeline()).map((o) => [o.id, o.customerName, o.kind, o.stream, o.stage, usd(o.arr), o.owner, o.expectedClose, o.probability]),
    "Open opportunities (forward funnel)");

  write("renewals.csv", ["id", "contract_id", "customer_id", "due_month", "arr_up_for_renewal", "new_arr", "status"],
    (await ds.listRenewals()).map((r) => [r.id, r.contractId, r.customerId, r.dueMonth, usd(r.arrUpForRenewal), usd(r.newArr), r.status]),
    "Renewal worklist + history");

  write("projects.csv", ["id", "name", "customer_id", "status", "pct_complete", "contract_value", "wip", "margin_pct"],
    (await ds.listProjects()).map((p) => [p.id, p.name, p.customerId, p.status, ratio4(p.pctComplete), usd(p.contractValue), usd(p.wip), ratio4(p.marginPct)]),
    "Services delivery projects");

  write("staff.csv", ["id", "name", "department_id", "function", "title", "start_month", "end_month", "fte", "annual_base_comp"],
    (await ds.listStaff()).map((s) => [s.id, s.name, s.departmentId, s.function, s.title, s.startMonth, s.endMonth ?? "", s.fte, usd(s.baseComp)]),
    "People register (by dept + function)");

  // ── GL ──
  write("gl_accounts.csv", ["id", "code", "name", "account_type", "classification", "function", "statement_line"],
    (await ds.listGlAccounts()).map((a) => [a.id, a.code, a.name, a.accountType, a.classification ?? "", a.function ?? "", a.statementLineId]),
    "Chart of accounts + Account Mapping");

  const jeLines: unknown[][] = [];
  for (const je of await ds.listJournalEntries())
    for (const l of je.lines) jeLines.push([je.id, je.period, je.docRef, je.source, je.memo, l.glAccountId, usd(l.debit), usd(l.credit)]);
  write("journal_lines.csv", ["entry_id", "period", "doc_ref", "source", "memo", "account_id", "debit", "credit"], jeLines,
    "Balanced JE lines (monthly-summary GL)");

  const glRows: unknown[][] = [];
  for (const [code, monthly] of ledger.activity)
    monthly.forEach((v, i) => { if (Math.abs(v) > 1e-6) glRows.push([MONTHS[i], code, v.toFixed(2)]); });
  write("gl_account_monthly.csv", ["period", "account_code", "natural_activity"], glRows,
    "Per-account monthly GL activity (pivotable)");

  // ── Sub-ledger transactions (lowest level) ──
  const bills = (await ds.listExpenseTransactions()) as VendorBill[];
  write("vendor_bills.csv", ["id", "doc_number", "period", "date", "due_date", "status", "account_id", "sub_code", "group_id", "function", "vendor", "amount", "memo"],
    bills.map((b) => [b.id, b.docNumber, b.period, b.date, b.dueDate, b.status, b.glAccountId, b.subCode ?? "", b.groupId, b.function, b.vendor ?? "", usd(b.amount), b.memo ?? ""]),
    "AP expense detail (drill + flux-note anchor; sub_code = GL sub-account within the group)");

  write("paychecks.csv", ["id", "doc_number", "staff_id", "period", "period_label", "date", "gross_pay", "employee_taxes", "benefits", "net_pay"],
    (await ds.listPaychecks()).map((p) => [p.id, p.docNumber, p.staffId, p.period, p.periodLabel, p.date, usd(p.grossPay), usd(p.employeeTaxes), usd(p.benefits), usd(p.netPay)]),
    "Salary detail, paycheck by paycheck");

  write("timesheets.csv", ["id", "doc_number", "staff_id", "project_id", "period", "date", "week_label", "hours", "bill_rate", "cost_rate", "billable_value", "labor_cost"],
    (await ds.listTimesheets()).map((t) => [t.id, t.docNumber, t.staffId, t.projectId, t.period, t.date, t.weekLabel, t.hours, usd(t.billRate), usd(t.costRate), usd(t.billableValue), usd(t.laborCost)]),
    "Labor detail, timesheet by timesheet");

  write("customer_invoices.csv", ["id", "doc_number", "customer_id", "contract_id", "project_id", "period", "date", "due_date", "status", "stream", "kind", "amount"],
    (await ds.listCustomerInvoices()).map((v) => [v.id, v.docNumber, v.customerId, v.contractId ?? "", v.projectId ?? "", v.period, v.date, v.dueDate, v.status, v.stream, v.kind, usd(v.amount)]),
    "Customer billing detail");

  write("cash_receipts.csv", ["id", "doc_number", "customer_id", "period", "date", "applied_invoice_id", "applied_doc_number", "amount"],
    (await ds.listCashReceipts()).map((r) => [r.id, r.docNumber, r.customerId, r.period, r.date, r.appliedInvoiceId ?? "", r.appliedDocNumber ?? "", usd(r.amount)]),
    "Cash collections (FIFO-applied)");

  // ── Revenue recognition, lowest level: by contract (subscription) and by project (services) ──
  const recC: unknown[][] = [];
  for (const c of sub.recByContract)
    MONTHS.forEach((mo, i) => { const rec = c.recognized[i] ?? 0; const def = c.deferred[i] ?? 0; const arr = c.arr[i] ?? 0;
      if (rec || def || arr) recC.push([c.contractId, c.customerId, c.customerName, c.tier, mo, rec.toFixed(2), def.toFixed(2), arr.toFixed(2)]); });
  write("revrec_by_contract.csv", ["contract_id", "customer_id", "customer_name", "tier", "period", "recognized", "deferred", "arr"], recC,
    "Subscription 606 recognition, per contract per month");

  const projName = new Map((await ds.listProjects()).map((p) => [p.id as string, p.name] as const));
  const recP: unknown[][] = [];
  for (const p of svc.recByProject)
    MONTHS.forEach((mo, i) => { const rec = p.monthly[i] ?? 0; if (rec) recP.push([p.projectId, projName.get(p.projectId) ?? "", mo, rec.toFixed(2)]); });
  write("revrec_by_project.csv", ["project_id", "project_name", "period", "recognized"], recP,
    "Services %-complete recognition, per project per month");

  // ── Driver series (one wide row per month — the master pivot table) ──
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
  write("driver_series_monthly.csv", ["period", ...driverCols.map((c) => c[0])],
    MONTHS.map((mo, i) => [mo, ...driverCols.map((c) => (c[1][i] ?? 0).toFixed(2))]),
    "All monthly driver + balance-sheet series (master pivot)");

  // ── Monthly P&L, long format, all fiscal years ──
  const pnlRows: unknown[][] = [];
  for (const fy of [2024, 2025, 2026]) {
    const mp = await ds.getMonthlyPnL(month(fy, 6));
    for (const line of mp.lines)
      mp.months.forEach((col, i) => pnlRows.push([col.month, fy, col.status, line.id, line.label, line.level, usd(line.monthly[i])]));
  }
  write("pnl_monthly.csv", ["period", "fiscal_year", "status", "line_id", "line_label", "level", "amount"], pnlRows,
    "Monthly P&L, every line × month, FY24-26");

  // ── Dashboard metrics (current period) ──
  const metricRows: unknown[][] = [];
  for (const def of METRIC_CATALOG) {
    const tile = await ds.getKpiTile(def.id as MetricId, CURRENT);
    metricRows.push([def.id, def.label, def.family, def.basis, tile ? formatMetricValue(tile.value) : "",
      tile?.priorYear ? formatMetricValue(tile.priorYear) : "", tile?.budget ? formatMetricValue(tile.budget) : ""]);
  }
  write("dashboard_metrics.csv", ["metric_id", "label", "family", "basis", "value", "prior_year", "budget"], metricRows,
    "The 19 dashboard KPI tiles (as of Jun 2026)");

  // ── manifest ──
  const total = manifest.reduce((a, m) => a + m.rows, 0);
  write("INDEX.csv", ["file", "rows", "description"], manifest.map((m) => [m.file, m.rows, m.desc]), "this index");
  console.log(`\n  ${manifest.length} files · ${total.toLocaleString()} data rows → ${OUT}/\n`);
}
main();
