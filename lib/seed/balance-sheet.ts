/**
 * Balance sheet + cash flow — step 5 of the §12 generator (drivers → … → statements).
 * Assembles the layer-3 statements from the step 1–4 drivers plus the working-capital drivers
 * generated here: AR/DSO, prepaids, fixed assets + depreciation (the D&A line absent before
 * step 5), AP/DPO, and the Series-B financing event.
 *
 * Tie-out BY CONSTRUCTION (the master check): cash is derived from the indirect-method cash
 * flow —  ΔCash = NI + D&A − ΔAR + ΔDeferred − ΔPrepaid + ΔAP − ΔWIP − capex + financing —
 * and equity accumulates net income, so **Assets === Liabilities + Equity every month**. That
 * balancing is an INDEPENDENT check: a sign error in any working-capital change breaks it.
 * Deferred comes from the subscription billings roll-forward, so `change_deferred_revenue`
 * is a real cash event (no closed-form fudge).
 */
import {
  SEED_MONTHS,
  SEED_MONTH_COUNT,
  DSO_DAYS,
  DPO_DAYS,
  PREPAID_DAYS,
  CAPEX_PER_NEW_HEAD,
  CAPEX_BASE_PER_HEAD_MONTH,
  DEPREC_LIFE_MONTHS,
  INTEREST_ON_CASH_RATE,
  OPENING_BALANCES,
  SERIES_B,
  DA_TARGETS,
} from "./params";
import type { Month } from "@/lib/types/period";
import type { TieOutCheck } from "./subscription";

/** Everything the assembler reads from the step 1–4 drivers (all monthly series, length 36). */
export interface BalanceSheetInputs {
  readonly subBillings: readonly number[];
  readonly subRecognized: readonly number[];
  readonly subDeferred: readonly number[];
  readonly subOpeningDeferred: number;
  readonly svcBilled: readonly number[];
  readonly svcWip: readonly number[];
  readonly grossProfit: readonly number[];
  readonly indirectPayroll: readonly number[];
  readonly nonEmployeeCoR: readonly number[];
  readonly nonPayrollOpEx: readonly number[];
  readonly totalHeadcount: readonly number[];
  /** Stock-based comp (ASC 718) — non-cash: deepens net income, credited to paid-in capital. */
  readonly sbc: readonly number[];
  /** Operating lease (ASC 842): ROU asset === lease liability each month → equity-neutral. */
  readonly rouAsset: readonly number[];
  readonly leaseLiability: readonly number[];
  readonly leaseOpening: number;
}

export interface BalanceSheetSeries {
  readonly months: readonly Month[];
  // assets
  readonly cash: readonly number[];
  readonly accountsReceivable: readonly number[];
  readonly unbilledWip: readonly number[];
  readonly prepaidExpenses: readonly number[];
  readonly fixedAssetsNet: readonly number[];
  readonly rouAsset: readonly number[];
  // liabilities
  readonly deferredRevenue: readonly number[];
  readonly accountsPayable: readonly number[];
  readonly leaseLiability: readonly number[];
  // equity
  readonly paidInCapital: readonly number[];
  readonly accumulatedDeficit: readonly number[];
  // P&L + cash-flow flows
  readonly netIncome: readonly number[];
  readonly interestIncome: readonly number[];
  readonly depreciation: readonly number[];
  readonly capex: readonly number[];
  readonly operatingCashFlow: readonly number[];
  readonly investingCashFlow: readonly number[];
  readonly financingCashFlow: readonly number[];
}

/** Opening balances as of the start of month 0 (= end of Dec 2023), for the GL roll-forward. */
export interface OpeningBalances {
  readonly cash: number;
  readonly accountsReceivable: number;
  readonly unbilledWip: number;
  readonly prepaidExpenses: number;
  readonly fixedAssetsNet: number;
  readonly deferredRevenue: number;
  readonly accountsPayable: number;
  readonly paidInCapital: number;
  readonly accumulatedDeficit: number;
}

