/**
 * General Ledger — step 6b of the §12 generator (drivers → balanced JEs → GL → statements).
 * Posts the seed's monthly activity as BALANCED double-entry journal entries (debits === credits),
 * rolls them into account balances, and exposes the Account Mapping (GL account → statement line, §7).
 *
 * Tie-out BY CONSTRUCTION: every JE balances, so the trial balance balances (Σ debits === Σ credits);
 * each balance-sheet account's GL balance reproduces its seed series; each P&L account's fiscal-year
 * activity reproduces its P&L line. The statements are now a VIEW of the GL.
 *
 * Granularity is monthly-summary, posted per source (invoice / payroll / ap_bill / depreciation /
 * manual). Per-individual-transaction detail (one JE per invoice/paycheck) is a later refinement.
 */
import { usd } from "@/lib/types/money";
import { indexToMonth } from "./params";
import { monthToIndex, fyStartIndex } from "@/lib/types/period";
import type { Month } from "@/lib/types/period";
import type { GlAccount, JournalEntry, JournalLine, JournalSource } from "@/lib/types/source";
import type { GlAccountId, StatementLineId, CostFunction, AccountType } from "@/lib/types/common";
import type { PnLLineId, BalanceSheetLineId } from "@/lib/types/statements";
import type { TieOutCheck } from "./subscription";
import {
  getSubscriptionSeed,
  getServicesSeed,
  getPersonnelSeed,
  getCostOfRevenueSeed,
  getOpExSeed,
  getBalanceSheetSeed,
  getSbcSeed,
  getLeaseSeed,
} from "./index";

const acc = (s: string): GlAccountId => s as GlAccountId;
// The Account Mapping seam (§7), now typed: `s` must already be a real statement line id, so a typo or
// a renamed P&L/BS line is a COMPILE error here instead of a silent runtime mis-map (P0 #4).
const sln = (s: PnLLineId | BalanceSheetLineId): StatementLineId => s as StatementLineId;

interface AccountSpec {
  readonly code: string;
  readonly name: string;
  readonly accountType: AccountType;
  readonly statementLineId: PnLLineId | BalanceSheetLineId; // typed Account Mapping seam (§7)
  readonly classification?: "cost_of_revenue" | "operating_expense";
  readonly function?: CostFunction;
}

/** The chart of accounts. `code` is the account id; `statementLineId` is the Account Mapping seam. */
const ACCOUNTS: readonly AccountSpec[] = [
  // Assets (debit-normal)
  { code: "1000", name: "Cash", accountType: "asset", statementLineId: "cash" },
  { code: "1100", name: "Accounts Receivable", accountType: "asset", statementLineId: "accounts_receivable" },
  { code: "1200", name: "Unbilled WIP", accountType: "asset", statementLineId: "unbilled_wip" },
  { code: "1300", name: "Prepaid Expenses", accountType: "asset", statementLineId: "prepaid_expenses" },
  { code: "1500", name: "Fixed Assets, net", accountType: "asset", statementLineId: "fixed_assets_net" },
  { code: "1600", name: "Right-of-Use Asset", accountType: "asset", statementLineId: "rou_asset" },
  // Liabilities (credit-normal)
  { code: "2000", name: "Accounts Payable", accountType: "liability", statementLineId: "accounts_payable" },
  { code: "2100", name: "Deferred Revenue", accountType: "liability", statementLineId: "deferred_revenue" },
  { code: "2200", name: "Lease Liability", accountType: "liability", statementLineId: "lease_liability" },
  // Equity
  { code: "3000", name: "Paid-in Capital", accountType: "equity", statementLineId: "paid_in_capital" },
  { code: "3100", name: "Accumulated Deficit", accountType: "contra_equity", statementLineId: "accumulated_deficit" },
  // Revenue (credit-normal)
  { code: "4000", name: "Subscription Revenue", accountType: "revenue", statementLineId: "subscription" },
  { code: "4100", name: "Services Revenue", accountType: "revenue", statementLineId: "services" },
  // Cost of Revenue (debit-normal)
  { code: "5000", name: "Direct Payroll", accountType: "cost_of_revenue", statementLineId: "direct_payroll", classification: "cost_of_revenue", function: "direct" },
  { code: "5100", name: "Non-employee Cost of Revenue", accountType: "cost_of_revenue", statementLineId: "non_employee_cor", classification: "cost_of_revenue", function: "direct" },
  // Operating Expenses (debit-normal)
  { code: "6000", name: "Indirect Payroll", accountType: "operating_expense", statementLineId: "indirect_payroll", classification: "operating_expense" },
  { code: "6100", name: "Employee Expenses", accountType: "operating_expense", statementLineId: "employee_expenses", classification: "operating_expense", function: "ga" },
  { code: "6200", name: "Sales & Marketing", accountType: "operating_expense", statementLineId: "sales_marketing", classification: "operating_expense", function: "sm" },
  { code: "6300", name: "Travel & Entertainment", accountType: "operating_expense", statementLineId: "travel_entertainment", classification: "operating_expense", function: "ga" },
  { code: "6400", name: "IT", accountType: "operating_expense", statementLineId: "it", classification: "operating_expense", function: "ga" },
  { code: "6500", name: "HR", accountType: "operating_expense", statementLineId: "hr", classification: "operating_expense", function: "ga" },
  { code: "6600", name: "Admin", accountType: "operating_expense", statementLineId: "admin", classification: "operating_expense", function: "ga" },
  { code: "6700", name: "Facilities", accountType: "operating_expense", statementLineId: "facilities", classification: "operating_expense", function: "ga" },
  { code: "6800", name: "Insurance", accountType: "operating_expense", statementLineId: "insurance", classification: "operating_expense", function: "ga" },
  { code: "6950", name: "Stock-based Compensation", accountType: "operating_expense", statementLineId: "stock_based_comp", classification: "operating_expense" },
  { code: "6900", name: "Depreciation & Amortization", accountType: "operating_expense", statementLineId: "depreciation_amortization", classification: "operating_expense", function: "ga" },
  // Below the line
  { code: "7000", name: "Interest Income", accountType: "other_income", statementLineId: "interest_other" },
  { code: "7100", name: "Income Tax", accountType: "tax", statementLineId: "taxes" },
];

