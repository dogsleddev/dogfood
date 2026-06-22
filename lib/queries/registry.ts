// lib/queries/registry.ts
//
// The query ↔ Scout-tool seam, type-safe.
//
// ONE source of truth (TOOL_THUNKS); QueryName derives from it; scout-readiness.ts and
// the agent loop import from here instead of keeping their own string map. Renaming a live
// query is now a compile error, not a silently-dropped tool. Harness DEFINES the per-module
// tool surface; the Run WIRES each tool as its grounding module ships (Scout Follows Modules).
//
// Two lanes (CLAUDE.md §4, §10): the DATA lane is a thin wrapper over a lib/queries fn (zero
// RAG, deterministic); the PRODUCT-KNOWLEDGE lane answers how-tos / "what does X do" from the
// User Guides + nav map held in Scout's context (no RAG unless the corpus outgrows the budget).

import {
  // --- live queries (already implemented + proven by the readiness gate) ---
  getDashboardSummary,
  getKpiTile,
  getMetric,
  getPnL,
  getMonthlyPnL,
  getPnLLine,
  getBalanceSheet,
  getCashFlow,
  // --- Sales / Contracts + Customers (live once the layer-1 stubs were forwarded to the DataStore) ---
  listContracts,
  getContract,
  getBookingsHistory,
  listCustomers,
  getCustomer,
  // --- Sales / Renewals + Pipeline & Reporting registers (layer-1 lists, live via the DataStore) ---
  listRenewals,
  listPipeline,
  listProjects,
  listStaff,
  listExpenseTransactions,
  // --- Forecast drivers (layer 2), Board Package, Scenarios (read), Flux notes (read + write) ---
  getRevenueForecast,
  getCostOfRevenue,
  getPersonnelForecast,
  getExpenseForecast,
  getArForecast,
  getFixedAssetForecast,
  getPrepaidsForecast,
  getBoardPackage,
  listScenarios,
  getScenarioPnL,
  getScenarioDashboard,
  listFluxNotes,
  getFluxDetail,
} from "@/lib/queries";

/**
 * A query: serializable args in, serializable result out, pure + deterministic.
 * Tighten `unknown[]` to the real serializable input unions if you want stricter call sites.
 */
type Query = (...args: never[]) => unknown;

/**
 * THE source of truth. One row per *live* query that Scout may call.
 * `satisfies` forces every value to be a Query and every key to be a real export —
 * so a rename in lib/queries breaks compilation right here.
 */
export const TOOL_THUNKS = {
  getDashboardSummary,
  getKpiTile,
  getMetric,
  getPnL,
  getMonthlyPnL,
  getPnLLine,
  getBalanceSheet,
  getCashFlow,
  listContracts,
  getContract,
  getBookingsHistory,
  listCustomers,
  getCustomer,
  listRenewals,
  listPipeline,
  listProjects,
  listStaff,
  listExpenseTransactions,
  getRevenueForecast,
  getCostOfRevenue,
  getPersonnelForecast,
  getExpenseForecast,
  getArForecast,
  getFixedAssetForecast,
  getPrepaidsForecast,
  getBoardPackage,
  listScenarios,
  getScenarioPnL,
  getScenarioDashboard,
  listFluxNotes,
  getFluxDetail,
} satisfies Record<string, Query>;
// Write queries (addFluxNote) are NOT in TOOL_THUNKS: scout-readiness executes every thunk, and a
// write must never run there. The write tool is wired with a dedicated impl (see lib/scout/tools.ts).

/** The closed set of callable query names. Both the registry and the readiness gate key off this. */
export type QueryName = keyof typeof TOOL_THUNKS;

/** Two lanes. The determinism guarantees only apply to the data lane. */
export type ToolLane =
  | "data" // numbers — a thin wrapper over a lib/queries fn (zero RAG)
  | "product-knowledge"; // how-tos / descriptions — reads the User Guides + nav map, in context

