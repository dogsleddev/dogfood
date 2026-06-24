/**
 * Scout's DATA-lane tool implementations (CLAUDE.md §4, §10).
 *
 * One impl per *wired* registry tool: the Anthropic input schema + a deterministic `run` that
 * calls the live lib/queries fn (the ONLY way Scout reads data — zero RAG) and returns a
 * display-shaped result plus a click-through RECEIPT. Results are pre-formatted strings: the
 * model never does math that must tie out (§15) — it quotes the numbers the spine computed.
 *
 * The agent loop exposes only the tools whose SCOUT_REGISTRY entry is `wired: true` AND that have
 * an impl here (asserted at module load), so adding a tool stays "flip wired + add an impl".
 */
import {
  getPnL,
  getMonthlyPnL,
  getPnLLine,
  getBalanceSheet,
  getMonthlyBalanceSheet,
  getCashFlow,
  getMonthlyCashFlow,
  getCashBurnBridge,
  getMetric,
  getDashboardSummary,
  getKpiTile,
  listContracts,
  getContract,
  getBookings,
  getDeferredWaterfall,
  getContractedRevenue,
  getBookingsHistory,
  listCustomers,
  getCustomer,
  listRenewals,
  listPipeline,
  listProjects,
  getUtilization,
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
  createScenario,
  duplicateScenario,
  resetScenario,
  deleteScenario,
  setScenarioDriver,
  listFluxNotes,
  addFluxNote,
  getFluxDetail,
  getReconciliation,
} from "@/lib/queries";
import type { DriverInput } from "@/lib/queries/scenarios";
import type { LeverId, AdjustmentShape } from "@/lib/types/scenario";
import { SCOUT_REGISTRY } from "@/lib/queries/registry";
import { GUIDES, getGuide } from "@/lib/guides/content";
import { month, parseMonth, monthLabel, monthYear, monthToIndex, compareMonth, type Month } from "@/lib/types/period";
import { formatMoney, sumMoney, moneyFromMinor, type Money } from "@/lib/types/money";
import { PLACEHOLDER_SETTINGS, SEED_DEPARTMENTS, SEED_EXPENSE_GROUPS } from "@/lib/target/placeholder";
import type { StaffMember, RenewalStatus, PipelineStage } from "@/lib/types/source";
import type { CostFunction, ScenarioId } from "@/lib/types/common";
import { formatMetricValue, METRIC_CATALOG, type MetricValue } from "@/lib/types/metrics";
import type { MetricId } from "@/lib/types/common";
import type { PnL, PnLLineId, BalanceSheet, BalanceSheetLineId, CashFlow, CashFlowLineId } from "@/lib/types/statements";
import type { DashboardSummary, KpiTile } from "@/lib/types/dashboard";
import type { ScoutReceipt } from "./types";

/** The app's "as of" period (the Dashboard + statements all read June 2026 — §11 close boundary). */
export const SCOUT_PERIOD: Month = month(2026, 6);

/** A tool's JSON-schema input (a minimal subset Anthropic accepts). */
type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required?: string[];
  additionalProperties: false;
};

export interface ScoutToolImpl {
  readonly inputSchema: JsonSchema;
  /** run the backing query; return a display-shaped result + the receipt for this call. */
  run(input: Record<string, unknown>): Promise<{ data: unknown; receipt: ScoutReceipt }>;
}

// ── shaping helpers (pre-formatted; Scout quotes, never computes) ──
const m = (x?: Money) => (x ? formatMoney(x, { compact: true }) : "—");
const periodOf = (input: Record<string, unknown>): Month => {
  const raw = typeof input.period === "string" ? input.period : "";
  try {
    return raw ? parseMonth(raw) : SCOUT_PERIOD;
  } catch {
    return SCOUT_PERIOD;
  }
};
const str = (input: Record<string, unknown>, key: string): string =>
  typeof input[key] === "string" ? (input[key] as string).trim() : "";

const PERIOD_PROP = { type: "string", description: "Month as YYYY-MM. Optional; defaults to the current period (2026-06)." } as const;

const shapePnL = (pnl: PnL) => ({
  period: pnl.label ?? "FY2026",
  lines: pnl.lines.map((l) => ({
    line: l.label,
    budget: m(l.values.budget),
    actual: m(l.values.actual),
    forecast: m(l.values.forecast),
    variance: m(l.values.variance),
  })),
});
const shapeStatement = (s: BalanceSheet | CashFlow) => ({
  // BS/CF carry the as-of value in the forecast column (actual for closed months); show that.
  lines: s.lines.map((l) => ({ line: l.label, value: m(l.values.forecast ?? l.values.actual ?? l.values.budget) })),
});
const shapeDashboard = (d: DashboardSummary) => ({
  period: monthLabel(d.period as Month),
  families: d.families.map((f) => ({
    family: f.label,
    tiles: f.tiles.map((t) => ({ metric: t.definition.label, value: formatMetricValue(t.value), basis: t.definition.basis })),
  })),
});
const shapeTile = (t: KpiTile) => ({
  metric: t.definition.label,
  value: formatMetricValue(t.value),
  priorYear: t.priorYear ? formatMetricValue(t.priorYear) : "—",
  budget: t.budget ? formatMetricValue(t.budget) : "—",
  basis: t.definition.basis,
  family: t.definition.family,
});
const shapeMetric = (v: MetricValue) => {
  const def = METRIC_CATALOG.find((d) => d.id === v.id);
  return { metric: def?.label ?? (v.id as string), value: formatMetricValue(v), basis: def?.basis };
};

const receipt = (tool: string, args: Record<string, string>, label: string, href: string): ScoutReceipt => ({ tool, args, label, href });

// ── register-tool helpers (the layer-1 fan-out: Renewals · Pipeline · Projects · Staff · Expenses) ──
/** A staff member is on the books in `period` if they've started and not yet left (mirrors the Staff register). */
const staffActiveIn = (s: StaffMember, period: Month): boolean => {
  const i = monthToIndex(period);
  const start = monthToIndex(s.startMonth);
  const end = s.endMonth ? monthToIndex(s.endMonth) : Infinity;
  return start <= i && i <= end;
};
const fteLabel = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const pctLabel = (p: number): string => `${Math.round(p * 100)}%`;
const DEPT_LABELS: Record<string, string> = Object.fromEntries(SEED_DEPARTMENTS.map((d) => [d.id as string, d.name]));
const GROUP_LABELS: Record<string, string> = Object.fromEntries(SEED_EXPENSE_GROUPS.map((g) => [g.id as string, g.label]));
/** Mirrors the Expense register's prettyGroup: OpEx groups use their label; CoR groups (hosting/
 *  passthrough) and any unmapped id are title-cased ("cor-hosting" → "CoR Hosting"). */
const prettyGroup = (id: string): string =>
  GROUP_LABELS[id] ?? id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bCor\b/, "CoR");
const FUNCTION_LABELS: Record<CostFunction, string> = { direct: "Direct · CoR", rnd: "R&D", sm: "S&M", ga: "G&A" };
const FUNCTION_ORDER: readonly CostFunction[] = ["direct", "rnd", "sm", "ga"];

