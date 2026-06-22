/**
 * Data sweep — a durable dev tool (run: npx tsx scripts/data-sweep.ts).
 * Confirms the seed ties out AND inventories its volume (counts of records, accounts, JEs,
 * series, statement lines, tie-out checks). Re-run each session to compare against the
 * baseline recorded in Handoff.md. Not part of the build.
 */
import {
  getSubscriptionSeed,
  getServicesSeed,
  getPersonnelSeed,
  getCostOfRevenueSeed,
  getOpExSeed,
  getBalanceSheetSeed,
  getSbcSeed,
  getLeaseSeed,
} from "@/lib/seed";
import { getLedger, CHART_OF_ACCOUNTS } from "@/lib/seed/gl";
import { getTransactionsSeed } from "@/lib/seed/transactions";
import type { TieOutCheck } from "@/lib/seed";
import { buildSeedPnL, buildSeedMonthlyPnL, buildSeedBalanceSheet, buildSeedMonthlyBalanceSheet, buildSeedCashFlow, buildSeedMonthlyCashFlow } from "@/lib/seed/statements";
import { buildSeedDashboard, buildSeedMetricValue } from "@/lib/seed/dashboard-metrics";
import { SEED_DEPARTMENTS, SEED_EXPENSE_GROUPS, PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import { TIERS } from "@/lib/seed/params";
import { month } from "@/lib/types/period";
import type { MetricId } from "@/lib/types/common";

const L = (s = "") => console.log(s);
const n = (x: number) => x.toLocaleString();
const sub = getSubscriptionSeed();
const svc = getServicesSeed();
const per = getPersonnelSeed();
const cor = getCostOfRevenueSeed();
const opx = getOpExSeed();
const bs = getBalanceSheetSeed();
const sbcSeed = getSbcSeed();
const leaseSeed = getLeaseSeed();
const led = getLedger();
const tx = getTransactionsSeed();
const months = sub.series.months;
const M = months.length;

const tally = <T,>(items: readonly T[], key: (t: T) => string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const it of items) out[key(it)] = (out[key(it)] ?? 0) + 1;
  return out;
};

L("================ BEARING SEED · DATA SWEEP ================\n");

L("TIME");
L(`  Months: ${M} (${months[0]} … ${months[M - 1]})`);
L(`  Fiscal years: 3 (FY2024, FY2025, FY2026)`);
L(`  Close boundary: actual through ${PLACEHOLDER_SETTINGS.closeThrough}, in-close ${PLACEHOLDER_SETTINGS.inCloseMonth}, forecast ${PLACEHOLDER_SETTINGS.forecastHorizon.start}…${PLACEHOLDER_SETTINGS.forecastHorizon.end}`);

L("\nLAYER 1 · SOURCE RECORDS");
const active = sub.customers.filter((c) => c.status === "active").length;
L(`  Customers: ${n(sub.customers.length)} (${active} active, ${sub.customers.length - active} churned)`);
L(`  Contracts (subscription): ${n(sub.contracts.length)}`);
L(`  Acquisitions (in-window new logos): ${n(sub.acquisitions.filter((a) => a.startIndex >= 0).length)} (pre-existing base ${sub.acquisitions.length === 0 ? 26 : sub.customers.length - sub.acquisitions.filter((a) => a.startIndex >= 0).length})`);
const svcComplete = svc.projects.length - svc.incompleteCount;
L(`  Projects (services): ${n(svc.projects.length)} (${svcComplete} complete, ${svc.incompleteCount} in-progress at horizon)`);
L(`  Staff: ${n(per.staff.length)}`);
L(`    by department: ${Object.entries(tally(per.staff, (s) => s.departmentId)).map(([d, c]) => `${d} ${c}`).join(" · ")}`);
L(`    by function: ${Object.entries(tally(per.staff, (s) => s.function)).map(([f, c]) => `${f} ${c}`).join(" · ")}`);
L(`  GL accounts: ${CHART_OF_ACCOUNTS.length}`);
L(`    by type: ${Object.entries(tally(CHART_OF_ACCOUNTS, (a) => a.accountType)).map(([t, c]) => `${t} ${c}`).join(" · ")}`);
const jeLines = led.journalEntries.reduce((s, e) => s + e.lines.length, 0);
L(`  Journal entries: ${n(led.journalEntries.length)} · journal LINES: ${n(jeLines)} (monthly-summary postings)`);
L(`    by source: ${Object.entries(tally(led.journalEntries, (e) => e.source)).map(([s, c]) => `${s} ${c}`).join(" · ")}`);