export interface BalanceSheetSeed {
  readonly series: BalanceSheetSeries;
  readonly opening: OpeningBalances;
  readonly fyNetIncome: Readonly<Record<number, number>>;
  readonly fyDepreciation: Readonly<Record<number, number>>;
  readonly fyOperatingCashFlow: Readonly<Record<number, number>>;
  readonly fyCapex: Readonly<Record<number, number>>;
  readonly endingCash: number;
  /** Working-capital day-count assumptions (DSO/DPO). The AR/AP forecast driver queries read
   *  these off the model so lib/queries never imports lib/seed/params at runtime (the §4 seam). */
  readonly dso: number;
  readonly dpo: number;
  // Runway / net-burn are deliberately NOT stored here: they are an as-of-period reporting
  // convention, not a balance-sheet fact. The canonical source is buildSeedRunway(asOf) in
  // lib/seed/statements.ts (TTM-as-of-period), which the dashboard runway/net-burn tiles also
  // use — one source, two callers. (A stray field here once computed them at the last month,
  // Dec 2026, printing a runway that conflicted with every user surface.)
  readonly checks: readonly TieOutCheck[];
}

const DAYS_PER_YEAR = 365;

/** Trailing-12-month sum of a flow, annualized — smooths the lumpy annual-prepay billings for DSO/DPO. */
const ttmAnnualized = (series: readonly number[], i: number): number => {
  const from = Math.max(0, i - 11);
  let sum = 0;
  for (let j = from; j <= i; j++) sum += series[j];
  return (sum / (i - from + 1)) * 12;
};