// ── the impls, keyed by registry tool name ──
export const SCOUT_TOOL_IMPLS: Record<string, ScoutToolImpl> = {
  getMetric: {
    inputSchema: {
      type: "object",
      properties: {
        metricId: { type: "string", description: "Metric id, e.g. runway, nrr, magic_number, cac_payback (dollar CAC per new logo), cac_payback_months (months to recover CAC — the payback PERIOD), ltv_cac, rule_of_40, burn_multiple, gross_margin_pct, arr_mrr. ARR, MRR, and 'monthly/annual recurring revenue' all use arr_mrr." },
        period: PERIOD_PROP,
      },
      required: ["metricId"],
      additionalProperties: false,
    },
    async run(input) {
      const period = periodOf(input);
      const metricId = str(input, "metricId") as MetricId;
      const v = await getMetric(metricId, period);
      return { data: shapeMetric(v), receipt: receipt("getMetric", { metricId: metricId as string, period }, `Metric: ${metricId}`, "/dashboard") };
    },
  },

  explainTile: {
    inputSchema: {
      type: "object",
      properties: {
        metricId: { type: "string", description: "Dashboard tile metric id (same ids as getMetric). Returns value + prior-year + budget + basis." },
        period: PERIOD_PROP,
      },
      required: ["metricId"],
      additionalProperties: false,
    },
    async run(input) {
      const period = periodOf(input);
      const metricId = str(input, "metricId") as MetricId;
      const tile = await getKpiTile(metricId, period);
      return { data: shapeTile(tile), receipt: receipt("explainTile", { metricId: metricId as string, period }, `Tile: ${metricId}`, "/dashboard") };
    },
  },

  getDashboard: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const d = await getDashboardSummary(period);
      return { data: shapeDashboard(d), receipt: receipt("getDashboard", { period }, "Dashboard", "/dashboard") };
    },
  },

  getPnL: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const pnl = await getPnL(period);
      return { data: shapePnL(pnl), receipt: receipt("getPnL", { period }, "Forecasted P&L", "/statements/pnl") };
    },
  },

  getMonthlyPnL: {
    inputSchema: {
      type: "object",
      properties: { period: { type: "string", description: "Any month (YYYY-MM) in the target fiscal year. Returns that whole FY broken out by month. Optional; defaults to the current FY." } },
      additionalProperties: false,
    },
    async run(input) {
      const period = periodOf(input);
      const mp = await getMonthlyPnL(period);
      const pick = (id: PnLLineId) => mp.lines.find((l) => l.id === id);
      const rev = pick("total_revenue"), gp = pick("gross_profit"), oi = pick("operating_income"), ni = pick("net_income");
      const months = mp.months.map((col, i) => ({
        month: col.label,
        status: col.status,
        totalRevenue: m(rev?.monthly[i]),
        grossProfit: m(gp?.monthly[i]),
        operatingIncome: m(oi?.monthly[i]),
        netIncome: m(ni?.monthly[i]),
      }));
      return {
        data: {
          fiscalYear: mp.label ?? "FY",
          note: "Each row is one month of the fiscal year (Σ months = the FY P&L total). Compare across rows to find the biggest / most profitable month.",
          months,
        },
        receipt: receipt("getMonthlyPnL", { period }, `Monthly P&L · ${mp.label ?? ""}`.trim(), "/statements/pnl?view=monthly"),
      };
    },
  },

  explainVariance: {
    inputSchema: {
      type: "object",
      properties: {
        lineId: { type: "string", description: "P&L line id, e.g. subscription, services, total_revenue, gross_profit, operating_income, net_income." },
        period: PERIOD_PROP,
      },
      required: ["lineId"],
      additionalProperties: false,
    },
    async run(input) {
      const period = periodOf(input);
      const lineId = str(input, "lineId") as PnLLineId;
      const line = await getPnLLine(lineId, period);
      return {
        data: { line: line.label, budget: m(line.values.budget), actual: m(line.values.actual), forecast: m(line.values.forecast), variance: m(line.values.variance) },
        receipt: receipt("explainVariance", { lineId: lineId as string, period }, `P&L line: ${lineId}`, `/statements/pnl?inspect=${lineId}`),
      };
    },
  },

  getBalanceSheet: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const bs = await getBalanceSheet(period);
      return { data: shapeStatement(bs), receipt: receipt("getBalanceSheet", { period }, "Balance Sheet", "/statements/balance-sheet") };
    },
  },

  getMonthlyBalanceSheet: {
    inputSchema: {
      type: "object",
      properties: { period: { type: "string", description: "Any month (YYYY-MM) in the target fiscal year. Returns that whole FY Balance Sheet broken out by month (month-end balances). Optional; defaults to the current FY." } },
      additionalProperties: false,
    },
    async run(input) {
      const period = periodOf(input);
      const mbs = await getMonthlyBalanceSheet(period);
      const pick = (id: BalanceSheetLineId) => mbs.lines.find((l) => l.id === id);
      const cash = pick("cash"), ar = pick("accounts_receivable"), def = pick("deferred_revenue");
      const months = mbs.months.map((col, i) => ({
        month: col.label,
        status: col.status,
        cash: m(cash?.monthly[i]),
        accountsReceivable: m(ar?.monthly[i]),
        deferredRevenue: m(def?.monthly[i]),
      }));
      return {
        data: {
          fiscalYear: mbs.label ?? "FY",
          note: "Each row is a month-END snapshot (a balance, not a flow); Assets = Liabilities + Equity every month. For the cash trajectory use getMonthlyCashFlow.",
          months,
        },
        receipt: receipt("getMonthlyBalanceSheet", { period }, `Monthly Balance Sheet · ${mbs.label ?? ""}`.trim(), "/statements/balance-sheet?view=monthly"),
      };
    },
  },

  getCashFlow: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const cf = await getCashFlow(period);
      return { data: shapeStatement(cf), receipt: receipt("getCashFlow", { period }, "Cash Flow Forecast", "/statements/cash-flow") };
    },
  },

  getMonthlyCashFlow: {
    inputSchema: {
      type: "object",
      properties: { period: { type: "string", description: "Any month (YYYY-MM) in the target fiscal year. Returns that whole FY Cash Flow broken out by month. Optional; defaults to the current FY." } },
      additionalProperties: false,
    },
    async run(input) {
      const period = periodOf(input);
      const mcf = await getMonthlyCashFlow(period);
      const pick = (id: CashFlowLineId) => mcf.lines.find((l) => l.id === id);
      const ni = pick("net_income"), ocf = pick("operating_cash_flow"), capex = pick("capex"), nc = pick("net_change_in_cash");
      const months = mcf.months.map((col, i) => ({
        month: col.label,
        status: col.status,
        netIncome: m(ni?.monthly[i]),
        operatingCashFlow: m(ocf?.monthly[i]),
        capex: m(capex?.monthly[i]),
        netChangeInCash: m(nc?.monthly[i]),
      }));
      return {
        data: {
          fiscalYear: mcf.label ?? "FY",
          note: "Each row is one month's cash FLOW (Σ months = the FY total); the net change in cash ties to the Balance Sheet cash movement.",
          months,
        },
        receipt: receipt("getMonthlyCashFlow", { period }, `Monthly Cash Flow · ${mcf.label ?? ""}`.trim(), "/statements/cash-flow?view=monthly"),
      };
    },
  },

  getCashBurnBridge: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const b = await getCashBurnBridge(period);
      const months = b.runway.months === null ? "cash-flow positive" : String(Math.round(b.runway.months));
      return {
        data: {
          period,
          bridge: {
            gaapNetIncome: m(b.gaapNetIncome),
            nonCashAddBacks: m(b.nonCashAddbacks),
            deferredRevenueInflow: m(b.deferredRevenueInflow),
            deferredRevenueNote: "The driver — Bearing bills annual-prepay, so subscription growth collects cash up front.",
            otherWorkingCapital: m(b.otherWorkingCapital),
            operatingCashFlow: m(b.operatingCashFlow),
            capex: m(b.capex),
            freeCashFlow: m(b.freeCashFlow),
          },
          margins: { gaapNet: pctLabel(b.gaapNetMargin), nonGaapNet: pctLabel(b.nonGaapNetMargin), freeCashFlow: pctLabel(b.freeCashFlowMargin) },
          runway: { asOf: monthLabel(b.runway.asOf), cash: m(b.runway.cash), netBurnPerMonth: `${m(b.runway.netBurn)} (trailing 12 mo)`, months },
          windowNote: `The bridge rows are the FY window (they tie to the Cash Flow Forecast column); net burn and runway are trailing-12-months ending ${monthLabel(b.runway.asOf)}. Do not divide FY free cash flow by 12 — the runway uses the TTM window.`,
          summary: `A ${pctLabel(b.gaapNetMargin)} GAAP margin becomes a ${pctLabel(b.freeCashFlowMargin)} free-cash-flow margin because of the ${m(b.deferredRevenueInflow)} annual-prepay deferred-revenue inflow; the ~${months}-month runway is a structural consequence of the prepay model, not an over-raised balance sheet.`,
        },
        receipt: receipt("getCashBurnBridge", { period }, "Cash Flow Forecast", "/statements/cash-flow"),
      };
    },
  },

  getContracts: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const [contracts, bookings, deferred, rpo] = await Promise.all([
        listContracts(),
        getBookings(period),
        getDeferredWaterfall(period),
        getContractedRevenue(period),
      ]);
      const active = contracts.filter((c) => c.status === "active");
      const churned = contracts.filter((c) => c.status === "churned");
      const topContracts = [...contracts]
        .sort((a, b) => b.arr.minor - a.arr.minor)
        .slice(0, 8)
        // A churned contract contributes $0 to the book — show "—", never its stale pre-churn ARR.
        .map((c) => ({ customer: c.customerName, plan: c.planTier ?? "—", arr: c.status === "churned" ? "—" : m(c.arr), status: c.status }));
      return {
        data: {
          summary: { total: contracts.length, active: active.length, churned: churned.length },
          bookings: { period: monthLabel(period), newBusiness: m(bookings.newBusiness), expansion: m(bookings.expansion), contraction: m(bookings.contraction), netDeltaArr: m(bookings.net) },
          deferredRevenue: { opening: m(deferred.opening), billings: m(deferred.additions), recognized: m(deferred.recognized), closing: m(deferred.closing) },
          contractedRevenue: { recognizedToDate: m(rpo.recognizedToDate), contractedForward: m(rpo.contractedForward) },
          topContracts,
        },
        receipt: receipt("getContracts", { period }, "Contracts", "/sales/contracts"),
      };
    },
  },

  getContract: {
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Contract id, e.g. C-sub-12-3. Use getContracts to find ids/customers first." } },
      required: ["id"],
      additionalProperties: false,
    },
    async run(input) {
      const id = str(input, "id");
      const c = await getContract(id);
      // A churned contract contributes $0 to the book — show "—", never its stale pre-churn ARR.
      const data = c
        ? { id: c.id, customer: c.customerName, stream: c.stream, plan: c.planTier ?? "—", arr: c.status === "churned" ? "—" : m(c.arr), startMonth: monthLabel(c.startMonth), termMonths: c.termMonths, status: c.status, bookingType: c.bookingType }
        : { error: `No contract with id "${id}". Use getContracts to list customers and ids.` };
      return { data, receipt: receipt("getContract", { id }, `Contract: ${id}`, "/sales/contracts") };
    },
  },

  getBookingsHistory: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const h = await getBookingsHistory(period);
      const win = (w: typeof h.ttm) => ({
        window: w.label,
        newBusiness: m(w.newBusiness),
        expansion: m(w.expansion),
        contraction: m(w.contraction),
        grossBookings: m(w.gross),
        netDeltaArr: m(w.net),
      });
      return {
        data: {
          note: "Bookings (ΔARR) over time, for year-over-year comparison. TTM = trailing 12 months ending at the period (the apples-to-apples 'at this point' view); fiscal-year totals include the forecast tail. Monthly bookings are lumpy — compare these windows, not single months.",
          ttm: win(h.ttm),
          priorTtm: win(h.priorTtm),
          fiscalYear: win(h.fiscalYear),
          priorFiscalYear: win(h.priorFiscalYear),
        },
        receipt: receipt("getBookingsHistory", { period }, "Contracts · Bookings", "/sales/contracts"),
      };
    },
  },

  getCustomers: {
    // The register is the current run-rate book of business, not a period slice — so no period arg
    // (a period would not change the data; the period ARR/MRR value is getMetric arr_mrr).
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      const customers = await listCustomers();
      const active = customers.filter((c) => c.status === "active");
      const churned = customers.filter((c) => c.status === "churned");
      const activeArr = sumMoney(active.map((c) => c.arr));
      const arrPerLogo = active.length > 0 ? moneyFromMinor(Math.round(activeArr.minor / active.length)) : moneyFromMinor(0);
      const bySegment = (["starter", "growth", "scale"] as const).map((segment) => {
        const rows = active.filter((c) => c.segment === segment);
        return { segment, logos: rows.length, arr: m(sumMoney(rows.map((c) => c.arr))) };
      });
      const cohort = (y: number) => customers.filter((c) => monthYear(c.startMonth) === y).length;
      const topCustomers = [...customers]
        .sort((a, b) => b.arr.minor - a.arr.minor)
        .slice(0, 8)
        .map((c) => ({ customer: c.name, segment: c.segment ?? "—", arr: c.status === "churned" ? "—" : m(c.arr), status: c.status }));
      return {
        data: {
          // Tell the model exactly what runRateArr is, so it never quotes it as the June point-in-time ARR.
          basis: "Active book run-rate ARR (= exit ARR). For the point-in-time period ARR/MRR value, use getMetric arr_mrr.",
          summary: { total: customers.length, active: active.length, churned: churned.length },
          runRateArr: m(activeArr),
          arrPerLogo: m(arrPerLogo),
          bySegment,
          newLogosByCohort: { preFy24Base: cohort(2023), fy2024: cohort(2024), fy2025: cohort(2025), fy2026: cohort(2026) },
          topCustomers,
        },
        receipt: receipt("getCustomers", {}, "Customers", "/sales/customers"),
      };
    },
  },

  getCustomer: {
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Customer/account id, e.g. sub-init-0. Use getCustomers to find ids/names first." } },
      required: ["id"],
      additionalProperties: false,
    },
    async run(input) {
      const id = str(input, "id");
      const c = await getCustomer(id);
      // A churned account contributes $0 to the book — show "—", not its stale pre-churn ARR.
      const data = c
        ? { id: c.id, customer: c.name, segment: c.segment ?? "—", arr: c.status === "churned" ? "—" : m(c.arr), customerSince: monthLabel(c.startMonth), status: c.status }
        : { error: `No customer with id "${id}". Use getCustomers to list accounts and ids.` };
      return { data, receipt: receipt("getCustomer", { id }, `Customer: ${id}`, "/sales/customers") };
    },
  },

  // ── Sales · Renewals (the retention worklist) ──
  getRenewals: {
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      const renewals = await listRenewals();
      const CLOSED: readonly RenewalStatus[] = ["renewed", "expanded", "contracted", "churned"];
      const open = renewals.filter((r) => r.status === "open");
      const closed = renewals.filter((r) => CLOSED.includes(r.status));
      const openArr = sumMoney(open.map((r) => r.arrUpForRenewal));
      const outcome = (s: RenewalStatus) => {
        const rows = closed.filter((r) => r.status === s);
        return { count: rows.length, arr: m(sumMoney(rows.map((r) => r.arrUpForRenewal))) };
      };
      // Gross dollar retention on the closed book: face-value ARR kept vs churned.
      const keptArr = sumMoney(closed.filter((r) => r.status !== "churned").map((r) => r.arrUpForRenewal));
      const closedArr = sumMoney(closed.map((r) => r.arrUpForRenewal));
      const grr = closedArr.minor > 0 ? `${((keptArr.minor / closedArr.minor) * 100).toFixed(1)}%` : "—";
      const nextDue = open.length > 0 ? [...open].sort((a, b) => compareMonth(a.dueMonth, b.dueMonth))[0] : undefined;
      return {
        data: {
          summary: { total: renewals.length, open: open.length, resolved: closed.length },
          forwardWorklist: { openRenewals: open.length, openArr: m(openArr), nextDue: nextDue ? monthLabel(nextDue.dueMonth) : "—" },
          outcomes: { renewed: outcome("renewed"), expanded: outcome("expanded"), contracted: outcome("contracted"), churned: outcome("churned") },
          grossDollarRetention: {
            value: grr,
            basis: "closed-book: face-value ARR kept (renewed + expanded + contracted) ÷ ARR up for renewal. For the NRR rate use getMetric nrr.",
          },
        },
        receipt: receipt("getRenewals", {}, "Renewals", "/sales/renewals"),
      };
    },
  },

  // ── Sales · Pipeline (the open-opportunity funnel) ──
  getPipeline: {
    inputSchema: {
      type: "object",
      properties: { stage: { type: "string", description: "Optional funnel stage filter: lead | qualified | proposal | negotiation." } },
      additionalProperties: false,
    },
    async run(input) {
      const all = await listPipeline();
      const STAGE_ORDER: readonly PipelineStage[] = ["lead", "qualified", "proposal", "negotiation"];
      const totalArr = sumMoney(all.map((o) => o.arr));
      const weightedArr = sumMoney(all.map((o) => moneyFromMinor(Math.round(o.arr.minor * (o.probability as number)))));
      const byStage = STAGE_ORDER.map((stage) => {
        const rows = all.filter((o) => o.stage === stage);
        return { stage, count: rows.length, arr: m(sumMoney(rows.map((o) => o.arr))) };
      });
      const repMap = new Map<string, { minor: number; count: number }>();
      for (const o of all) {
        const prev = repMap.get(o.owner);
        if (prev) { prev.minor += o.arr.minor; prev.count += 1; }
        else repMap.set(o.owner, { minor: o.arr.minor, count: 1 });
      }
      const topOwners = [...repMap.entries()]
        .map(([owner, v]) => ({ owner, count: v.count, minor: v.minor }))
        .sort((a, b) => b.minor - a.minor)
        .slice(0, 5)
        .map(({ owner, count, minor }) => ({ owner, count, arr: m(moneyFromMinor(minor)) }));
      const stage = str(input, "stage");
      const filtered = stage ? all.filter((o) => (o.stage as string) === stage) : null;
      return {
        data: {
          note: "Open pipeline (deals not yet signed). Weighted ARR = Σ ARR × win probability. Booked ΔARR is getContracts; this is the funnel ahead.",
          totalOpenPipeline: { opportunities: all.length, arr: m(totalArr), weightedArr: m(weightedArr) },
          byStage,
          topOwners,
          ...(filtered ? { filtered: { stage, count: filtered.length, arr: m(sumMoney(filtered.map((o) => o.arr))) } } : {}),
        },
        receipt: receipt("getPipeline", stage ? { stage } : {}, "Pipeline", stage ? `/sales/pipeline?stage=${stage}` : "/sales/pipeline"),
      };
    },
  },

  // ── Reporting · Projects (services delivery) ──
  getProjects: {
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      const utilPeriod = PLACEHOLDER_SETTINGS.closeThrough;
      const [projects, util] = await Promise.all([listProjects(), getUtilization(utilPeriod)]);
      const count = (s: string) => projects.filter((p) => p.status === s).length;
      const totalWip = sumMoney(projects.map((p) => p.wip));
      const top = [...projects]
        .sort((a, b) => b.contractValue.minor - a.contractValue.minor)
        .slice(0, 6)
        .map((p) => ({ project: p.name, status: p.status, pctComplete: pctLabel(p.pctComplete as number), wip: m(p.wip), contractValue: m(p.contractValue) }));
      return {
        data: {
          summary: { total: projects.length, inProgress: count("in_progress"), complete: count("complete") },
          totalWip: m(totalWip),
          utilization: { period: monthLabel(utilPeriod), value: pctLabel(util.utilization as number), basis: "billable delivery ÷ capacity at the last closed month. For the utilization metric tile use getMetric utilization." },
          topProjects: top,
        },
        receipt: receipt("getProjects", {}, "Projects", "/reporting/projects"),
      };
    },
  },

  // ── Reporting · Staff (the people roster) ──
  getStaff: {
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      // Match the Staff register: the roster active at the last closed month.
      const asOf = PLACEHOLDER_SETTINGS.closeThrough;
      const roster = (await listStaff()).filter((s) => staffActiveIn(s, asOf));
      const totalHeads = roster.reduce((n, s) => n + s.fte, 0);
      const byDeptMap = new Map<string, number>();
      for (const s of roster) byDeptMap.set(s.departmentId as string, (byDeptMap.get(s.departmentId as string) ?? 0) + s.fte);
      const byDepartment = [...byDeptMap.entries()]
        .map(([id, heads]) => ({ id, heads }))
        .sort((a, b) => b.heads - a.heads)
        .map((d) => ({ department: DEPT_LABELS[d.id] ?? d.id, heads: fteLabel(d.heads) }));
      const byFnMap = new Map<CostFunction, number>();
      for (const s of roster) byFnMap.set(s.function, (byFnMap.get(s.function) ?? 0) + s.fte);
      const byFunction = FUNCTION_ORDER.map((f) => ({ function: FUNCTION_LABELS[f], heads: fteLabel(byFnMap.get(f) ?? 0) }));
      return {
        data: {
          headcount: fteLabel(totalHeads),
          asOf: monthLabel(asOf),
          basis: "Active FTE on the current roster (departed + not-yet-started excluded). Ties to getHeadcount by construction. Heads, not dollars — for payroll cost use the P&L.",
          byDepartment,
          byFunction,
        },
        receipt: receipt("getStaff", {}, "Staff", "/reporting/staff"),
      };
    },
  },

  // ── Reporting · Expense Transactions (the AP sub-ledger / Flux drill) ──
  getExpenseTransactions: {
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", description: "Month as YYYY-MM. Optional; defaults to the last closed month (2026-05)." },
        group: { type: "string", description: "Optional expense-group id filter, e.g. sales-marketing, it, employee-expenses, facilities, travel-entertainment, hr, admin, insurance." },
      },
      additionalProperties: false,
    },
    async run(input) {
      const rawPeriod = str(input, "period");
      let period: Month = PLACEHOLDER_SETTINGS.closeThrough;
      if (rawPeriod) { try { period = parseMonth(rawPeriod); } catch { period = PLACEHOLDER_SETTINGS.closeThrough; } }
      const all = await listExpenseTransactions({ period });
      const total = sumMoney(all.map((b) => b.amount));
      const groupIds = [...new Set(all.map((b) => b.groupId as string))];
      const byGroup = groupIds
        .map((id) => {
          const rows = all.filter((b) => (b.groupId as string) === id);
          return { id, amt: sumMoney(rows.map((b) => b.amount)), count: rows.length };
        })
        .sort((a, b) => b.amt.minor - a.amt.minor)
        .map((g) => ({ group: prettyGroup(g.id), count: g.count, amount: m(g.amt) }));
      const group = str(input, "group");
      const filtered = group ? all.filter((b) => (b.groupId as string) === group) : all;
      const topBills = [...filtered]
        .sort((a, b) => b.amount.minor - a.amount.minor)
        .slice(0, 6)
        .map((b) => ({ vendor: b.vendor ?? "—", group: prettyGroup(b.groupId as string), amount: m(b.amount) }));
      const href = group
        ? `/reporting/expense-transactions?period=${period}&group=${group}`
        : `/reporting/expense-transactions?period=${period}`;
      return {
        data: {
          period: monthLabel(period),
          total: m(total),
          count: all.length,
          byGroup,
          ...(group ? { filteredGroup: { group: prettyGroup(group), count: filtered.length, amount: m(sumMoney(filtered.map((b) => b.amount))) } } : {}),
          topBills,
        },
        receipt: receipt("getExpenseTransactions", group ? { period: period as string, group } : { period: period as string }, "Expense Transactions", href),
      };
    },
  },

  // ── Forecast drivers (layer 2 — forward assumptions; FY aggregates) ──
  getRevenueForecast: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const lines = await getRevenueForecast(period);
      const byStream = (stream: string) => {
        const ls = lines.filter((l) => l.stream === stream);
        return { contracted: m(sumMoney(ls.map((l) => l.contracted))), newBusiness: m(sumMoney(ls.map((l) => l.newBusiness))), total: m(sumMoney(ls.map((l) => l.total))) };
      };
      return {
        data: {
          fiscalYear: `FY${monthYear(period)}`,
          subscription: byStream("subscription"),
          services: byStream("services"),
          note: "Forward revenue assumption. Contracted = signed as of close; new-business = assumed post-close. For the recognized P&L revenue use getPnL; for ARR use getMetric arr_mrr.",
        },
        receipt: receipt("getRevenueForecast", { period }, "Revenue Forecast", "/forecasts/revenue"),
      };
    },
  },
  getCostOfRevenue: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const lines = await getCostOfRevenue(period);
      return {
        data: {
          fiscalYear: `FY${monthYear(period)}`,
          directPayroll: m(sumMoney(lines.map((l) => l.directPayroll))),
          nonEmployeeCoR: m(sumMoney(lines.map((l) => l.nonEmployee))),
          totalCoR: m(sumMoney(lines.map((l) => l.total))),
          note: "Assembled: direct payroll (Personnel direct depts) + non-employee rate × revenue. For gross margin % use getMetric gross_margin_pct.",
        },
        receipt: receipt("getCostOfRevenue", { period }, "Cost of Revenue", "/forecasts/cost-of-revenue"),
      };
    },
  },
  getPersonnelForecast: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const FNS: readonly CostFunction[] = ["direct", "rnd", "sm", "ga"];
      const byFunction = [];
      for (const f of FNS) {
        const ls = await getPersonnelForecast(period, { function: f });
        byFunction.push({ function: FUNCTION_LABELS[f], headcountYearEnd: ls[ls.length - 1]?.heads ?? 0, fyBaseComp: m(sumMoney(ls.map((l) => l.baseComp))) });
      }
      const total = await getPersonnelForecast(period);
      return {
        data: {
          fiscalYear: `FY${monthYear(period)}`,
          headcountYearEnd: total[total.length - 1]?.heads ?? 0,
          fyBaseComp: m(sumMoney(total.map((l) => l.baseComp))),
          byFunction,
          note: "Forward base-comp payroll + year-end headcount by function (burden lives in Employee Expenses). For the current roster use getStaff; for the P&L payroll lines use getPnL.",
        },
        receipt: receipt("getPersonnelForecast", { period }, "Personnel", "/forecasts/personnel"),
      };
    },
  },
  getExpenseForecast: {
    inputSchema: {
      type: "object",
      properties: {
        period: PERIOD_PROP,
        groupId: { type: "string", description: "OpEx group slug to drill, e.g. 'sales-marketing', 'it' (required for breakdown account/vendor)" },
        breakdown: { type: "string", description: "drill depth, one of: 'group' (default) · 'account' (GL sub-accounts) · 'vendor' (recurring vendors at run-rate + an Other line per account on forecast months)" },
      },
      additionalProperties: false,
    },
    async run(input) {
      const period = periodOf(input);
      const fiscalYear = `FY${monthYear(period)}`;
      const breakdown = (input.breakdown as "group" | "account" | "vendor" | undefined) ?? "group";
      const groupId = input.groupId as string | undefined;

      // account / vendor drill for one group, focused on the requested month (the period)
      if ((breakdown === "account" || breakdown === "vendor") && groupId) {
        const all = await getExpenseForecast(period, { groupId: groupId as never, breakdown });
        const monthLines = all.filter((l) => l.period === period);
        const total = m(sumMoney(monthLines.map((l) => l.amount)));
        const base = { fiscalYear, month: monthLabel(period), group: prettyGroup(groupId), total };
        const drillReceipt = receipt("getExpenseForecast", { period, groupId, breakdown }, `Expense Forecast · ${prettyGroup(groupId)}`, `/forecasts/expenses/${groupId}?month=${period}`);
        if (breakdown === "account") {
          return {
            data: {
              ...base,
              byAccount: monthLines.map((l) => ({ account: `${l.subCode} ${l.accountLabel}`, amount: m(l.amount) })),
              note: `${prettyGroup(groupId)} by GL sub-account for ${monthLabel(period)}. Drill further to vendors with breakdown 'vendor'.`,
            },
            receipt: drillReceipt,
          };
        }
        return {
          data: {
            ...base,
            byVendor: monthLines.map((l) => ({ account: l.subCode, vendor: l.vendor, amount: m(l.amount), ...(l.isResidual ? { residual: true } : {}), ...(l.isActual ? { actual: true } : {}) })),
            note:
              period <= PLACEHOLDER_SETTINGS.closeThrough
                ? `${prettyGroup(groupId)} real vendor bills for ${monthLabel(period)} (closed month).`
                : `${prettyGroup(groupId)} forecast for ${monthLabel(period)}: recurring vendors at run-rate + an "Other —" line per account (the variable remainder).`,
          },
          receipt: drillReceipt,
        };
      }

      // default: by group across the fiscal year
      const lines = await getExpenseForecast(period);
      const totals = new Map<string, number>();
      for (const l of lines) totals.set(l.groupId as string, (totals.get(l.groupId as string) ?? 0) + l.amount.minor);
      const byGroup = [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, minor]) => ({ group: prettyGroup(id), amount: m(moneyFromMinor(minor)) }));
      return {
        data: {
          fiscalYear,
          totalOpEx: m(sumMoney(lines.map((l) => l.amount))),
          byGroup,
          note: "Forward non-payroll OpEx by group. Drill a group with groupId + breakdown 'account'/'vendor'. For actual bills use getExpenseTransactions; for the P&L opex lines use getPnL.",
        },
        receipt: receipt("getExpenseForecast", { period }, "Expense Forecast", "/forecasts/expenses"),
      };
    },
  },
  getArForecast: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const lines = await getArForecast(period);
      const last = lines[lines.length - 1];
      return {
        data: { fiscalYear: `FY${monthYear(period)}`, dso: last ? `${Math.round(Number(last.dso))} days` : "—", closingBalance: m(last?.balance), note: "DSO-driven receivables; closing = year-end AR (ties to the balance-sheet AR line)." },
        receipt: receipt("getArForecast", { period }, "AR Forecast", "/forecasts/ar"),
      };
    },
  },
  getFixedAssetForecast: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const lines = await getFixedAssetForecast(period);
      const last = lines[lines.length - 1];
      return {
        data: { fiscalYear: `FY${monthYear(period)}`, fyCapex: m(sumMoney(lines.map((l) => l.capex))), fyDepreciation: m(sumMoney(lines.map((l) => l.depreciation))), closingNetBookValue: m(last?.netBookValue) },
        receipt: receipt("getFixedAssetForecast", { period }, "Fixed Asset Budget", "/forecasts/fixed-assets"),
      };
    },
  },
  getPrepaidsForecast: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const lines = await getPrepaidsForecast(period);
      const last = lines[lines.length - 1];
      return {
        data: { fiscalYear: `FY${monthYear(period)}`, fyAdditions: m(sumMoney(lines.map((l) => l.additions))), fyAmortization: m(sumMoney(lines.map((l) => l.amortization))), closingBalance: m(last?.balance) },
        receipt: receipt("getPrepaidsForecast", { period }, "Prepaids Budget", "/forecasts/prepaids"),
      };
    },
  },

  // ── Board Package (layer 5 — the exportable deck) ──
  getBoardPackage: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const bp = await getBoardPackage(period);
      return {
        data: {
          period: monthLabel(bp.period as Month),
          sections: bp.sections.map((sec) => ({ section: sec.title, tiles: sec.tiles.map((t) => ({ metric: t.definition.label, value: formatMetricValue(t.value) })) })),
        },
        receipt: receipt("getBoardPackage", { period }, "Board Package", "/board-package"),
      };
    },
  },

  // ── Setup · Data Import — the detail-to-TB reconciliation control total (§16) ──
  getReconciliation: {
    inputSchema: { type: "object", properties: { period: PERIOD_PROP }, additionalProperties: false },
    async run(input) {
      const period = periodOf(input);
      const r = await getReconciliation(period);
      const exceptions = r.findings
        .filter((f) => !f.reconciled)
        .map((f) => ({ account: `${f.accountCode} ${f.accountName}`, statementLine: f.statementLineId, variance: `$${Math.round(f.gap).toLocaleString()}` }));
      return {
        data: {
          period: monthLabel(period),
          reconciled: r.reconciled,
          message: r.reconciled
            ? `All ${r.findings.length} accounts with a sub-ledger tie to the trial balance to the dollar; ${r.tbOnly.length} more are authoritative (no sub-ledger to reconcile up).`
            : `${exceptions.length} account(s) need attention (Σ|gap| $${Math.round(r.unreconciledTotal).toLocaleString()}) — fix upstream and re-import, never plug.`,
          detailedAccounts: r.findings.length,
          authoritativeAccounts: r.tbOnly.length,
          exceptions,
        },
        receipt: receipt("getReconciliation", { period }, "Data Import · reconciliation", "/setup/data-import"),
      };
    },
  },

  // ── Scenarios (group-scoped reads — contained hypotheticals, never Base/actuals) ──
  getScenarios: {
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      const list = await listScenarios();
      return {
        data: { scenarios: list.map((s) => ({ id: s.id, name: s.name, baseline: s.baseline, adjustments: s.adjustmentCount, isPreset: s.isPreset, isBase: s.isBase })) },
        receipt: receipt("getScenarios", {}, "Scenario Manager", "/scenarios/manager"),
      };
    },
  },
  getScenarioPnL: {
    inputSchema: {
      type: "object",
      properties: { scenarioId: { type: "string", description: "Scenario id (find via getScenarios), e.g. preset-25-profit, base." } },
      required: ["scenarioId"],
      additionalProperties: false,
    },
    async run(input) {
      const id = str(input, "scenarioId") as ScenarioId;
      const res = await getScenarioPnL(id);
      if (!res) return { data: { error: `No scenario "${id}". Use getScenarios to list ids.` }, receipt: receipt("getScenarioPnL", { scenarioId: id as string }, "Scenario P&L", "/scenarios/pnl") };
      return {
        data: {
          scenario: res.scenarioName,
          comparedTo: res.comparedTo,
          period: monthLabel(res.period),
          note: "A contained hypothetical vs its baseline — NOT the real P&L (for that use getPnL).",
          lines: res.lines.map((l) => ({ line: l.label, scenario: m(l.scenario), baseline: m(l.baseline), delta: m(l.delta) })),
        },
        receipt: receipt("getScenarioPnL", { scenarioId: id as string }, `Scenario P&L: ${res.scenarioName}`, "/scenarios/pnl"),
      };
    },
  },
  compareScenarios: {
    inputSchema: {
      type: "object",
      properties: { scenarioIds: { type: "string", description: "Comma-separated scenario ids to compare (e.g. 'base,preset-25-profit'). Omit to compare Base + the presets." } },
      additionalProperties: false,
    },
    async run(input) {
      const raw = str(input, "scenarioIds");
      const list = await listScenarios();
      const ids = (raw ? raw.split(",").map((x) => x.trim()) : list.slice(0, 3).map((s) => s.id as string)) as ScenarioId[];
      const res = await getScenarioDashboard(ids);
      return {
        data: {
          period: monthLabel(res.period),
          note: "Side-by-side contained hypotheticals (group-scoped) — not Base/actuals.",
          columns: res.columns.map((c) => ({
            scenario: c.scenarioName,
            isBase: c.isBase,
            kpis: c.dashboard.families.flatMap((f) => f.tiles).slice(0, 6).map((t) => ({ metric: t.definition.label, value: formatMetricValue(t.value) })),
          })),
        },
        receipt: receipt("compareScenarios", {}, "Scenario Dashboard", "/scenarios/dashboard"),
      };
    },
  },

  // ── Scenarios — WRITES (the full contained authoring surface; §9/§17). Never touch Base/actuals;
  //    Base + presets are immutable (duplicate to edit). Each write is engine-validated and recorded
  //    on the user's behalf (undoable via resetScenario / deleteScenario). Scout routes a what-if
  //    THROUGH the engine (create/duplicate → setDriver → getScenarioPnL) — it never hand-computes it.
  createScenario: {
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the new scenario, e.g. 'Downside Case'." },
        baseline: { type: "string", description: "Comparison baseline: 'base' (the working forecast, default) or 'budget' (the locked plan)." },
      },
      required: ["name"],
      additionalProperties: false,
    },
    async run(input) {
      const name = str(input, "name");
      const baseline = str(input, "baseline") === "budget" ? "budget" : "base";
      const res = await createScenario(name, baseline);
      if (!res.ok) return { data: { error: res.error }, receipt: receipt("createScenario", {}, "Scenario Manager", "/scenarios/manager") };
      return {
        data: { created: true, scenarioId: res.scenarioId, name: res.scenarioName, baseline, next: "Add driver adjustments with setDriver, then read it with getScenarioPnL.", attribution: "Created on your behalf (via Scout)." },
        receipt: receipt("createScenario", { scenarioId: res.scenarioId as string }, `Scenario created · ${res.scenarioName}`, `/scenarios/drivers?scenario=${res.scenarioId}`),
      };
    },
  },
  duplicateScenario: {
    inputSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string", description: "Id of the scenario to copy (Base, a preset, or a user one — find via getScenarios)." },
        name: { type: "string", description: "Optional name for the copy (defaults to '<source> (copy)')." },
      },
      required: ["sourceId"],
      additionalProperties: false,
    },
    async run(input) {
      const sourceId = str(input, "sourceId") as ScenarioId;
      const name = str(input, "name") || undefined;
      const res = await duplicateScenario(sourceId, name);
      if (!res.ok) return { data: { error: res.error }, receipt: receipt("duplicateScenario", {}, "Scenario Manager", "/scenarios/manager") };
      return {
        data: { duplicated: true, scenarioId: res.scenarioId, name: res.scenarioName, from: sourceId, next: "Edit it with setDriver, then read with getScenarioPnL." },
        receipt: receipt("duplicateScenario", { scenarioId: res.scenarioId as string }, `Scenario copied · ${res.scenarioName}`, `/scenarios/drivers?scenario=${res.scenarioId}`),
      };
    },
  },
  setDriver: {
    inputSchema: {
      type: "object",
      properties: {
        scenarioId: { type: "string", description: "The USER scenario to adjust (find with getScenarios or create first — Base + presets are immutable; duplicate them)." },
        lever: { type: "string", description: "One of: revenue, personnel, expense, direct_cost, ar_dso. (ap_dpo is gated/off.)" },
        magnitude: { type: "number", description: "The slider value: a PERCENT for revenue/direct_cost (25 = +25%), a $/MONTH delta for personnel/expense (e.g. 50000 or -50000), or DAYS for ar_dso (e.g. 45). Omit when freeze=true." },
        start: { type: "string", description: "Window start month YYYY-MM (must sit inside the forecast horizon, Jul–Dec 2026)." },
        end: { type: "string", description: "Optional window end YYYY-MM (omit to run start-through-horizon)." },
        shape: { type: "string", description: "'step' (full at start, default) or 'ramp' (phase in across the window)." },
        stream: { type: "string", description: "revenue only: 'subscription' (default) or 'services'." },
        departmentId: { type: "string", description: "personnel only (optional): a department id to scope the change." },
        freeze: { type: "string", description: "personnel only: pass 'true' for a hiring freeze (magnitude is ignored)." },
        groupId: { type: "string", description: "expense only: the OpEx group id, e.g. sales-marketing, it, travel-entertainment." },
      },
      required: ["scenarioId", "lever", "start"],
      additionalProperties: false,
    },
    async run(input) {
      const scenarioId = str(input, "scenarioId") as ScenarioId;
      const lever = str(input, "lever") as LeverId;
      const VALID_LEVERS = new Set(["revenue", "personnel", "expense", "direct_cost", "ar_dso", "ap_dpo"]);
      if (!VALID_LEVERS.has(lever)) {
        return {
          data: { error: `unknown lever "${lever}". Use one of: revenue, personnel, expense, direct_cost, ar_dso.` },
          receipt: receipt("setDriver", { scenarioId: scenarioId as string }, "Scenario Drivers", `/scenarios/drivers?scenario=${scenarioId}`),
        };
      }
      const rawMag = input.magnitude;
      const magnitude = typeof rawMag === "number" ? rawMag : Number(str(input, "magnitude")) || 0;
      const di: DriverInput = {
        lever,
        start: str(input, "start"),
        end: str(input, "end") || undefined,
        shape: (str(input, "shape") === "ramp" ? "ramp" : "step") as AdjustmentShape,
        magnitude,
        stream: (str(input, "stream") || undefined) as DriverInput["stream"],
        departmentId: str(input, "departmentId") || undefined,
        freeze: str(input, "freeze") === "true",
        groupId: str(input, "groupId") || undefined,
      };
      const res = await setScenarioDriver(scenarioId, di);
      if (!res.ok) {
        return {
          data: { error: res.error, hint: "revenue/direct_cost take a %, personnel/expense a $/mo delta, ar_dso days. The window must be in Jul–Dec 2026. To edit Base or a preset, duplicate it first." },
          receipt: receipt("setDriver", { scenarioId: scenarioId as string }, "Scenario Drivers", `/scenarios/drivers?scenario=${scenarioId}`),
        };
      }
      return {
        data: { set: true, scenario: res.scenarioName, lever, note: "Adjustment added + validated. Read the result with getScenarioPnL (never hand-compute it).", undo: "Remove it on the Scenario Drivers page, or ask me to reset the scenario." },
        receipt: receipt("setDriver", { scenarioId: res.scenarioId as string }, `Driver set · ${res.scenarioName}`, `/scenarios/drivers?scenario=${res.scenarioId}`),
      };
    },
  },
  resetScenario: {
    inputSchema: {
      type: "object",
      properties: { scenarioId: { type: "string", description: "The user scenario to clear (removes all its adjustments)." } },
      required: ["scenarioId"],
      additionalProperties: false,
    },
    async run(input) {
      const scenarioId = str(input, "scenarioId") as ScenarioId;
      const res = await resetScenario(scenarioId);
      if (!res.ok) return { data: { error: res.error }, receipt: receipt("resetScenario", {}, "Scenario Manager", "/scenarios/manager") };
      return {
        data: { reset: true, scenario: res.scenarioName, note: "All adjustments cleared — the scenario is back to its baseline." },
        receipt: receipt("resetScenario", { scenarioId: scenarioId as string }, `Scenario reset · ${res.scenarioName}`, `/scenarios/drivers?scenario=${scenarioId}`),
      };
    },
  },
  deleteScenario: {
    inputSchema: {
      type: "object",
      properties: { scenarioId: { type: "string", description: "The user scenario to delete (Base + presets cannot be deleted)." } },
      required: ["scenarioId"],
      additionalProperties: false,
    },
    async run(input) {
      const scenarioId = str(input, "scenarioId") as ScenarioId;
      const res = await deleteScenario(scenarioId);
      if (!res.ok) return { data: { error: res.error }, receipt: receipt("deleteScenario", {}, "Scenario Manager", "/scenarios/manager") };
      return {
        data: { deleted: true, scenario: res.scenarioName ?? scenarioId },
        receipt: receipt("deleteScenario", {}, "Scenario Manager", "/scenarios/manager"),
      };
    },
  },

  // ── Flux Analysis notes — READ (the write tool addFluxNote is below) ──
  getFluxNotes: {
    inputSchema: {
      type: "object",
      properties: {
        transactionId: { type: "string", description: "Sub-ledger transaction id (a specific bill), e.g. VB-2026-05-1351." },
        accountCode: { type: "string", description: "GL account code (the trial-balance grain), e.g. 6200." },
        statementLine: { type: "string", description: "Statement line id, e.g. sales_marketing (multi-account lines / metrics)." },
        period: { type: "string", description: "Month YYYY-MM (required with accountCode or statementLine)." },
      },
      additionalProperties: false,
    },
    async run(input) {
      const filter = {
        transactionId: str(input, "transactionId") || undefined,
        accountCode: str(input, "accountCode") || undefined,
        statementLine: str(input, "statementLine") || undefined,
        period: (str(input, "period") || undefined) as Month | undefined,
      };
      const notes = await listFluxNotes(filter);
      return {
        data: {
          count: notes.length,
          note: notes.length === 0 ? "No flux notes on this anchor yet — to record one use addFluxNote." : undefined,
          notes: notes.map((n) => ({
            author: n.author,
            body: n.body,
            source: n.source,
            resolved: n.resolved,
            anchor: n.transactionId ?? n.accountCode ?? n.statementLine ?? "—",
            period: n.period,
            amountAtNote: n.amountAtNote ? m(n.amountAtNote) : undefined,
          })),
        },
        receipt: receipt("getFluxNotes", filter.transactionId ? { transactionId: filter.transactionId } : {}, "Flux notes", filter.transactionId ? `/reporting/expense-transactions?note=${filter.transactionId}` : "/reporting/expense-transactions"),
      };
    },
  },

  // ── Flux decomposition — the budget-vs-actual breakdown (pairs with getFluxNotes) ──
  getFluxDetail: {
    inputSchema: {
      type: "object",
      properties: {
        statementLine: { type: "string", description: "Statement line id, e.g. sales_marketing, it, employee_expenses." },
        period: PERIOD_PROP,
      },
      required: ["statementLine"],
      additionalProperties: false,
    },
    async run(input) {
      // Flux is a CLOSED-month analysis (explain a month's variance from its bills), so when no period is
      // given default to the last closed month — not the in-close current period — so the drill lands
      // where the actuals + bills exist and the tie-out holds.
      const period = typeof input.period === "string" && input.period ? periodOf(input) : PLACEHOLDER_SETTINGS.closeThrough;
      const statementLine = str(input, "statementLine");
      const d = await getFluxDetail(statementLine, period);
      const transactionsTotal = sumMoney(d.transactions.map((t) => t.amount));
      return {
        data: {
          line: d.line.label,
          period: monthLabel(period),
          periodStatus: d.line.periodStatus,
          monthActual: m(d.line.monthActual),
          transactionsTotal: m(transactionsTotal), // ties to monthActual for an expense (vendor-bill) line
          topTransactions: d.transactions.slice(0, 8).map((t) => ({ vendor: t.vendor, account: t.accountCode, amount: m(t.amount) })),
          fullYear: d.line.fullYear
            ? { actual: m(d.line.fullYear.actual), forecast: m(d.line.fullYear.forecast), budget: m(d.line.fullYear.budget), variance: m(d.line.fullYear.variance) }
            : undefined,
          note: "monthActual is THIS month's actual for the line and (for an expense line) equals transactionsTotal — the bills below compose it. fullYear is the FY P&L context, not this month. Pair with getFluxNotes for the written explanation.",
        },
        receipt: receipt("getFluxDetail", { statementLine }, `Flux detail: ${d.line.label}`, `/reporting/expense-transactions?period=${period}`),
      };
    },
  },

  // ── Flux Analysis notes — WRITE (Scout's only write; attributed to the user, source = scout) ──
  addFluxNote: {
    inputSchema: {
      type: "object",
      properties: {
        body: { type: "string", description: "The note text — the variance explanation to record." },
        transactionId: { type: "string", description: "Anchor: a sub-ledger transaction id (a specific bill), e.g. VB-2026-05-1351." },
        accountCode: { type: "string", description: "Anchor: a GL account code (trial-balance grain), e.g. 6200 (Sales & Marketing)." },
        statementLine: { type: "string", description: "Anchor: a statement line id, e.g. sales_marketing (multi-account lines / metrics)." },
        period: { type: "string", description: "Month YYYY-MM (required when anchoring by accountCode or statementLine)." },
        resolve: { type: "string", description: "Pass 'true' to mark the variance resolved as you note it." },
      },
      required: ["body"],
      additionalProperties: false,
    },
    async run(input) {
      const body = str(input, "body");
      const anchor = {
        transactionId: str(input, "transactionId") || undefined,
        accountCode: str(input, "accountCode") || undefined,
        statementLine: str(input, "statementLine") || undefined,
        period: (str(input, "period") || undefined) as Month | undefined,
      };
      try {
        const saved = await addFluxNote({ anchor, body, source: "scout", resolved: str(input, "resolve") === "true" });
        const anchorLabel = saved.transactionId ?? (saved.accountCode ? `account ${saved.accountCode}` : saved.statementLine) ?? "—";
        // Route the receipt to the surface that actually shows the note, by anchor grain: a
        // transaction note opens the Expense register; an account note opens Account Mapping (both via
        // ?note=). A statement-line-only note has no single working surface, so fall back to the register.
        const href = saved.transactionId
          ? `/reporting/expense-transactions?note=${saved.transactionId}`
          : saved.accountCode
            ? `/setup/account-mapping?note=${saved.accountCode}`
            : "/reporting/expense-transactions";
        return {
          data: {
            added: true,
            note: { body: saved.body, author: saved.author, anchor: anchorLabel, statementLine: saved.statementLine, period: saved.period, resolved: saved.resolved },
            attribution: `Recorded as ${saved.author} (entered via Scout).`,
            undo: "To remove it, open the note card and Delete (always available), or ask me to remove it.",
          },
          receipt: receipt(
            "addFluxNote",
            anchor.transactionId ? { transactionId: anchor.transactionId } : anchor.accountCode ? { accountCode: anchor.accountCode } : {},
            `Flux note added · ${anchorLabel}`,
            href,
          ),
        };
      } catch (e) {
        return {
          data: { error: (e as Error).message, hint: "Anchor with a real transactionId, or accountCode + period, or statementLine + period." },
          receipt: receipt("addFluxNote", {}, "Flux note", "/reporting/expense-transactions"),
        };
      }
    },
  },

  // ── Product-knowledge lane: how-to / "what does X do" answered from the User Guides (one
  //    source, two callers — these guides also render at /setup/guides). NOT the number spine. ──
  getProductMap: {
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      return {
        data: {
          note: "The product/nav map, from the User Guides. Use these summaries to answer 'what does X do / where is it'. For a single module's detail, call describeModule with its slug. NOT for numbers.",
          guides: GUIDES.map((g) => ({ slug: g.slug, title: g.title, summary: g.summary })),
        },
        receipt: receipt("getProductMap", {}, "User Guides", "/setup/guides"),
      };
    },
  },

  describeModule: {
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: `Guide slug. One of: ${GUIDES.map((g) => g.slug).join(", ")}. Omit to get the full map (same as getProductMap).` },
      },
      additionalProperties: false,
    },
    async run(input) {
      const slug = str(input, "slug");
      const guide = slug ? getGuide(slug) : undefined;
      if (slug && !guide) {
        return {
          data: { error: `No guide "${slug}". Available: ${GUIDES.map((g) => g.slug).join(", ")}.`, guides: GUIDES.map((g) => ({ slug: g.slug, title: g.title })) },
          receipt: receipt("describeModule", { slug }, "User Guides", "/setup/guides"),
        };
      }
      if (!guide) {
        return {
          data: { note: "No slug given — here is the full guide map.", guides: GUIDES.map((g) => ({ slug: g.slug, title: g.title, summary: g.summary })) },
          receipt: receipt("describeModule", {}, "User Guides", "/setup/guides"),
        };
      }
      return {
        data: { slug: guide.slug, title: guide.title, summary: guide.summary, body: guide.body },
        receipt: receipt("describeModule", { slug: guide.slug }, `Guide: ${guide.title}`, `/setup/guides/${guide.slug}`),
      };
    },
  },
};

/** The tools the loop should expose: wired in the registry AND implemented here. */
export function wiredScoutTools(): { name: string; description: string; impl: ScoutToolImpl }[] {
  return SCOUT_REGISTRY.filter((b) => b.wired && SCOUT_TOOL_IMPLS[b.tool]).map((b) => ({
    name: b.tool,
    description: b.description,
    impl: SCOUT_TOOL_IMPLS[b.tool],
  }));
}

// Fail loud at module load if a tool is wired in the registry but missing an impl here (or vice
// versa) — keeps "Scout Follows Modules" honest: a flipped `wired` with no impl can't ship silently.
const wiredNames = SCOUT_REGISTRY.filter((b) => b.wired && b.lane === "data").map((b) => b.tool);
const missing = wiredNames.filter((n) => !SCOUT_TOOL_IMPLS[n]);
if (missing.length > 0) {
  throw new Error(`Scout: wired data tools without an impl in lib/scout/tools.ts: ${missing.join(", ")}`);
}
