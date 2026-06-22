/**
 * Balance Sheet + Cash Flow peek targets (CLAUDE.md §6; diagrams/drilldowns-statements.svg).
 * Same "peek where you read, navigate where you work" rule as the P&L: a line peeks its
 * register (actual → layer 1) and/or driver (forecast → layer 2). Lines with no working
 * surface (leases, equity, pure subtotals) carry a NOTE the pane shows instead.
 */
import type { BalanceSheetLineId, CashFlowLineId } from "@/lib/types/statements";
import type { LineDrill } from "./drill-map";

// ── Balance Sheet ──
export const BS_DRILL: Partial<Record<BalanceSheetLineId, LineDrill>> = {
  cash: { driver: { href: "/statements/cash-flow", label: "Cash Flow Forecast" } },
  accounts_receivable: {
    register: { href: "/sales/contracts", label: "Customer invoices · open AR" },
    driver: { href: "/forecasts/ar", label: "AR Forecast · DSO" },
  },
  unbilled_wip: {
    register: { href: "/reporting/projects", label: "Projects · % complete / WIP" },
    driver: { href: "/forecasts/revenue", label: "Revenue Forecast · services" },
  },
  prepaid_expenses: { driver: { href: "/forecasts/prepaids", label: "Prepaids Budget" } },
  fixed_assets_net: { driver: { href: "/forecasts/fixed-assets", label: "Fixed Asset Budget" } },
  deferred_revenue: {
    register: { href: "/sales/contracts", label: "Contracts · deferred waterfall" },
    driver: { href: "/forecasts/revenue", label: "Revenue Forecast · contracted" },
  },
  accounts_payable: {
    register: { href: "/reporting/expense-transactions", label: "Expense Transactions · vendor bills" },
    driver: { href: "/forecasts/expenses", label: "Expense Forecast · DPO" },
  },
  accumulated_deficit: {
    driver: { href: "/statements/pnl", label: "Forecasted P&L · cumulative net income" },
  },
};

/** Balance-sheet lines with no working surface — the pane shows this note instead (§6). */
export const BS_NOTE: Partial<Record<BalanceSheetLineId, string>> = {
  rou_asset:
    "Right-of-use asset (ASC 842). Equal to the lease liability each month — equity-neutral. No editable driver; the lease cost stays in the Facilities OpEx line.",
  lease_liability:
    "Operating-lease liability (ASC 842). Mirrors the right-of-use asset. No editable driver in this build.",
  paid_in_capital:
    "Contributed capital (founders + the Series B raise). Moves only on a financing event — see the Cash Flow financing line.",
};

// ── Cash Flow (indirect method) ──
export const CF_DRILL: Partial<Record<CashFlowLineId, LineDrill>> = {
  net_income: { driver: { href: "/statements/pnl", label: "Forecasted P&L · net income" } },
  depreciation: { driver: { href: "/forecasts/fixed-assets", label: "Fixed Asset Budget · D&A" } },
  change_ar: {
    register: { href: "/sales/contracts", label: "Customer invoices · open AR" },
    driver: { href: "/forecasts/ar", label: "AR Forecast · DSO" },
  },
  change_deferred_revenue: {
    register: { href: "/sales/contracts", label: "Contracts · deferred waterfall" },
    driver: { href: "/forecasts/revenue", label: "Revenue Forecast · contracted" },
  },
  change_unbilled_wip: {
    register: { href: "/reporting/projects", label: "Projects · WIP" },
    driver: { href: "/forecasts/revenue", label: "Revenue Forecast · services" },
  },
  change_prepaids: { driver: { href: "/forecasts/prepaids", label: "Prepaids Budget" } },
  change_ap: {
    register: { href: "/reporting/expense-transactions", label: "Expense Transactions · vendor bills" },
    driver: { href: "/forecasts/expenses", label: "Expense Forecast · DPO" },
  },
  capex: { driver: { href: "/forecasts/fixed-assets", label: "Fixed Asset Budget · capex" } },
};

/** Cash-flow non-cash add-backs / subtotals / one-off lines with no working surface (§6). */
export const CF_NOTE: Partial<Record<CashFlowLineId, string>> = {
  stock_based_comp:
    "Non-cash stock-based compensation (ASC 718), added back to net income. Equity-settled — no cash impact and no editable driver.",
  operating_cash_flow: "Subtotal — Net income + D&A + stock-based comp + the working-capital changes above.",
  financing:
    "Equity financing (the Series B raise) was booked in FY2025, so FY2026 financing is zero. A one-time event, not a recurring driver.",
  net_change_in_cash:
    "Subtotal — Operating + Investing + Financing. Ties to the change in the Balance Sheet cash line.",
};