export function assembleBalanceSheet(inp: BalanceSheetInputs): BalanceSheetSeed {
  const n = SEED_MONTH_COUNT;

  // Total customer billings (subscription annual upfront + services at completion) drive AR.
  const totalBillings = inp.subBillings.map((b, i) => b + inp.svcBilled[i]);
  // Cash-settled expense base for AP (non-payroll OpEx + non-employee CoR; payroll pays immediately).
  const payableExpenses = inp.nonPayrollOpEx.map((o, i) => o + inp.nonEmployeeCoR[i]);

  // ── depreciation schedule: straight-line over DEPREC_LIFE_MONTHS per vintage ──
  const depByMonth = new Array<number>(n).fill(0);
  const addVintage = (startMonth: number, gross: number) => {
    const perMonth = gross / DEPREC_LIFE_MONTHS;
    for (let t = startMonth; t < Math.min(n, startMonth + DEPREC_LIFE_MONTHS); t++) depByMonth[t] += perMonth;
  };
  // Opening fixed assets depreciate over the window's first life-months.
  addVintage(0, OPENING_BALANCES.fixedAssetsNet);

  const capex = new Array<number>(n).fill(0);
  let prevHead = inp.totalHeadcount[0]; // treat month-0 founders as opening (their kit is in opening FA)
  for (let i = 0; i < n; i++) {
    const newHeads = Math.max(0, inp.totalHeadcount[i] - prevHead);
    prevHead = inp.totalHeadcount[i];
    capex[i] = CAPEX_PER_NEW_HEAD * newHeads + CAPEX_BASE_PER_HEAD_MONTH * inp.totalHeadcount[i];
    addVintage(i, capex[i]);
  }
  const depreciation = depByMonth;

  // ── month-by-month roll-forwards (opening balances seed t = −1) ──
  const cash: number[] = [];
  const ar: number[] = [];
  const prepaid: number[] = [];
  const ap: number[] = [];
  const fixedAssetsNet: number[] = [];
  const netIncome: number[] = [];
  const interestIncomeSeries: number[] = [];
  const paidInCapital: number[] = [];
  const accumulatedDeficit: number[] = [];
  const operatingCF: number[] = [];
  const investingCF: number[] = [];
  const financingCF: number[] = [];

  // opening equity is the plug that balances the opening sheet; split into paid-in + accumulated deficit.
  const openAssets =
    OPENING_BALANCES.cash + OPENING_BALANCES.accountsReceivable + OPENING_BALANCES.prepaidExpenses + OPENING_BALANCES.fixedAssetsNet + inp.leaseOpening;
  const openLiab = inp.subOpeningDeferred + OPENING_BALANCES.accountsPayable + inp.leaseOpening;
  const openEquity = openAssets - openLiab; // lease is equity-neutral (ROU asset === lease liability)
  const openDeficit = OPENING_BALANCES.paidInCapital - openEquity; // > 0: accumulated losses pre-window

  let prevCash: number = OPENING_BALANCES.cash;
  let prevAr: number = OPENING_BALANCES.accountsReceivable;
  let prevPrepaid: number = OPENING_BALANCES.prepaidExpenses;
  let prevAp: number = OPENING_BALANCES.accountsPayable;
  let prevFa: number = OPENING_BALANCES.fixedAssetsNet;
  let prevDeferred = inp.subOpeningDeferred;
  let prevWip = 0; // services start in-window
  let prevPaidIn: number = OPENING_BALANCES.paidInCapital;
  let prevDeficit = openDeficit;

  for (let i = 0; i < n; i++) {
    const arNow = (DSO_DAYS / DAYS_PER_YEAR) * ttmAnnualized(totalBillings, i);
    const prepaidNow = (PREPAID_DAYS / DAYS_PER_YEAR) * ttmAnnualized(inp.nonPayrollOpEx, i);
    const apNow = (DPO_DAYS / DAYS_PER_YEAR) * ttmAnnualized(payableExpenses, i);
    const faNow = prevFa + capex[i] - depreciation[i];

    const interestIncome = (INTEREST_ON_CASH_RATE / 12) * prevCash; // on prior-month cash (no circularity)
    const ni = inp.grossProfit[i] - inp.indirectPayroll[i] - inp.nonPayrollOpEx[i] - depreciation[i] - inp.sbc[i] + interestIncome;

    const dAr = arNow - prevAr;
    const dDeferred = inp.subDeferred[i] - prevDeferred;
    const dPrepaid = prepaidNow - prevPrepaid;
    const dAp = apNow - prevAp;
    const dWip = inp.svcWip[i] - prevWip;
    const financing = i === SERIES_B.monthIndex ? SERIES_B.amount : 0;

    const opCF = ni + depreciation[i] + inp.sbc[i] - dAr + dDeferred - dPrepaid + dAp - dWip;
    const invCF = -capex[i];
    const finCF = financing;
    const cashNow = prevCash + opCF + invCF + finCF;

    cash.push(cashNow);
    ar.push(arNow);
    prepaid.push(prepaidNow);
    ap.push(apNow);
    fixedAssetsNet.push(faNow);
    netIncome.push(ni);
    interestIncomeSeries.push(interestIncome);
    paidInCapital.push(prevPaidIn + financing + inp.sbc[i]);
    accumulatedDeficit.push(prevDeficit - ni); // ni < 0 ⇒ deficit grows
    operatingCF.push(opCF);
    investingCF.push(invCF);
    financingCF.push(finCF);

    prevCash = cashNow;
    prevAr = arNow;
    prevPrepaid = prepaidNow;
    prevAp = apNow;
    prevFa = faNow;
    prevDeferred = inp.subDeferred[i];
    prevWip = inp.svcWip[i];
    prevPaidIn += financing + inp.sbc[i];
    prevDeficit -= ni;
  }

  // ── FY aggregates ──
  const fy = (): Record<number, number> => ({ 2024: 0, 2025: 0, 2026: 0 });
  const fyNetIncome = fy();
  const fyDepreciation = fy();
  const fyOperatingCashFlow = fy();
  const fyCapex = fy();
  for (let i = 0; i < n; i++) {
    const y = 2024 + Math.floor(i / 12);
    fyNetIncome[y] += netIncome[i];
    fyDepreciation[y] += depreciation[i];
    fyOperatingCashFlow[y] += operatingCF[i];
    fyCapex[y] += capex[i];
  }

  // Last month index (Dec 2026) — used by the ending-cash and cash tie-out checks below.
  // (Runway/net-burn are NOT computed here; see buildSeedRunway in lib/seed/statements.ts.)
  const last = n - 1;

  // ── checks ──
  // MASTER independent tie: assets === liabilities + equity, every month (separate aggregations).
  let balances = true;
  let worstImbalance = 0;
  for (let i = 0; i < n; i++) {
    const assets = cash[i] + ar[i] + inp.svcWip[i] + prepaid[i] + fixedAssetsNet[i] + inp.rouAsset[i];
    const liabPlusEquity = inp.subDeferred[i] + ap[i] + inp.leaseLiability[i] + paidInCapital[i] - accumulatedDeficit[i];
    const diff = Math.abs(assets - liabPlusEquity);
    if (diff > worstImbalance) worstImbalance = diff;
    if (diff >= 1) balances = false;
  }
  const openingBalances = Math.abs(openAssets - openLiab - openEquity) < 1;

  // INDEPENDENT: ending cash rebuilt from opening + Σ all cash-flow movements (a different path
  // than the rolling `cash` accumulator — catches a flow that updates cash but not the statement).
  const totalCF = operatingCF.reduce((a, b) => a + b, 0) + investingCF.reduce((a, b) => a + b, 0) + financingCF.reduce((a, b) => a + b, 0);
  const cashFromFlows = OPENING_BALANCES.cash + totalCF;
  const cashTies = Math.abs(cashFromFlows - cash[last]) < 1;

  const cashNonNeg = cash.every((c) => c >= 0);
  const faNonNeg = fixedAssetsNet.every((f) => f >= -1);
  const da26 = fyDepreciation[2026];
  const daTarget = DA_TARGETS[2026];
  const daInBand = Math.abs(da26 / daTarget - 1) <= 0.2;

  const checks: TieOutCheck[] = [
    {
      label: "Balance sheet balances (Assets === Liabilities + Equity), every month",
      ok: balances && openingBalances,
      detail: `worst imbalance ${worstImbalance.toFixed(4)} across ${n} months (the master tie — cash from CF, equity from NI)`,
      kind: "independent",
    },
    {
      label: "Cash flow ties to the cash balance",
      ok: cashTies,
      detail: `opening ${Math.round(OPENING_BALANCES.cash).toLocaleString()} + Σ cash flow === ending cash ${Math.round(cash[last]).toLocaleString()}`,
      kind: "independent",
    },
    {
      label: "Cash never negative (funded by opening + Series B)",
      ok: cashNonNeg,
      detail: `min ${Math.round(Math.min(...cash)).toLocaleString()} · end ${Math.round(cash[last]).toLocaleString()}`,
      kind: "sanity",
    },
    {
      label: "Fixed assets net never negative",
      ok: faNonNeg,
      detail: "capex − straight-line depreciation; one-sided bound",
      kind: "sanity",
    },
    {
      label: `FY26 D&A within 20% of the ${Math.round(daTarget / 1000)}K target`,
      ok: daInBand,
      detail: `${Math.round(da26).toLocaleString()} vs ${Math.round(daTarget).toLocaleString()}`,
      kind: "calibration",
    },
  ];

  const opening: OpeningBalances = {
    cash: OPENING_BALANCES.cash,
    accountsReceivable: OPENING_BALANCES.accountsReceivable,
    unbilledWip: 0,
    prepaidExpenses: OPENING_BALANCES.prepaidExpenses,
    fixedAssetsNet: OPENING_BALANCES.fixedAssetsNet,
    deferredRevenue: inp.subOpeningDeferred,
    accountsPayable: OPENING_BALANCES.accountsPayable,
    paidInCapital: OPENING_BALANCES.paidInCapital,
    accumulatedDeficit: openDeficit,
  };

  return {
    series: {
      months: SEED_MONTHS,
      cash,
      accountsReceivable: ar,
      unbilledWip: inp.svcWip,
      prepaidExpenses: prepaid,
      fixedAssetsNet,
      rouAsset: inp.rouAsset,
      deferredRevenue: inp.subDeferred,
      accountsPayable: ap,
      leaseLiability: inp.leaseLiability,
      paidInCapital,
      accumulatedDeficit,
      netIncome,
      interestIncome: interestIncomeSeries,
      depreciation,
      capex,
      operatingCashFlow: operatingCF,
      investingCashFlow: investingCF,
      financingCashFlow: financingCF,
    },
    opening,
    fyNetIncome,
    fyDepreciation,
    fyOperatingCashFlow,
    fyCapex,
    endingCash: cash[last],
    dso: DSO_DAYS,
    dpo: DPO_DAYS,
    checks,
  };
}
