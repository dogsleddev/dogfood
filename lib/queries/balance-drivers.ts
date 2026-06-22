/** Balance-sheet drivers: AR · Fixed Assets · Prepaids (layer 2 — CLAUDE.md §8). */
import { type Month, monthYear } from "@/lib/types/period";
import { usd, days } from "@/lib/types/money";
import type {
  ArForecastLine,
  FixedAssetForecastLine,
  PrepaidsForecastLine,
} from "@/lib/types/drivers";
import { getDataStore } from "@/lib/datastore";
import { assertBaseScope, type ScenarioOpt } from "./util";

/**
 * DSO-driven receivables: one line per month of the period's fiscal year. The balance is the seed's
 * AR series (DSO/365 × trailing billings), so it === the Balance Sheet AR line and the month-over-
 * month delta === the cash-flow change-in-AR — closing the revenue → AR → cash drill.
 */
export async function getArForecast(period: Month, opts: ScenarioOpt = {}): Promise<readonly ArForecastLine[]> {
  assertBaseScope(opts, "getArForecast");
  const bs = await getDataStore().getBalanceSheetModel();
  const months = bs.series.months;
  const fyStart = (monthYear(period) - 2024) * 12;
  const lines: ArForecastLine[] = [];
  for (let m = fyStart; m <= fyStart + 11; m++) {
    const mo = months[m];
    if (!mo) continue;
    lines.push({ period: mo, dso: days(bs.dso), balance: usd(bs.series.accountsReceivable[m] ?? 0) });
  }
  return lines;
}

/**
 * Capex + straight-line depreciation schedule: one line per month of the period's fiscal year.
 * Reads the seed's capex / depreciation / fixed-assets-net series, so netBookValue === the Balance
 * Sheet Fixed Assets line and depreciation === the P&L D&A line (one source, two callers).
 */
export async function getFixedAssetForecast(period: Month, opts: ScenarioOpt = {}): Promise<readonly FixedAssetForecastLine[]> {
  assertBaseScope(opts, "getFixedAssetForecast");
  const bs = (await getDataStore().getBalanceSheetModel()).series;
  const months = bs.months;
  const fyStart = (monthYear(period) - 2024) * 12;
  const lines: FixedAssetForecastLine[] = [];
  for (let m = fyStart; m <= fyStart + 11; m++) {
    const mo = months[m];
    if (!mo) continue;
    lines.push({
      period: mo,
      capex: usd(bs.capex[m] ?? 0),
      depreciation: usd(bs.depreciation[m] ?? 0),
      netBookValue: usd(bs.fixedAssetsNet[m] ?? 0),
    });
  }
  return lines;
}

/**
 * Prepaid amortization roll-forward: one line per month of the period's fiscal year. The closing
 * `balance` is the seed's prepaid series (=== the Balance Sheet Prepaid Expenses line — the
 * authoritative figure). The flow is split into amortization (a 12-month straight-line run-off of
 * the opening balance) and additions, with additions backed out as the plug so the roll ties to the
 * authoritative balance every month (balance = prior + additions − amortization).
 */
export async function getPrepaidsForecast(period: Month, opts: ScenarioOpt = {}): Promise<readonly PrepaidsForecastLine[]> {
  assertBaseScope(opts, "getPrepaidsForecast");
  const bs = (await getDataStore().getBalanceSheetModel()).series;
  const months = bs.months;
  const fyStart = (monthYear(period) - 2024) * 12;
  const AMORT_MONTHS = 12; // prepaids amortize straight-line over ~12 months (annual policies/software)
  const lines: PrepaidsForecastLine[] = [];
  for (let m = fyStart; m <= fyStart + 11; m++) {
    const mo = months[m];
    if (!mo) continue;
    const balance = bs.prepaidExpenses[m] ?? 0;
    const prior = m > 0 ? (bs.prepaidExpenses[m - 1] ?? 0) : balance;
    const amortization = prior / AMORT_MONTHS;
    const additions = balance - prior + amortization; // plug so the roll ties to the authoritative balance
    lines.push({ period: mo, additions: usd(additions), amortization: usd(amortization), balance: usd(balance) });
  }
  return lines;
}

/* AP Forecast (DPO) is now IN (first-pass): the step-5 seed generates an AP/DPO balance + the
 * cash-flow change_ap. A getApForecast query stub lands when these queries are wired to the seed
 * (step 6); the typed CashFlow/BalanceSheet line sets get the AP + D&A lines at the same time. */