L("\nLAYER 1 · TRANSACTION SUB-LEDGER (individual transactions; each stream Σ === its monthly driver)");
const txTotal = tx.vendorBills.length + tx.paychecks.length + tx.timesheets.length + tx.customerInvoices.length + tx.cashReceipts.length;
L(`  Vendor bills: ${n(tx.vendorBills.length)} · Paychecks: ${n(tx.paychecks.length)} · Timesheets: ${n(tx.timesheets.length)} · Customer invoices: ${n(tx.customerInvoices.length)} · Cash receipts: ${n(tx.cashReceipts.length)}`);
L(`  TOTAL transactions: ${n(txTotal)} · PS timesheet hours: ${n(tx.jobCostByProject.reduce((s, j) => s + j.hours, 0))} (job-costed WIP)`);

L("\nLAYER 2 · DRIVERS");
L(`  Departments: ${SEED_DEPARTMENTS.length} · Function tags: 4 · Plan tiers: ${TIERS.length}`);
L(`  OpEx groups: ${SEED_EXPENSE_GROUPS.length}`);
const seriesCounts = {
  subscription: 8, // recognized, deferred, billings, arr, mrr, bookings, activeLogos, churnedLogos
  services: 4, // recognized, wip, billed, utilization
  personnel: 7, // totalHeadcount, headcountByFunction, totalPayroll, payrollByFunction, directPayroll, indirectPayroll, servicesCapacity
  costOfRevenue: 8,
  opex: opx.series.groups.length + 1,
  balanceSheet: 16,
};
const totalSeries = Object.values(seriesCounts).reduce((a, b) => a + b, 0);
L(`  Monthly driver/statement series: ~${totalSeries} (${Object.entries(seriesCounts).map(([k, v]) => `${k} ${v}`).join(" · ")})`);
L(`  Monthly data points (series × ${M} months): ~${n(totalSeries * M)}`);

L("\nLAYER 3 · STATEMENTS");
const pnl = buildSeedPnL(month(2026, 6));
const sheet = buildSeedBalanceSheet(month(2026, 6));
const cf = buildSeedCashFlow(month(2026, 6));
L(`  P&L lines: ${pnl.lines.length} (${pnl.lines.filter((l) => l.level === 1).length} leaf + ${pnl.lines.filter((l) => l.level === 0).length} subtotals/headlines)`);
L(`  Balance sheet lines: ${sheet.lines.length}`);
L(`  Cash flow lines: ${cf.lines.length}`);
L(`  Trial balances: 3 fiscal years (FY-close) + ${M} monthly — ${CHART_OF_ACCOUNTS.length} accounts each`);

L("\nLAYER 4 · METRICS");
const dash = buildSeedDashboard(month(2026, 6));
const tiles = dash.families.reduce((s, f) => s + f.tiles.length, 0);
L(`  Dashboard tiles: ${tiles} (${dash.families.map((f) => `${f.family} ${f.tiles.length}`).join(" · ")})`);

L("\nVOLUMES (rows)");
const apBillLines = led.journalEntries.filter((e) => e.source === "ap_bill" && e.memo.startsWith("Vendor")).reduce((s, e) => s + e.lines.length, 0);
L(`  Expense postings (vendor-bill JE lines): ${n(apBillLines)}`);
L(`  OpEx group-months: ${SEED_EXPENSE_GROUPS.length} × ${M} = ${n(SEED_EXPENSE_GROUPS.length * M)}`);
const custMonths = sub.series.activeLogos.reduce((a, b) => a + b, 0);
L(`  Active customer-months: ${n(custMonths)}`);
const bookingEvents = sub.series.bookings.filter((b) => b.newBusiness || b.expansion || b.contraction).length;
L(`  Months with booking activity: ${bookingEvents}/${M}`);

