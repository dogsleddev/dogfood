/**
 * P&L peek targets (CLAUDE.md §6; diagrams/drilldowns-statements.svg).
 * Actual months peek their REGISTER (layer 1); forecast months peek their DRIVER (layer 2).
 * Pure derived metrics are pane-only and decompose into their component lines instead.
 */
import type { PnLLineId } from "@/lib/types/statements";

export interface DrillTarget {
  readonly href: string;
  readonly label: string;
}

export interface LineDrill {
  readonly register?: DrillTarget; // actual → layer 1
  readonly driver?: DrillTarget; // forecast → layer 2
}

export const PNL_DRILL: Partial<Record<PnLLineId, LineDrill>> = {
  subscription: {
    register: { href: "/sales/contracts", label: "Contracts · 606 schedules" },
    driver: { href: "/forecasts/revenue", label: "Revenue Forecast + Contracts" },
  },
  services: {
    register: { href: "/reporting/projects", label: "Projects · % complete / WIP" },
    driver: { href: "/forecasts/revenue", label: "Revenue Forecast · services capacity" },
  },
  total_revenue: {
    register: { href: "/sales/contracts", label: "Recognized revenue (both streams)" },
    driver: { href: "/forecasts/revenue", label: "Revenue Forecast (both streams)" },
  },
  direct_payroll: {
    register: { href: "/reporting/expense-transactions", label: "Expense Transactions · payroll" },
    driver: { href: "/forecasts/personnel", label: "Personnel · Direct depts" },
  },
  non_employee_cor: {
    register: { href: "/reporting/expense-transactions", label: "Expense Transactions · CoR" },
    driver: { href: "/forecasts/cost-of-revenue", label: "Cost of Revenue · rate × revenue" },
  },
  total_cor: {
    driver: { href: "/forecasts/cost-of-revenue", label: "Cost of Revenue" },
  },
  indirect_payroll: {
    register: { href: "/reporting/expense-transactions", label: "Expense Transactions · payroll" },
    driver: { href: "/forecasts/personnel", label: "Personnel · R&D / S&M / G&A" },
  },
  employee_expenses: {
    register: { href: "/reporting/expense-transactions", label: "Expense Transactions" },
    driver: { href: "/forecasts/expenses/employee-expenses", label: "Expense Forecast · Employee Expenses" },
  },
  sales_marketing: {
    register: { href: "/reporting/expense-transactions", label: "Expense Transactions · S&M" },
    driver: { href: "/forecasts/expenses/sales-marketing", label: "Expense Forecast · Sales & Marketing" },
  },
  travel_entertainment: { driver: { href: "/forecasts/expenses/travel-entertainment", label: "Expense Forecast · T&E" } },
  it: { driver: { href: "/forecasts/expenses/it", label: "Expense Forecast · IT" } },
  hr: { driver: { href: "/forecasts/expenses/hr", label: "Expense Forecast · HR" } },
  admin: { driver: { href: "/forecasts/expenses/admin", label: "Expense Forecast · Admin" } },
  facilities: { driver: { href: "/forecasts/expenses/facilities", label: "Expense Forecast · Facilities" } },
  insurance: { driver: { href: "/forecasts/expenses/insurance", label: "Expense Forecast · Insurance" } },
  depreciation_amortization: {
    register: { href: "/reporting/expense-transactions", label: "Fixed Assets · register" },
    driver: { href: "/forecasts/fixed-assets", label: "Fixed Asset Budget" },
  },
  total_opex: { driver: { href: "/forecasts/expenses", label: "Expense Forecast" } },
  interest_other: { driver: { href: "/statements/cash-flow", label: "Cash Flow Forecast" } },
};

/** P&L OpEx lines that are config-driven expense groups (§7) → the group slug, for the peek pane's
 *  "By account" mini-breakdown (group -> GL sub-account -> vendor lives on the Expense Forecast). */
export const OPEX_LINE_GROUP: Partial<Record<PnLLineId, string>> = {
  employee_expenses: "employee-expenses",
  sales_marketing: "sales-marketing",
  travel_entertainment: "travel-entertainment",
  it: "it",
  hr: "hr",
  admin: "admin",
  facilities: "facilities",
  insurance: "insurance",
};

/** Pure derived (pane-only) lines decompose into their component lines (§6). */
export interface Decomposition {
  readonly formula: string;
  readonly parts: readonly PnLLineId[];
}

export const PNL_DECOMPOSITION: Partial<Record<PnLLineId, Decomposition>> = {
  gross_profit: { formula: "Total Revenue − Total Cost of Revenue", parts: ["total_revenue", "total_cor"] },
  operating_income: { formula: "Gross Profit − Total Operating Expenses", parts: ["gross_profit", "total_opex"] },
  net_income: { formula: "Operating Income + Interest / Other − Taxes", parts: ["operating_income", "interest_other", "taxes"] },
};