/** Grounding module (Scout Follows Modules). */
export type ModuleId =
  | "dashboard"
  | "metrics"
  | "board-package"
  | "pnl"
  | "balance-sheet"
  | "cash-flow"
  | "reporting"
  | "sales"
  | "forecasts"
  | "scenarios"
  | "config"
  | "guides";

export interface ScoutToolBinding {
  /** The Anthropic tool name the model sees. */
  tool: string;
  /** The module whose data grounds this tool (no tool ships ahead of its module). */
  module: ModuleId;
  lane: ToolLane;
  /**
   * The backing lib/queries fn — type-checked.
   * `null` means "no live query backs this yet": either the query isn't built
   * (see `plannedQuery`) or this is a product-knowledge tool (lane !== "data").
   */
  query: QueryName | null;
  /** Documentation only: the intended query name for a not-yet-built data tool (can't be type-checked until it exists). */
  plannedQuery?: string;
  /** Flipped to true once the tool is registered in the Anthropic tool-use loop. */
  wired: boolean;
  /**
   * A WRITE tool (mutates state). Backed by its impl in lib/scout/tools.ts, NOT a read query in
   * TOOL_THUNKS (the readiness/structural probes execute every thunk — a write must never run there).
   */
  write?: boolean;
  /**
   * Disambiguating description. For overlap pairs, NAME THE SIBLING and steer —
   * this is the single biggest misroute lever (bigger than the model).
   */
  description: string;
}

