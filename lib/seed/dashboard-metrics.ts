/**
 * Seed → the 19 dashboard metrics (step 6). The Financial family is derived from the seed P&L
 * (one source, two callers — it ties to the statement by construction); the SaaS metrics
 * (ARR/MRR, bookings, NRR, logo retention, CAC, CAC payback, LTV:CAC, magic number, utilization,
 * burn, runway, Rule of 40, burn multiple) compute from the real seed series — with a REAL prior-year
 * (the same formula 12 months earlier) and a real trailing sparkline, replacing the model's
 * hand-set PY_RULES constants.
 */
import { usd, toMajor } from "@/lib/types/money";
import { monthToIndex, type Month } from "@/lib/types/period";
import type { MetricId } from "@/lib/types/common";
import type { MetricFamily, MetricValue, MetricValueKind } from "@/lib/types/metrics";
import { METRIC_CATALOG, METRIC_FAMILY_LABELS, metricValueFromMagnitude } from "@/lib/types/metrics";
import type { DashboardSummary, KpiTile } from "@/lib/types/dashboard";
import {
  getSubscriptionSeed,
  getServicesSeed,
  getPersonnelSeed,
  getCostOfRevenueSeed,
  getOpExSeed,
  getBalanceSheetSeed,
  getSbcSeed,
} from "./index";
import { seedPnLColumns } from "./statements";
import type { ColumnValues } from "@/lib/types/statements";

const clampIdx = (i: number, n: number) => Math.max(0, Math.min(i, n - 1));
const fyOf = (idx: number) => 2024 + Math.floor(idx / 12);

/** Σ a series over the trailing 12 months ending at `idx` (clamped at the start). */
const ttm = (ser: readonly number[], idx: number): number => {
  let s = 0;
  for (let j = Math.max(0, idx - 11); j <= idx; j++) s += ser[j] ?? 0;
  return s;
};

/** All metric magnitudes as of a month index — callable at the current month, 12 months back
 *  (prior year), and across a trailing window (sparkline). Money in major units. */
