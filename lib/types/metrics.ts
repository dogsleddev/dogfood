/**
 * Layer 4 — Metrics: derived analytics in four families (CLAUDE.md §5).
 * Surfaced THROUGH the Dashboard, not its own nav item. Design decided in Harness;
 * the surface + drill-downs are built in the Run (§13, §17).
 *
 * The catalog below is the locked tile set from diagrams/drilldowns-dashboard.svg:
 * each tile's family, first-tap mode (peek vs pane-only pure metric), the "Open full"
 * navigation target, and the deterministic BASIS the seed must reconcile to.
 */
import type { Money, Percent, Ratio } from "./money";
import { formatMoney, formatPercent, formatRatio, usd, percent, ratio } from "./money";
import type { Month } from "./period";
import type { MetricId } from "./common";
import type { FirstTap } from "./statements";

export type MetricFamily =
  | "financial" // profitability
  | "growth_retention"
  | "unit_economics"
  | "cash_efficiency";

export type MetricValueKind = "money" | "percent" | "ratio" | "count";

export interface MetricDefinition {
  readonly id: MetricId;
  readonly label: string;
  readonly family: MetricFamily;
  readonly firstTap: FirstTap;
  readonly kind: MetricValueKind;
  /** for variance/trend coloring; defaults to true (higher = better) */
  readonly higherIsBetter?: boolean;
  /** the deterministic tie-out formula / source (the contract the seed reconciles to) */
  readonly basis: string;
  /** registry of working-surface routes for "Open full ↗" (peek tiles only) */
  readonly openFull?: readonly string[];
}

export interface MetricValue {
  readonly id: MetricId;
  readonly period: Month;
  readonly kind: MetricValueKind;
  readonly money?: Money;
  readonly percent?: Percent;
  readonly ratio?: Ratio;
  readonly count?: number;
}

const m = (s: string): MetricId => s as MetricId;

