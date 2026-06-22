/** Sales — the revenue funnel (layer 1 — CLAUDE.md §8). Contracts is the 606/deferred pivot. */
import { type Month, type PeriodRange, monthYear, monthLabel, monthToIndex, fyStartIndexForYear } from "@/lib/types/period";
import { usd, percent, ratio, sumMoney, type Money, type Percent, type Ratio } from "@/lib/types/money";
import type { Stream, MetricId } from "@/lib/types/common";
import type {
  PipelineOpportunity,
  PipelineStage,
  Contract,
  Customer,
  Renewal,
  RenewalStatus,
} from "@/lib/types/source";
import { getDataStore } from "@/lib/datastore";
import { PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";

// ── Pipeline ──
export interface PipelineFilter {
  readonly byStage?: PipelineStage;
  readonly byRep?: string;
}
export interface PipelineCoverage {
  readonly openArr: Money;
  /** next quarter's PLANNED gross new bookings (new business + expansion) — the coverage target */
  readonly target: Money;
  /** openArr ÷ target — the standard "do we have enough pipeline to hit plan" ratio */
  readonly coverage: Ratio;
}
export async function listPipeline(filter: PipelineFilter = {}): Promise<readonly PipelineOpportunity[]> {
  let rows = await getDataStore().listPipeline();
  if (filter.byStage) rows = rows.filter((o) => o.stage === filter.byStage);
  if (filter.byRep) rows = rows.filter((o) => o.owner === filter.byRep);
  return rows;
}
/**
 * Pipeline coverage — open funnel ARR vs the bookings target it is meant to cover. The target is the
 * next quarter's PLANNED gross new bookings (new business + expansion) read from the forecast bookings
 * ledger (the same series whose cumulative net === ARR); closeThrough is the actual/forecast boundary,
 * so the three months after it are the quarter the open pipeline closes into. Coverage = openArr ÷
 * target, the standard "do we have enough pipeline to hit plan" ratio.
 */
export async function getPipelineCoverage(): Promise<PipelineCoverage> {
  const store = getDataStore();
  const openArr = sumMoney((await store.listPipeline()).map((o) => o.arr));
  const sub = await store.getSubscriptionModel();
  const closeIdx = monthToIndex((await store.getSettings()).closeThrough);
  let targetMajor = 0;
  for (let i = closeIdx + 1; i <= closeIdx + 3; i++) {
    const b = sub.series.bookings[i];
    if (b) targetMajor += b.newBusiness + b.expansion;
  }
  const target = usd(targetMajor);
  return { openArr, target, coverage: ratio(target.minor > 0 ? openArr.minor / target.minor : 0) };
}

// ── Contracts (register + Bookings + Schedules/Deferred + contracted-revenue bridge) ──
export interface DeferredWaterfall {
  readonly period: Month;
  readonly opening: Money;
  readonly additions: Money;
  readonly recognized: Money;
  readonly closing: Money;
}
export interface Bookings {
  readonly period: Month;
  readonly newBusiness: Money;
  readonly expansion: Money;
  readonly contraction: Money;
  readonly net: Money;
}
export interface ContractedRevenue {
  readonly period: Month;
  readonly recognizedToDate: Money;
  readonly contractedForward: Money;
}
export async function listContracts(): Promise<readonly Contract[]> {
  return getDataStore().listContracts();
}
export async function getContract(id: string): Promise<Contract | undefined> {
  return getDataStore().getContract(id);
}
/**
 * Subscription deferred-revenue roll-forward for a period: opening + billings − recognized = closing.
 * Reads the seed's billings/recognized/deferred series, so `closing` === the Balance Sheet deferred
 * line and the chain ties to cash (the indirect-method change in deferred). The pre-window opening
 * deferred seeds month 0.
 */
export async function getDeferredWaterfall(period: Month): Promise<DeferredWaterfall> {
  const sub = await getDataStore().getSubscriptionModel();
  const i = monthToIndex(period);
  const opening = i > 0 ? (sub.series.deferred[i - 1] ?? 0) : sub.openingDeferred;
  return {
    period,
    opening: usd(opening),
    additions: usd(sub.series.billings[i] ?? 0),
    recognized: usd(sub.series.recognized[i] ?? 0),
    closing: usd(sub.series.deferred[i] ?? 0),
  };
}
/**
 * Period ΔARR (the Bookings view inside Contracts — §8): new business + expansion − contraction.
 * Reads the seed's per-month bookings ledger (the same series whose cumulative net === ARR, the
 * load-bearing subscription tie-out). Bookings are a subscription motion; `byStream: "services"`
 * has no ARR ledger, so it returns zeros (services revenue is capacity-driven, not booked ARR).
 */
export async function getBookings(period: Month, opts: { byStream?: Stream } = {}): Promise<Bookings> {
  if (opts.byStream === "services") {
    return { period, newBusiness: usd(0), expansion: usd(0), contraction: usd(0), net: usd(0) };
  }
  const sub = await getDataStore().getSubscriptionModel();
  const b = sub.series.bookings[monthToIndex(period)];
  return {
    period,
    newBusiness: usd(b?.newBusiness ?? 0),
    expansion: usd(b?.expansion ?? 0),
    contraction: usd(b?.contraction ?? 0),
    net: usd(b?.net ?? 0),
  };
}
/**
 * The contracted-revenue bridge (RPO/backlog) at a period: recognized-to-date (solid) +
 * contracted-forward (the remaining performance obligation = billed-but-unrecognized on signed
 * terms, i.e. the deferred balance). Split at "today" — the wedge between actual and forecast (§8).
 */
export async function getContractedRevenue(period: Month): Promise<ContractedRevenue> {
  const sub = await getDataStore().getSubscriptionModel();
  const i = monthToIndex(period);
  let recognizedToDate = 0;
  for (let j = 0; j <= i; j++) recognizedToDate += sub.series.recognized[j] ?? 0;
  return {
    period,
    recognizedToDate: usd(recognizedToDate),
    contractedForward: usd(sub.series.deferred[i] ?? 0),
  };
}

// ── Bookings over time (the honest YoY view — monthly bookings are lumpy) ──
export interface BookingsWindow {
  readonly label: string;
  readonly newBusiness: Money;
  readonly expansion: Money;
  /** positive magnitude of lost ARR (net = newBusiness + expansion − contraction) */
  readonly contraction: Money;
  readonly gross: Money; // newBusiness + expansion
  readonly net: Money;
}
export interface BookingsHistory {
  readonly period: Month;
  readonly fiscalYear: BookingsWindow; // full calendar FY containing `period` (includes the forecast tail)
  readonly priorFiscalYear: BookingsWindow;
  readonly ttm: BookingsWindow; // trailing 12 months ending at `period` — the apples-to-apples "at this point" view
  readonly priorTtm: BookingsWindow; // the 12 months immediately before the TTM window
}
/**
 * Bookings (ΔARR) aggregated into comparable windows so a year-over-year question is answered on a
 * fiscal-year or trailing-12-month basis, not a single lumpy month. Reads the same bookings ledger
 * whose cumulative net === ARR (the load-bearing subscription tie-out), so these windows reconcile
 * to ARR by construction. TTM is the honest "at this point last year vs now" comparison.
 */
export async function getBookingsHistory(period: Month): Promise<BookingsHistory> {
  const sub = await getDataStore().getSubscriptionModel();
  const series = sub.series.bookings;
  const last = series.length - 1;
  const i = monthToIndex(period);
  const window = (lo: number, hi: number, label: string): BookingsWindow => {
    let nb = 0, ex = 0, co = 0, net = 0;
    for (let j = Math.max(0, lo); j <= Math.min(last, hi); j++) {
      const b = series[j];
      nb += b.newBusiness;
      ex += b.expansion;
      co += b.contraction;
      net += b.net;
    }
    return { label, newBusiness: usd(nb), expansion: usd(ex), contraction: usd(co), gross: usd(nb + ex), net: usd(net) };
  };
  const year = monthYear(period);
  const fyLo = fyStartIndexForYear(year);
  const priorFyLo = fyStartIndexForYear(year - 1);
  return {
    period,
    fiscalYear: window(fyLo, fyLo + 11, `FY${year}`),
    priorFiscalYear: window(priorFyLo, priorFyLo + 11, `FY${year - 1}`),
    ttm: window(i - 11, i, `TTM to ${monthLabel(period)}`),
    priorTtm: window(i - 23, i - 12, "Prior TTM"),
  };
}

// ── Customers ──
export async function listCustomers(): Promise<readonly Customer[]> {
  // The register reflects the book AS-OF the current (in-close) period: a logo that signs in the
  // forecast horizon (Jul–Dec 2026) has not signed yet, so it does not appear as an active customer
  // (audit #8). Its ARR lives in the Revenue Forecast, not the actuals register. Month strings compare
  // lexically. (When the global as-of becomes user-movable, this reads the same source of truth.)
  const asOf = PLACEHOLDER_SETTINGS.inCloseMonth ?? PLACEHOLDER_SETTINGS.closeThrough;
  const all = await getDataStore().listCustomers();
  return all.filter((c) => c.startMonth <= asOf);
}
export async function getCustomer(id: string): Promise<Customer | undefined> {
  return getDataStore().getCustomer(id);
}
export async function getArr(period: Month): Promise<Money> {
  const sub = await getDataStore().getSubscriptionModel();
  return usd(sub.series.arr[monthToIndex(period)] ?? 0);
}

// ── Renewals (the retention motion) ──
export async function listRenewals(window?: PeriodRange): Promise<readonly Renewal[]> {
  return getDataStore().listRenewals(window);
}
/**
 * Net revenue retention — forwards the seed's i-12 cohort NRR metric (the same value the Dashboard
 * NRR tile shows), so Scout/UI and the tile never diverge (one source, two callers). NRR is a
 * cohort computation the seed owns; this query does not recompute it.
 */
export async function getNrr(period: Month): Promise<Percent> {
  const mv = await getDataStore().getMetricValue("nrr" as MetricId, period);
  return mv?.percent ?? percent(1);
}
/**
 * Gross dollar retention on the CLOSED renewal book (the seed's renewal worklist is book-level, so
 * `_period` is accepted for signature symmetry): face-value ARR kept (renewed + expanded + contracted)
 * ÷ ARR that came up for renewal. Mirrors the getRenewals Scout tool exactly (one source, two callers)
 * — same records, same formula — so the UI and Scout never diverge. For the NRR cohort rate use getNrr.
 */
export async function getGrr(_period: Month): Promise<Percent> {
  const CLOSED: readonly RenewalStatus[] = ["renewed", "expanded", "contracted", "churned"];
  const closed = (await listRenewals()).filter((r) => CLOSED.includes(r.status));
  const closedArr = sumMoney(closed.map((r) => r.arrUpForRenewal));
  if (closedArr.minor === 0) return percent(1);
  const keptArr = sumMoney(closed.filter((r) => r.status !== "churned").map((r) => r.arrUpForRenewal));
  return percent(keptArr.minor / closedArr.minor);
}