L("\nTIE-OUT CONFIRMATION");
const checkSets: [string, readonly TieOutCheck[]][] = [
  ["subscription", sub.checks],
  ["services", svc.checks],
  ["personnel", per.checks],
  ["cost-of-revenue", cor.checks],
  ["opex", opx.checks],
  ["balance-sheet", bs.checks],
  ["sbc", sbcSeed.checks],
  ["leases", leaseSeed.checks],
  ["gl", led.checks],
  ["sub-ledger", tx.checks],
];
let pass = 0;
let total = 0;
for (const [, cs] of checkSets) {
  for (const c of cs) {
    total += 1;
    if (c.ok) pass += 1;
  }
}
L(`  Checks: ${pass} / ${total} PASS (${checkSets.map(([name, cs]) => `${name} ${cs.length}`).join(" · ")})`);
if (pass !== total) for (const [name, cs] of checkSets) for (const c of cs) if (!c.ok) L(`    FAIL [${name}] ${c.label}`);

// independent reconciliations
const r0 = (x: number) => Math.round(x);
const fy26Rev = cor.fyTotalRevenue[2026];
const pnlRev = pnl.lines.find((l) => l.id === "total_revenue")!.values.forecast!.minor / 100;
const pnlNi = pnl.lines.find((l) => l.id === "net_income")!.values.forecast!.minor / 100;
let assets = 0;
let le = 0;
for (const l of sheet.lines) {
  const v = (l.values.forecast?.minor ?? 0) / 100;
  if (l.section === "asset") assets += v;
  else le += v;
}
L(`  Revenue FY26: seed ${n(r0(fy26Rev))} === P&L ${n(r0(pnlRev))} (Δ ${r0(pnlRev - fy26Rev)})`);
L(`  Net income FY26: P&L ${n(r0(pnlNi))} === seed ${n(r0(bs.fyNetIncome[2026]))} (Δ ${r0(pnlNi - bs.fyNetIncome[2026])})`);
L(`  Balance sheet (FY26 close): assets ${n(r0(assets))} === L+E ${n(r0(le))} (Δ ${(assets - le).toFixed(2)})`);
L(`  Trial balance check: ${led.checks[0].ok ? "BALANCES" : "OUT OF BALANCE"} — ${led.checks[0].detail}`);
// Cross-statement tie: the Cash Flow's Net Change in Cash (FY26 forecast) must equal the Balance
// Sheet cash movement Dec-2025 -> Dec-2026. Catches an SBC / working-capital add-back drift in
// buildSeedCashFlow that the seed's own opCF-series checks miss (see the cash-flow page).
const cfNetChange = cf.lines.find((l) => l.id === "net_change_in_cash")!.values.forecast!.minor / 100;
const bsCashDelta = (bs.series.cash[35] ?? 0) - (bs.series.cash[23] ?? 0);
const cfTieOk = Math.abs(cfNetChange - bsCashDelta) < 0.01;
L(`  Cash flow FY26: net change ${n(r0(cfNetChange))} ${cfTieOk ? "===" : "=/="} BS cash Δ ${n(r0(bsCashDelta))} (Δ ${(cfNetChange - bsCashDelta).toFixed(2)})${cfTieOk ? "" : "  <- FAIL"}`);
if (!cfTieOk) process.exitCode = 1;