export const CHART_OF_ACCOUNTS: readonly GlAccount[] = ACCOUNTS.map((a) => ({
  id: acc(a.code),
  code: a.code,
  name: a.name,
  accountType: a.accountType,
  classification: a.classification,
  function: a.function,
  statementLineId: sln(a.statementLineId),
}));

/** Debit-normal account types add to balance on a debit; the rest on a credit. (Exported so the CSV
 *  importer converts an imported TB row's debit/credit to the same natural balance the GL/TB use.) */
export const isDebitNormal = (t: AccountType): boolean =>
  t === "asset" || t === "cost_of_revenue" || t === "operating_expense" || t === "tax" || t === "contra_equity";

const OPEX_GROUP_TO_ACCOUNT: Record<string, string> = {
  "employee-expenses": "6100",
  "sales-marketing": "6200",
  "travel-entertainment": "6300",
  it: "6400",
  hr: "6500",
  admin: "6600",
  facilities: "6700",
  insurance: "6800",
};

export interface Ledger {
  readonly accounts: readonly GlAccount[];
  readonly journalEntries: readonly JournalEntry[];
  /** per-account monthly natural-balance activity (debit-normal: dr−cr; credit-normal: cr−dr) */
  readonly activity: ReadonlyMap<string, readonly number[]>;
  readonly checks: readonly TieOutCheck[];
}

interface PendingLine {
  account: string;
  debit: number;
  credit: number;
}

let cached: Ledger | undefined;

export function getLedger(): Ledger {
  if (!cached) cached = buildLedger();
  return cached;
}

/**
 * The Account-Mapping rollup seam (§7 — the map is LOAD-BEARING). Groups the per-account monthly GL
 * activity by each account's `statementLineId`, so re-pointing an account's mapping moves its closed
 * activity into a different statement line. The statement builders read this for the ACTUAL column:
 * Σ(accounts mapped to a line) === that line's actual, proven exact by `plTie` (and month-by-month,
 * since `activity` is posted from the same monthly leaf series). The `+=` accumulator handles the
 * general N:1 (many accounts → one line) case; today the P&L map is 1:1.
 * Override-aware: takes the EFFECTIVE chart (`accounts`), defaulting to the generator constant
 * CHART_OF_ACCOUNTS. The statement builders pass the composed map (DataStore.listGlAccounts()), so a
 * persisted re-point moves the account's closed activity to a different line. The default keeps every
 * direct (no-arg) caller — the gates, getLedger checks — byte-identical to the generator.
 */
