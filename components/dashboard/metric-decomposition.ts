/**
 * Pure-metric decomposition for the Dashboard peek pane (§6). Each pane-only (pure) metric breaks
 * into the lines/metrics that compose it, every part a click-through: parts that are themselves
 * Dashboard tiles (metricId) resolve their value from the loaded summary and open their own pane;
 * the rest link to the statement line or driver that sources them. "Just another spine caller."
 */

/** One component of a pure metric — links into a line/metric it's built from. */
export interface DecompPart {
  readonly label: string;
  /** when set, the part is itself a Dashboard tile — show its value + open its pane */
  readonly metricId?: string;
  /** statement line / driver / dashboard-metric route to drill into */
  readonly href: string;
}

export interface MetricDecomposition {
  readonly formula: string;
  readonly parts: readonly DecompPart[];
}

const dash = (id: string): string => `/dashboard?inspect=${id}`;

export const METRIC_DECOMPOSITION: Record<string, MetricDecomposition> = {
  gross_profit: {
    formula: "Revenue − Cost of Revenue",
    parts: [
      { label: "Revenue", metricId: "revenue", href: dash("revenue") },
      { label: "Cost of Revenue", href: "/statements/pnl?inspect=total_cor" },
    ],
  },
  gross_margin_pct: {
    formula: "Gross profit ÷ Revenue",
    parts: [
      { label: "Gross profit", metricId: "gross_profit", href: dash("gross_profit") },
      { label: "Revenue", metricId: "revenue", href: dash("revenue") },
    ],
  },
  operating_income: {
    formula: "Gross profit − Operating expenses",
    parts: [
      { label: "Gross profit", metricId: "gross_profit", href: dash("gross_profit") },
      { label: "Operating expenses", href: "/statements/pnl?inspect=total_opex" },
    ],
  },
  net_income: {
    formula: "Operating income + net interest − tax",
    parts: [
      { label: "Operating income", metricId: "operating_income", href: dash("operating_income") },
      { label: "Net interest / tax", href: "/statements/pnl?inspect=net_income" },
    ],
  },
  net_margin_pct: {
    formula: "Net income ÷ Revenue",
    parts: [
      { label: "Net income", metricId: "net_income", href: dash("net_income") },
      { label: "Revenue", metricId: "revenue", href: dash("revenue") },
    ],
  },
  growth_rate: {
    formula: "FY revenue ÷ prior-FY revenue − 1",
    parts: [
      { label: "Revenue (FY)", metricId: "revenue", href: dash("revenue") },
      { label: "Prior-year revenue", href: "/statements/pnl?view=monthly" },
    ],
  },
  cac_payback: {
    formula: "Trailing-12-mo S&M (lagged 1 quarter) ÷ new logos",
    parts: [
      { label: "Sales & Marketing spend", href: "/forecasts/expenses/sales-marketing" },
      { label: "New logos", href: "/sales/customers" },
    ],
  },
  cac_payback_months: {
    formula: "CAC per logo ÷ (avg ARR per logo × gross margin % ÷ 12)",
    parts: [
      { label: "CAC per new logo", metricId: "cac_payback", href: dash("cac_payback") },
      { label: "ARR / MRR", metricId: "arr_mrr", href: dash("arr_mrr") },
      { label: "Gross margin %", metricId: "gross_margin_pct", href: dash("gross_margin_pct") },
    ],
  },
  ltv_cac: {
    formula: "LTV (avg ARR × gross margin % × lifetime) ÷ CAC",
    parts: [
      { label: "Gross margin %", metricId: "gross_margin_pct", href: dash("gross_margin_pct") },
      { label: "Logo retention / churn", metricId: "logo_retention", href: dash("logo_retention") },
      { label: "CAC per new logo", metricId: "cac_payback", href: dash("cac_payback") },
    ],
  },
  magic_number: {
    formula: "Trailing-12-mo net ΔARR ÷ trailing-12-mo S&M (lagged 1 quarter)",
    parts: [
      { label: "Bookings (ΔARR)", metricId: "bookings_delta_arr", href: dash("bookings_delta_arr") },
      { label: "Sales & Marketing spend", href: "/forecasts/expenses/sales-marketing" },
    ],
  },
  net_burn: {
    formula: "− trailing-12-mo (operating + investing cash flow) ÷ 12",
    parts: [{ label: "Operating + investing cash flow", href: "/statements/cash-flow" }],
  },
  runway: {
    formula: "Cash ÷ net burn",
    parts: [
      { label: "Cash", href: "/statements/balance-sheet" },
      { label: "Net burn", metricId: "net_burn", href: dash("net_burn") },
    ],
  },
  rule_of_40: {
    formula: "FY revenue growth % + non-GAAP operating margin % (ex-SBC)",
    parts: [
      { label: "Revenue growth (FY)", metricId: "growth_rate", href: dash("growth_rate") },
      { label: "Operating income", metricId: "operating_income", href: dash("operating_income") },
    ],
  },
  burn_multiple: {
    formula: "Annualized net burn ÷ trailing-12-mo net new ARR",
    parts: [
      { label: "Net burn", metricId: "net_burn", href: dash("net_burn") },
      { label: "Bookings (ΔARR)", metricId: "bookings_delta_arr", href: dash("bookings_delta_arr") },
    ],
  },
};

const ROUTE_LABELS: Record<string, string> = {
  "/sales/contracts": "Contracts",
  "/sales/customers": "Customers",
  "/sales/renewals": "Renewals",
  "/sales/pipeline": "Pipeline",
  "/reporting/projects": "Projects",
  "/reporting/staff": "Staff",
  "/reporting/expense-transactions": "Expense Transactions",
  "/statements/pnl": "Forecasted P&L",
  "/statements/balance-sheet": "Balance Sheet",
  "/statements/cash-flow": "Cash Flow",
};

/** A friendly label for an "Open full" / decomposition href (path only, query ignored). */
export function routeLabel(href: string): string {
  const path = href.split("?")[0];
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];
  if (path.startsWith("/forecasts/expenses/")) return "Expense Forecast";
  if (path.startsWith("/forecasts/")) return "Forecast driver";
  return path;
}
