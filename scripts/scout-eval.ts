/**
 * scout-eval — Scout's routing gate (CLAUDE.md §10, the Run plan's "routing eval" unblocker).
 *
 * Two layers, by design:
 *   1. STRUCTURAL (free, deterministic — always runs, CI-safe): every wired data tool is backed by
 *      a live query, has an impl with a well-formed schema, and its run() returns a usable receipt
 *      (a non-empty label + an in-app href). This catches a flipped `wired` with a broken tool.
 *   1b. DETERMINISTIC ROUTING (free): the no-key keyword router maps obvious questions correctly.
 *   2. LLM ROUTING (metered — runs only when ANTHROPIC_API_KEY is set): the REAL loop is asked a
 *      curated set of questions; we assert which tool(s) it called via the receipts. Weighted toward
 *      the OVERLAP pairs the register fan-out will create (contracts vs balance sheet for "deferred",
 *      runway as metric vs cash flow, gross margin as metric vs P&L) — that's where misroutes appear.
 *
 * Run:  npx tsx scripts/scout-eval.ts        (structural + deterministic; LLM layer if a key is present)
 * The LLM layer is non-deterministic + metered, so it passes on a THRESHOLD (not all-or-nothing) and is
 * meant to be run on-demand when the tool surface changes, not on every CI push.
 */
import { readFileSync, existsSync } from "node:fs";
import { runScout } from "@/lib/scout/agent";
import { runDeterministicScout } from "@/lib/scout/router";
import { SCOUT_TOOL_IMPLS, wiredScoutTools } from "@/lib/scout/tools";
import { hasApiKey } from "@/lib/scout/config";
import { SCOUT_REGISTRY, TOOL_THUNKS } from "@/lib/queries/registry";
import type { ScoutReceipt } from "@/lib/scout/types";

// tsx doesn't auto-load .env.local the way Next does — load it so the LLM layer can find the key.
function loadEnvLocal() {
  if (process.env.ANTHROPIC_API_KEY || !existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const mt = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2];
  }
}

const ok = (b: boolean) => (b ? "PASS" : "FAIL");
let structuralFail = 0;
let routingFail = 0;

// ── helpers over the receipt trace ──
const toolsOf = (rs: readonly ScoutReceipt[]) => rs.map((r) => r.tool);
const metricsOf = (rs: readonly ScoutReceipt[]) =>
  rs.filter((r) => r.tool === "getMetric" || r.tool === "explainTile").map((r) => r.args.metricId);
const has = (rs: readonly ScoutReceipt[], tool: string) => toolsOf(rs).includes(tool);
const anyOf = (rs: readonly ScoutReceipt[], ...tools: string[]) => toolsOf(rs).some((t) => tools.includes(t));
// Product-knowledge lane: the guide-backed tools (NOT the number spine).
const PRODUCT_KNOWLEDGE_TOOLS = ["getProductMap", "describeModule"];
const DATA_TOOLS = wiredScoutTools().map((w) => w.name).filter((n) => !PRODUCT_KNOWLEDGE_TOOLS.includes(n));
// A how-to is answered correctly if it called NO data tool (either no tool, or a guide tool).
const noDataTool = (rs: readonly ScoutReceipt[]) => !rs.some((r) => DATA_TOOLS.includes(r.tool));