// Vendor bills reconcile to the GL SUB-ACCOUNT series (§7 expense granularity): Σ bills stamped with
// a subCode === that sub-account's monthly series, every month. Independent of the group roll-up —
// catches a bill mis-stamped to the wrong sub-account even when the group total still ties.
const subExpected = new Map<string, readonly number[]>();
for (const g of opx.series.groups) for (const sa of g.subAccounts) subExpected.set(sa.subCode, sa.monthly);
const subActual = new Map<string, number[]>();
for (const b of tx.vendorBills) {
  if (!b.subCode) continue;
  const i = months.indexOf(b.period);
  if (i < 0) continue;
  const arr = subActual.get(b.subCode) ?? new Array(months.length).fill(0);
  arr[i] += b.amount.minor / 100;
  subActual.set(b.subCode, arr);
}
let subAcctMaxDelta = 0;
for (const [code, exp] of subExpected) {
  const act = subActual.get(code) ?? [];
  for (let i = 0; i < exp.length; i++) subAcctMaxDelta = Math.max(subAcctMaxDelta, Math.abs((act[i] ?? 0) - exp[i]));
}
const subTieOk = subAcctMaxDelta < 1;
L(`  Vendor bills → GL sub-account: ${subExpected.size} sub-accounts reconcile to the OpEx series (max Δ $${subAcctMaxDelta.toFixed(2)})${subTieOk ? "" : "  <- FAIL"}`);
if (!subTieOk) process.exitCode = 1;

// Monthly board view: each line's FY Total must equal the FY P&L Forecast column. The month-across
// assembler spreads the same series and recomputes subtotals per month — an independent path to the
// same number. LEAF lines tie to the cent (same annual sum); SUBTOTAL lines carry only the standard
// sum-of-rounded vs rounded-sum penny (invisible at $M display). A real drift would be ≥ thousands.
const mpnl = buildSeedMonthlyPnL(month(2026, 6));
let leafMaxDelta = 0;
let subMaxDelta = 0;
let worstLine = "";
for (const ml of mpnl.lines) {
  const fyLine = pnl.lines.find((l) => l.id === ml.id);
  const fyFcst = (fyLine?.values.forecast?.minor ?? 0) / 100;
  const d = Math.abs(ml.total.minor / 100 - fyFcst);
  if (ml.isSubtotal) subMaxDelta = Math.max(subMaxDelta, d);
  else if (d > leafMaxDelta) { leafMaxDelta = d; worstLine = ml.id; }
}
const leafCount = mpnl.lines.filter((l) => !l.isSubtotal).length;
const subCount = mpnl.lines.length - leafCount;
const monthlyTieOk = leafMaxDelta < 0.01 && subMaxDelta < 1.0;
L(`  Monthly P&L FY26: ${leafCount} leaf lines tie EXACTLY (max Δ $${leafMaxDelta.toFixed(2)}${leafMaxDelta < 0.01 ? "" : ` on ${worstLine}  <- FAIL`}) · ${subCount} subtotals within rounding (max Δ $${subMaxDelta.toFixed(2)})`);
if (!monthlyTieOk) process.exitCode = 1;

// Monthly Balance Sheet: each line's Total is the FY-END balance (a snapshot), so it must equal the FY
// Balance Sheet Forecast column EXACTLY (identical computation, an independent month-across path).
const mbs = buildSeedMonthlyBalanceSheet(month(2026, 6));
let mbsMaxDelta = 0;
let mbsWorst = "";
for (const ml of mbs.lines) {
  const fyLine = sheet.lines.find((l) => l.id === ml.id);
  const d = Math.abs(ml.total.minor / 100 - (fyLine?.values.forecast?.minor ?? 0) / 100);
  if (d > mbsMaxDelta) { mbsMaxDelta = d; mbsWorst = ml.id; }
}
const mbsOk = mbsMaxDelta < 0.01;
L(`  Monthly BS FY26: ${mbs.lines.length} lines tie EXACTLY to the FY-end balance (max Δ $${mbsMaxDelta.toFixed(2)}${mbsOk ? "" : ` on ${mbsWorst}  <- FAIL`})`);
if (!mbsOk) process.exitCode = 1;