/** The Dashboard metric catalog — 19 tiles across 4 families (diagrams/drilldowns-dashboard.svg). */
export const METRIC_CATALOG: readonly MetricDefinition[] = [
  // Financial · profitability
  { id: m("revenue"), label: "Revenue", family: "financial", firstTap: "peek", kind: "money", basis: "subscription + services recognized", openFull: ["/sales/contracts", "/reporting/projects"] },
  { id: m("gross_profit"), label: "Gross profit", family: "financial", firstTap: "pane_only", kind: "money", basis: "Revenue − Cost of Revenue" },
  { id: m("gross_margin_pct"), label: "Gross margin %", family: "financial", firstTap: "pane_only", kind: "percent", basis: "gross profit ÷ revenue" },
  { id: m("operating_income"), label: "Operating income", family: "financial", firstTap: "pane_only", kind: "money", basis: "gross profit − operating expenses" },
  { id: m("net_income"), label: "Net income", family: "financial", firstTap: "pane_only", kind: "money", basis: "operating income + net interest − tax (Bearing: interest income on cash, $0 tax under NOLs, so NI is less negative than OI)" },
  { id: m("net_margin_pct"), label: "Net margin %", family: "financial", firstTap: "pane_only", kind: "percent", basis: "net income ÷ revenue" },

  // Growth & Retention
  { id: m("arr_mrr"), label: "ARR / MRR", family: "growth_retention", firstTap: "peek", kind: "money", basis: "from contract schedules", openFull: ["/sales/contracts"] },
  { id: m("bookings_delta_arr"), label: "Bookings (ΔARR)", family: "growth_retention", firstTap: "peek", kind: "money", basis: "trailing-12-mo net ΔARR (new + expansion − contraction)", openFull: ["/sales/contracts"] },
  { id: m("nrr"), label: "Net revenue retention", family: "growth_retention", firstTap: "peek", kind: "percent", basis: "i-12 cohort: cohort ARR now ÷ cohort ARR 12 mo ago (within-cohort expansion/contraction/churn; excludes new logos)", openFull: ["/sales/renewals", "/sales/customers"] },
  { id: m("logo_retention"), label: "Logo retention / churn", family: "growth_retention", firstTap: "peek", kind: "percent", basis: "1 − trailing-12-mo churned logos ÷ active logos 12 mo ago", openFull: ["/sales/customers", "/sales/renewals"] },
  { id: m("growth_rate"), label: "Revenue growth (FY)", family: "growth_retention", firstTap: "pane_only", kind: "percent", basis: "FY recognized revenue ÷ prior FY − 1 (lags ARR growth via ratable recognition)" },

  // Unit Economics
  { id: m("cac_payback"), label: "CAC per new logo", family: "unit_economics", firstTap: "pane_only", kind: "money", higherIsBetter: false, basis: "trailing-12-mo S&M (payroll + programs, lagged 1 quarter) ÷ new logos (dollar CAC, not payback months)" },
  { id: m("ltv_cac"), label: "LTV : CAC", family: "unit_economics", firstTap: "pane_only", kind: "ratio", basis: "LTV (avg ARR × gross margin % × min(1 ÷ annual churn, 5 yr)) ÷ CAC (S&M lagged 1 quarter)" },
  { id: m("magic_number"), label: "Magic number", family: "unit_economics", firstTap: "pane_only", kind: "ratio", basis: "trailing-12-mo net ΔARR ÷ trailing-12-mo S&M (lagged 1 quarter)" },
  { id: m("utilization"), label: "Utilization", family: "unit_economics", firstTap: "peek", kind: "percent", basis: "trailing-12-mo avg services utilization (delivery ÷ capacity)", openFull: ["/reporting/projects", "/reporting/staff"] },

  // Cash & Efficiency
  { id: m("net_burn"), label: "Net burn", family: "cash_efficiency", firstTap: "pane_only", kind: "money", higherIsBetter: false, basis: "− trailing-12-mo (operating + investing cash flow) ÷ 12 (avg monthly burn)" },
  { id: m("runway"), label: "Runway", family: "cash_efficiency", firstTap: "pane_only", kind: "count", basis: "cash ÷ net burn" },
  { id: m("rule_of_40"), label: "Rule of 40", family: "cash_efficiency", firstTap: "pane_only", kind: "percent", basis: "FY revenue growth % + non-GAAP operating margin % (ex-SBC)" },
  { id: m("burn_multiple"), label: "Burn multiple", family: "cash_efficiency", firstTap: "pane_only", kind: "ratio", higherIsBetter: false, basis: "annualized net burn ÷ trailing-12-mo net new ARR" },
];

export const METRIC_FAMILY_LABELS: Record<MetricFamily, string> = {
  financial: "Financial · profitability",
  growth_retention: "Growth & Retention",
  unit_economics: "Unit Economics",
  cash_efficiency: "Cash & Efficiency",
};

/** Format a metric value for display, switching on its kind. */
export function formatMetricValue(v: MetricValue): string {
  switch (v.kind) {
    case "money":
      return v.money ? formatMoney(v.money, { compact: true }) : "—";
    case "percent":
      return v.percent !== undefined ? formatPercent(v.percent, 0) : "—";
    case "ratio":
      return v.ratio !== undefined ? formatRatio(v.ratio) : "—";
    case "count":
      return v.count !== undefined ? `${v.count} mo` : "—";
  }
}

/** The comparable numeric magnitude of a metric value (money in major units). */
export function metricMagnitude(v: MetricValue): number {
  switch (v.kind) {
    case "money":
      return v.money ? v.money.minor / 100 : 0;
    case "percent":
      return v.percent ?? 0;
    case "ratio":
      return v.ratio ?? 0;
    case "count":
      return v.count ?? 0;
  }
}

/** Build a metric value of a given kind from a raw magnitude (money in major units). */
export function metricValueFromMagnitude(
  id: MetricId,
  period: Month,
  kind: MetricValueKind,
  magnitude: number,
): MetricValue {
  switch (kind) {
    case "money":
      return { id, period, kind, money: usd(magnitude) };
    case "percent":
      return { id, period, kind, percent: percent(magnitude) };
    case "ratio":
      return { id, period, kind, ratio: ratio(magnitude) };
    case "count":
      return { id, period, kind, count: Math.round(magnitude) };
  }
}