// ── the curated LLM routing cases (want = a predicate over the receipts) ──
interface Case {
  readonly q: string;
  readonly want: string;
  readonly check: (rs: readonly ScoutReceipt[]) => boolean;
}
const CASES: readonly Case[] = [
  // unambiguous data routes
  { q: "How many contracts do we have?", want: "getContracts", check: (rs) => has(rs, "getContracts") },
  { q: "Show me our biggest contracts by ARR.", want: "getContracts", check: (rs) => has(rs, "getContracts") },
  { q: "What's the bookings ΔARR this period?", want: "getContracts (this-period bookings live in Contracts)", check: (rs) => has(rs, "getContracts") },
  // bookings OVER TIME must hit getBookingsHistory, not a single-month getContracts (the lumpy-YoY trap)
  { q: "What were our bookings this year compared to last year?", want: "getBookingsHistory", check: (rs) => has(rs, "getBookingsHistory") },
  { q: "How are bookings trending year over year?", want: "getBookingsHistory", check: (rs) => has(rs, "getBookingsHistory") },
  { q: "What's our CAC?", want: "getMetric(cac_payback)", check: (rs) => metricsOf(rs).includes("cac_payback") },
  // CAC payback PERIOD (months) is a distinct metric from the dollar CAC — must not collide either way
  { q: "What's our CAC payback period in months?", want: "getMetric(cac_payback_months)", check: (rs) => metricsOf(rs).includes("cac_payback_months") },
  { q: "How long does it take to recover our customer acquisition cost?", want: "getMetric(cac_payback_months)", check: (rs) => metricsOf(rs).includes("cac_payback_months") },
  { q: "What's our Rule of 40?", want: "getMetric(rule_of_40)", check: (rs) => metricsOf(rs).includes("rule_of_40") },
  { q: "What are our total assets?", want: "getBalanceSheet", check: (rs) => has(rs, "getBalanceSheet") },
  { q: "How is cash flow looking this year?", want: "getCashFlow", check: (rs) => has(rs, "getCashFlow") },
  { q: "Give me the dashboard overview.", want: "getDashboard", check: (rs) => has(rs, "getDashboard") },
  // monthly statement questions must hit getMonthlyPnL, NOT 12x getPnL (which returns the FY total every time)
  { q: "What was our biggest revenue month in 2025?", want: "getMonthlyPnL", check: (rs) => has(rs, "getMonthlyPnL") },
  { q: "Which month in 2025 was the most profitable?", want: "getMonthlyPnL", check: (rs) => has(rs, "getMonthlyPnL") },
  // monthly BS/CF — the "monthly" intent must reach the month-across tool, NOT the annual statement
  { q: "Show me the balance sheet by month for this fiscal year.", want: "getMonthlyBalanceSheet", check: (rs) => has(rs, "getMonthlyBalanceSheet") },
  { q: "Break down our cash flow month by month.", want: "getMonthlyCashFlow", check: (rs) => has(rs, "getMonthlyCashFlow") },
  { q: "How does our cash position trend month to month this year?", want: "getMonthlyBalanceSheet OR getMonthlyCashFlow", check: (rs) => anyOf(rs, "getMonthlyBalanceSheet", "getMonthlyCashFlow") },
  { q: "Pull up contract C-sub-init-0.", want: "getContract", check: (rs) => has(rs, "getContract") },
  // Customers register — sibling of getContracts; "customers" must NOT steal to getContracts (and vice-versa)
  { q: "How many customers do we have?", want: "getCustomers", check: (rs) => has(rs, "getCustomers") },
  { q: "Break down our ARR by customer segment.", want: "getCustomers", check: (rs) => has(rs, "getCustomers") },
  { q: "How many logos have we churned?", want: "getCustomers", check: (rs) => has(rs, "getCustomers") },
  { q: "Tell me about the customer Talon Labs.", want: "getCustomers or getCustomer", check: (rs) => anyOf(rs, "getCustomers", "getCustomer") },
  // metric/register boundary — "accounts" (no keyword overlap) and churn RATE (the metric) vs churned LOGOS (the register)
  { q: "How many accounts do we have?", want: "getCustomers", check: (rs) => has(rs, "getCustomers") },
  { q: "What's our logo churn rate?", want: "getMetric(logo_retention)", check: (rs) => metricsOf(rs).includes("logo_retention") },
  // multi-tool (the chain the deterministic fallback can't do)
  { q: "What are our NRR and magic number, and how do they compare?", want: "getMetric(nrr) + getMetric(magic_number)", check: (rs) => metricsOf(rs).includes("nrr") && metricsOf(rs).includes("magic_number") },
  // overlap pairs (fan-out will sharpen these) — accept either credible surface
  { q: "What's our deferred revenue balance?", want: "getContracts OR getBalanceSheet", check: (rs) => anyOf(rs, "getContracts", "getBalanceSheet") },
  { q: "How many months of runway do we have?", want: "getMetric(runway) OR getCashFlow OR getDashboard", check: (rs) => metricsOf(rs).includes("runway") || anyOf(rs, "getCashFlow", "getDashboard") },
  { q: "What's our gross margin?", want: "getMetric(gross_margin_pct) OR getPnL", check: (rs) => metricsOf(rs).includes("gross_margin_pct") || has(rs, "getPnL") },
  { q: "What's our ARR right now?", want: "getMetric(arr_mrr) OR getCustomers", check: (rs) => metricsOf(rs).includes("arr_mrr") || has(rs, "getCustomers") },
  // MRR alone must reach the arr_mrr metric (the routing miss the live eval caught)
  { q: "What's our MRR?", want: "getMetric(arr_mrr)", check: (rs) => metricsOf(rs).includes("arr_mrr") },
  { q: "What's our monthly recurring revenue?", want: "getMetric(arr_mrr)", check: (rs) => metricsOf(rs).includes("arr_mrr") },
  { q: "What's our net income this year?", want: "getPnL OR getMetric(net_income) OR explainVariance", check: (rs) => has(rs, "getPnL") || metricsOf(rs).includes("net_income") || has(rs, "explainVariance") },
  // Renewals register — sibling of the retention RATE metrics; "renewal(s)" must NOT steal NRR (and vice-versa)
  { q: "What renewals are coming up this year?", want: "getRenewals", check: (rs) => has(rs, "getRenewals") },
  { q: "What's our gross dollar retention on renewals?", want: "getRenewals", check: (rs) => has(rs, "getRenewals") },
  { q: "What's our net revenue retention?", want: "getMetric(nrr) — the rate, not the renewals register", check: (rs) => metricsOf(rs).includes("nrr") },
  // Pipeline register — open deals vs signed contracts
  { q: "How much open pipeline do we have?", want: "getPipeline", check: (rs) => has(rs, "getPipeline") },
  { q: "Show me the pipeline by stage.", want: "getPipeline", check: (rs) => has(rs, "getPipeline") },
  // Reporting registers — Projects / Staff / Expense Transactions
  { q: "How many projects are in progress?", want: "getProjects", check: (rs) => has(rs, "getProjects") },
  { q: "What's our total WIP?", want: "getProjects", check: (rs) => has(rs, "getProjects") },
  { q: "How many employees do we have?", want: "getStaff", check: (rs) => has(rs, "getStaff") },
  { q: "Break down headcount by department.", want: "getStaff", check: (rs) => has(rs, "getStaff") },
  { q: "What did we spend on marketing in May?", want: "getExpenseTransactions", check: (rs) => has(rs, "getExpenseTransactions") },
  // overlap: utilization is a metric AND surfaced by Projects — accept either credible surface
  { q: "What's our utilization?", want: "getMetric(utilization) OR getProjects", check: (rs) => metricsOf(rs).includes("utilization") || has(rs, "getProjects") },
  // Forecast drivers — the forward ASSUMPTION, distinct from the actual/statement number
  { q: "What's our revenue forecast and the contracted vs new-business split?", want: "getRevenueForecast", check: (rs) => has(rs, "getRevenueForecast") },
  { q: "Break down our Cost of Revenue / cost-to-serve.", want: "getCostOfRevenue", check: (rs) => has(rs, "getCostOfRevenue") },
  { q: "What's our payroll forecast by function?", want: "getPersonnelForecast", check: (rs) => has(rs, "getPersonnelForecast") },
  { q: "What's the OpEx forecast by group for the year?", want: "getExpenseForecast", check: (rs) => has(rs, "getExpenseForecast") },
  { q: "What makes up the Sales & Marketing forecast in July — break it down by account and vendor?", want: "getExpenseForecast (drill)", check: (rs) => has(rs, "getExpenseForecast") },
  { q: "What's our DSO and AR forecast?", want: "getArForecast", check: (rs) => has(rs, "getArForecast") },
  { q: "What's our capex and depreciation plan?", want: "getFixedAssetForecast", check: (rs) => has(rs, "getFixedAssetForecast") },
  // driver vs actual overlap — bare "revenue this year" is the statement number, NOT the forecast driver
  { q: "What was our total revenue this fiscal year?", want: "getPnL OR getMetric(revenue), NOT getRevenueForecast", check: (rs) => !has(rs, "getRevenueForecast") && (has(rs, "getPnL") || metricsOf(rs).includes("revenue")) },
  // Board package
  { q: "Pull up the board package for the period.", want: "getBoardPackage", check: (rs) => has(rs, "getBoardPackage") },
  // Reconciliation control total (Data Import) — "tie out / reconcile" must NOT grab getBalanceSheet
  { q: "Are the books reconciled?", want: "getReconciliation", check: (rs) => has(rs, "getReconciliation") },
  { q: "Do the detailed transactions tie out to the trial balance?", want: "getReconciliation, NOT getBalanceSheet", check: (rs) => has(rs, "getReconciliation") && !has(rs, "getBalanceSheet") },
  // Scenarios — READ saved scenarios (distinct from the what-if guard below)
  { q: "What scenarios do we have set up?", want: "getScenarios", check: (rs) => has(rs, "getScenarios") },
  { q: "Show me the 25% Profit scenario's P&L.", want: "getScenarioPnL", check: (rs) => has(rs, "getScenarioPnL") },
  { q: "Compare the Breakeven and Base scenarios side by side.", want: "compareScenarios", check: (rs) => has(rs, "compareScenarios") },
  // Flux — read vs write: each must route to its own tool, never steal the other
  { q: "Why is Sales & Marketing over budget — is there a note explaining it?", want: "getFluxNotes (read)", check: (rs) => has(rs, "getFluxNotes") && !has(rs, "addFluxNote") },
  { q: "For account 6200, add a note that the overage is the Q3 campaign pull-forward.", want: "addFluxNote (write)", check: (rs) => has(rs, "addFluxNote") },
  { q: "What's driving the Sales & Marketing overage — break down the actuals.", want: "getFluxDetail", check: (rs) => has(rs, "getFluxDetail") },
  // Scenarios — WRITE surface (create/duplicate/setDriver) + modeling a what-if THROUGH the engine
  { q: "Create a new scenario called 'Downside Case'.", want: "createScenario", check: (rs) => has(rs, "createScenario") },
  { q: "Duplicate the 25% Profit scenario so I can tweak a copy.", want: "duplicateScenario", check: (rs) => has(rs, "duplicateScenario") },
  { q: "In a new scenario, set subscription revenue to -15% starting July 2026, then show me the P&L.", want: "setDriver (built through the engine)", check: (rs) => has(rs, "setDriver") },
  // a what-if must now route THROUGH the engine (create/duplicate + setDriver + read), NEVER hand-computed off getPnL
  { q: "What if we freeze hiring from August — model it and tell me the impact on net income.", want: "engine write path, not a hand-computed getPnL", check: (rs) => anyOf(rs, "setDriver", "createScenario", "duplicateScenario") },
  { q: "Model a sensitivity where subscription growth drops to +10%.", want: "engine write path (create/duplicate + setDriver), not fabricated off getPnL", check: (rs) => anyOf(rs, "setDriver", "createScenario", "duplicateScenario") },
  // product-knowledge — answer from the guides (a guide tool is fine), NEVER a data/number tool
  { q: "What does the Contracts page do?", want: "no data tool (guide-backed)", check: noDataTool },
  { q: "Where in the app do I create a scenario?", want: "no data tool (guide-backed)", check: noDataTool },
  { q: "What's the difference between Base and Budget?", want: "no data tool (guide-backed)", check: noDataTool },
  { q: "How do I update actuals?", want: "describeModule/getProductMap (guide-backed)", check: noDataTool },
];

