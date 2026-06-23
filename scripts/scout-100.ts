/**
 * scout-100 — a 100-question Scout stress test, verified against the REPORTS (CLAUDE.md §10).
 *
 * For each question we run the REAL Scout loop (the live LLM + tool-use), then check two things:
 *   1. ROUTING — did Scout call the right tool(s)? (predicate over the receipts)
 *   2. GROUNDING — does Scout's answer actually surface the figure the TOOL returned? We call the
 *      same tool impl Scout calls to get the ground-truth "report" value, and assert that value's
 *      numeric core appears in the reply. Scout is instructed to quote tool values verbatim, so a
 *      grounded answer must contain it; a miss flags a hallucination / dropped-number risk.
 *
 * Forces the in-memory store (writes are ephemeral) + loads .env.local for the key. Metered (100 live
 * runs). Run: npx tsx scripts/scout-100.ts
 */
process.env.DATASTORE = "in-memory";
import { readFileSync, existsSync } from "node:fs";
function loadEnvLocal() {
  if (process.env.ANTHROPIC_API_KEY || !existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const mt = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2];
  }
}
loadEnvLocal();

import { runScout } from "@/lib/scout/agent";
import { SCOUT_TOOL_IMPLS } from "@/lib/scout/tools";
import { hasApiKey } from "@/lib/scout/config";
import type { ScoutReceipt } from "@/lib/scout/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const tools = (rs: readonly ScoutReceipt[]) => rs.map((r) => r.tool);
const has = (rs: readonly ScoutReceipt[], t: string) => tools(rs).includes(t);
const anyOf = (rs: readonly ScoutReceipt[], ...t: string[]) => tools(rs).some((x) => t.includes(x));
const metric = (rs: readonly ScoutReceipt[], id: string) => rs.some((r) => (r.tool === "getMetric" || r.tool === "explainTile") && r.args.metricId === id);
const noData = (rs: readonly ScoutReceipt[]) => !rs.some((r) => !["getProductMap", "describeModule"].includes(r.tool));

// numeric cores in a string: "23.4", "49", "109", "11,918,577" -> "11918577"
const cores = (s: string): number[] =>
  (s.match(/\d[\d,]*\.?\d*/g) ?? []).map((x) => Number(x.replace(/,/g, ""))).filter((n) => Number.isFinite(n));
/** the reply surfaces the report figure if a number within 1.5% (rounding/compact tolerance) appears. */
function grounded(reply: string, expected: string): boolean {
  const exp = cores(expected);
  const got = cores(reply);
  if (exp.length === 0) return true;
  return exp.some((e) => got.some((g) => Math.abs(g - e) <= Math.max(0.05, Math.abs(e) * 0.015)));
}

interface Ground { tool: string; args?: Record<string, unknown>; pick: (d: any) => string }
interface Case {
  q: string;
  cat: string;
  want: (rs: readonly ScoutReceipt[]) => boolean;
  g?: Ground; // ground-truth report figure
}
const M = (metricId: string): Ground => ({ tool: "getMetric", args: { metricId }, pick: (d) => String(d.value) });

