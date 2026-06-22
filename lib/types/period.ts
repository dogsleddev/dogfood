/**
 * Periods are ALWAYS explicit parameters — never an implicit "now" (CLAUDE.md §15).
 * Monthly granularity is the locked base unit (§9); quarters/years roll up from months.
 */

/** A calendar month, canonical form "YYYY-MM" (e.g. "2026-06"). */
export type Month = string & { readonly __brand: "Month" };

/** A calendar quarter, canonical form "YYYY-Qn" (e.g. "2026-Q2"). */
export type Quarter = string & { readonly __brand: "Quarter" };

/** A fiscal year (Bearing runs a calendar fiscal year — §11). */
export type FiscalYear = number & { readonly __brand: "FiscalYear" };

export type PeriodGranularity = "month" | "quarter" | "year";

/**
 * Where a period sits relative to the close boundary.
 * Bearing: Jan 2024–May 2026 closed; June 2026 in close; Jul–Dec 2026 forecast (§11).
 * The exact boundary is seed/Settings config — classify against it, never hardcode here.
 */
export type PeriodStatus = "actual" | "in_close" | "forecast";

export const month = (year: number, m: number): Month => {
  if (m < 1 || m > 12) throw new Error(`invalid month: ${m}`);
  return `${year.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}` as Month;
};

export const parseMonth = (value: string): Month => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new Error(`invalid Month: ${value}`);
  return value as Month;
};

export const monthYear = (mo: Month): number => Number(mo.slice(0, 4));
export const monthIndex = (mo: Month): number => Number(mo.slice(5, 7)); // 1–12

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Short display label for a month — "2026-06" → "Jun 2026". Display only; never for keys. */
export const monthLabel = (mo: Month): string => `${MONTH_ABBR[monthIndex(mo) - 1]} ${monthYear(mo)}`;

export const compareMonth = (a: Month, b: Month): number => (a < b ? -1 : a > b ? 1 : 0);

export const quarterOf = (mo: Month): Quarter =>
  `${monthYear(mo)}-Q${Math.floor((monthIndex(mo) - 1) / 3) + 1}` as Quarter;

/** An inclusive range of months [start, end]. */
export interface PeriodRange {
  readonly start: Month;
  readonly end: Month;
}

/** Enumerate the months in an inclusive range. */
export const monthsInRange = ({ start, end }: PeriodRange): Month[] => {
  const out: Month[] = [];
  let y = monthYear(start);
  let m = monthIndex(start);
  while (true) {
    const cur = month(y, m);
    out.push(cur);
    if (cur === end) break;
    if (compareMonth(cur, end) > 0) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
};

/** The forecast horizon a scenario/driver operates over (a closed range). */
export type ForecastHorizon = PeriodRange;