function computeMetricsAt(idx: number): Record<string, number> {
  const sub = getSubscriptionSeed();
  const svc = getServicesSeed();
  const per = getPersonnelSeed();
  const cor = getCostOfRevenueSeed();
  const opx = getOpExSeed();
  const bs = getBalanceSheetSeed();
  const n = sub.series.months.length;
  const i = clampIdx(idx, n);
  const fy = fyOf(i);
  const priorFy = fy - 1;

  // ── Financial family — from the seed FY aggregates (= the P&L forecast column) ──
  const fyRevenue = cor.fyTotalRevenue[fy] ?? 0;
  const fyGrossProfit = cor.fyGrossProfit[fy] ?? 0;
  const fyIndirect = (per.fyPayroll[fy] ?? 0) - (per.fyDirectPayroll[fy] ?? 0);
  const fyOpEx = opx.fyTotal[fy] ?? 0;
  const fyDA = bs.fyDepreciation[fy] ?? 0;
  const fySbc = getSbcSeed().fySbc[fy] ?? 0;
  const fyOperatingIncome = fyGrossProfit - fyIndirect - fyOpEx - fyDA - fySbc;
  const fyNetIncome = bs.fyNetIncome[fy] ?? 0;
  const priorRevenue = cor.fyTotalRevenue[priorFy] ?? 0;

  // ── Growth & Retention ──
  const arr = sub.series.arr[i] ?? 0;
  const ttmNetBookings = ttm(sub.series.bookings.map((b) => b.net), i);
  // True i-12 cohort NRR: take the customers active 12 months ago and compare their ARR NOW to
  // their ARR THEN — so it captures within-cohort expansion, contraction, and churn (churned → 0)
  // and EXCLUDES any logo acquired in the last 12 months. Reads the per-contract ARR timelines
  // (recByContract). This is the textbook cohort definition; the prior basis was whole-book TTM,
  // which drifted unsigned vs a real cohort (realism review).
  const i12 = clampIdx(i - 12, n);
  let cohortThen = 0;
  let cohortNow = 0;
  for (const rc of sub.recByContract) {
    const then = rc.arr[i12] ?? 0;
    if (then > 0) {
      cohortThen += then;
      cohortNow += rc.arr[i] ?? 0;
    }
  }
  const nrr = cohortThen > 0 ? cohortNow / cohortThen : 1;
  const churnedTtm = ttm(sub.series.churnedLogos, i);
  const activeLogos12 = sub.series.activeLogos[clampIdx(i - 12, n)] ?? 0;
  const logoRetention = activeLogos12 > 0 ? Math.max(0, 1 - churnedTtm / activeLogos12) : 1;
  const growthRate = priorRevenue > 0 ? fyRevenue / priorRevenue - 1 : 0;

  // ── Unit Economics ──
  const smGroup = opx.series.groups.find((g) => g.groupId === "sales-marketing")?.monthly ?? [];
  const smSpendAt = (j: number) => (per.series.payrollByFunction[j]?.sm ?? 0) + (smGroup[j] ?? 0);
  const ttmSMEndingAt = (end: number) => {
    let s = 0;
    for (let j = Math.max(0, end - 11); j <= end; j++) s += smSpendAt(j);
    return s;
  };
  // S&M converts to bookings / new logos with a sales-cycle lag, so CAC and the magic number
  // attribute a period's wins to the spend of ONE QUARTER EARLIER (the textbook convention),
  // not same-period spend. This was the "no lag" simplification flagged in the metrics review.
  const SM_LAG = 3;
  const ttmSMLagged = ttmSMEndingAt(Math.max(0, i - SM_LAG));
  const newLogosTtm = sub.acquisitions.filter((a) => a.startIndex >= 0 && a.startIndex >= i - 11 && a.startIndex <= i).length;
  const cac = newLogosTtm > 0 ? ttmSMLagged / newLogosTtm : 0;
  const activeNow = sub.series.activeLogos[i] ?? 0;
  const avgArr = activeNow > 0 ? arr / activeNow : 0;
  const gmPct = fyRevenue > 0 ? fyGrossProfit / fyRevenue : 0;
  const annualChurn = Math.max(0.05, 1 - logoRetention);
  // LTV with a conservative 5-year lifetime cap (a standard convention). Without it, the low ~8.7%
  // logo churn implies an 11+ year customer life and an inflated ~9x LTV:CAC that reads as a vanity
  // ratio next to the −35% net margin (realism audit, 2026-06-18). Capped lifetime lands LTV:CAC ~3x,
  // the defensible Series-B band, and never claims more than 5 years of value.
  const lifetimeYears = Math.min(1 / annualChurn, 5);
  const ltv = avgArr * gmPct * lifetimeYears;
  const ltvCac = cac > 0 ? ltv / cac : 0;
  // CAC payback PERIOD (months) — the gross-margin-adjusted months to recover one new logo's CAC.
  // Reuses the same cac / avgArr / gmPct above (one source), so it ties to the dollar CAC + GM% tiles.
  const monthlyGmPerLogo = (avgArr * gmPct) / 12;
  const cacPaybackMonths = monthlyGmPerLogo > 0 ? cac / monthlyGmPerLogo : 0;
  const magicNumber = ttmSMLagged > 0 ? ttmNetBookings / ttmSMLagged : 0;
  const utilization = (() => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - 11); j <= i; j++) {
      s += svc.series.utilization[j] ?? 0;
      c += 1;
    }
    return c > 0 ? s / c : 0;
  })();

  // ── Cash & Efficiency ──
  let ttmOpInv = 0;
  for (let j = Math.max(0, i - 11); j <= i; j++) ttmOpInv += (bs.series.operatingCashFlow[j] ?? 0) + (bs.series.investingCashFlow[j] ?? 0);
  const netBurn = -ttmOpInv / 12; // positive = burning
  const cash = bs.series.cash[i] ?? 0;
  const runway = netBurn > 0 ? cash / netBurn : 999;
  // Rule of 40 uses a non-GAAP (ex-SBC) operating margin — the standard convention; SBC is added
  // back so a richer equity package doesn't read as operational deterioration (GAAP SBC stays on the P&L).
  const ruleOf40 = growthRate + (fyRevenue > 0 ? (fyOperatingIncome + fySbc) / fyRevenue : 0);
  const burnMultiple = ttmNetBookings > 0 ? (netBurn * 12) / ttmNetBookings : 0;

  return {
    revenue: fyRevenue,
    gross_profit: fyGrossProfit,
    gross_margin_pct: gmPct,
    operating_income: fyOperatingIncome,
    net_income: fyNetIncome,
    net_margin_pct: fyRevenue > 0 ? fyNetIncome / fyRevenue : 0,
    arr_mrr: arr,
    bookings_delta_arr: ttmNetBookings,
    nrr,
    logo_retention: logoRetention,
    growth_rate: growthRate,
    cac_payback: cac,
    cac_payback_months: cacPaybackMonths,
    ltv_cac: ltvCac,
    magic_number: magicNumber,
    utilization,
    net_burn: netBurn,
    runway,
    rule_of_40: ruleOf40,
    burn_multiple: burnMultiple,
  };
}