const CASES: readonly Case[] = [
  // ── Financial / profitability ──
  { q: "What was our total revenue this fiscal year?", cat: "financial", want: (rs) => has(rs, "getPnL") || metric(rs, "revenue"), g: M("revenue") },
  { q: "What's our net income for the year?", cat: "financial", want: (rs) => has(rs, "getPnL") || metric(rs, "net_income"), g: M("net_income") },
  { q: "What's our gross profit?", cat: "financial", want: (rs) => has(rs, "getPnL") || metric(rs, "gross_profit"), g: M("gross_profit") },
  { q: "What's our gross margin percentage?", cat: "financial", want: (rs) => metric(rs, "gross_margin_pct") || has(rs, "getPnL"), g: M("gross_margin_pct") },
  { q: "What's our operating income?", cat: "financial", want: (rs) => has(rs, "getPnL") || metric(rs, "operating_income"), g: M("operating_income") },
  { q: "What's our net margin?", cat: "financial", want: (rs) => metric(rs, "net_margin_pct") || has(rs, "getPnL") },
  { q: "Give me the full P&L for this year.", cat: "financial", want: (rs) => has(rs, "getPnL") },
  { q: "How profitable were we — show revenue, gross profit and net income.", cat: "financial", want: (rs) => has(rs, "getPnL") || metric(rs, "revenue") },

  // ── Growth & retention ──
  { q: "What's our ARR right now?", cat: "growth", want: (rs) => metric(rs, "arr_mrr") || has(rs, "getCustomers"), g: M("arr_mrr") },
  { q: "What's our MRR?", cat: "growth", want: (rs) => metric(rs, "arr_mrr"), g: M("arr_mrr") },
  { q: "What's our net revenue retention?", cat: "growth", want: (rs) => metric(rs, "nrr"), g: M("nrr") },
  { q: "What's our gross revenue retention?", cat: "growth", want: (rs) => metric(rs, "grr") || has(rs, "getRenewals") },
  { q: "What's our logo retention rate?", cat: "growth", want: (rs) => metric(rs, "logo_retention"), g: M("logo_retention") },
  { q: "How fast are we growing revenue year over year?", cat: "growth", want: (rs) => metric(rs, "growth") || has(rs, "getPnL") || has(rs, "getBookingsHistory") },
  { q: "What's our annual recurring revenue?", cat: "growth", want: (rs) => metric(rs, "arr_mrr") || has(rs, "getCustomers"), g: M("arr_mrr") },
  { q: "What's our logo churn rate?", cat: "growth", want: (rs) => metric(rs, "logo_retention") },

  // ── Unit economics ──
  { q: "What's our CAC?", cat: "uniteconomics", want: (rs) => metric(rs, "cac_payback"), g: M("cac_payback") },
  { q: "What's our CAC payback period in months?", cat: "uniteconomics", want: (rs) => metric(rs, "cac_payback_months"), g: M("cac_payback_months") },
  { q: "What's our LTV to CAC ratio?", cat: "uniteconomics", want: (rs) => metric(rs, "ltv_cac"), g: M("ltv_cac") },
  { q: "What's our magic number?", cat: "uniteconomics", want: (rs) => metric(rs, "magic_number"), g: M("magic_number") },
  { q: "What's our sales efficiency / magic number?", cat: "uniteconomics", want: (rs) => metric(rs, "magic_number"), g: M("magic_number") },
  { q: "What's our services utilization?", cat: "uniteconomics", want: (rs) => metric(rs, "utilization") || has(rs, "getProjects") },

  // ── Cash & efficiency ──
  { q: "How many months of runway do we have?", cat: "cash", want: (rs) => metric(rs, "runway") || anyOf(rs, "getCashFlow", "getDashboard"), g: M("runway") },
  { q: "What's our Rule of 40?", cat: "cash", want: (rs) => metric(rs, "rule_of_40"), g: M("rule_of_40") },
  { q: "What's our burn multiple?", cat: "cash", want: (rs) => metric(rs, "burn_multiple"), g: M("burn_multiple") },
  { q: "What's our net burn?", cat: "cash", want: (rs) => metric(rs, "net_burn") || has(rs, "getCashFlow") },
  { q: "How much cash are we burning a month?", cat: "cash", want: (rs) => metric(rs, "net_burn") || has(rs, "getCashFlow") },
  { q: "When do we run out of cash?", cat: "cash", want: (rs) => metric(rs, "runway") || has(rs, "getCashFlow") },

  // ── P&L: monthly / annual ──
  { q: "What was our biggest revenue month in 2025?", cat: "pnl-monthly", want: (rs) => has(rs, "getMonthlyPnL") },
  { q: "Which month this year was the most profitable?", cat: "pnl-monthly", want: (rs) => has(rs, "getMonthlyPnL") },
  { q: "Show me the P&L month by month for the fiscal year.", cat: "pnl-monthly", want: (rs) => has(rs, "getMonthlyPnL") },
  { q: "What's our total operating expense this year?", cat: "pnl", want: (rs) => has(rs, "getPnL") },
  { q: "How much did we spend on payroll this year?", cat: "pnl", want: (rs) => has(rs, "getPnL") || has(rs, "getPersonnelForecast") },
  { q: "Why is net income negative — explain the variance.", cat: "pnl", want: (rs) => anyOf(rs, "getPnL", "explainVariance", "getMetric") },

  // ── Balance sheet ──
  { q: "What are our total assets?", cat: "balancesheet", want: (rs) => has(rs, "getBalanceSheet") },
  { q: "How much cash is on the balance sheet?", cat: "balancesheet", want: (rs) => has(rs, "getBalanceSheet") },
  { q: "What's our accounts receivable balance?", cat: "balancesheet", want: (rs) => has(rs, "getBalanceSheet") || has(rs, "getArForecast") },
  { q: "What's our deferred revenue balance?", cat: "balancesheet", want: (rs) => anyOf(rs, "getBalanceSheet", "getContracts") },
  { q: "Show me the balance sheet by month this year.", cat: "balancesheet", want: (rs) => has(rs, "getMonthlyBalanceSheet") },
  { q: "How has our cash balance trended month to month?", cat: "balancesheet", want: (rs) => anyOf(rs, "getMonthlyBalanceSheet", "getMonthlyCashFlow") },

  // ── Cash flow ──
  { q: "How is cash flow looking this year?", cat: "cashflow", want: (rs) => has(rs, "getCashFlow") },
  { q: "What's our net change in cash this year?", cat: "cashflow", want: (rs) => has(rs, "getCashFlow") },
  { q: "Break down our cash flow month by month.", cat: "cashflow", want: (rs) => has(rs, "getMonthlyCashFlow") },
  { q: "What was our operating cash flow?", cat: "cashflow", want: (rs) => has(rs, "getCashFlow") },

  // ── Contracts / bookings ──
  { q: "How many contracts do we have?", cat: "contracts", want: (rs) => has(rs, "getContracts"), g: { tool: "getContracts", pick: (d) => String(d.summary.total) } },
  { q: "Show me our biggest contracts by ARR.", cat: "contracts", want: (rs) => has(rs, "getContracts") },
  { q: "What were our bookings this period?", cat: "contracts", want: (rs) => has(rs, "getContracts") },
  { q: "What were our bookings this year versus last year?", cat: "contracts", want: (rs) => has(rs, "getBookingsHistory") },
  { q: "How are bookings trending year over year?", cat: "contracts", want: (rs) => has(rs, "getBookingsHistory") },
  { q: "What's our remaining performance obligation / contracted backlog?", cat: "contracts", want: (rs) => has(rs, "getContracts") },
  { q: "Pull up contract C-sub-init-0.", cat: "contracts", want: (rs) => anyOf(rs, "getContract", "getContracts") },

  // ── Customers ──
  { q: "How many customers do we have?", cat: "customers", want: (rs) => has(rs, "getCustomers"), g: { tool: "getCustomers", pick: (d) => String(d.summary.total) } },
  { q: "How many logos have we churned?", cat: "customers", want: (rs) => has(rs, "getCustomers"), g: { tool: "getCustomers", pick: (d) => String(d.summary.churned) } },
  { q: "Break down our ARR by customer segment.", cat: "customers", want: (rs) => has(rs, "getCustomers") },
  { q: "Who are our biggest customers by ARR?", cat: "customers", want: (rs) => has(rs, "getCustomers") },
  { q: "How many active accounts do we have?", cat: "customers", want: (rs) => has(rs, "getCustomers"), g: { tool: "getCustomers", pick: (d) => String(d.summary.active) } },
  { q: "Tell me about the customer Talon Labs.", cat: "customers", want: (rs) => anyOf(rs, "getCustomers", "getCustomer") },

  // ── Renewals ──
  { q: "What renewals are coming up this year?", cat: "renewals", want: (rs) => has(rs, "getRenewals") },
  { q: "What's our gross dollar retention on renewals?", cat: "renewals", want: (rs) => has(rs, "getRenewals") },
  { q: "How much ARR is up for renewal?", cat: "renewals", want: (rs) => has(rs, "getRenewals") },
  { q: "When is our next renewal due?", cat: "renewals", want: (rs) => has(rs, "getRenewals") },

  // ── Pipeline ──
  { q: "How much open pipeline do we have?", cat: "pipeline", want: (rs) => has(rs, "getPipeline") },
  { q: "Show me the pipeline by stage.", cat: "pipeline", want: (rs) => has(rs, "getPipeline") },
  { q: "What's our pipeline coverage?", cat: "pipeline", want: (rs) => has(rs, "getPipeline") },
  { q: "Which reps have the most open pipeline?", cat: "pipeline", want: (rs) => has(rs, "getPipeline") },

  // ── Projects ──
  { q: "How many projects are in progress?", cat: "projects", want: (rs) => has(rs, "getProjects") },
  { q: "What's our total WIP / unbilled?", cat: "projects", want: (rs) => has(rs, "getProjects") },
  { q: "What's our delivery utilization?", cat: "projects", want: (rs) => has(rs, "getProjects") || metric(rs, "utilization") },
  { q: "What are our largest services engagements?", cat: "projects", want: (rs) => has(rs, "getProjects") },

  // ── Staff ──
  { q: "How many employees do we have?", cat: "staff", want: (rs) => has(rs, "getStaff"), g: { tool: "getStaff", pick: (d) => String(d.headcount) } },
  { q: "Break down headcount by department.", cat: "staff", want: (rs) => has(rs, "getStaff") },
  { q: "What's our headcount by function?", cat: "staff", want: (rs) => has(rs, "getStaff") },
  { q: "How big is the engineering team?", cat: "staff", want: (rs) => has(rs, "getStaff") },
  { q: "What's our total FTE?", cat: "staff", want: (rs) => has(rs, "getStaff"), g: { tool: "getStaff", pick: (d) => String(d.headcount) } },

  // ── Expense transactions ──
  { q: "What did we spend on marketing in May?", cat: "expenses", want: (rs) => has(rs, "getExpenseTransactions") },
  { q: "Show me our expense transactions for last month.", cat: "expenses", want: (rs) => has(rs, "getExpenseTransactions") },
  { q: "What were our biggest vendor bills?", cat: "expenses", want: (rs) => has(rs, "getExpenseTransactions") },
  { q: "How much did we spend on IT last month?", cat: "expenses", want: (rs) => has(rs, "getExpenseTransactions") },

  // ── Forecast drivers ──
  { q: "What's our revenue forecast and the contracted vs new-business split?", cat: "forecasts", want: (rs) => has(rs, "getRevenueForecast") },
  { q: "Break down our cost of revenue build-up.", cat: "forecasts", want: (rs) => has(rs, "getCostOfRevenue") },
  { q: "What's our payroll forecast by function?", cat: "forecasts", want: (rs) => has(rs, "getPersonnelForecast") },
  { q: "What's the OpEx forecast by group for the year?", cat: "forecasts", want: (rs) => has(rs, "getExpenseForecast") },
  { q: "What makes up the Sales & Marketing forecast in July?", cat: "forecasts", want: (rs) => has(rs, "getExpenseForecast") },
  { q: "What's our DSO and AR forecast?", cat: "forecasts", want: (rs) => has(rs, "getArForecast") },
  { q: "What's our capex and depreciation plan?", cat: "forecasts", want: (rs) => has(rs, "getFixedAssetForecast") },
  { q: "Show me the prepaids amortization schedule.", cat: "forecasts", want: (rs) => has(rs, "getPrepaidsForecast") },

  // ── Board package ──
  { q: "Pull up the board package for this period.", cat: "board", want: (rs) => has(rs, "getBoardPackage") },
  { q: "What metrics are in the board deck?", cat: "board", want: (rs) => has(rs, "getBoardPackage") },

  // ── Reconciliation (the new tool) ──
  { q: "Are the books reconciled?", cat: "reconciliation", want: (rs) => has(rs, "getReconciliation") },
  { q: "Do the detailed transactions tie out to the trial balance?", cat: "reconciliation", want: (rs) => has(rs, "getReconciliation") && !has(rs, "getBalanceSheet") },
  { q: "Are there any reconciliation exceptions I should know about?", cat: "reconciliation", want: (rs) => has(rs, "getReconciliation") },
  { q: "Did we close the month cleanly?", cat: "reconciliation", want: (rs) => anyOf(rs, "getReconciliation", "getPnL") },

  // ── Scenarios: read + write ──
  { q: "What scenarios do we have set up?", cat: "scenarios", want: (rs) => has(rs, "getScenarios") },
  { q: "Show me the 25% Profit scenario's P&L.", cat: "scenarios", want: (rs) => has(rs, "getScenarioPnL") },
  { q: "Compare the Breakeven and Base scenarios side by side.", cat: "scenarios", want: (rs) => has(rs, "compareScenarios") },
  { q: "Create a new scenario called Downside Case.", cat: "scenarios", want: (rs) => has(rs, "createScenario") },
  { q: "What if we freeze hiring from August — model the impact on net income.", cat: "scenarios", want: (rs) => anyOf(rs, "setDriver", "createScenario", "duplicateScenario") },
  { q: "Model subscription revenue dropping 15% from July and show me the P&L.", cat: "scenarios", want: (rs) => anyOf(rs, "setDriver", "createScenario", "duplicateScenario") },

  // ── Flux notes ──
  { q: "Why is Sales & Marketing over budget — is there a note?", cat: "flux", want: (rs) => has(rs, "getFluxNotes") && !has(rs, "addFluxNote") },
  { q: "For account 6200, add a note that the overage is the Q3 campaign pull-forward.", cat: "flux", want: (rs) => has(rs, "addFluxNote") },
  { q: "What's driving the Sales & Marketing overage — break down the actuals.", cat: "flux", want: (rs) => has(rs, "getFluxDetail") },

  // ── Product knowledge / how-to (no data tool) ──
  { q: "What does the Contracts page do?", cat: "howto", want: noData },
  { q: "Where in the app do I create a scenario?", cat: "howto", want: noData },
  { q: "What's the difference between Base and Budget?", cat: "howto", want: noData },
  { q: "How do I import a new month's actuals?", cat: "howto", want: noData },
  { q: "How does the reconciliation control total work?", cat: "howto", want: noData },
];