export function activityByStatementLine(
  accounts: readonly GlAccount[] = CHART_OF_ACCOUNTS,
): Map<string, readonly number[]> {
  const { activity } = getLedger();
  const n = [...activity.values()][0]?.length ?? 0;
  const byLine = new Map<string, number[]>();
  for (const a of accounts) {
    const act = activity.get(a.code);
    if (!act) continue;
    const bucket = byLine.get(a.statementLineId) ?? new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) bucket[i] += act[i];
    byLine.set(a.statementLineId, bucket);
  }
  return byLine;
}

/**
 * Per-account opening balances, keyed by account code (the same values buildLedger's local `openFor`
 * literal uses for bsTie). Lazily memoized off the seed singletons. P&L / equity-deficit accounts have
 * no opening (→ absent → treated as 0). MUST stay in sync with buildLedger's openFor; the data-sweep
 * neutrality tripwire (balanceSeriesByLine(CHART) === the BS series, per line per month) enforces that.
 */
let _openingByCode: Record<string, number> | undefined;
function openingByCode(): Record<string, number> {
  if (_openingByCode) return _openingByCode;
  const bs = getBalanceSheetSeed();
  const lease = getLeaseSeed();
  const o = bs.opening;
  _openingByCode = {
    "1000": o.cash, "1100": o.accountsReceivable, "1200": o.unbilledWip, "1300": o.prepaidExpenses,
    "1500": o.fixedAssetsNet, "1600": lease.opening, "2000": o.accountsPayable,
    "2100": o.deferredRevenue, "2200": lease.opening, "3000": o.paidInCapital,
  };
  return _openingByCode;
}

/**
 * The cumulative point-in-time BALANCE series per statement line — the Balance-Sheet twin of
 * activityByStatementLine, override-aware. For each line: opening-by-line + a running Σ of activity.
 * Re-pointing an account carries BOTH its opening and its cumulative activity to the target line.
 * A line with NO contributing account is ABSENT from the map (Map.get → undefined, never a 0 entry) —
 * that absence is what routes the derived equity lines (accumulated_deficit, paid_in_capital) to the
 * series fallback in the builders. Byte-identical to getBalanceSheetSeed().series per BS line when
 * `accounts` is the generator chart (bsTie: opening + Σactivity === series, every month).
 */
export function balanceSeriesByLine(
  accounts: readonly GlAccount[] = CHART_OF_ACCOUNTS,
): Map<string, number[]> {
  const { activity } = getLedger();
  const n = [...activity.values()][0]?.length ?? 0;
  const opening = openingByCode();
  const byLine = new Map<string, number[]>();
  for (const a of accounts) {
    const act = activity.get(a.code);
    const arr = byLine.get(a.statementLineId) ?? new Array<number>(n).fill(0);
    let bal = opening[a.code] ?? 0; // P&L / derived-equity accounts open at 0
    for (let i = 0; i < n; i++) {
      bal += act?.[i] ?? 0;
      arr[i] += bal;
    }
    byLine.set(a.statementLineId, arr);
  }
  return byLine;
}

/** A GL account's natural balance is a point-in-time STOCK (assets/liabilities/equity) vs a period FLOW (P&L). */
const isBalanceSheetType = (t: AccountType): boolean =>
  t === "asset" || t === "liability" || t === "equity" || t === "contra_equity";

/**
 * The trial balance AT `period`, per account code, in NATURAL balance (the importer's TB representation —
 * import-templates/README.md: "Balance-sheet accounts carry their period-end balance; P&L accounts carry
 * fiscal-year-to-date activity"). This is the TB side of the detail-to-TB reconciliation control total
 * (CLAUDE.md §16): the imported TB is compared against the sub-ledger detail, and the seed's OWN books
 * use this as the standing control total. Reuses the GL's natural-balance `activity` + `openingByCode()` —
 * the same opening literal `buildLedger`'s bsTie uses, so it never drifts (the data-sweep BS-rollup
 * tripwire guards that). BS = opening + Σactivity[0..i]; P&L = Σactivity[fyStart..i] (FYTD).
 */