// Monthly Cash Flow: each line's Total is Σ months — flows sum and the working-capital deltas telescope
// to the FY deltaCash, so every line ties to the FY Cash Flow Forecast column within the sum-of-rounded
// vs rounded-sum penny (the subtotals carry it, like the monthly P&L).
const mcf = buildSeedMonthlyCashFlow(month(2026, 6));
let mcfMaxDelta = 0;
let mcfWorst = "";
for (const ml of mcf.lines) {
  const fyLine = cf.lines.find((l) => l.id === ml.id);
  const d = Math.abs(ml.total.minor / 100 - (fyLine?.values.forecast?.minor ?? 0) / 100);
  if (d > mcfMaxDelta) { mcfMaxDelta = d; mcfWorst = ml.id; }
}
const mcfOk = mcfMaxDelta < 1.0;
L(`  Monthly CF FY26: ${mcf.lines.length} lines tie to the FY forecast (max Δ $${mcfMaxDelta.toFixed(2)}${mcfOk ? "" : ` on ${mcfWorst}  <- FAIL`})`);
if (!mcfOk) process.exitCode = 1;

// Account Mapping totality (P0 #4): the GL chart-of-accounts -> statement-line map must be TOTAL and
// well-formed — every leaf P&L line and every BS line has exactly ONE backing account, the 6 computed
// subtotals have NONE, and no account points at an unknown line. Catches GL<->statements drift that the
// rollup tie-outs miss (the statements never read the map, so a bad mapping otherwise fails silently).
const leafPnlIds = pnl.lines.filter((l) => l.level === 1).map((l) => l.id as string);
const subtotalPnlIds = pnl.lines.filter((l) => l.level === 0).map((l) => l.id as string);
const bsIds = sheet.lines.map((l) => l.id as string);
const backedLineIds = new Set<string>([...leafPnlIds, ...bsIds]);
const coaCountByLine = new Map<string, number>();
for (const a of CHART_OF_ACCOUNTS) coaCountByLine.set(a.statementLineId, (coaCountByLine.get(a.statementLineId) ?? 0) + 1);
const orphanAccts = CHART_OF_ACCOUNTS.filter((a) => !backedLineIds.has(a.statementLineId)).map((a) => a.code);
const uncovered = [...backedLineIds].filter((id) => (coaCountByLine.get(id) ?? 0) !== 1);
const subtotalBacked = subtotalPnlIds.filter((id) => coaCountByLine.has(id));
const mapOk = orphanAccts.length === 0 && uncovered.length === 0 && subtotalBacked.length === 0;
L(`  Account Mapping: ${CHART_OF_ACCOUNTS.length} accounts -> ${backedLineIds.size} statement lines ${mapOk ? "TOTAL + well-formed" : "BROKEN"} (orphans ${orphanAccts.length} · uncovered ${uncovered.length} · subtotals-backed ${subtotalBacked.length})${mapOk ? "" : "  <- FAIL"}`);
if (!mapOk) { process.exitCode = 1; if (orphanAccts.length) L(`    orphan accounts: ${orphanAccts.join(", ")}`); if (uncovered.length) L(`    uncovered lines: ${uncovered.join(", ")}`); if (subtotalBacked.length) L(`    subtotals with an account: ${subtotalBacked.join(", ")}`); }

// Dashboard financial tiles === the P&L Forecast column (guards the SBC-class drift: the dashboard
// recomputes revenue/GP/OI/NI from separate FY aggregates than computeColumns — they must agree).
const finTiles: [string, string][] = [["revenue", "total_revenue"], ["gross_profit", "gross_profit"], ["operating_income", "operating_income"], ["net_income", "net_income"]];
let finMaxDelta = 0;
let finWorst = "";
for (const [metric, lineId] of finTiles) {
  const tile = (buildSeedMetricValue(metric as MetricId, month(2026, 6))?.money?.minor ?? 0) / 100;
  const line = (pnl.lines.find((l) => l.id === lineId)?.values.forecast?.minor ?? 0) / 100;
  const d = Math.abs(tile - line);
  if (d > finMaxDelta) { finMaxDelta = d; finWorst = metric; }
}
const finOk = finMaxDelta < 1.0;
L(`  Dashboard financial tiles === P&L FY26: revenue/GP/OI/NI agree (max Δ $${finMaxDelta.toFixed(2)}${finOk ? "" : ` on ${finWorst}  <- FAIL`})`);
if (!finOk) process.exitCode = 1;
L("\n================ DONE ================");