export const SCOUT_REGISTRY: readonly ScoutToolBinding[] = [
  // ── Overview ───────────────────────────────────────────────────────────────
  {
    tool: "getDashboard",
    module: "dashboard",
    lane: "data",
    query: "getDashboardSummary",
    wired: true,
    description: "All dashboard KPI tiles for a period. For a single named metric (CAC, runway, magic number) use getMetric; for a full statement use getPnL.",
  },
  {
    tool: "explainTile",
    module: "dashboard",
    lane: "data",
    query: "getKpiTile",
    wired: true,
    description: "Explain why a DASHBOARD TILE moved (the metric behind a tile). For a P&L statement line use explainVariance.",
  },

  // ── Metrics (getMetric is LIVE — readiness gate ties net income through it) ──
  {
    tool: "getMetric",
    module: "metrics",
    lane: "data",
    query: "getMetric",
    wired: true,
    description: "One named metric for a period (gross margin %, CAC, LTV:CAC, magic number, Rule of 40, burn multiple, net burn, runway, NRR/GRR, logo retention / logo churn rate, ARR/MRR). Use this for any RATE or ratio (incl. churn/retention rate). For ARR, MRR, 'annual/monthly recurring revenue', or 'what's our recurring revenue' use metricId arr_mrr (a single point-in-time value — the Customers register's run-rate book is getCustomers instead). For the whole P&L use getPnL; to explain a dashboard tile use explainTile.",
  },

  // ── Board Package ────────────────────────────────────────────────────────────
  {
    tool: "getBoardPackage",
    module: "board-package",
    lane: "data",
    query: "getBoardPackage",
    wired: true,
    description: "The exportable monthly board deck for a period — the KPI sections (Financial · Growth & Retention · Unit Economics · Cash & Efficiency) with each tile's value. Use for 'the board package / board deck / board metrics'. For the live cockpit use getDashboard; for one metric use getMetric.",
  },

  // ── Financial Statements ─────────────────────────────────────────────────────
  {
    tool: "getPnL",
    module: "pnl",
    lane: "data",
    query: "getPnL",
    wired: true,
    description: "The full FISCAL-YEAR P&L (Budget / Actual / Variance / Forecast columns) for the year that contains `period` — this is an ANNUAL view, NOT a single month (every month of a year returns the same FY totals). For a month-by-month breakdown, or any 'which month was biggest / most profitable / highest revenue' question, use getMonthlyPnL instead. For a single KPI use getMetric. (When scenarios land, add a baseline arg: compare vs Base or Budget.)",
  },
  {
    tool: "getMonthlyPnL",
    module: "pnl",
    lane: "data",
    query: "getMonthlyPnL",
    wired: true,
    description: "The P&L broken out MONTH BY MONTH for the fiscal year containing `period` (each row is one month's revenue, gross profit, operating income, net income; Σ months = the FY total). Use for any monthly or 'which month' question (biggest revenue/sales month, most profitable month, monthly trend). For the whole-year P&L use getPnL.",
  },
  {
    tool: "explainVariance",
    module: "pnl",
    lane: "data",
    query: "getPnLLine",
    wired: true,
    description: "Explain why a P&L LINE moved vs budget/forecast. For a dashboard tile use explainTile.",
  },
  {
    tool: "getBalanceSheet",
    module: "balance-sheet",
    lane: "data",
    query: "getBalanceSheet",
    wired: true,
    description: "The balance sheet for a period (Assets = Liabilities + Equity, through the query).",
  },
  {
    tool: "getBalanceSheetLine",
    module: "balance-sheet",
    lane: "data",
    query: null,
    plannedQuery: "getBalanceSheetLine",
    wired: false,
    description: "Drill a single balance-sheet line (parity with explainVariance for the P&L).",
  },
  {
    tool: "getCashFlow",
    module: "cash-flow",
    lane: "data",
    query: "getCashFlow",
    wired: true,
    description: "The cash-flow forecast for a period (and runway / cash-out).",
  },
  {
    tool: "getCashFlowLine",
    module: "cash-flow",
    lane: "data",
    query: null,
    plannedQuery: "getCashFlowLine",
    wired: false,
    description: "Drill a single cash-flow line (parity with the P&L line drill).",
  },

  // ── Sales · Contracts (the first shipped Run module — register + bookings/deferred/RPO) ──
  {
    tool: "getContracts",
    module: "sales",
    lane: "data",
    query: "listContracts",
    wired: true,
    description: "The Contracts register + THIS PERIOD's bookings (ΔARR: new/expansion/contraction), the deferred-revenue waterfall, and the contracted-revenue (RPO) bridge — plus the top contracts by ARR. Use for ARR, this-period bookings, deferred, RPO, or the biggest contracts. For bookings OVER TIME / year-over-year / a trend use getBookingsHistory; for one named contract use getContract; for OPEN deals not yet signed use getPipeline.",
  },
  {
    tool: "getContract",
    module: "sales",
    lane: "data",
    query: "getContract",
    wired: true,
    description: "One contract's detail by id (customer, plan, ARR, term, status, booking type). Find ids/customers via getContracts first.",
  },
  {
    tool: "getBookingsHistory",
    module: "sales",
    lane: "data",
    query: "getBookingsHistory",
    wired: true,
    description: "Bookings (ΔARR) OVER TIME for year-over-year comparison: trailing-12-month and fiscal-year totals (new business / expansion / contraction / gross / net), current vs prior. Use for 'bookings this year vs last year', 'bookings YoY', or a bookings trend — monthly bookings are lumpy, so this avoids a misleading single-month compare. TTM is the honest 'at this point last year vs now' view. For just THIS period's bookings + the register use getContracts.",
  },

  // ── Sales · Customers (the accounts behind the ARR — register + book of business) ──
  {
    tool: "getCustomers",
    module: "sales",
    lane: "data",
    query: "listCustomers",
    wired: true,
    description: "The Customers register + book of business: logo COUNTS (total/active/churned), run-rate ARR (= exit ARR), ARR by segment (starter/growth/scale), new logos by cohort year, and the top accounts by ARR. Use for customer/logo/account questions, the count of churned logos, or ARR-by-segment. For the period ARR/MRR *value* use getMetric (arr_mrr); for a RATE (churn / logo-retention / NRR) use getMetric; for signed agreements / bookings / deferred / RPO use getContracts; for the renewal worklist / gross dollar retention use getRenewals.",
  },
  {
    tool: "getCustomer",
    module: "sales",
    lane: "data",
    query: "getCustomer",
    wired: true,
    description: "One customer/account's detail by id (name, segment, ARR, customer-since, status). Find ids/names via getCustomers first. For a signed contract (term, booking type) use getContract.",
  },

  // ── Sales · Renewals (the retention worklist that defends the contracted base) ──
  {
    tool: "getRenewals",
    module: "sales",
    lane: "data",
    query: "listRenewals",
    wired: true,
    description: "The Renewals register — the retention worklist: open renewals (count + ARR up for renewal on the contracted base), resolved outcomes by status (renewed / expanded / contracted / churned, each with count + ARR), the gross dollar retention on the closed book, and the next renewal due. Use for renewals, the renewal worklist, what's coming up for renewal, or gross dollar retention. For the NRR or logo-retention RATE use getMetric (nrr / logo_retention); for the accounts behind them use getCustomers.",
  },

  // ── Sales · Pipeline (the open-opportunity funnel feeding the Revenue Forecast) ──
  {
    tool: "getPipeline",
    module: "sales",
    lane: "data",
    query: "listPipeline",
    wired: true,
    description: "The Pipeline register — open opportunities (deals not yet signed): total open pipeline (count + ARR + probability-weighted ARR), the by-stage funnel (lead / qualified / proposal / negotiation), and the top reps by open ARR. Optional `stage` filter. Use for pipeline, open deals/opportunities, funnel, coverage, or deals by stage/rep. For SIGNED agreements use getContracts; for booked ΔARR over time use getBookingsHistory.",
  },

  // ── Reporting · Projects / Staff / Expense Transactions (layer-1 registers) ──
  {
    tool: "getProjects",
    module: "reporting",
    lane: "data",
    query: "listProjects",
    wired: true,
    description: "The Projects register — services delivery: the in-progress vs complete split, total WIP / unbilled (contract assets), current delivery utilization, and the largest engagements by contract value. Use for projects, services delivery, WIP/unbilled, % complete, or how many projects. For the utilization METRIC value use getMetric (utilization); for headcount use getStaff.",
  },
  {
    tool: "getStaff",
    module: "reporting",
    lane: "data",
    query: "listStaff",
    wired: true,
    description: "The Staff register — the people roster as of the last closed month: total headcount (FTE), the org by department, and the functional split (Direct·CoR / R&D / S&M / G&A). Use for headcount, how many employees, the org by department, or the function breakdown. This is HEADS, not dollars — for payroll cost use the P&L (getPnL); for utilization use getMetric (utilization).",
  },
  {
    tool: "getExpenseTransactions",
    module: "reporting",
    lane: "data",
    query: "listExpenseTransactions",
    wired: true,
    description: "GL-level expense transaction detail for a month (the AP sub-ledger behind the P&L expense lines, and the Flux Analysis drill target): total spend, the by-group breakdown (Employee Expenses, Sales & Marketing, IT, …), and the largest bills. Optional `period` (defaults to the last closed month) and `group` filter. Use for 'what did we spend on X', expense detail, or vendor bills. For the P&L expense LINES / totals use getPnL or explainVariance; this is the transaction-level detail under them.",
  },

  // ── Forecast drivers (layer 2 — the forward ASSUMPTIONS behind the statements) ──
  {
    tool: "getRevenueForecast",
    module: "forecasts",
    lane: "data",
    query: "getRevenueForecast",
    wired: true,
    description: "The Revenue Forecast driver for the fiscal year: subscription + services, each split into CONTRACTED (signed as of close) vs NEW-BUSINESS (assumed post-close). Use for the revenue forecast/plan, the contracted-vs-new split, or the forward revenue assumption. For the recognized P&L revenue line use getPnL; for the ARR value use getMetric (arr_mrr); for bookings use getContracts.",
  },
  {
    tool: "getCostOfRevenue",
    module: "forecasts",
    lane: "data",
    query: "getCostOfRevenue",
    wired: true,
    description: "The Cost of Revenue driver (assembled): Direct Payroll + non-employee cost (hosting/pass-through rate × revenue), per fiscal year. Use for the cost-to-serve, the CoR build-up, or the hosting/pass-through rate. For gross margin % use getMetric (gross_margin_pct); for the P&L CoR line use getPnL.",
  },
  {
    tool: "getPersonnelForecast",
    module: "forecasts",
    lane: "data",
    query: "getPersonnelForecast",
    wired: true,
    description: "The Personnel driver — forecast payroll (base comp) and headcount by function (Direct·CoR / R&D / S&M / G&A) for the fiscal year. Use for the payroll forecast/plan or comp by function. For the current roster/headcount use getStaff; for the P&L payroll lines use getPnL.",
  },
  {
    tool: "getExpenseForecast",
    module: "forecasts",
    lane: "data",
    query: "getExpenseForecast",
    wired: true,
    description: "The Expense Forecast driver — non-payroll OpEx by group (Sales & Marketing, IT, Facilities, …) for the fiscal year. Use for the opex forecast/plan by group. For ACTUAL expense detail (bills) use getExpenseTransactions; for the P&L opex lines use getPnL.",
  },
  {
    tool: "getArForecast",
    module: "forecasts",
    lane: "data",
    query: "getArForecast",
    wired: true,
    description: "The AR Forecast driver — DSO and the receivables balance per month for the fiscal year. Use for DSO, the AR forecast, or receivables. For the balance-sheet AR line use getBalanceSheet.",
  },
  {
    tool: "getFixedAssetForecast",
    module: "forecasts",
    lane: "data",
    query: "getFixedAssetForecast",
    wired: true,
    description: "The Fixed Asset Budget driver — capex, depreciation, and net book value per month for the fiscal year. Use for capex or the depreciation schedule. For the balance-sheet fixed-assets line use getBalanceSheet.",
  },
  {
    tool: "getPrepaidsForecast",
    module: "forecasts",
    lane: "data",
    query: "getPrepaidsForecast",
    wired: true,
    description: "The Prepaids Budget driver — prepaid additions, amortization, and the closing balance per month for the fiscal year. Use for prepaids/amortization. For the balance-sheet prepaids line use getBalanceSheet.",
  },

  // ── Flux Analysis notes (read; the write tool addFluxNote is below) ──
  {
    tool: "getFluxNotes",
    module: "reporting",
    lane: "data",
    query: "listFluxNotes",
    wired: true,
    description: "Read the Flux Analysis notes (variance explanations) on an anchor — pass transactionId, or accountCode + period, or statementLine + period. Use for 'why is X over/under, is there an explanation/note on X, what's been flagged'. Returns the reviewer's notes (author, body, resolved). To ADD a note use addFluxNote.",
  },
  {
    tool: "getFluxDetail",
    module: "reporting",
    lane: "data",
    query: "getFluxDetail",
    wired: true,
    description: "The variance DECOMPOSITION for a statement line (pass statementLine + period): the line's actual / forecast / budget / variance plus the largest transactions composing the actual. Use for 'what's driving / break down / decompose' a variance — pair it with getFluxNotes (the written explanation). For just the line's value use getPnL.",
  },
  {
    tool: "addFluxNote",
    module: "reporting",
    lane: "data",
    query: null,
    write: true,
    wired: true,
    description: "WRITE a Flux Analysis note on the user's behalf — Scout's only write. Anchor it with transactionId, or accountCode + period, or statementLine + period; pass the note body. It's recorded as the user (attributed to them, flagged entered-via-Scout) and can be removed from the note card. Use when the user says 'add/record a note that…', 'flag…', 'note that…', 'write down why…'. To READ existing notes use getFluxNotes instead.",
  },

  // ── Config (load-bearing reads; flip to live when account-mapping exposes them) ─
  {
    tool: "getPeriodConfig",
    module: "config",
    lane: "data",
    query: null,
    plannedQuery: "getPeriodConfig",
    wired: false,
    description: "Which periods are closed (actuals) vs forecast, and the fiscal calendar. Use to answer 'is June closed yet'.",
  },
  {
    tool: "getExpenseGroups",
    module: "config",
    lane: "data",
    query: null,
    plannedQuery: "getExpenseGroups",
    wired: false,
    description: "The live OpEx group set + classification (CoR/OpEx) + function sub-role.",
  },

  // ── Scenarios (group-scoped; the engine is built — READ tools wired) ─
  {
    tool: "getScenarios",
    module: "scenarios",
    lane: "data",
    query: "listScenarios",
    wired: true,
    description: "List the scenarios (Base + the seed presets 25% Profit / Capacity / Breakeven + any user-made), each with its baseline and adjustment count. Use for 'what scenarios are there'. For one scenario's P&L use getScenarioPnL; to compare several use compareScenarios.",
  },
  {
    tool: "getScenarioPnL",
    module: "scenarios",
    lane: "data",
    query: "getScenarioPnL",
    wired: true,
    description: "One scenario's contained P&L vs its baseline (Base or the locked Budget) for the current fiscal year — each line with the scenario value, the baseline, and the delta. Pass a scenarioId (find them via getScenarios). Group-scoped: this is a hypothetical, never the real/Base P&L (for that use getPnL).",
  },
  {
    tool: "compareScenarios",
    module: "scenarios",
    lane: "data",
    query: "getScenarioDashboard",
    wired: true,
    description: "Compare 2–3 scenarios side by side (KPI tiles per scenario) for the current period. Pass scenarioIds (include 'base' to anchor). Group-scoped — these are contained hypotheticals, not Base/actuals.",
  },
  {
    tool: "setDriver",
    module: "scenarios",
    lane: "data",
    query: null,
    plannedQuery: "(scenario write — scenario_inputs persistence)",
    wired: false,
    description: "Set one scenario adjustment (lever + magnitude + window + step/ramp). Group-scoped. NOT wired: scenario WRITE persistence isn't built yet (the in-memory registry isn't a durable Scout write target).",
  },

  // ── Product-knowledge lane (how-tos / descriptions — NOT the number spine) ───
  {
    tool: "getProductMap",
    module: "guides",
    lane: "product-knowledge",
    query: null, // reads the User Guides (lib/guides/content.ts) — the same prose /setup/guides renders
    wired: true,
    description: "The product/nav map from the User Guides: every guide's title + one-line summary (the IA + what each area covers). Use for 'where is X / what areas are there / what can the app do'. For one module's how-to detail use describeModule. NOT for numbers.",
  },
  {
    tool: "describeModule",
    module: "guides",
    lane: "product-knowledge",
    query: null, // reads one User Guide's summary + body from lib/guides/content.ts
    wired: true,
    description: "One User Guide's full text by slug (getting-started, budgets-and-forecasts, updating-actuals, creating-scenarios, reading-the-statements, asking-scout). Use to answer 'what does X do', 'how do I…', or 'explain how scenarios/actuals/the statements work' — quote the guide. Omit the slug for the full map. NOT for numbers.",
  },
  // searchGuides(query) — add ONLY if the guide corpus outgrows the context budget (the bounded use of retrieval).
];

// ── Derived views (feed the honesty report / coverage artifact) ────────────────

/** A data tool is "live" once a real query backs it. */
export function backing(b: ScoutToolBinding): "live" | "not-built" | "external" {
  if (b.lane === "product-knowledge") return "external"; // sourced from guides, not lib/queries
  if (b.write) return "live"; // backed by its write impl (not a read query in TOOL_THUNKS)
  return b.query !== null ? "live" : "not-built";
}

/** The set the eval + the loop should actually expose: wired tools only. */
export const WIRED_TOOLS = SCOUT_REGISTRY.filter((b) => b.wired);

/** Print the registry-honesty report: declared → backed → wired. */
export function honestyReport(): string {
  const rows = SCOUT_REGISTRY.map((b) => {
    const state = !b.wired ? (backing(b) === "live" ? "ready-to-wire" : backing(b)) : "WIRED";
    return `  ${b.tool.padEnd(20)} ${b.lane.padEnd(18)} ${state}`;
  });
  const live = SCOUT_REGISTRY.filter((b) => backing(b) === "live").length;
  return [
    `Scout registry — ${SCOUT_REGISTRY.length} declared · ${live} backed by a live query · ${WIRED_TOOLS.length} wired`,
    ...rows,
  ].join("\n");
}