export function accountTrialBalanceAt(
  period: Month,
  accounts: readonly GlAccount[] = CHART_OF_ACCOUNTS,
): Map<string, number> {
  const { activity } = getLedger();
  const opening = openingByCode();
  const i = monthToIndex(period);
  const fy0 = fyStartIndex(period);
  // The accumulated deficit is NOT posted in the monthly-summary GL — there is no period-end closing
  // entry rolling P&L into equity (the close is the ERP's job, §16). In a trial balance with OPEN P&L
  // accounts, equity therefore carries its PRIOR-fiscal-year-end balance (the current FY's profit/loss
  // still sits in the income-statement accounts until it closes), and that is exactly what foots the
  // books: Assets + Σ(expense FYTD) + AccDef[priorFY] === Liabilities + Paid-in + Σ(revenue FYTD).
  // Source it from the balance-sheet deficit series at the prior FY-end (0 before the first FY).
  const bsSeed = getBalanceSheetSeed();
  const deficitSeries = bsSeed.series.accumulatedDeficit;
  // For the FIRST fiscal year (fy0 === 0) the "prior FY-end" deficit is the pre-window OPENING deficit
  // (the plug that balances the opening sheet), NOT 0 — otherwise the contra-equity debit it should
  // carry is missing and the TB is short the opening deficit on the debit side (it would not foot).
  const priorFyEndDeficit = fy0 >= 1 ? deficitSeries[fy0 - 1] ?? 0 : bsSeed.opening.accumulatedDeficit;
  const out = new Map<string, number>();
  for (const a of accounts) {
    if (a.accountType === "contra_equity") {
      out.set(a.code, priorFyEndDeficit); // a positive debit balance (accumulated losses)
      continue;
    }
    const act = activity.get(a.code);
    const bsAcct = isBalanceSheetType(a.accountType);
    let sum = bsAcct ? opening[a.code] ?? 0 : 0; // P&L accounts open at 0 (FYTD)
    if (act) for (let k = bsAcct ? 0 : fy0; k <= i; k++) sum += act[k] ?? 0;
    out.set(a.code, sum);
  }
  return out;
}

/** Point-in-time wrapper: each line's balance AT `asOfIdx` (clamped to ≥ 0). Absent lines → no entry. */
export function balanceByStatementLine(
  accounts: readonly GlAccount[] = CHART_OF_ACCOUNTS,
  asOfIdx = 0,
): Map<string, number> {
  const series = balanceSeriesByLine(accounts);
  const out = new Map<string, number>();
  const i = Math.max(0, asOfIdx);
  for (const [line, arr] of series) out.set(line, arr[i] ?? 0);
  return out;
}

