/**
 * Seed → typed statements (step 6). Assembles the layer-3 statements (the §8 P&L line layout,
 * Balance Sheet, Cash Flow, Runway) from the step 1–5 seed series, so the live `lib/queries`
 * read REAL Bearing data instead of the first-pass `lib/target/model.ts`. Signatures unchanged —
 * this is the "swap don't rewrite" seam (§4).
 *
 * Columns (§8): Forecast = full fiscal year · Actual = YTD through the close boundary · Budget =
 * the frozen, lockable snapshot (DataStore.getBudgetSnapshot, overlaid via applyBudgetSnapshot;
 * the per-line plan factor below is the GENERATOR of the default FY plan + the prior-year fallback,
 * no longer a per-read view) · Variance = Forecast − Budget. Subtotals foot from the leaves by
 * construction; net income equals the seed's own net-income series.
 */
import { usd, toMajor, subMoney, zeroMoney, percent, type Money } from "@/lib/types/money";
import { month, monthYear, monthIndex, type Month } from "@/lib/types/period";
import type {
  PnL,
  PnLLine,
  PnLLineId,
  ColumnValues,
  BudgetSnapshot,
  BalanceSheet,
  BalanceSheetLine,
  CashFlow,
  CashFlowLine,
  CashFlowLineId,
  Runway,
  NonGaapReconciliation,
  MonthlyPnL,
  MonthlyColumn,
  MonthlyPnLLine,
  BalanceSheetLineId,
  MonthlyBalanceSheet,
  MonthlyBalanceSheetLine,
  MonthlyCashFlow,
  MonthlyCashFlowLine,
} from "@/lib/types/statements";
import { PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import {
  getSubscriptionSeed,
  getServicesSeed,
  getPersonnelSeed,
  getCostOfRevenueSeed,
  getOpExSeed,
  getBalanceSheetSeed,
  getSbcSeed,
} from "./index";
import { indexToMonth } from "./params"; // negative-safe index↔month, shared with the generators

const monthToIndex = (mo: Month): number => (monthYear(mo) - 2024) * 12 + (monthIndex(mo) - 1);
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** The leaf (input) P&L lines and the seed series each one sums. */
type LeafId = Exclude<
  PnLLineId,
  "total_revenue" | "total_cor" | "gross_profit" | "total_opex" | "operating_income" | "net_income"
>;

interface LeafSpec {
  readonly id: LeafId;
  readonly label: string;
  readonly classification?: PnLLine["classification"];
  readonly polarity: NonNullable<PnLLine["polarity"]>;
  /** plan factor: budget = forecast × factor (revenue >1 ⇒ under plan; cost <1 ⇒ over plan) */
  readonly budgetFactor: number;
}

const LEAVES: readonly LeafSpec[] = [
  { id: "subscription", label: "Subscription", polarity: "positive", budgetFactor: 1.03 },
  { id: "services", label: "Services", polarity: "positive", budgetFactor: 1.06 },
  { id: "direct_payroll", label: "Direct Payroll", classification: "cost_of_revenue", polarity: "cost", budgetFactor: 0.98 },
  { id: "non_employee_cor", label: "Non-employee Cost of Revenue", classification: "cost_of_revenue", polarity: "cost", budgetFactor: 0.98 },
  { id: "indirect_payroll", label: "Indirect Payroll", classification: "operating_expense", polarity: "cost", budgetFactor: 0.97 },
  { id: "employee_expenses", label: "Employee Expenses", classification: "operating_expense", polarity: "cost", budgetFactor: 0.98 },
  { id: "sales_marketing", label: "Sales & Marketing", classification: "operating_expense", polarity: "cost", budgetFactor: 0.96 },
  { id: "travel_entertainment", label: "Travel & Entertainment", classification: "operating_expense", polarity: "cost", budgetFactor: 0.97 },
  { id: "it", label: "IT", classification: "operating_expense", polarity: "cost", budgetFactor: 0.98 },
  { id: "hr", label: "HR", classification: "operating_expense", polarity: "cost", budgetFactor: 0.99 },
  { id: "admin", label: "Admin", classification: "operating_expense", polarity: "cost", budgetFactor: 0.99 },
  { id: "facilities", label: "Facilities", classification: "operating_expense", polarity: "cost", budgetFactor: 1.0 },
  { id: "insurance", label: "Insurance", classification: "operating_expense", polarity: "cost", budgetFactor: 1.0 },
  { id: "stock_based_comp", label: "Stock-based Compensation", classification: "operating_expense", polarity: "cost", budgetFactor: 1.0 },
  { id: "depreciation_amortization", label: "Depreciation & Amortization", classification: "operating_expense", polarity: "cost", budgetFactor: 1.0 },
  { id: "interest_other", label: "Interest / Other", polarity: "positive", budgetFactor: 1.1 },
  { id: "taxes", label: "Taxes", polarity: "cost", budgetFactor: 1.0 },
];

// The subtotal compositions, derived ONCE from the leaf classifications so the FY P&L (computeColumns)
// and the monthly board (buildSeedMonthlyPnL) sum the same leaves. Adding a leaf to LEAVES with a
// classification flows into both subtotals automatically — no second hand-maintained list to drift.
const COR_LEAF_IDS: readonly LeafId[] = LEAVES.filter((l) => l.classification === "cost_of_revenue").map((l) => l.id);
const OPEX_LEAF_IDS: readonly LeafId[] = LEAVES.filter((l) => l.classification === "operating_expense").map((l) => l.id);

/** Map each leaf to its monthly seed series. */
function leafSeriesById(): Record<LeafId, readonly number[]> {
  const sub = getSubscriptionSeed();
  const svc = getServicesSeed();
  const per = getPersonnelSeed();
  const cor = getCostOfRevenueSeed();
  const opx = getOpExSeed();
  const bs = getBalanceSheetSeed();
  const zeros = sub.series.recognized.map(() => 0);
  const grp = (id: string) => opx.series.groups.find((g) => g.groupId === id)?.monthly ?? zeros;
  return {
    subscription: sub.series.recognized,
    services: svc.series.recognized,
    direct_payroll: per.series.directPayroll,
    non_employee_cor: cor.series.nonEmployee,
    indirect_payroll: per.series.indirectPayroll,
    employee_expenses: grp("employee-expenses"),
    sales_marketing: grp("sales-marketing"),
    travel_entertainment: grp("travel-entertainment"),
    it: grp("it"),
    hr: grp("hr"),
    admin: grp("admin"),
    facilities: grp("facilities"),
    insurance: grp("insurance"),
    stock_based_comp: getSbcSeed().series.monthly,
    depreciation_amortization: bs.series.depreciation,
    interest_other: bs.series.interestIncome,
    taxes: zeros,
  };
}

/** Deterministic ±3% dispersion around a line's central plan factor, keyed on (lineId, fiscal year).
 *  Without it, budget = forecast × a STATIC factor, so the Budget/Variance column shows the SAME
 *  variance % for a line every single year (e.g. Subscription −2.91% in FY24/25/26) — which an FP&A
 *  reviewer, who lives in that column, reads as hand-set (realism audit 2026-06-18). This jitters the
 *  budget only; forecast/actual and every tie-out are untouched. */
function planFactor(id: string, fy: number, central: number): number {
  let h = 2166136261;
  const key = `${id}:${fy}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = ((h >>> 0) % 1000) / 1000; // deterministic 0..1
  return central + (u - 0.5) * 0.06; // ±0.03 around the central factor
}

/** The fiscal-year window + close boundary for a period. */
function fyWindow(period: Month) {
  const fy = monthYear(period);
  const fyStart = (fy - 2024) * 12;
  const fyEnd = fyStart + 11;
  const closeIdx = monthToIndex(PLACEHOLDER_SETTINGS.closeThrough);
  const actualEnd = Math.min(fyEnd, closeIdx); // last closed month within the FY
  return { fy, fyStart, fyEnd, actualEnd };
}

const sumRange = (ser: readonly number[], lo: number, hi: number): number => {
  let s = 0;
  for (let i = lo; i <= hi; i++) s += ser[i] ?? 0;
  return s;
};

/** The month columns of a fiscal year (index + label + actual/in-close/forecast status). Shared by
 *  every month-across-columns builder so the close boundary is defined once. */
function monthlyColumns(period: Month): { idxs: number[]; months: MonthlyColumn[] } {
  const { fyStart, fyEnd } = fyWindow(period);
  const closeIdx = monthToIndex(PLACEHOLDER_SETTINGS.closeThrough);
  const inCloseIdx = PLACEHOLDER_SETTINGS.inCloseMonth ? monthToIndex(PLACEHOLDER_SETTINGS.inCloseMonth) : -1;
  const idxs: number[] = [];
  for (let i = fyStart; i <= fyEnd; i++) idxs.push(i);
  const months: MonthlyColumn[] = idxs.map((i) => ({
    month: indexToMonth(i),
    label: MONTH_ABBR[i % 12],
    status: i <= closeIdx ? "actual" : i === inCloseIdx ? "in_close" : "forecast",
  }));
  return { idxs, months };
}

// ── ColumnValues algebra (subtotals foot from leaves; variance = forecast − budget) ──
const cv = (forecast: number, actual: number, budget: number): ColumnValues => {
  const f = usd(forecast);
  const b = usd(budget);
  return { forecast: f, actual: usd(actual), budget: b, variance: subMoney(f, b) };
};
const getN = (c: ColumnValues, k: keyof ColumnValues): number => toMajor(c[k] ?? zeroMoney());
const addCols = (...cs: ColumnValues[]): ColumnValues =>
  cv(
    cs.reduce((a, c) => a + getN(c, "forecast"), 0),
    cs.reduce((a, c) => a + getN(c, "actual"), 0),
    cs.reduce((a, c) => a + getN(c, "budget"), 0),
  );
const subCols = (a: ColumnValues, b: ColumnValues): ColumnValues =>
  cv(getN(a, "forecast") - getN(b, "forecast"), getN(a, "actual") - getN(b, "actual"), getN(a, "budget") - getN(b, "budget"));
const marginOf = (line: ColumnValues, rev: ColumnValues) => percent(getN(line, "forecast") / getN(rev, "forecast"));

interface ComputedPnL {
  readonly leaf: Map<LeafId, ColumnValues>;
  readonly totalRevenue: ColumnValues;
  readonly totalCor: ColumnValues;
  readonly grossProfit: ColumnValues;
  readonly totalOpex: ColumnValues;
  readonly operatingIncome: ColumnValues;
  readonly netIncome: ColumnValues;
}

function computeColumns(period: Month): ComputedPnL {
  const series = leafSeriesById();
  const { fy, fyStart, fyEnd, actualEnd } = fyWindow(period);
  const leaf = new Map<LeafId, ColumnValues>();
  for (const spec of LEAVES) {
    const ser = series[spec.id];
    const forecast = sumRange(ser, fyStart, fyEnd);
    const actual = actualEnd >= fyStart ? sumRange(ser, fyStart, actualEnd) : 0;
    leaf.set(spec.id, cv(forecast, actual, forecast * planFactor(spec.id, fy, spec.budgetFactor)));
  }
  const v = (id: LeafId) => leaf.get(id) ?? cv(0, 0, 0);
  const totalRevenue = addCols(v("subscription"), v("services"));
  const totalCor = addCols(...COR_LEAF_IDS.map(v));
  const grossProfit = subCols(totalRevenue, totalCor);
  const totalOpex = addCols(...OPEX_LEAF_IDS.map(v));
  const operatingIncome = subCols(grossProfit, totalOpex);
  const netIncome = subCols(addCols(operatingIncome, v("interest_other")), v("taxes"));
  return { leaf, totalRevenue, totalCor, grossProfit, totalOpex, operatingIncome, netIncome };
}

const leafLine = (spec: LeafSpec, values: ColumnValues): PnLLine => ({
  id: spec.id,
  label: spec.label,
  level: 1,
  classification: spec.classification,
  firstTap: "peek",
  polarity: spec.polarity,
  values,
});

const SEED_FY_LABEL = (period: Month) => `FY${monthYear(period)}`;

export function buildSeedPnL(period: Month): PnL {
  const c = computeColumns(period);
  const v = (id: LeafId) => c.leaf.get(id) ?? cv(0, 0, 0);
  const spec = (id: LeafId) => LEAVES.find((l) => l.id === id)!;

  const lines: PnLLine[] = [
    leafLine(spec("subscription"), v("subscription")),
    leafLine(spec("services"), v("services")),
    { id: "total_revenue", label: "Total Revenue", level: 0, firstTap: "peek", polarity: "positive", values: c.totalRevenue },

    leafLine(spec("direct_payroll"), v("direct_payroll")),
    leafLine(spec("non_employee_cor"), v("non_employee_cor")),
    { id: "total_cor", label: "Total Cost of Revenue", level: 0, classification: "cost_of_revenue", firstTap: "peek", polarity: "cost", values: c.totalCor },

    { id: "gross_profit", label: "Gross Profit", level: 0, firstTap: "pane_only", polarity: "positive", values: c.grossProfit, marginPct: marginOf(c.grossProfit, c.totalRevenue) },

    leafLine(spec("indirect_payroll"), v("indirect_payroll")),
    leafLine(spec("employee_expenses"), v("employee_expenses")),
    leafLine(spec("sales_marketing"), v("sales_marketing")),
    leafLine(spec("travel_entertainment"), v("travel_entertainment")),
    leafLine(spec("it"), v("it")),
    leafLine(spec("hr"), v("hr")),
    leafLine(spec("admin"), v("admin")),
    leafLine(spec("facilities"), v("facilities")),
    leafLine(spec("insurance"), v("insurance")),
    leafLine(spec("stock_based_comp"), v("stock_based_comp")),
    leafLine(spec("depreciation_amortization"), v("depreciation_amortization")),
    { id: "total_opex", label: "Total Operating Expenses", level: 0, classification: "operating_expense", firstTap: "peek", polarity: "cost", values: c.totalOpex },

    { id: "operating_income", label: "Operating Income (EBIT)", level: 0, firstTap: "pane_only", polarity: "positive", values: c.operatingIncome, marginPct: marginOf(c.operatingIncome, c.totalRevenue) },

    leafLine(spec("interest_other"), v("interest_other")),
    leafLine(spec("taxes"), v("taxes")),
    { id: "net_income", label: "Net Income", level: 0, firstTap: "pane_only", polarity: "positive", values: c.netIncome, marginPct: marginOf(c.netIncome, c.totalRevenue) },
  ];

  return { period, label: SEED_FY_LABEL(period), lines };
}

// ── Monthly (month-across-columns) P&L — the board-package view (P0 #3) ──
// Reuses buildSeedPnL for the canonical line order + metadata + FY margins, and spreads each line's
// seed series across the 12 months of the fiscal year. Subtotals are recomputed per month with the
// SAME algebra as computeColumns, so each line's `total` (Σ months) equals the FY Forecast column by
// construction — the tie-out the data sweep asserts.
export function buildSeedMonthlyPnL(period: Month): MonthlyPnL {
  const fyP = buildSeedPnL(period); // canonical lines + metadata + FY margin
  const series = leafSeriesById();
  const { idxs, months } = monthlyColumns(period);

  const at = (id: LeafId, i: number): number => series[id]?.[i] ?? 0;
  const sumLeaves = (ids: readonly LeafId[], i: number) => ids.reduce((s, id) => s + at(id, i), 0);
  const totRev = (i: number) => at("subscription", i) + at("services", i);
  const totCor = (i: number) => sumLeaves(COR_LEAF_IDS, i);
  const totOpex = (i: number) => sumLeaves(OPEX_LEAF_IDS, i);
  const opInc = (i: number) => totRev(i) - totCor(i) - totOpex(i);
  const netInc = (i: number) => opInc(i) + at("interest_other", i) - at("taxes", i);

  // resolve a line's monthly value, mirroring computeColumns' subtotal formulas
  const valueAt = (id: PnLLineId, i: number): number => {
    switch (id) {
      case "total_revenue": return totRev(i);
      case "total_cor": return totCor(i);
      case "gross_profit": return totRev(i) - totCor(i);
      case "total_opex": return totOpex(i);
      case "operating_income": return opInc(i);
      case "net_income": return netInc(i);
      default: return at(id as LeafId, i); // a leaf line
    }
  };

  const lines: MonthlyPnLLine[] = fyP.lines.map((l) => {
    const monthly = idxs.map((i) => usd(valueAt(l.id, i)));
    // total rounds the raw annual sum ONCE (so leaf totals tie to the FY P&L Forecast column exactly);
    // the displayed month cells round independently, so Σ(cells) can differ by a cent — invisible at $M.
    const total = usd(idxs.reduce((s, i) => s + valueAt(l.id, i), 0));
    return {
      id: l.id,
      label: l.label,
      level: l.level,
      classification: l.classification,
      polarity: l.polarity,
      firstTap: l.firstTap,
      isSubtotal: l.level === 0,
      monthly,
      total,
      marginPct: l.marginPct,
    };
  });

  return { period, label: fyP.label, months, lines };
}

/** The period whose fiscal year the seed Budget is locked for (the current FY26 plan, §8). */
export const SEED_BUDGET_PERIOD: Month = PLACEHOLDER_SETTINGS.closeThrough;

/**
 * Overlay a locked Budget snapshot's per-line budget onto a freshly-built P&L, keyed by line id (leaves
 * AND subtotals — the snapshot already carries correct subtotal budgets, so nothing is re-footed). The
 * LIVE forecast/actual are kept; only budget is swapped and variance (= forecast − budget) re-derived.
 * Applies ONLY when the snapshot covers `period`'s fiscal year; otherwise the P&L keeps its default
 * (factor-derived) budget — the fallback for prior fiscal years and the pre-lock state.
 */
export function applyBudgetSnapshot(pnl: PnL, snap: BudgetSnapshot | undefined, period: Month): PnL {
  if (!snap || monthYear(snap.horizon.start) !== monthYear(period)) return pnl;
  const budgetById = new Map<PnLLineId, Money>(snap.lines.map((l) => [l.id, l.values.budget ?? zeroMoney()]));
  return {
    ...pnl,
    lines: pnl.lines.map((l) => {
      const b = budgetById.get(l.id);
      if (!b) return l;
      const forecast = l.values.forecast ?? zeroMoney();
      return { ...l, values: { ...l.values, budget: b, variance: subMoney(forecast, b) } };
    }),
  };
}

export function buildSeedBudget(period: Month): BudgetSnapshot {
  const fy = monthYear(period);
  return {
    lockedAt: month(fy, 1),
    sourcedFrom: "base",
    horizon: { start: month(fy, 1), end: month(fy, 12) },
    lines: buildSeedPnL(period).lines,
  };
}

// ── Balance Sheet (point-in-time: Actual = last close, Forecast = fiscal year-end) ──
export function buildSeedBalanceSheet(period: Month): BalanceSheet {
  const s = getBalanceSheetSeed().series;
  const { fyEnd, actualEnd } = fyWindow(period);
  const aIdx = Math.max(0, actualEnd);
  const bsCv = (ser: readonly number[]): ColumnValues => ({ actual: usd(ser[aIdx] ?? 0), forecast: usd(ser[fyEnd] ?? 0) });
  type Row = { id: BalanceSheetLine["id"]; label: string; ser: readonly number[]; section: BalanceSheetLine["section"]; deficit?: boolean };
  const rows: Row[] = [
    { id: "cash", label: "Cash", ser: s.cash, section: "asset" },
    { id: "accounts_receivable", label: "Accounts Receivable", ser: s.accountsReceivable, section: "asset" },
    { id: "unbilled_wip", label: "Unbilled WIP (contract asset)", ser: s.unbilledWip, section: "asset" },
    { id: "prepaid_expenses", label: "Prepaid Expenses", ser: s.prepaidExpenses, section: "asset" },
    { id: "fixed_assets_net", label: "Fixed Assets, net", ser: s.fixedAssetsNet, section: "asset" },
    { id: "rou_asset", label: "Right-of-Use Asset (operating lease)", ser: s.rouAsset, section: "asset" },
    { id: "deferred_revenue", label: "Deferred Revenue (contract liability)", ser: s.deferredRevenue, section: "liability" },
    { id: "accounts_payable", label: "Accounts Payable", ser: s.accountsPayable, section: "liability" },
    { id: "lease_liability", label: "Lease Liability (operating)", ser: s.leaseLiability, section: "liability" },
    { id: "paid_in_capital", label: "Paid-in Capital", ser: s.paidInCapital, section: "equity" },
    { id: "accumulated_deficit", label: "Accumulated Deficit", ser: s.accumulatedDeficit, section: "equity", deficit: true },
  ];
  // Lines with no working surface to open (leases, contributed capital) are pane_only; the rest
  // peek their register/driver. Keeps firstTap honest per the P&L convention (§6).
  const BS_PANE_ONLY: ReadonlySet<BalanceSheetLine["id"]> = new Set(["rou_asset", "lease_liability", "paid_in_capital"]);
  const lines: BalanceSheetLine[] = rows.map((r) => {
    const values = bsCv(r.ser);
    // accumulated deficit reduces equity → carry it negative on the statement
    const signed: ColumnValues = r.deficit
      ? { actual: usd(-(s.accumulatedDeficit[aIdx] ?? 0)), forecast: usd(-(s.accumulatedDeficit[fyEnd] ?? 0)) }
      : values;
    return { id: r.id, label: r.label, firstTap: BS_PANE_ONLY.has(r.id) ? "pane_only" : "peek", values: signed, section: r.section, gated: false };
  });
  return { period, lines };
}

// ── Cash Flow (indirect; FY view, current fiscal year) ──
export function buildSeedCashFlow(period: Month): CashFlow {
  const bs = getBalanceSheetSeed();
  const s = bs.series;
  const { fyStart, fyEnd, actualEnd } = fyWindow(period);
  const prev = fyStart - 1; // end of prior fiscal year (= opening for FY2024 handled by month -1 → guard)
  const aEnd = Math.max(fyStart, actualEnd);

  // balance delta as a CASH impact (sign per the indirect method), forecast (FY-end) vs actual (YTD)
  const deltaCash = (ser: readonly number[], sign: 1 | -1): ColumnValues => {
    const base = prev >= 0 ? (ser[prev] ?? 0) : 0;
    return { forecast: usd(sign * ((ser[fyEnd] ?? 0) - base)), actual: usd(sign * ((ser[aEnd] ?? 0) - base)) };
  };
  const flow = (ser: readonly number[]): ColumnValues => ({ forecast: usd(sumRange(ser, fyStart, fyEnd)), actual: usd(sumRange(ser, fyStart, aEnd)) });

  const netIncome = flow(s.netIncome);
  const depreciation = flow(s.depreciation);
  // Stock-based comp (ASC 718) is a non-cash expense already subtracted from net income, so the
  // indirect method adds it back. The seed's own monthly operating-cash-flow series includes it
  // (lib/seed/balance-sheet.ts), so omitting it here would break the BS-cash tie-out.
  const sbc = flow(getSbcSeed().series.monthly);
  const changeAr = deltaCash(s.accountsReceivable, -1);
  const changeDeferred = deltaCash(s.deferredRevenue, 1);
  const changeWip = deltaCash(s.unbilledWip, -1);
  const changePrepaid = deltaCash(s.prepaidExpenses, -1);
  const changeAp = deltaCash(s.accountsPayable, 1);
  const operating = addCols(netIncome, depreciation, sbc, changeAr, changeDeferred, changeWip, changePrepaid, changeAp);
  const capex = flow(s.investingCashFlow); // already negative (−capex)
  const financing = flow(s.financingCashFlow);
  const netChange = addCols(operating, capex, financing);

  // Lines with only a note (no register/driver to open) are pane_only, mirroring the P&L convention
  // and keeping firstTap honest for any future caller/Scout (the InspectPane branches on drill/note,
  // but the typed contract should still be correct).
  const CF_PANE_ONLY: ReadonlySet<CashFlowLine["id"]> = new Set([
    "stock_based_comp",
    "operating_cash_flow",
    "financing",
    "net_change_in_cash",
  ]);
  const line = (id: CashFlowLine["id"], label: string, values: ColumnValues, section: CashFlowLine["section"], isSubtotal = false): CashFlowLine => ({
    id, label, firstTap: CF_PANE_ONLY.has(id) ? "pane_only" : "peek", values, section, isSubtotal,
  });
  const lines: CashFlowLine[] = [
    line("net_income", "Net Income", netIncome, "operating"),
    line("depreciation", "Depreciation & Amortization", depreciation, "operating"),
    line("stock_based_comp", "Stock-based Compensation (non-cash)", sbc, "operating"),
    line("change_ar", "Change in Accounts Receivable", changeAr, "operating"),
    line("change_deferred_revenue", "Change in Deferred Revenue", changeDeferred, "operating"),
    line("change_unbilled_wip", "Change in Unbilled WIP", changeWip, "operating"),
    line("change_prepaids", "Change in Prepaid Expenses", changePrepaid, "operating"),
    line("change_ap", "Change in Accounts Payable", changeAp, "operating"),
    line("operating_cash_flow", "Operating Cash Flow", operating, "operating", true),
    line("capex", "Capital Expenditures", capex, "investing"),
    line("financing", "Equity Financing", financing, "financing"),
    line("net_change_in_cash", "Net Change in Cash", netChange, "total", true),
  ];
  return { period, lines };
}

// ── Monthly (month-across-columns) Balance Sheet — the board-package view ──
// Reuses buildSeedBalanceSheet for the canonical line order + labels + firstTap + section + sign, and
// reads each line's month-END balance from the same seed series. A line's `total` is the FY-END value
// (a snapshot, NOT a sum) so it equals the FY Balance Sheet Forecast column by construction.
export function buildSeedMonthlyBalanceSheet(period: Month): MonthlyBalanceSheet {
  const fyBs = buildSeedBalanceSheet(period); // canonical lines (order/labels/firstTap/section)
  const s = getBalanceSheetSeed().series;
  const { fyEnd } = fyWindow(period);
  const { idxs, months } = monthlyColumns(period);

  // accumulated deficit reduces equity → carry it negative, matching the FY statement convention.
  const serFor = (id: BalanceSheetLineId): { ser: readonly number[]; sign: 1 | -1 } => {
    switch (id) {
      case "cash": return { ser: s.cash, sign: 1 };
      case "accounts_receivable": return { ser: s.accountsReceivable, sign: 1 };
      case "unbilled_wip": return { ser: s.unbilledWip, sign: 1 };
      case "prepaid_expenses": return { ser: s.prepaidExpenses, sign: 1 };
      case "fixed_assets_net": return { ser: s.fixedAssetsNet, sign: 1 };
      case "rou_asset": return { ser: s.rouAsset, sign: 1 };
      case "deferred_revenue": return { ser: s.deferredRevenue, sign: 1 };
      case "accounts_payable": return { ser: s.accountsPayable, sign: 1 };
      case "lease_liability": return { ser: s.leaseLiability, sign: 1 };
      case "paid_in_capital": return { ser: s.paidInCapital, sign: 1 };
      case "accumulated_deficit": return { ser: s.accumulatedDeficit, sign: -1 };
    }
  };

  const lines: MonthlyBalanceSheetLine[] = fyBs.lines.map((l) => {
    const { ser, sign } = serFor(l.id);
    return {
      id: l.id,
      label: l.label,
      firstTap: l.firstTap,
      section: l.section,
      monthly: idxs.map((i) => usd(sign * (ser[i] ?? 0))),
      total: usd(sign * (ser[fyEnd] ?? 0)),
    };
  });
  return { period, label: SEED_FY_LABEL(period), months, lines };
}

// ── Monthly (month-across-columns) Cash Flow — the board-package view ──
// Reuses buildSeedCashFlow for the canonical line order + labels + firstTap + section + isSubtotal, and
// computes each line's per-MONTH flow. Flow lines (NI/D&A/SBC/capex/financing) are the month's series
// value; the working-capital lines are the month-over-month balance delta (ser[i] − ser[i−1], with the
// pre-FY-2024 opening = 0). Σ months telescopes/ sums to the FY deltaCash/flow, so each line's `total`
// equals the FY Cash Flow Forecast column by construction.
export function buildSeedMonthlyCashFlow(period: Month): MonthlyCashFlow {
  const fyCf = buildSeedCashFlow(period); // canonical lines (order/labels/firstTap/section/isSubtotal)
  const s = getBalanceSheetSeed().series;
  const sbcSer = getSbcSeed().series.monthly;
  const { idxs, months } = monthlyColumns(period);

  const at = (ser: readonly number[], i: number): number => ser[i] ?? 0;
  // balance delta as a cash impact: sign × (this month − last month); month -1 (pre-FY24) opens at 0
  const delta = (ser: readonly number[], sign: 1 | -1, i: number): number =>
    sign * (at(ser, i) - (i - 1 >= 0 ? at(ser, i - 1) : 0));

  const comp = (id: CashFlowLineId, i: number): number => {
    switch (id) {
      case "net_income": return at(s.netIncome, i);
      case "depreciation": return at(s.depreciation, i);
      case "stock_based_comp": return at(sbcSer, i);
      case "change_ar": return delta(s.accountsReceivable, -1, i);
      case "change_deferred_revenue": return delta(s.deferredRevenue, 1, i);
      case "change_unbilled_wip": return delta(s.unbilledWip, -1, i);
      case "change_prepaids": return delta(s.prepaidExpenses, -1, i);
      case "change_ap": return delta(s.accountsPayable, 1, i);
      case "capex": return at(s.investingCashFlow, i); // already negative (−capex)
      case "financing": return at(s.financingCashFlow, i);
      case "operating_cash_flow":
        return (
          comp("net_income", i) + comp("depreciation", i) + comp("stock_based_comp", i) +
          comp("change_ar", i) + comp("change_deferred_revenue", i) + comp("change_unbilled_wip", i) +
          comp("change_prepaids", i) + comp("change_ap", i)
        );
      case "net_change_in_cash":
        return comp("operating_cash_flow", i) + comp("capex", i) + comp("financing", i);
    }
  };

  const lines: MonthlyCashFlowLine[] = fyCf.lines.map((l) => ({
    id: l.id,
    label: l.label,
    firstTap: l.firstTap,
    section: l.section,
    isSubtotal: l.isSubtotal ?? false,
    monthly: idxs.map((i) => usd(comp(l.id, i))),
    total: usd(idxs.reduce((sum, i) => sum + comp(l.id, i), 0)),
  }));
  return { period, label: SEED_FY_LABEL(period), months, lines };
}

export function buildSeedRunway(asOf: Month): Runway {
  const bs = getBalanceSheetSeed();
  const n = bs.series.cash.length;
  const idx = Math.max(0, Math.min(monthToIndex(asOf), n - 1));
  const cash = bs.series.cash[idx] ?? bs.endingCash;
  // TTM net cash burn ending at the as-of month (ex financing) — the same window the dashboard
  // runway/net-burn tiles use, so getRunway and the tile agree.
  let ttmOpInv = 0;
  for (let i = Math.max(0, idx - 11); i <= idx; i++) ttmOpInv += (bs.series.operatingCashFlow[i] ?? 0) + (bs.series.investingCashFlow[i] ?? 0);
  const netBurn = -ttmOpInv / 12;
  return {
    asOf,
    cash: usd(cash),
    netBurn: usd(netBurn),
    // Raw cash/netBurn (NOT pre-rounded to 1 decimal): the dashboard runway tile computes the raw
    // ratio, and a 1-decimal pre-round here could push a value like 50.45 → 50.5 → 51 while the tile
    // shows 50, so getRunway and getMetric(runway) disagreed by a month at a boundary. Surfaces round
    // for display; the underlying value is now identical across both paths.
    months: netBurn > 0 ? cash / netBurn : null,
  };
}

// ── GAAP → non-GAAP reconciliation (how a real SaaS company reports profitability) ──
// GAAP statements carry stock-based comp (ASC 718); the non-GAAP measures add it back, and free
// cash flow is the cash-basis headline. The three ladder GAAP (deepest) → non-GAAP → FCF (best).
export function buildSeedNonGaap(period: Month): NonGaapReconciliation {
  const fy = monthYear(period);
  const c = computeColumns(period); // GAAP, FY forecast column
  const bs = getBalanceSheetSeed();
  const sbc = getSbcSeed().fySbc[fy] ?? 0;
  const revenue = toMajor(c.totalRevenue.forecast ?? zeroMoney());
  const gaapOi = toMajor(c.operatingIncome.forecast ?? zeroMoney());
  const gaapNi = toMajor(c.netIncome.forecast ?? zeroMoney());
  const fcf = (bs.fyOperatingCashFlow[fy] ?? 0) - (bs.fyCapex[fy] ?? 0); // operating CF − capex
  const marg = (x: number) => percent(revenue > 0 ? x / revenue : 0);
  return {
    period,
    revenue: usd(revenue),
    stockBasedComp: usd(sbc),
    gaapOperatingIncome: usd(gaapOi),
    gaapOperatingMargin: marg(gaapOi),
    nonGaapOperatingIncome: usd(gaapOi + sbc),
    nonGaapOperatingMargin: marg(gaapOi + sbc),
    gaapNetIncome: usd(gaapNi),
    gaapNetMargin: marg(gaapNi),
    nonGaapNetIncome: usd(gaapNi + sbc),
    nonGaapNetMargin: marg(gaapNi + sbc),
    freeCashFlow: usd(fcf),
    freeCashFlowMargin: marg(fcf),
  };
}

/** Exposed for the metrics layer (one source, two callers). */
export function seedPnLColumns(period: Month): ComputedPnL {
  return computeColumns(period);
}
export type { ComputedPnL };

// ── Scenario-engine seam (CLAUDE.md §9) ──────────────────────────────────────────────
// The scenario engine re-derives the contained Scenario P&L by perturbing the SAME monthly
// leaf series the Base P&L is built from, then footing the subtotals with the SAME algebra.
// Exposing these (rather than re-implementing the seed) is what makes the HARD INVARIANT
// hold by construction: with zero adjustments the engine feeds the untouched Base series
// through the identical math, so Scenario(Base) === the real seed P&L exactly.

/** The 17 monthly leaf P&L series, keyed by leaf id (Base, before any scenario adjustment). */
export function seedLeafSeries(): Record<LeafId, readonly number[]> {
  return leafSeriesById();
}

/** The ordered leaf specs (id + label + classification + polarity), for engine line assembly. */
export const SEED_PNL_LEAVES = LEAVES;
export type { LeafId, LeafSpec };

/** The subtotal compositions, so the engine foots Cost of Revenue / OpEx from the same leaves. */
export const SEED_COR_LEAF_IDS = COR_LEAF_IDS;
export const SEED_OPEX_LEAF_IDS = OPEX_LEAF_IDS;

/** The fiscal-year window + close boundary for a period (shared with the engine's column math). */
export function seedFyWindow(period: Month) {
  return fyWindow(period);
}

/** Σ a series over an inclusive index range (shared with the engine). */
export function seedSumRange(ser: readonly number[], lo: number, hi: number): number {
  return sumRange(ser, lo, hi);
}

/**
 * Re-derive the FY ComputedPnL from a (possibly adjusted) set of leaf series, using the SAME
 * column algebra as Base. The Forecast column reflects the adjusted series; Actual and Budget
 * stay on the BASE series (actuals are immutable; Budget is the locked plan — §8/§9), so a
 * scenario only moves the forward shape. Pass the Base series unchanged ⇒ identical to
 * computeColumns(period).
 */
export function computeColumnsFromSeries(
  period: Month,
  adjusted: Record<LeafId, readonly number[]>,
): ComputedPnL {
  const base = leafSeriesById();
  const { fy, fyStart, fyEnd, actualEnd } = fyWindow(period);
  const leaf = new Map<LeafId, ColumnValues>();
  for (const spec of LEAVES) {
    const fSer = adjusted[spec.id] ?? base[spec.id];
    const forecast = sumRange(fSer, fyStart, fyEnd);
    // actuals + budget read the BASE series (immutable / locked plan)
    const actual = actualEnd >= fyStart ? sumRange(base[spec.id], fyStart, actualEnd) : 0;
    const budget = sumRange(base[spec.id], fyStart, fyEnd) * planFactor(spec.id, fy, spec.budgetFactor);
    leaf.set(spec.id, cv(forecast, actual, budget));
  }
  const v = (id: LeafId) => leaf.get(id) ?? cv(0, 0, 0);
  const totalRevenue = addCols(v("subscription"), v("services"));
  const totalCor = addCols(...COR_LEAF_IDS.map(v));
  const grossProfit = subCols(totalRevenue, totalCor);
  const totalOpex = addCols(...OPEX_LEAF_IDS.map(v));
  const operatingIncome = subCols(grossProfit, totalOpex);
  const netIncome = subCols(addCols(operatingIncome, v("interest_other")), v("taxes"));
  return { leaf, totalRevenue, totalCor, grossProfit, totalOpex, operatingIncome, netIncome };
}

/** Assemble a typed PnL from a ComputedPnL (the §8 line layout), for the engine's Scenario P&L. */
export function pnlFromColumns(period: Month, c: ComputedPnL, scenarioId?: string): PnL {
  const v = (id: LeafId) => c.leaf.get(id) ?? cv(0, 0, 0);
  const spec = (id: LeafId) => LEAVES.find((l) => l.id === id)!;
  const lines: PnLLine[] = [
    leafLine(spec("subscription"), v("subscription")),
    leafLine(spec("services"), v("services")),
    { id: "total_revenue", label: "Total Revenue", level: 0, firstTap: "peek", polarity: "positive", values: c.totalRevenue },
    leafLine(spec("direct_payroll"), v("direct_payroll")),
    leafLine(spec("non_employee_cor"), v("non_employee_cor")),
    { id: "total_cor", label: "Total Cost of Revenue", level: 0, classification: "cost_of_revenue", firstTap: "peek", polarity: "cost", values: c.totalCor },
    { id: "gross_profit", label: "Gross Profit", level: 0, firstTap: "pane_only", polarity: "positive", values: c.grossProfit, marginPct: marginOf(c.grossProfit, c.totalRevenue) },
    leafLine(spec("indirect_payroll"), v("indirect_payroll")),
    leafLine(spec("employee_expenses"), v("employee_expenses")),
    leafLine(spec("sales_marketing"), v("sales_marketing")),
    leafLine(spec("travel_entertainment"), v("travel_entertainment")),
    leafLine(spec("it"), v("it")),
    leafLine(spec("hr"), v("hr")),
    leafLine(spec("admin"), v("admin")),
    leafLine(spec("facilities"), v("facilities")),
    leafLine(spec("insurance"), v("insurance")),
    leafLine(spec("stock_based_comp"), v("stock_based_comp")),
    leafLine(spec("depreciation_amortization"), v("depreciation_amortization")),
    { id: "total_opex", label: "Total Operating Expenses", level: 0, classification: "operating_expense", firstTap: "peek", polarity: "cost", values: c.totalOpex },
    { id: "operating_income", label: "Operating Income (EBIT)", level: 0, firstTap: "pane_only", polarity: "positive", values: c.operatingIncome, marginPct: marginOf(c.operatingIncome, c.totalRevenue) },
    leafLine(spec("interest_other"), v("interest_other")),
    leafLine(spec("taxes"), v("taxes")),
    { id: "net_income", label: "Net Income", level: 0, firstTap: "pane_only", polarity: "positive", values: c.netIncome, marginPct: marginOf(c.netIncome, c.totalRevenue) },
  ];
  return { period, label: SEED_FY_LABEL(period), scenarioId: scenarioId as PnL["scenarioId"], lines };
}

/** FY-end / actual money helpers reused by the dashboard. */
export const fyForecast = (c: ColumnValues): Money => c.forecast ?? zeroMoney();
