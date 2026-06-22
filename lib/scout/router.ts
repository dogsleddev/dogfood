/**
 * Deterministic fallback for Scout when no ANTHROPIC_API_KEY is set (CLAUDE.md §10).
 * Routes the question to ONE data tool by keyword, runs it, and renders a grounded one-liner +
 * the same receipt the live loop produces. This keeps the whole surface (tool execution, receipts,
 * panel UI) verifiable with no key — and the live LLM loop takes over the moment a key is present.
 * It is intentionally simple (single-tool, no follow-up reasoning); the LLM is what makes Scout conversational.
 */
import { SCOUT_TOOL_IMPLS } from "./tools";
import { stepLabel } from "./commentary";
import type { ScoutResponse, ScoutOnStep } from "./types";

interface Route {
  readonly test: RegExp;
  readonly tool: keyof typeof SCOUT_TOOL_IMPLS;
  readonly input: Record<string, unknown>;
}

// Most specific first. A question that matches nothing falls through to the dashboard overview.
const ROUTES: readonly Route[] = [
  { test: /runway|cash\s*out|months? of cash/i, tool: "getMetric", input: { metricId: "runway" } },
  { test: /\bburn\b/i, tool: "getMetric", input: { metricId: "net_burn" } },
  { test: /magic/i, tool: "getMetric", input: { metricId: "magic_number" } },
  { test: /rule of 40/i, tool: "getMetric", input: { metricId: "rule_of_40" } },
  // Renewals register BEFORE the retention-rate metrics: "renewal" / "gross (dollar) retention" / GRR
  // route to the worklist (which carries the gross-dollar-retention number); the NRR/logo RATES stay on getMetric.
  { test: /renewals?|up for renewal|gross (dollar )?retention|\bgrr\b/i, tool: "getRenewals", input: {} },
  // logo_retention before nrr (bare "retention") and before the customers register, so "logo
  // retention" / "churn rate" hit the rate metric, not the NRR metric or the logo register.
  { test: /logo retention|churn rate/i, tool: "getMetric", input: { metricId: "logo_retention" } },
  { test: /\bnrr\b|net revenue retention|retention/i, tool: "getMetric", input: { metricId: "nrr" } },
  { test: /\bltv\b/i, tool: "getMetric", input: { metricId: "ltv_cac" } },
  { test: /\bcac\b/i, tool: "getMetric", input: { metricId: "cac_payback" } },
  { test: /gross margin/i, tool: "getMetric", input: { metricId: "gross_margin_pct" } },
  // Pipeline register (open deals) — a unique keyword, so place it before the sales record routes.
  { test: /pipeline|opportunit|\bfunnel\b|open deals|deals? by (stage|rep)|win prob/i, tool: "getPipeline", input: {} },
  // Customers register BEFORE the arr/mrr metric: requires a customer-y token (customers/logos/
  // segment/churned), so "ARR by segment" lands here while a bare "what's our ARR" falls to the
  // scalar metric below. "churned" (not bare "churn") so "churn rate" stays with logo_retention.
  { test: /\bcustomers?\b|\blogos?\b|segment|churned/i, tool: "getCustomers", input: {} },
  { test: /\barr\b|\bmrr\b|recurring revenue/i, tool: "getMetric", input: { metricId: "arr_mrr" } },
  // bookings OVER TIME / YoY → the trend tool, BEFORE the single-period contracts route
  { test: /booking.*(year|yoy|trend|last year|over time|\bvs\b|compar|grow)|year.*booking/i, tool: "getBookingsHistory", input: {} },
  { test: /booking|deferred|\brpo\b|contracted|contract/i, tool: "getContracts", input: {} },
  // Reporting registers — BEFORE the statement routes so "project margin" doesn't hit the P&L
  // "margin" keyword and "headcount" / "spend on X" route to their registers, not the dashboard.
  { test: /projects?|\bwip\b|work[- ]in[- ]progress|utiliz|services delivery|billable|engagement/i, tool: "getProjects", input: {} },
  { test: /\bstaff\b|head\s?count|employees?|\bfte\b|how many people|roster|by department|hiring plan/i, tool: "getStaff", input: {} },
  { test: /expense (transaction|detail|bill)|vendor bill|what did we spend|spend(ing)? on|\bap\b detail/i, tool: "getExpenseTransactions", input: {} },
  // ── Flux notes · Board · Scenarios · Forecast drivers — BEFORE the generic statement/metric routes ──
  { test: /break ?down|what'?s driving|decompos|variance (detail|breakdown)|drove the/i, tool: "getFluxDetail", input: { statementLine: "sales_marketing" } },
  { test: /\bflux\b|why is .{1,40}(over|under)|is there (a )?note|notes? on |explanation for/i, tool: "getFluxNotes", input: {} },
  { test: /board (package|deck|meeting|metrics|report|slides)/i, tool: "getBoardPackage", input: {} },
  { test: /compare.*scenario|scenario.*(compare|side by side|\bvs\b)|which scenario/i, tool: "compareScenarios", input: {} },
  { test: /scenario p&?l|scenario (pnl|income|profit)/i, tool: "getScenarioPnL", input: { scenarioId: "base" } },
  { test: /\bscenarios?\b|list scenario|what scenario/i, tool: "getScenarios", input: {} },
  { test: /revenue forecast|forecast.*revenue|new[- ]business|contracted vs/i, tool: "getRevenueForecast", input: {} },
  { test: /cost of revenue|cost[- ]to[- ]serve|cost of goods|\bcogs\b|hosting cost/i, tool: "getCostOfRevenue", input: {} },
  { test: /personnel|payroll forecast|comp(ensation)? (forecast|plan|by function)|hiring plan/i, tool: "getPersonnelForecast", input: {} },
  { test: /expense forecast|opex forecast|opex (plan|budget|by group)|operating expense forecast/i, tool: "getExpenseForecast", input: {} },
  { test: /\bdso\b|ar forecast|receivables forecast|days sales/i, tool: "getArForecast", input: {} },
  { test: /\bcapex\b|capital expenditure|fixed asset|depreciation schedule/i, tool: "getFixedAssetForecast", input: {} },
  { test: /prepaid/i, tool: "getPrepaidsForecast", input: {} },
  { test: /balance sheet|assets|liabilit|equity|\bcash\b/i, tool: "getBalanceSheet", input: {} },
  { test: /cash flow/i, tool: "getCashFlow", input: {} },
  // monthly/"which month" intent BEFORE the annual P&L route (getPnL is FY-only)
  { test: /\bmonth(ly|s)?\b|by month|each month|which month|most profitable|biggest.*(month|sales)/i, tool: "getMonthlyPnL", input: {} },
  { test: /p&l|pnl|income statement|revenue|net income|profit|expense|opex|margin/i, tool: "getPnL", input: {} },
  { test: /dashboard|kpi|how are we|overview|doing/i, tool: "getDashboard", input: {} },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
function summarize(tool: string, data: any): string {
  switch (tool) {
    case "getMetric":
      return `${data.metric} is ${data.value}${data.basis ? ` (${data.basis}).` : "."}`;
    case "getPnL": {
      const find = (s: string) => data.lines?.find((l: any) => l.line?.toLowerCase().includes(s));
      const rev = find("total revenue") ?? find("revenue");
      const ni = find("net income");
      const gp = find("gross profit");
      return `${data.period}: Total revenue ${rev?.forecast ?? "—"}, gross profit ${gp?.forecast ?? "—"}, net income ${ni?.forecast ?? "—"} (Forecast column).`;
    }
    case "getMonthlyPnL": {
      const rows = data.months ?? [];
      return `Month-by-month P&L for ${data.fiscalYear} (revenue · net income): ${rows.map((r: any) => `${r.month} ${r.totalRevenue}/${r.netIncome}`).join(", ")}.`;
    }
    case "getContracts":
      return `${data.summary.total} contracts (${data.summary.active} active, ${data.summary.churned} churned). ${data.bookings.period} net ΔARR ${data.bookings.netDeltaArr}; deferred closing ${data.deferredRevenue.closing}; RPO ${data.contractedRevenue.contractedForward}.`;
    case "getCustomers":
      return `${data.summary.total} customers (${data.summary.active} active, ${data.summary.churned} churned). Run-rate ARR ${data.runRateArr} across the book, ARR per logo ${data.arrPerLogo}. By segment: ${data.bySegment.map((s: any) => `${s.segment} ${s.logos}`).join(", ")}.`;
    case "getBookingsHistory":
      return `Bookings (net ΔARR): ${data.ttm.window} ${data.ttm.netDeltaArr} vs ${data.priorTtm.window} ${data.priorTtm.netDeltaArr}; ${data.fiscalYear.window} ${data.fiscalYear.netDeltaArr} vs ${data.priorFiscalYear.window} ${data.priorFiscalYear.netDeltaArr}. Gross ${data.ttm.grossBookings} TTM. (Compare windows, not single months — bookings are lumpy.)`;
    case "getRenewals":
      return `${data.summary.total} renewals (${data.summary.open} open · ${data.summary.resolved} resolved). Open book ${data.forwardWorklist.openArr} ARR up for renewal (next due ${data.forwardWorklist.nextDue}); gross dollar retention ${data.grossDollarRetention.value} on the closed book.`;
    case "getPipeline":
      return `Open pipeline ${data.totalOpenPipeline.arr} across ${data.totalOpenPipeline.opportunities} opportunities (weighted ${data.totalOpenPipeline.weightedArr}). By stage: ${data.byStage.map((s: any) => `${s.stage} ${s.arr}`).join(", ")}.`;
    case "getProjects":
      return `${data.summary.total} projects (${data.summary.inProgress} in progress · ${data.summary.complete} complete). Total WIP ${data.totalWip}; utilization ${data.utilization.value} (${data.utilization.period}).`;
    case "getStaff":
      return `${data.headcount} FTE on the roster (${data.asOf}). By department: ${data.byDepartment.slice(0, 4).map((d: any) => `${d.department} ${d.heads}`).join(", ")}. By function: ${data.byFunction.map((f: any) => `${f.function} ${f.heads}`).join(", ")}.`;
    case "getExpenseTransactions":
      return `${data.period}: ${data.total} across ${data.count} expense transactions. Top groups: ${data.byGroup.slice(0, 3).map((g: any) => `${g.group} ${g.amount}`).join(", ")}.`;
    case "getRevenueForecast":
      return `${data.fiscalYear} revenue forecast — subscription ${data.subscription.total} (contracted ${data.subscription.contracted} + new ${data.subscription.newBusiness}); services ${data.services.total}.`;
    case "getCostOfRevenue":
      return `${data.fiscalYear} Cost of Revenue ${data.totalCoR} = direct payroll ${data.directPayroll} + non-employee ${data.nonEmployeeCoR}.`;
    case "getPersonnelForecast":
      return `${data.fiscalYear} payroll ${data.fyBaseComp}, ${data.headcountYearEnd} heads at year-end. By function: ${data.byFunction.map((f: any) => `${f.function} ${f.fyBaseComp}`).join(", ")}.`;
    case "getExpenseForecast":
      return `${data.fiscalYear} non-payroll OpEx ${data.totalOpEx}. Top groups: ${data.byGroup.slice(0, 3).map((g: any) => `${g.group} ${g.amount}`).join(", ")}.`;
    case "getArForecast":
      return `AR forecast (${data.fiscalYear}): DSO ${data.dso}, closing balance ${data.closingBalance}.`;
    case "getFixedAssetForecast":
      return `${data.fiscalYear}: capex ${data.fyCapex}, depreciation ${data.fyDepreciation}, net book value ${data.closingNetBookValue}.`;
    case "getPrepaidsForecast":
      return `${data.fiscalYear} prepaids: additions ${data.fyAdditions}, amortization ${data.fyAmortization}, closing ${data.closingBalance}.`;
    case "getBoardPackage":
      return `Board package, ${data.period}: ${data.sections.map((s: any) => s.section).join(" · ")}.`;
    case "getScenarios":
      return `${data.scenarios.length} scenarios: ${data.scenarios.map((s: any) => s.name).join(", ")}.`;
    case "getScenarioPnL": {
      if (data.error) return data.error;
      const ni = (data.lines ?? []).find((l: any) => /net income/i.test(l.line));
      return `${data.scenario} vs ${data.comparedTo} (${data.period}): net income ${ni?.scenario ?? "—"} (Δ ${ni?.delta ?? "—"} vs baseline). A contained hypothetical.`;
    }
    case "compareScenarios":
      return `Comparing ${data.columns.length} scenarios (${data.period}): ${data.columns.map((c: any) => c.scenario).join(" vs ")}.`;
    case "getFluxDetail":
      return `${data.line} (${data.period}): actual ${data.actual} vs budget ${data.budget}, variance ${data.variance}. Top items: ${(data.topTransactions ?? []).slice(0, 3).map((t: any) => `${t.vendor} ${t.amount}`).join(", ")}.`;
    case "getFluxNotes":
      return data.count === 0
        ? "No flux notes on this anchor yet — add one to explain the variance."
        : `${data.count} flux note${data.count === 1 ? "" : "s"}: ${data.notes.map((n: any) => `"${n.body}" — ${n.author}${n.resolved ? " (resolved)" : ""}`).join("; ")}.`;
    case "getBalanceSheet":
    case "getCashFlow": {
      const top = (data.lines ?? []).slice(0, 4).map((l: any) => `${l.line} ${l.value}`).join(", ");
      return `${tool === "getCashFlow" ? "Cash flow" : "Balance sheet"} (as of June 2026): ${top}.`;
    }
    case "getDashboard": {
      const fams = (data.families ?? []).map((f: any) => `${f.family}: ${f.tiles.slice(0, 2).map((t: any) => `${t.metric} ${t.value}`).join(", ")}`).join(" · ");
      return `Dashboard, ${data.period}. ${fams}.`;
    }
    default:
      return "Here is what I found.";
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// What-if MODELING (creating a new hypothetical): Scout can't set drivers yet (the scenario WRITE
// path isn't wired), so NEVER fabricate one off a read tool — answer gracefully, point at Scenarios.
// (Reading EXISTING scenarios is fine — that's getScenarios/getScenarioPnL/compareScenarios, so the
// bare word "scenario" is intentionally NOT here; only new-hypothetical phrasing is.)
const WHATIF = /\bwhat\s*if\b|\bif we (cut|raise|drop|lower|increase|reduce|add|hire|freeze|grow|spend)|\bsensitivity\b|\bmodel(ing)?\b a |\bhypothetical/i;

export async function runDeterministicScout(question: string, onStep?: ScoutOnStep): Promise<ScoutResponse> {
  if (WHATIF.test(question)) {
    return {
      reply:
        "Scenario modeling isn't available yet — the scenario engine isn't built, so I can't model a what-if and I won't improvise the math (a hand-computed hypothetical wouldn't flow through the drivers, statements, and cash). Once it ships, the Scenarios group (Scenario Manager, Drivers, P&L, Dashboard) is where you'll build and compare these.",
      receipts: [],
      mode: "deterministic",
    };
  }
  const route = ROUTES.find((r) => r.test.test(question)) ?? { tool: "getDashboard" as const, input: {} };
  onStep?.({ tool: route.tool, label: stepLabel(route.tool, route.input) });
  const { data, receipt } = await SCOUT_TOOL_IMPLS[route.tool].run(route.input);
  return { reply: summarize(route.tool, data), receipts: [receipt], mode: "deterministic" };
}
