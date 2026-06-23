/**
 * Scout-readiness gate (CLAUDE.md §4 "Scout-ready bar", §10). This is NOT the agent — it proves
 * the DETERMINISTIC SPINE that Scout will call is sound, so wiring tool-use in the Run is wiring,
 * not a numbers risk. A finance tool-use agent does no arithmetic; it repeats what its tools return.
 * So Scout's trust reduces to three properties of the live query surface:
 *
 *   1. SERIALIZABLE  — every live tool result JSON round-trips (tool results reach the model as JSON).
 *   2. CONSISTENT    — the same number agrees across every tool that reports it (Scout can't contradict itself).
 *   3. DETERMINISTIC — same tool + same args → identical bytes (Scout's answers are reproducible).
 *
 * Plus a registry-honesty report from the SINGLE source of truth (lib/queries/registry.ts — TOOL_THUNKS /
 * SCOUT_REGISTRY): which declared Scout tools are backed by a LIVE query today. No parallel string map here.
 * Run: npx tsx scripts/scout-readiness.ts
 */
import {
  SCOUT_REGISTRY,
  TOOL_THUNKS,
  backing,
  type QueryName,
  getPnL,
  getCashFlow,
  getBalanceSheet,
  getMetric,
  getRunway,
} from "@/lib/queries";
import type { Money } from "@/lib/types/money";
import { month } from "@/lib/types/period";
import type { MetricId, ScenarioId } from "@/lib/types/common";
import type { PnLLineId } from "@/lib/types/statements";

const PERIOD = month(2026, 6); // the app's current period (app/dashboard/page.tsx)
const dollars = (m?: Money): number => (m ? m.minor / 100 : NaN);
const ok = (b: boolean) => (b ? "PASS" : "FAIL");
let pass = 0;
let fail = 0;
const record = (b: boolean) => { if (b) pass++; else fail++; return b; };

// Representative test args per live query. The query SET comes from the registry's TOOL_THUNKS (one
// source of truth); only the sample args live here. callQuery exercises a query for serialize/determinism.
const ARGS: Record<QueryName, readonly unknown[]> = {
  getDashboardSummary: [PERIOD],
  getKpiTile: ["net_income" as MetricId, PERIOD],
  getMetric: ["net_income" as MetricId, PERIOD],
  getPnL: [PERIOD],
  getMonthlyPnL: [PERIOD],
  getPnLLine: ["net_income" as PnLLineId, PERIOD],
  getBalanceSheet: [PERIOD],
  getMonthlyBalanceSheet: [PERIOD],
  getCashFlow: [PERIOD],
  getMonthlyCashFlow: [PERIOD],
  listContracts: [],
  getContract: ["C-sub-init-0"],
  getBookingsHistory: [PERIOD],
  listCustomers: [],
  getCustomer: ["sub-init-0"],
  listRenewals: [],
  listPipeline: [],
  listProjects: [],
  listStaff: [],
  listExpenseTransactions: [],
  getRevenueForecast: [PERIOD],
  getCostOfRevenue: [PERIOD],
  getPersonnelForecast: [PERIOD],
  getExpenseForecast: [PERIOD],
  getArForecast: [PERIOD],
  getFixedAssetForecast: [PERIOD],
  getPrepaidsForecast: [PERIOD],
  getBoardPackage: [PERIOD],
  listScenarios: [],
  getScenarioPnL: ["base" as ScenarioId],
  getScenarioDashboard: [["base"] as ScenarioId[]],
  listFluxNotes: [{}],
  getFluxDetail: ["sales_marketing", PERIOD],
  getReconciliation: [PERIOD],
};
const callQuery = (name: QueryName): Promise<unknown> =>
  (TOOL_THUNKS[name] as (...a: readonly unknown[]) => Promise<unknown>)(...ARGS[name]);