async function groundFigure(g: Ground): Promise<string> {
  const impl = SCOUT_TOOL_IMPLS[g.tool];
  if (!impl) return "";
  const { data } = await impl.run(g.args ?? {});
  try {
    return g.pick(data);
  } catch {
    return "";
  }
}

// small concurrency pool (live API; keep modest to avoid rate limits)
async function pool<T, R>(items: readonly T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    }),
  );
  return out;
}

interface Result { c: Case; routed: boolean; groundedOk: boolean | null; trace: string; reply: string; expected: string; err?: string }

async function main() {
  if (!hasApiKey()) {
    console.log("\nSCOUT-100 — SKIPPED (no ANTHROPIC_API_KEY).\n");
    return;
  }
  console.log(`\n===== SCOUT-100 — ${CASES.length} questions through the live loop, verified vs the reports =====\n`);

  const results = await pool(CASES, 4, async (c): Promise<Result> => {
    try {
      const res = await runScout([{ role: "user", content: c.q }]);
      const routed = res.mode === "live" && c.want(res.receipts);
      const trace = res.receipts.map((r) => `${r.tool}${r.args.metricId ? `(${r.args.metricId})` : ""}`).join(", ") || "(no tool)";
      let groundedOk: boolean | null = null;
      let expected = "";
      if (c.g) {
        expected = await groundFigure(c.g);
        groundedOk = grounded(res.reply, expected);
      }
      return { c, routed, groundedOk, trace, reply: res.reply, expected };
    } catch (e) {
      return { c, routed: false, groundedOk: null, trace: "", reply: "", expected: "", err: (e as Error).message };
    }
  });

  // per-category routing
  const byCat = new Map<string, { n: number; ok: number }>();
  let routedOk = 0;
  let gOk = 0;
  let gTotal = 0;
  for (const r of results) {
    const cc = byCat.get(r.c.cat) ?? { n: 0, ok: 0 };
    cc.n++;
    if (r.routed) cc.ok++;
    byCat.set(r.c.cat, cc);
    if (r.routed) routedOk++;
    if (r.groundedOk !== null) {
      gTotal++;
      if (r.groundedOk) gOk++;
    }
  }

  console.log("ROUTING by category:");
  for (const [cat, v] of [...byCat].sort()) console.log(`  ${v.ok === v.n ? "ok " : "!! "} ${cat.padEnd(16)} ${v.ok}/${v.n}`);

  const routeFails = results.filter((r) => !r.routed);
  if (routeFails.length) {
    console.log(`\nROUTING MISSES (${routeFails.length}):`);
    for (const r of routeFails) console.log(`  ✗ "${r.c.q}"\n      got [${r.trace}]${r.err ? ` ERROR ${r.err}` : ""}`);
  }
  const groundFails = results.filter((r) => r.groundedOk === false);
  if (groundFails.length) {
    console.log(`\nGROUNDING MISSES (figure not surfaced — INSPECT, may be a format/compaction diff or a real miss):`);
    for (const r of groundFails) console.log(`  ? "${r.c.q}"\n      report=${r.expected}  reply="${r.reply.slice(0, 160).replace(/\s+/g, " ")}"`);
  }

  console.log(`\n──────── SCOUT-100 ────────`);
  console.log(`  ROUTING:   ${routedOk}/${CASES.length} (${((routedOk / CASES.length) * 100).toFixed(0)}%)`);
  console.log(`  GROUNDING: ${gOk}/${gTotal} (${gTotal ? ((gOk / gTotal) * 100).toFixed(0) : 0}% of the ${gTotal} numeric-checked answers surfaced the report figure)`);
  console.log(`───────────────────────────\n`);
  process.exitCode = routedOk >= Math.ceil(CASES.length * 0.9) ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
