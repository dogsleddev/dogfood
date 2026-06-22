/**
 * Money & units — centralized, typed; never stringly-typed amounts (CLAUDE.md §15).
 * Amounts are stored as integer MINOR units (cents) to keep arithmetic exact.
 * Deterministic helpers only; the LLM never does math that must tie out (§15).
 */

export type CurrencyCode = "USD";

export interface Money {
  /** integer minor units (cents) */
  readonly minor: number;
  readonly currency: CurrencyCode;
}

/** A fraction where 1 === 100% (e.g. gross margin 0.62 === 62%). */
export type Percent = number & { readonly __brand: "Percent" };

/** A plain ratio/multiple (e.g. LTV:CAC 3.4, magic number 0.9). */
export type Ratio = number & { readonly __brand: "Ratio" };

/** A count of days (DSO/DPO). */
export type Days = number & { readonly __brand: "Days" };

export const percent = (fraction: number): Percent => fraction as Percent;
export const ratio = (value: number): Ratio => value as Ratio;
export const days = (value: number): Days => value as Days;

/** Build Money from major units (dollars). */
export const usd = (major: number): Money => ({
  minor: Math.round(major * 100),
  currency: "USD",
});

/** Build Money from integer minor units (cents). */
export const moneyFromMinor = (minor: number, currency: CurrencyCode = "USD"): Money => ({
  minor: Math.round(minor),
  currency,
});

export const zeroMoney = (currency: CurrencyCode = "USD"): Money => ({ minor: 0, currency });

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  return { minor: a.minor + b.minor, currency: a.currency };
};

export const subMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new Error(`currency mismatch: ${a.currency} vs ${b.currency}`);
  return { minor: a.minor - b.minor, currency: a.currency };
};

export const negateMoney = (a: Money): Money => ({ minor: -a.minor, currency: a.currency });

export const sumMoney = (items: readonly Money[], currency: CurrencyCode = "USD"): Money =>
  items.reduce(addMoney, zeroMoney(currency));

export const toMajor = (m: Money): number => m.minor / 100;

export interface FormatMoneyOptions {
  /** Use compact notation ($1.4M, $820K). Default true for summary surfaces. */
  readonly compact?: boolean;
  /** Show cents. Default false. */
  readonly cents?: boolean;
}

export const formatMoney = (m: Money, opts: FormatMoneyOptions = {}): string => {
  const { compact = false, cents = false } = opts;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: m.currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: cents ? 2 : compact ? 1 : 0,
    minimumFractionDigits: cents ? 2 : 0,
  }).format(toMajor(m));
};

export const formatPercent = (p: Percent, fractionDigits = 1): string =>
  `${(p * 100).toFixed(fractionDigits)}%`;

export const formatRatio = (r: Ratio, fractionDigits = 1): string => `${r.toFixed(fractionDigits)}x`;