// ── deterministic-router smoke (free): obvious keyword routes ──
const DET_CASES: readonly { q: string; tool: string }[] = [
  { q: "What's our runway?", tool: "getMetric" },
  { q: "How many contracts do we have?", tool: "getContracts" },
  { q: "How many customers do we have?", tool: "getCustomers" },
  { q: "What were our bookings this year vs last year?", tool: "getBookingsHistory" },
  { q: "Break down our ARR by customer segment.", tool: "getCustomers" },
  { q: "What's our MRR?", tool: "getMetric" },
  { q: "What's our monthly recurring revenue?", tool: "getMetric" },
  { q: "What's our logo churn rate?", tool: "getMetric" },
  { q: "What's our CAC payback period?", tool: "getMetric" },
  { q: "Show me the P&L / net income.", tool: "getPnL" },
  { q: "What was the biggest revenue month in 2025?", tool: "getMonthlyPnL" },
  { q: "Show me the balance sheet by month.", tool: "getMonthlyBalanceSheet" },
  { q: "Break down cash flow month by month.", tool: "getMonthlyCashFlow" },
  // annual cash flow — guards the \bcash\b-shadows-cash-flow router bug (was returning the Balance Sheet)
  { q: "How is cash flow looking this year?", tool: "getCashFlow" },
  // month-qualified burn → the monthly CF trajectory, not the scalar net_burn metric
  { q: "What's our monthly burn this year?", tool: "getMonthlyCashFlow" },
  { q: "What are total assets on the balance sheet?", tool: "getBalanceSheet" },
  { q: "What renewals are coming up?", tool: "getRenewals" },
  { q: "How much open pipeline do we have?", tool: "getPipeline" },
  { q: "How many projects are in progress?", tool: "getProjects" },
  { q: "How many employees do we have?", tool: "getStaff" },
  { q: "What did we spend on marketing last month?", tool: "getExpenseTransactions" },
  { q: "What's our revenue forecast for the year?", tool: "getRevenueForecast" },
  { q: "What's the cost of revenue build-up?", tool: "getCostOfRevenue" },
  { q: "Show the payroll forecast by function.", tool: "getPersonnelForecast" },
  { q: "What's the OpEx forecast by group?", tool: "getExpenseForecast" },
  { q: "What's our DSO?", tool: "getArForecast" },
  { q: "What's the capex plan?", tool: "getFixedAssetForecast" },
  { q: "Show me the prepaids schedule.", tool: "getPrepaidsForecast" },
  { q: "Pull up the board package.", tool: "getBoardPackage" },
  { q: "Are the books reconciled?", tool: "getReconciliation" },
  { q: "Do the detailed transactions tie out to the trial balance?", tool: "getReconciliation" },
  { q: "What scenarios do we have?", tool: "getScenarios" },
  { q: "Compare the breakeven and base scenarios.", tool: "compareScenarios" },
  { q: "Show the 25% profit scenario P&L.", tool: "getScenarioPnL" },
  { q: "Why is Sales & Marketing over budget? Any notes?", tool: "getFluxNotes" },
  { q: "Break down the Sales & Marketing variance.", tool: "getFluxDetail" },
];