/** Financial-family budgets read the P&L budget column, so the cards tie to the statement. */
function financialBudgetMag(id: string, period: Month): number | undefined {
  const c = seedPnLColumns(period);
  const b = (cv: ColumnValues) => toMajor(cv.budget ?? usd(0));
  switch (id) {
    case "revenue":
      return b(c.totalRevenue);
    case "gross_profit":
      return b(c.grossProfit);
    case "gross_margin_pct":
      return b(c.grossProfit) / b(c.totalRevenue);
    case "operating_income":
      return b(c.operatingIncome);
    case "net_income":
      return b(c.netIncome);
    case "net_margin_pct":
      return b(c.netIncome) / b(c.totalRevenue);
    default:
      return undefined;
  }
}

const mid = (s: string): MetricId => s as MetricId;
const valueOf = (id: string, period: Month, kind: MetricValueKind, mag: number): MetricValue =>
  metricValueFromMagnitude(mid(id), period, kind, mag);

/** Per-metric plan factor (budget = actual × factor) for the NON-financial KPIs. A real annual plan
 *  beats on some metrics and misses on others by DIFFERENT amounts — a uniform actual×1.04/0.94 across
 *  every tile was a synthetic tell (audit #21). These are hand-set to a plausible mix (some beats, some
 *  misses, 2–15%); the budget column is a display comparison and feeds no tie-out, so this moves nothing.
 *  (Financial tiles ignore this — they read the real locked Budget snapshot via financialBudgetMag.) */
const BUDGET_FACTOR_OVERRIDE: Record<string, number> = {
  arr_mrr: 0.97, // grew a touch faster than plan
  bookings_delta_arr: 1.06, // bookings came in light vs plan
  nrr: 0.98, // retention beat plan
  logo_retention: 0.99,
  growth_rate: 0.93, // grew faster than planned
  cac_payback: 1.07, // CAC per logo came in below plan (lower is better → beat)
  cac_payback_months: 1.06, // recovered CAC a bit faster than planned (lower is better → beat)
  ltv_cac: 0.91, // unit economics beat plan
  magic_number: 1.05, // efficiency slightly below plan
  utilization: 0.85, // capacity-gated at 100% — planned below and exceeded
  net_burn: 1.13, // burned less than planned (lower is better → beat)
  runway: 0.9, // longer runway than planned
  rule_of_40: 1.04, // a touch below plan
  burn_multiple: 1.16, // more capital-efficient than planned (lower is better → beat)
};

export function buildSeedKpiTile(metricId: MetricId, period: Month): KpiTile | undefined {
  const definition = METRIC_CATALOG.find((d) => d.id === metricId);
  if (!definition) return undefined;
  const id = definition.id as string;
  const idx = monthToIndex(period);
  const cur = computeMetricsAt(idx)[id] ?? 0;
  const py = computeMetricsAt(idx - 12)[id] ?? 0;
  const budgetMag =
    financialBudgetMag(id, period) ?? cur * (BUDGET_FACTOR_OVERRIDE[id] ?? (definition.higherIsBetter === false ? 0.94 : 1.04));
  // real trailing sparkline: this metric over the last 7 months
  const trail = Array.from({ length: 7 }, (_, k) => computeMetricsAt(idx - 6 + k)[id] ?? 0);
  return {
    definition,
    value: valueOf(id, period, definition.kind, cur),
    priorYear: valueOf(id, period, definition.kind, py),
    budget: valueOf(id, period, definition.kind, budgetMag),
    trail,
  };
}

export function buildSeedDashboard(period: Month): DashboardSummary {
  const families: MetricFamily[] = ["financial", "growth_retention", "unit_economics", "cash_efficiency"];
  return {
    period,
    families: families.map((family) => ({
      family,
      label: METRIC_FAMILY_LABELS[family],
      tiles: METRIC_CATALOG.filter((d) => d.family === family).map((d) => buildSeedKpiTile(d.id, period)!),
    })),
  };
}

/** Single metric value (for getMetric / getMetricSet). */
export function buildSeedMetricValue(metricId: MetricId, period: Month): MetricValue | undefined {
  const definition = METRIC_CATALOG.find((d) => d.id === metricId);
  if (!definition) return undefined;
  const mag = computeMetricsAt(monthToIndex(period))[definition.id as string] ?? 0;
  return valueOf(definition.id as string, period, definition.kind, mag);
}