function buildLedger(): Ledger {
  const sub = getSubscriptionSeed();
  const svc = getServicesSeed();
  const per = getPersonnelSeed();
  const cor = getCostOfRevenueSeed();
  const opx = getOpExSeed();
  const bs = getBalanceSheetSeed();
  const sbc = getSbcSeed();
  const lease = getLeaseSeed();
  const n = sub.series.months.length;
  const opening = bs.opening;

  const journalEntries: JournalEntry[] = [];
  // raw natural-balance activity per account per month (for exact tie-outs)
  const activity = new Map<string, number[]>();
  for (const a of ACCOUNTS) activity.set(a.code, new Array<number>(n).fill(0));
  const typeOf = new Map(ACCOUNTS.map((a) => [a.code, a.accountType] as const));

  let totalDebits = 0;
  let totalCredits = 0;

  const prevOr = (ser: readonly number[], i: number, open: number) => (i === 0 ? open : ser[i - 1]);

  for (let i = 0; i < n; i++) {
    const month = indexToMonth(i);
    let jeSeq = 0;

    // post a balanced journal entry from a set of debit/credit lines (amounts may be negative —
    // a negative line flips to the opposite side so debit & credit stay non-negative)
    const post = (source: JournalSource, memo: string, rawLines: PendingLine[]) => {
      const lines: JournalLine[] = [];
      let dr = 0;
      let cr = 0;
      for (const l of rawLines) {
        // a negative amount moves to the opposite side so debit & credit stay non-negative
        let debit = l.debit;
        let credit = l.credit;
        if (debit < 0) {
          credit += -debit;
          debit = 0;
        }
        if (credit < 0) {
          debit += -credit;
          credit = 0;
        }
        if (debit < 1e-6 && credit < 1e-6) continue;
        lines.push({ glAccountId: acc(l.account), debit: usd(debit), credit: usd(credit) });
        dr += debit;
        cr += credit;
        const arr = activity.get(l.account)!;
        const t = typeOf.get(l.account)!;
        arr[i] += isDebitNormal(t) ? debit - credit : credit - debit;
      }
      if (lines.length === 0) return;
      totalDebits += dr;
      totalCredits += cr;
      journalEntries.push({
        id: `JE-${month}-${(jeSeq++).toString().padStart(2, "0")}` as JournalEntry["id"],
        period: month as Month,
        memo,
        docRef: `${month}-${source}`,
        source,
        lines,
      });
    };

    // ── flows for the month ──
    const rSub = sub.series.recognized[i];
    const bSub = sub.series.billings[i];
    const rSvc = svc.series.recognized[i];
    const billedSvc = svc.series.billed[i];
    const dp = cor.series.directPayroll[i];
    const ip = per.series.indirectPayroll[i];
    const ne = cor.series.nonEmployee[i];
    const dep = bs.series.depreciation[i];
    const capex = bs.series.capex[i];
    const interest = bs.series.interestIncome[i];
    const financing = bs.series.financingCashFlow[i];

    const opexTotal = opx.series.total[i];
    const billings = bSub + billedSvc;
    const dAr = bs.series.accountsReceivable[i] - prevOr(bs.series.accountsReceivable, i, opening.accountsReceivable);
    const collections = billings - dAr;
    const payableBills = ne + opexTotal;
    const dAp = bs.series.accountsPayable[i] - prevOr(bs.series.accountsPayable, i, opening.accountsPayable);
    const apPayments = payableBills - dAp;
    const dPrepaid = bs.series.prepaidExpenses[i] - prevOr(bs.series.prepaidExpenses, i, opening.prepaidExpenses);

    // 1) subscription revenue recognized (deferred → revenue)
    post("invoice", "Subscription revenue recognized", [
      { account: "2100", debit: rSub, credit: 0 },
      { account: "4000", debit: 0, credit: rSub },
    ]);
    // 2) subscription billed (AR ↑, deferred ↑)
    post("invoice", "Subscription billed (annual upfront)", [
      { account: "1100", debit: bSub, credit: 0 },
      { account: "2100", debit: 0, credit: bSub },
    ]);
    // 3) services revenue recognized (builds the contract asset)
    post("invoice", "Services revenue recognized (% complete)", [
      { account: "1200", debit: rSvc, credit: 0 },
      { account: "4100", debit: 0, credit: rSvc },
    ]);
    // 4) services billed (WIP → AR)
    post("invoice", "Services billed", [
      { account: "1100", debit: billedSvc, credit: 0 },
      { account: "1200", debit: 0, credit: billedSvc },
    ]);
    // 5) cash collections (AR → cash)
    post("invoice", "Customer collections", [
      { account: "1000", debit: collections, credit: 0 },
      { account: "1100", debit: 0, credit: collections },
    ]);
    // 6) payroll (paid in cash)
    post("payroll", "Payroll", [
      { account: "5000", debit: dp, credit: 0 },
      { account: "6000", debit: ip, credit: 0 },
      { account: "1000", debit: 0, credit: dp + ip },
    ]);
    // 7) vendor bills (non-employee CoR + the 8 OpEx groups → AP)
    const billLines: PendingLine[] = [{ account: "5100", debit: ne, credit: 0 }];
    for (const g of opx.series.groups) {
      const accCode = OPEX_GROUP_TO_ACCOUNT[g.groupId];
      if (accCode) billLines.push({ account: accCode, debit: g.monthly[i], credit: 0 });
    }
    billLines.push({ account: "2000", debit: 0, credit: payableBills });
    post("ap_bill", "Vendor bills (CoR + OpEx)", billLines);
    // 8) AP payments (AP → cash)
    post("ap_bill", "AP payments", [
      { account: "2000", debit: apPayments, credit: 0 },
      { account: "1000", debit: 0, credit: apPayments },
    ]);
    // 9) depreciation (D&A → fixed assets)
    post("depreciation", "Depreciation & amortization", [
      { account: "6900", debit: dep, credit: 0 },
      { account: "1500", debit: 0, credit: dep },
    ]);
    // 9b) stock-based compensation (ASC 718; non-cash — Dr SBC expense / Cr paid-in capital)
    post("manual", "Stock-based compensation (ASC 718)", [
      { account: "6950", debit: sbc.series.monthly[i], credit: 0 },
      { account: "3000", debit: 0, credit: sbc.series.monthly[i] },
    ]);
    // 9c) operating lease recognition (ASC 842; non-cash BS reclass — ROU asset ↔ lease liability)
    const dRou = lease.series.rouAsset[i] - prevOr(lease.series.rouAsset, i, lease.opening);
    post("manual", "Operating lease (ASC 842)", [
      { account: "1600", debit: dRou, credit: 0 },
      { account: "2200", debit: 0, credit: dRou },
    ]);
    // 10) capex (cash → fixed assets)
    post("manual", "Capital expenditures", [
      { account: "1500", debit: capex, credit: 0 },
      { account: "1000", debit: 0, credit: capex },
    ]);
    // 11) prepaid build / release (cash ↔ prepaid)
    post("prepaid_amort", "Prepaid expense movement", [
      { account: "1300", debit: dPrepaid, credit: 0 },
      { account: "1000", debit: 0, credit: dPrepaid },
    ]);
    // 12) interest income (cash ← interest)
    post("manual", "Interest income", [
      { account: "1000", debit: interest, credit: 0 },
      { account: "7000", debit: 0, credit: interest },
    ]);
    // 13) financing (Series B: cash ← paid-in capital)
    if (financing !== 0) {
      post("manual", "Series B financing", [
        { account: "1000", debit: financing, credit: 0 },
        { account: "3000", debit: 0, credit: financing },
      ]);
    }
  }

  // ── checks ──
  const trialBalances = Math.abs(totalDebits - totalCredits) < 1;

  // BS account balances reproduce the seed series (natural balance = opening + Σ activity)
  const seriesFor: Record<string, readonly number[]> = {
    "1000": bs.series.cash,
    "1100": bs.series.accountsReceivable,
    "1200": bs.series.unbilledWip,
    "1300": bs.series.prepaidExpenses,
    "1500": bs.series.fixedAssetsNet,
    "1600": bs.series.rouAsset,
    "2000": bs.series.accountsPayable,
    "2100": bs.series.deferredRevenue,
    "2200": bs.series.leaseLiability,
    "3000": bs.series.paidInCapital,
  };
  const openFor: Record<string, number> = {
    "1000": opening.cash,
    "1100": opening.accountsReceivable,
    "1200": opening.unbilledWip,
    "1300": opening.prepaidExpenses,
    "1500": opening.fixedAssetsNet,
    "1600": lease.opening,
    "2000": opening.accountsPayable,
    "2100": opening.deferredRevenue,
    "2200": lease.opening,
    "3000": opening.paidInCapital,
  };
  let bsTie = true;
  let worstBs = 0;
  for (const [code, ser] of Object.entries(seriesFor)) {
    const act = activity.get(code)!;
    let bal = openFor[code] ?? 0;
    for (let i = 0; i < n; i++) {
      bal += act[i];
      const diff = Math.abs(bal - ser[i]);
      if (diff > worstBs) worstBs = diff;
      if (diff >= 1) bsTie = false;
    }
  }

  // P&L account FY activity reproduces the P&L line (per fiscal year)
  const plSeries: Record<string, readonly number[]> = {
    "4000": sub.series.recognized,
    "4100": svc.series.recognized,
    "5000": cor.series.directPayroll,
    "5100": cor.series.nonEmployee,
    "6000": per.series.indirectPayroll,
    "6900": bs.series.depreciation,
    "6950": sbc.series.monthly,
    "7000": bs.series.interestIncome,
  };
  for (const g of opx.series.groups) {
    const code = OPEX_GROUP_TO_ACCOUNT[g.groupId];
    if (code) plSeries[code] = g.monthly;
  }
  let plTie = true;
  let worstPl = 0;
  for (const [code, ser] of Object.entries(plSeries)) {
    const act = activity.get(code)!;
    for (const fy of [2024, 2025, 2026]) {
      let glFy = 0;
      let serFy = 0;
      for (let i = (fy - 2024) * 12; i < (fy - 2024) * 12 + 12; i++) {
        glFy += act[i];
        serFy += ser[i];
      }
      const diff = Math.abs(glFy - serFy);
      if (diff > worstPl) worstPl = diff;
      if (diff >= 1) plTie = false;
    }
  }

  const checks: TieOutCheck[] = [
    {
      label: "Trial balance balances (Σ debits === Σ credits)",
      ok: trialBalances,
      detail: `Σ debits ${Math.round(totalDebits).toLocaleString()} === Σ credits ${Math.round(totalCredits).toLocaleString()} across ${journalEntries.length} journal entries`,
      kind: "independent",
    },
    {
      label: "GL balance-sheet accounts reproduce the seed series",
      ok: bsTie,
      detail: `each account: opening + Σ(dr−cr) === series, every month (worst Δ ${worstBs.toFixed(4)})`,
      kind: "independent",
    },
    {
      label: "GL P&L accounts reproduce the P&L lines (per FY)",
      ok: plTie,
      detail: `Σ FY account activity === the mapped P&L line, FY24–26 (worst Δ ${worstPl.toFixed(4)})`,
      kind: "independent",
    },
  ];

  return { accounts: CHART_OF_ACCOUNTS, journalEntries, activity, checks };
}