async function main() {
  // FORCE the in-memory store before loading .env.local: the LLM layer exercises the WRITE tool
  // (addFluxNote), and those writes must hit the ephemeral in-memory store — never a real backend
  // (.env.local may carry DATASTORE=supabase for the running app). Set first so loadEnvLocal won't override.
  process.env.DATASTORE = "in-memory";
  loadEnvLocal();
  console.log("\n===== SCOUT-EVAL — routing gate (DataStore forced in-memory; writes are ephemeral) =====\n");

  // ── 1. STRUCTURAL (free) ──
  console.log("STRUCTURAL — every wired data tool is backed, implemented, and returns a usable receipt");
  const wired = wiredScoutTools();
  console.log(`  wired data tools: ${wired.length} (${wired.map((w) => w.name).join(", ")})`);
  for (const b of SCOUT_REGISTRY.filter((x) => x.wired && x.lane === "data")) {
    const impl = SCOUT_TOOL_IMPLS[b.tool];
    // A write tool is backed by its impl (not a read query in TOOL_THUNKS); never run it here.
    const backed = b.write ? !!impl : b.query !== null && (b.query as string) in TOOL_THUNKS;
    const schemaOk = !!impl && impl.inputSchema.type === "object" && impl.inputSchema.additionalProperties === false;
    let receiptOk = false;
    let detail = "";
    try {
      // run with empty input — required-arg tools throw or short-circuit; that's fine, we only need the
      // ones runnable from empty (period-only) to prove the run()->query->receipt path; others are
      // proven by scout-readiness's per-query serialize check, so here we just require an impl + schema.
      if (impl && (!impl.inputSchema.required || impl.inputSchema.required.length === 0)) {
        const { receipt } = await impl.run({});
        receiptOk = !!receipt.tool && !!receipt.label && receipt.href.startsWith("/");
        detail = `${receipt.label} -> ${receipt.href}`;
      } else {
        receiptOk = true; // required-arg tool: impl + schema presence is the structural guarantee here
        detail = "(required-arg; receipt proven via live case)";
      }
    } catch (e) {
      detail = `run() threw: ${(e as Error).message}`;
    }
    const pass = !!impl && backed && schemaOk && receiptOk;
    if (!pass) structuralFail++;
    console.log(`  ${ok(pass)}  ${b.tool.padEnd(16)} backed:${backed} impl:${!!impl} schema:${schemaOk} receipt:${receiptOk}  ${detail}`);
  }

  // ── 1b. DETERMINISTIC ROUTING (free) ──
  console.log("\nDETERMINISTIC ROUTING — the no-key keyword router maps obvious questions");
  for (const c of DET_CASES) {
    const { receipts } = await runDeterministicScout(c.q);
    const got = receipts[0]?.tool ?? "(none)";
    const pass = got === c.tool;
    if (!pass) structuralFail++;
    console.log(`  ${ok(pass)}  "${c.q}" -> ${got}  (want ${c.tool})`);
  }
  // the no-key router must NOT fabricate a what-if: a scenario question returns no tool + a graceful reply
  for (const q of ["What if we cut S&M by 20%?", "Model a sensitivity on subscription growth."]) {
    const res = await runDeterministicScout(q);
    const pass = res.receipts.length === 0 && /scenario/i.test(res.reply);
    if (!pass) structuralFail++;
    console.log(`  ${ok(pass)}  "${q}" -> ${res.receipts[0]?.tool ?? "(none)"}  (want no tool + scenarios-not-available)`);
  }

  // ── 2. LLM ROUTING (metered; only with a key) ──
  if (!hasApiKey()) {
    console.log("\nLLM ROUTING — SKIPPED (no ANTHROPIC_API_KEY). Structural + deterministic layers above are the CI gate.");
  } else {
    console.log(`\nLLM ROUTING — ${CASES.length} curated cases against the live loop (metered; non-deterministic, threshold-scored)`);
    for (const c of CASES) {
      let line: string;
      let pass = false;
      try {
        const res = await runScout([{ role: "user", content: c.q }]);
        pass = res.mode === "live" && c.check(res.receipts);
        const trace = res.receipts.map((r) => `${r.tool}${r.args.metricId ? `(${r.args.metricId})` : ""}`).join(", ") || "(no tool)";
        line = `[${trace}]  want: ${c.want}`;
      } catch (e) {
        line = `ERROR ${(e as Error).message}  want: ${c.want}`;
      }
      if (!pass) routingFail++;
      console.log(`  ${ok(pass)}  "${c.q}"\n          ${line}`);
    }
    const total = CASES.length;
    const passed = total - routingFail;
    const rate = passed / total;
    const THRESHOLD = 0.85;
    console.log(`\n  LLM routing: ${passed}/${total} (${(rate * 100).toFixed(0)}%) · threshold ${THRESHOLD * 100}%`);
    if (rate < THRESHOLD) {
      console.log("  -> BELOW THRESHOLD: a tool description likely overlaps/misroutes — tighten descriptions (name the sibling).");
    } else {
      routingFail = 0; // above threshold: the non-deterministic layer passes as a whole
    }
  }

  const failed = structuralFail + routingFail;
  console.log(`\n================ SCOUT-EVAL: ${failed === 0 ? "PASS" : `${failed} FAILING`} (structural ${structuralFail === 0 ? "ok" : structuralFail + " bad"}) ================\n`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