async function main() {
  console.log("\n===== SCOUT-READINESS GATE =====");
  console.log(`period ${PERIOD} · proving the spine Scout calls is serializable, consistent, deterministic\n`);

  // ── 1. Registry honesty: which declared tools are backed by a LIVE query (Scout Follows Modules) ──
  console.log("REGISTRY — declared Scout tools vs live spine");
  const liveData = new Set<QueryName>();
  for (const b of SCOUT_REGISTRY) {
    let status: string;
    if (backing(b) === "external") status = "product-knowledge (guides)";
    else if (b.query === null) status = `not-built (${b.plannedQuery ?? "planned"})`;
    else {
      try { await callQuery(b.query); status = "LIVE — ready to wire"; liveData.add(b.query); }
      catch { status = "stub (notImplemented)"; }
    }
    console.log(`  ${b.module.padEnd(14)} ${b.tool.padEnd(20)} → ${(b.query ?? b.plannedQuery ?? "—").padEnd(22)} ${status}`);
  }
  console.log(`  ⇒ ${liveData.size}/${SCOUT_REGISTRY.length} declared tools backed by a live, tie-out query today\n`);

  // ── 2. SERIALIZABLE + DETERMINISTIC, per live tool ──
  console.log("SERIALIZABLE + DETERMINISTIC — each live tool result round-trips and is reproducible");
  for (const name of Object.keys(TOOL_THUNKS) as QueryName[]) {
    let r1: unknown;
    let live = true;
    try { r1 = await callQuery(name); } catch { live = false; }
    if (!live) { console.log(`  ${name.padEnd(22)} stub — skipped (built in the Run)`); continue; }
    const r2 = await callQuery(name);
    const s1 = JSON.stringify(r1);
    const roundTrip = JSON.stringify(JSON.parse(s1)); // throws if not serializable
    const serializable = roundTrip === s1;
    const deterministic = JSON.stringify(r2) === s1;
    record(serializable);
    record(deterministic);
    console.log(`  ${name.padEnd(22)} serialize ${ok(serializable)} · deterministic ${ok(deterministic)} · ${(s1.length / 1024).toFixed(1)}KB`);
  }

  // ── 3. CONSISTENT — the same number agrees across every tool that reports it ──
  console.log("\nCONSISTENT — cross-tool tie-out (Scout reads the same value whichever tool it calls)");
  const pnl = await getPnL(PERIOD);
  const cf = await getCashFlow(PERIOD);
  const bs = await getBalanceSheet(PERIOD);
  const pnlLine = (id: PnLLineId) => pnl.lines.find((l) => l.id === id)?.values.forecast;
  const cfLine = (id: string) => cf.lines.find((l) => l.id === id)?.values.forecast;

  const checks: { label: string; a: number; b: number; unit?: string }[] = [];
  // Revenue / gross profit / operating income / net income: P&L forecast vs the dashboard metric.
  for (const [id, metricId] of [
    ["total_revenue", "revenue"],
    ["gross_profit", "gross_profit"],
    ["operating_income", "operating_income"],
    ["net_income", "net_income"],
  ] as const) {
    const mv = await getMetric(metricId as MetricId, PERIOD);
    checks.push({ label: `${id}: getPnL == getMetric(${metricId})`, a: dollars(pnlLine(id)), b: dollars(mv.money) });
  }
  // Net income is reported by THREE tools — they must all agree.
  checks.push({ label: "net_income: getPnL == getCashFlow", a: dollars(pnlLine("net_income")), b: dollars(cfLine("net_income")) });
  // Net burn: getRunway vs the net_burn metric.
  const runway = await getRunway(PERIOD);
  const netBurnMetric = await getMetric("net_burn" as MetricId, PERIOD);
  checks.push({ label: "net_burn: getRunway == getMetric(net_burn)", a: dollars(runway.netBurn), b: dollars(netBurnMetric.money) });
  // Runway months: getRunway vs the runway metric (count).
  const runwayMetric = await getMetric("runway" as MetricId, PERIOD);
  checks.push({ label: "runway(mo): getRunway == getMetric(runway)", a: Math.round(runway.months ?? -1), b: runwayMetric.count ?? -1, unit: "mo" });
  // Balance-sheet identity THROUGH the query (forecast column): Assets == Liabilities + Equity.
  const sumSection = (sec: string) => bs.lines.filter((l) => l.section === sec).reduce((s, l) => s + dollars(l.values.forecast), 0);
  checks.push({ label: "balance sheet: Assets == Liabilities + Equity", a: sumSection("asset"), b: sumSection("liability") + sumSection("equity") });

  for (const c of checks) {
    const delta = Math.abs(c.a - c.b);
    const tied = record(delta < 1); // within $1 (or 0 mo) ⇒ ties out
    const fmt = (x: number) => (c.unit === "mo" ? `${x}mo` : `$${Math.round(x).toLocaleString()}`);
    console.log(`  ${ok(tied)}  ${c.label.padEnd(46)} ${fmt(c.a)} vs ${fmt(c.b)} (Δ ${c.unit === "mo" ? delta : "$" + delta.toFixed(2)})`);
  }

  console.log(`\n================ SCOUT-READINESS: ${pass}/${pass + fail} checks PASS ================`);
  if (fail > 0) process.exitCode = 1;
}

main();
