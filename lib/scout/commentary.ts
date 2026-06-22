/**
 * Scout's live step commentary (CLAUDE.md §10). When Scout reaches for a tool, we narrate the
 * calculation as it happens — with a light dog-pun where it lands naturally (Scout is a good boy).
 * Pure + deterministic: same tool + args → same line. Used by the agent loop and the deterministic
 * router so the streamed steps read the same in both modes.
 */

import { METRIC_CATALOG } from "@/lib/types/metrics";

const titleize = (id: string): string => id.replace(/_/g, " ").trim();
/** Prefer the catalog's human label (e.g. "Gross margin %") over the raw id ("gross_margin_pct"). */
const metricName = (id: string): string => METRIC_CATALOG.find((d) => (d.id as string) === id)?.label ?? titleize(id);

/** A playful, calculation-describing line for one tool call (the in-flight step the panel shows). */
export function stepLabel(tool: string, args: Record<string, unknown> = {}): string {
  const metric = typeof args.metricId === "string" ? metricName(args.metricId) : "";
  const lineId = typeof args.lineId === "string" ? titleize(args.lineId) : "";
  const id = typeof args.id === "string" ? args.id : "";
  switch (tool) {
    case "getMetric":
      return `Sniffing out ${metric || "the metric"}…`;
    case "explainTile":
      return `Nosing into the ${metric || "tile"} tile…`;
    case "getPnL":
      return "Digging through the P&L…";
    case "getMonthlyPnL":
      return "Fetching the P&L month by month…";
    case "explainVariance":
      return `Tracking down the ${lineId || "P&L"} line…`;
    case "getBalanceSheet":
      return "Pawing over the balance sheet…";
    case "getMonthlyBalanceSheet":
      return "Laying the balance sheet out month by month…";
    case "getCashFlow":
      return "Chasing down the cash flow…";
    case "getMonthlyCashFlow":
      return "Sniffing the cash flow month by month…";
    case "getDashboard":
      return "Rounding up the dashboard…";
    case "getContracts":
      return "Herding the contracts…";
    case "getBookingsHistory":
      return "Following the bookings trail year over year…";
    case "getContract":
      return `Fetching contract ${id || "detail"}…`;
    case "getCustomers":
      return "Counting heads in the customer pack…";
    case "getCustomer":
      return `Fetching account ${id || "detail"}…`;
    case "getRenewals":
      return "Guarding the renewal book…";
    case "getPipeline":
      return "Nosing through the pipeline…";
    case "getProjects":
      return "Digging through the project book…";
    case "getStaff":
      return "Taking roll call on the roster…";
    case "getExpenseTransactions":
      return "Sniffing through the expense ledger…";
    case "getRevenueForecast":
      return "Following the revenue trail forward…";
    case "getCostOfRevenue":
      return "Sniffing out the cost to serve…";
    case "getPersonnelForecast":
      return "Counting the future pack…";
    case "getExpenseForecast":
      return "Forecasting the OpEx spend…";
    case "getArForecast":
      return "Chasing down the receivables…";
    case "getFixedAssetForecast":
      return "Digging up the capex plan…";
    case "getPrepaidsForecast":
      return "Unrolling the prepaids…";
    case "getBoardPackage":
      return "Fetching the board deck…";
    case "getScenarios":
      return "Rounding up the scenarios…";
    case "getScenarioPnL":
      return "Running the scenario…";
    case "compareScenarios":
      return "Comparing scenarios nose to nose…";
    case "getFluxDetail":
      return "Breaking down the variance…";
    case "getFluxNotes":
      return "Sniffing for flux notes…";
    case "addFluxNote":
      return "Pinning a flux note…";
    case "getProductMap":
      return "Fetching the product map…";
    case "describeModule":
      return "Reading the guide…";
    default:
      return "On the scent…";
  }
}
