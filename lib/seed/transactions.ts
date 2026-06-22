/**
 * Transaction sub-ledger — explodes the monthly drivers into individual transactions (the
 * detailed actuals a real ERP would hold; CLAUDE.md §5 layer 1 / §16). FIVE streams, each
 * reconciling to its driver BY CONSTRUCTION (Σ transactions in month i === driver[i], verified
 * by the checks below). Nothing here feeds the statements — the GL is still built from the
 * monthly drivers — so every existing tie-out is untouched; this is pure layer-1 detail.
 *
 *   vendor bills   → non-payroll OpEx (8 groups) + non-employee CoR   (partition each group-month)
 *   paychecks      → total payroll                                    (per employee × 2 periods/mo)
 *   timesheets     → services recognized revenue                      (per project: hours × bill rate; job-costed WIP)
 *   customer invoices → subscription billings + services billed       (emitted from the source billing events)
 *   cash receipts  → collections (billings − ΔAR)                     (FIFO against open customer balances)
 */
import { mulberry32, type Rng } from "./prng";
import { SEED_RNG_SEED, SEED_MONTH_COUNT, indexToMonth, SUBSCRIPTION_HOSTING_RATE, SERVICES_PASSTHROUGH_RATE, DSO_DAYS } from "./params";
import { monthlyCompFor } from "./personnel";
import { SEED_EXPENSE_GROUPS, PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import { CHART_OF_ACCOUNTS } from "./gl";
import { opexSubAccountById, opexGroupPool } from "./opex-accounts";
import { usd, toMajor } from "@/lib/types/money";
import { month, monthYear, monthIndex as monthNo, monthToIndex, type Month } from "@/lib/types/period";
import type { GlAccountId, ExpenseGroupId, JournalEntryId, CustomerId, ContractId, ProjectId, StaffId, CostFunction } from "@/lib/types/common";
import type { CustomerInvoice, CashReceipt, Paycheck, Timesheet, ProjectJobCost, VendorBill, DocStatus } from "@/lib/types/transactions";
import type { TieOutCheck } from "./subscription";
import {
  getSubscriptionSeed,
  getServicesSeed,
  getPersonnelSeed,
  getCostOfRevenueSeed,
  getOpExSeed,
  getBalanceSheetSeed,
} from "./index";

const r2 = (x: number) => Math.round(x * 100) / 100;

// ── dates & document numbers ──
// A full calendar date for a transaction, ALWAYS inside its own month so no monthly roll-up
// moves. `day` is clamped to the month's length; the result is "YYYY-MM-DD".
const daysInMonth = (year: number, month1: number): number => new Date(year, month1, 0).getDate();
function isoDate(monthIdx: number, day: number): string {
  const m = indexToMonth(monthIdx); // "YYYY-MM"
  const year = monthYear(m as Month);
  const mo = monthNo(m as Month);
  const d = Math.min(Math.max(1, Math.round(day)), daysInMonth(year, mo));
  return `${m}-${d.toString().padStart(2, "0")}`;
}
/** Advance an ISO date by `days` calendar days (used for net-30 due dates that may cross months). */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = (dt.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getUTCDate().toString().padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
// The close boundary: actuals are closed through this date; anything due (and not yet collected
// or paid) after it is still "open". Drives invoice/bill open|paid status realistically.
const CLOSE_THROUGH = PLACEHOLDER_SETTINGS.closeThrough as Month;
const CLOSE_IDX = monthToIndex(CLOSE_THROUGH); // last closed month index
const CLOSE_LAST_ISO = (() => {
  const y = monthYear(CLOSE_THROUGH);
  const mo = monthNo(CLOSE_THROUGH);
  return `${CLOSE_THROUGH}-${daysInMonth(y, mo).toString().padStart(2, "0")}`;
})();
const isPastClose = (iso: string): boolean => iso > CLOSE_LAST_ISO;

/** Split `amount` into `n` positive-weighted parts that sum to it EXACTLY (last absorbs residual). */
function split(rng: Rng, amount: number, n: number): number[] {
  if (n <= 1) return [r2(amount)];
  const w = Array.from({ length: n }, () => 0.6 + rng() * 0.8);
  const sw = w.reduce((a, b) => a + b, 0);
  const parts: number[] = [];
  let acc = 0;
  for (let k = 0; k < n - 1; k++) {
    const p = r2((amount * w[k]) / sw);
    parts.push(p);
    acc += p;
  }
  parts.push(r2(amount - acc));
  return parts;
}

// ── vendor pools: the non-employee CoR streams here; the 8 OpEx groups now live in opex-accounts.ts ──
// Bearing's own SaaS/AI stack — the tools a 2025 AI-native finance company actually expenses
// (Numeric/Campfire peer profile). On-brand: it pays Anthropic/OpenAI for the model inference behind its
// own product (CoR-hosting). Pure cosmetic strings — never touch amounts, counts, or the reconciliation.
// Each pool has ANCHOR vendors (fixed-contract spend, recurring every month at a stable share + jitter)
// plus ROTATING vendors that fill the remainder. Σ per bucket-month is UNCHANGED: anchors + the rotating
// remainder are renormalized to the driver total, so every reconciliation holds.
// NOTE (2026-06-22): the OpEx group pools moved to lib/seed/opex-accounts.ts (OPEX_SUB_ACCOUNTS) — emit()
// is now called PER SUB-ACCOUNT, so each group's vendors live under their GL sub-account. The CoR streams
// stay here (non_employee_cor is one account, not a sub-accounted OpEx group).
type VendorPool = { readonly anchors: readonly (readonly [string, number])[]; readonly rotating: readonly string[] };
const VENDOR_POOLS: Record<string, VendorPool> = {
  // non-employee Cost of Revenue — infra/hosting + model inference (the on-brand AI touch)
  "cor-hosting": { anchors: [["Amazon Web Services", 0.42], ["Anthropic", 0.26], ["OpenAI", 0.14]], rotating: ["Google Cloud", "Cloudflare", "MongoDB Atlas", "Snowflake", "Pinecone"] },
  // 1–2 anchor implementation partners carry the steady spend, the rest are occasional overflow.
  "cor-passthrough": { anchors: [["Implementation Partners LLC", 0.46], ["Slalom", 0.3]], rotating: ["Northbeam Consulting", "Turing", "Crossover Solutions"] },
};

// A short per-vendor memo template so a bill register doesn't show one canned line.
const MEMO_VERBS: Record<string, string> = {
  "employee-expenses": "benefits & payroll services",
  "sales-marketing": "marketing program spend",
  "travel-entertainment": "travel & entertainment",
  it: "software subscription",
  hr: "recruiting & HR platform",
  admin: "corporate services",
  facilities: "office & facilities",
  insurance: "insurance premium",
  "cor-hosting": "cloud infrastructure & inference",
  "cor-passthrough": "implementation pass-through",
};
const billMemo = (groupId: string, vendor: string, periodMonthNo: number): string => {
  const base = MEMO_VERBS[groupId] ?? "vendor bill";
  const moName = new Date(2000, periodMonthNo - 1, 1).toLocaleString("en-US", { month: "short" });
  return `${vendor} — ${base} (${moName})`;
};

// NOTE: a former ANNUAL_LUMP device (a "big January D&O premium" / "July SaaS prepay") was removed in
// the 2026-06-21 data pass. Under smooth monthly OpEx drivers a within-month lump can never exceed the
// month's driver total, so the "annual premium" actually read SMALLER than an ordinary month (audit #35)
// — a false signal. A real annual prepay belongs in the prepaids balance-sheet driver, not the bill mix.

// Resolve a statement line to its GL account. Fail LOUD at seed-build time if a line is unmapped (a
// renamed/typo'd line or a new OpEx group with no account) rather than silently bucketing it to Admin (P0 #4).
const acctForLine = (line: string): GlAccountId => {
  const a = CHART_OF_ACCOUNTS.find((acct) => acct.statementLineId === line);
  if (!a) throw new Error(`acctForLine: no GL account maps to statement line '${line}' (Account Mapping seam, §7)`);
  return a.id;
};
const pick = (rng: Rng, pool: readonly string[]) => pool[Math.floor(rng() * pool.length)] ?? pool[0];

/** Sample `k` distinct vendors from a pool WITHOUT replacement (Fisher-Yates prefix). If the pool
 *  is smaller than `k`, returns the whole pool shuffled (callers cap counts to the pool size). */
function sampleVendors(rng: Rng, pool: readonly string[], k: number): string[] {
  const arr = pool.slice();
  const take = Math.min(k, arr.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rng() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, take);
}

export interface TransactionsSeed {
  readonly vendorBills: readonly VendorBill[];
  readonly paychecks: readonly Paycheck[];
  readonly timesheets: readonly Timesheet[];
  readonly customerInvoices: readonly CustomerInvoice[];
  readonly cashReceipts: readonly CashReceipt[];
  readonly jobCostByProject: readonly ProjectJobCost[];
  readonly checks: readonly TieOutCheck[];
}

let cached: TransactionsSeed | undefined;
export function getTransactionsSeed(): TransactionsSeed {
  if (!cached) cached = buildTransactions();
  return cached;
}

function buildTransactions(): TransactionsSeed {
  const sub = getSubscriptionSeed();
  const svc = getServicesSeed();
  const per = getPersonnelSeed();
  const cor = getCostOfRevenueSeed();
  const opx = getOpExSeed();
  const bs = getBalanceSheetSeed();
  const rng = mulberry32(SEED_RNG_SEED + 101);
  const n = SEED_MONTH_COUNT;
  const checks: TieOutCheck[] = [];
  const within = (a: number, b: number) => Math.abs(a - b) < 1;

  // Document numbers reset their sequence PER YEAR (a real ERP restarts numbering each fiscal year),
  // so a 2026 invoice reads INV-2026-0001…, not a continuation of a global counter (audit #38). The
  // record `id` keeps its own global sequence for uniqueness; only the human doc number resets.
  const docCounters = new Map<string, number>();
  const docNum = (prefix: string, monthIdx: number): string => {
    const year = monthYear(indexToMonth(monthIdx) as Month);
    const key = `${prefix}-${year}`;
    const seq = (docCounters.get(key) ?? 0) + 1;
    docCounters.set(key, seq);
    return `${prefix}-${year}-${seq.toString().padStart(4, "0")}`;
  };
  // Per-customer collection lag (days from invoice to payment) — a deterministic offset around DSO so
  // the invoice→receipt gap spreads (some customers pay net-30, some stretch to ~60) instead of every
  // invoice clearing at exactly DSO_DAYS (audit #18). Receipt MONTH is unchanged (FIFO-budget driven),
  // so collections still tie; only the receipt date within the month shifts.
  const custLag = (customerId: string): number => {
    let h = 0;
    for (let c = 0; c < customerId.length; c++) h = (h * 31 + customerId.charCodeAt(c)) % 41;
    return DSO_DAYS - 12 + (h % 25); // ~33–57 days
  };

  // ── 1) VENDOR BILLS — partition each OpEx group-month + non-employee CoR (hosting/pass-through) ──
  // Each group's spend goes to its ANCHOR vendors (recurring every month at a stable share + jitter)
  // plus a rotating remainder; per-vendor memos, dates/net-30 due/open|paid status. This gives recurring
  // SaaS/PEO/insurance vendors a steady month-over-month run-rate instead of randomly appearing and
  // swinging (data audit 2026-06-21 #2/#3/#36). Σ per group-month is UNCHANGED — anchors + the rotating
  // remainder are renormalized to the group total (+ non-emp CoR), so every reconciliation holds.
  const vendorBills: VendorBill[] = [];
  let billSeq = 0;
  const groupMeta = new Map(SEED_EXPENSE_GROUPS.map((g) => [g.id as string, g]));
  const emit = (i: number, groupId: string, line: string, fn: CostFunction, total: number, poolDef: VendorPool, subCode?: string) => {
    if (total < 1) return 0;
    const acct = acctForLine(line);
    const fnTag = groupMeta.get(groupId)?.function ?? fn;
    const moNo = monthNo(indexToMonth(i) as Month);

    // Build the bill lines: ANCHOR vendors first (recurring every month at their stable share of the
    // group total, with ±8% month jitter so they aren't byte-identical), then a ROTATING remainder
    // split across 1–3 sampled vendors. Renormalized below so Σ === total exactly.
    const lines: { vendor: string; amount: number; anchor: boolean }[] = [];
    const anchorSum = poolDef.anchors.reduce((s, [, w]) => s + w, 0);
    for (const [vendor, w] of poolDef.anchors) {
      const jitter = 1 + (rng() * 0.16 - 0.08);
      lines.push({ vendor, amount: Math.max(0, total * w * jitter), anchor: true });
    }
    const rotShare = Math.max(0, 1 - anchorSum);
    if (rotShare > 0.001 && poolDef.rotating.length > 0) {
      const k = Math.min(poolDef.rotating.length, 1 + Math.floor(rng() * 3)); // 1–3 rotating bills/month
      const rotVendors = sampleVendors(rng, poolDef.rotating, k);
      const parts = split(rng, total * rotShare, k);
      rotVendors.forEach((v, idx) => lines.push({ vendor: v, amount: parts[idx] ?? 0, anchor: false }));
    }
    if (lines.length === 0) lines.push({ vendor: pick(rng, poolDef.rotating.length ? poolDef.rotating : ["Vendor"]), amount: total, anchor: false });

    // Renormalize to the driver total EXACTLY (last line absorbs the rounding residual).
    const raw = lines.reduce((s, l) => s + l.amount, 0) || 1;
    let acc = 0;
    for (let k = 0; k < lines.length; k++) {
      lines[k].amount = k === lines.length - 1 ? r2(total - acc) : r2((lines[k].amount * total) / raw);
      acc = r2(acc + lines[k].amount);
    }

    let posted = 0;
    for (const ln of lines) {
      if (ln.amount <= 0) continue;
      const day = ln.anchor ? 1 + Math.floor(rng() * 8) : 5 + Math.floor(rng() * 22); // anchors bill early in the month
      const date = isoDate(i, day);
      const dueDate = addDays(date, 30);
      const status = isPastClose(dueDate) ? "open" : "paid";
      vendorBills.push({
        id: `VB-${indexToMonth(i)}-${billSeq.toString().padStart(4, "0")}` as JournalEntryId,
        docNumber: docNum("BILL", i),
        period: indexToMonth(i),
        date,
        dueDate,
        status,
        glAccountId: acct,
        groupId: groupId as ExpenseGroupId,
        subCode,
        function: fnTag,
        vendor: ln.vendor,
        memo: billMemo(groupId, ln.vendor, moNo),
        amount: usd(ln.amount),
      });
      billSeq++;
      posted += ln.amount;
    }
    return posted;
  };
  for (let i = 0; i < n; i++) {
    // Each OpEx group bills PER SUB-ACCOUNT (§7): the sub-account's monthly amount, split across its own
    // vendor pool, stamped with its subCode. Σ over sub-accounts === g.monthly[i] (opex.ts), so the
    // per-month bills-roll-up below is unchanged. glAccountId stays the PARENT group account (acctForLine).
    for (const g of opx.series.groups) {
      const line = g.groupId.replace(/-/g, "_");
      const fn = groupMeta.get(g.groupId)?.function ?? "ga";
      if (g.subAccounts.length === 0) {
        emit(i, g.groupId, line, fn, g.monthly[i], opexGroupPool(g.groupId));
      } else {
        for (const sa of g.subAccounts) {
          const cfg = opexSubAccountById(sa.id);
          const pool: VendorPool = cfg ? { anchors: cfg.anchors, rotating: cfg.rotating } : { anchors: [], rotating: ["Vendor"] };
          emit(i, g.groupId, line, fn, sa.monthly[i], pool, sa.subCode);
        }
      }
    }
    // non-employee CoR splits into hosting (% of sub) + pass-through (% of svc); Σ === cor.nonEmployee[i]
    emit(i, "cor-hosting", "non_employee_cor", "direct", SUBSCRIPTION_HOSTING_RATE * cor.series.subscriptionRevenue[i], VENDOR_POOLS["cor-hosting"]);
    emit(i, "cor-passthrough", "non_employee_cor", "direct", SERVICES_PASSTHROUGH_RATE * cor.series.servicesRevenue[i], VENDOR_POOLS["cor-passthrough"]);
  }
  // reconcile per month: Σ vendor bills === non-payroll OpEx total + non-employee CoR
  const billByMonth = new Array<number>(n).fill(0);
  for (const b of vendorBills) billByMonth[monthToIndex(b.period)] += toMajor(b.amount);
  const billsTie = billByMonth.every((t, i) => within(t, opx.series.total[i] + cor.series.nonEmployee[i]));
  checks.push({
    label: "Vendor bills roll up to non-payroll OpEx + non-employee CoR",
    ok: billsTie,
    detail: `${vendorBills.length.toLocaleString()} bills · Σ/month === opx.total + non-employee CoR`,
    kind: "independent",
  });

  // ── AP reconciliation: open vendor bills as-of close foot to the formula BS AP ──
  // Add the $300K opening payable as a pre-window bill, then settle bills oldest-first up to the
  // cumulative payment implied by the formula AP (purchases paid on a DPO lag). Σ open bill balances
  // as-of close === formula BS AP, so an AP-aging drill ties to the statement (mirrors the AR fix).
  const openingApBill: VendorBill = {
    id: "VB-OB-0001" as JournalEntryId,
    docNumber: "BILL-OB-0001",
    period: month(2023, 12),
    date: "2023-12-20",
    dueDate: "2024-01-19",
    status: "open",
    glAccountId: acctForLine("admin"),
    groupId: "admin" as ExpenseGroupId,
    function: "ga",
    vendor: "Opening payables",
    memo: "Opening accounts-payable balance (pre-window)",
    amount: usd(bs.opening.accountsPayable),
  };
  vendorBills.push(openingApBill); // pushed AFTER the roll-up check above, so billByMonth is unchanged
  const apRecs = vendorBills
    .map((b) => ({ bill: b, monthIdx: b === openingApBill ? 0 : monthToIndex(b.period), open: toMajor(b.amount) }))
    .filter((r) => r.monthIdx <= CLOSE_IDX)
    .sort((a, b) => (a.bill.date < b.bill.date ? -1 : a.bill.date > b.bill.date ? 1 : 0));
  const formulaAp = bs.series.accountsPayable[CLOSE_IDX];
  let apToPay = Math.max(0, apRecs.reduce((s, r) => s + r.open, 0) - formulaAp); // cumulative paid by close
  for (const r of apRecs) {
    const pay = r2(Math.min(r.open, apToPay));
    r.open = r2(r.open - pay);
    apToPay = r2(apToPay - pay);
  }
  const apOpenByBill = new Map(apRecs.map((r) => [r.bill, r.open] as const));
  for (const b of vendorBills) {
    const open = apOpenByBill.get(b); // undefined ⇒ issued in a forecast month ⇒ open (unpaid)
    (b as { status: DocStatus }).status = open === undefined ? "open" : open > 0.005 ? "open" : "paid";
  }
  const subledgerAp = apRecs.reduce((s, r) => s + r.open, 0);
  checks.push({
    // DEFINITIONAL, not independent: apToPay is plugged from (Σbills − formulaAp), so settling that much
    // forces Σopen === formulaAp algebraically. It proves the AP aging is CONSTRUCTED to the BS AP and
    // that enough bills exist (Σbills ≥ formulaAp), not an independent second derivation of AP. (The AR
    // foot, by contrast, pins the opening-AR injection + no-leak on top of the collections roll-up.)
    label: "AP sub-ledger settled to the BS (Σ open vendor bills as-of close === BS AP)",
    ok: within(subledgerAp, formulaAp),
    detail: `Σ open bill balances ${Math.round(subledgerAp).toLocaleString()} === BS AP ${Math.round(formulaAp).toLocaleString()} @ ${CLOSE_THROUGH} (definitional)`,
    kind: "definitional",
  });

  // ── 2) PAYCHECKS — per employee × 2 semi-monthly periods; Σ gross/month === total payroll ──
  // GROSS now reads monthlyCompFor(baseComp, hireIndex, monthIndex) — the SAME function the
  // personnel series uses — so gross ties to total payroll WITH merit raises + the December bonus
  // (a flat baseComp/12 had every paycheck byte-identical for 36 months; realism audit 2026-06-18).
  // WITHHOLDING is now realistic (cosmetic — gross is what ties): Social Security 6.2% to the
  // $168,600 annual wage-base cap (tracked YTD per employee, so high earners stop paying SS
  // mid-year), Medicare 1.45% uncapped, and coarse progressive federal withholding by annualized
  // pay band — so two employees at different salaries show different effective rates.
  const SS_RATE = 0.062;
  const SS_WAGE_CAP = 168_600;
  const MEDICARE_RATE = 0.0145;
  // coarse marginal-ish federal withholding rate by ANNUALIZED gross (single-filer flavored bands)
  const fedRate = (annualizedGross: number): number => {
    if (annualizedGross < 50_000) return 0.1;
    if (annualizedGross < 100_000) return 0.12;
    if (annualizedGross < 190_000) return 0.22;
    return 0.24;
  };
  const paychecks: Paycheck[] = [];
  let paySeq = 0;
  for (const s of per.staff) {
    const hireIndex = Math.max(0, monthToIndex(s.startMonth));
    const baseComp = toMajor(s.baseComp);
    // benefits deduction: a flat-ish % that varies slightly per employee (deterministic from RNG)
    const benefitsPct = 0.07 + rng() * 0.02; // 7–9%
    const endIndex = s.endMonth ? monthToIndex(s.endMonth) : n; // paychecks stop at departure (attrition)
    let ssYtd = 0; // YTD Social-Security wages taxed (resets each calendar year)
    let ytdYear = -1;
    for (let i = hireIndex; i < Math.min(n, endIndex); i++) {
      const year = monthYear(indexToMonth(i) as Month);
      if (year !== ytdYear) { ssYtd = 0; ytdYear = year; }
      const monthlyGross = monthlyCompFor(baseComp, hireIndex, i);
      if (monthlyGross < 1) continue;
      // the annualized base (ex-bonus) drives the federal band so December's bonus doesn't jump bands
      const annualBase = baseComp * Math.pow(1.035, Math.floor((i - hireIndex) / 12));
      const fed = fedRate(annualBase);
      const lastDay = daysInMonth(year, monthNo(indexToMonth(i) as Month));
      const halves: Array<{ label: string; day: number }> = [
        { label: "1st half", day: 15 },
        { label: "2nd half", day: lastDay },
      ];
      // split the month's gross across the two pay dates
      const half1 = r2(monthlyGross / 2);
      const half2 = r2(monthlyGross - half1);
      const halfGross = [half1, half2];
      for (let h = 0; h < 2; h++) {
        const gross = halfGross[h];
        // Social Security only on wages up to the annual cap
        const ssTaxable = Math.max(0, Math.min(gross, SS_WAGE_CAP - ssYtd));
        ssYtd += ssTaxable;
        const ss = r2(ssTaxable * SS_RATE);
        const medicare = r2(gross * MEDICARE_RATE);
        const federal = r2(gross * fed);
        const employeeTaxes = r2(ss + medicare + federal);
        const benefits = r2(gross * benefitsPct);
        paychecks.push({
          id: `PC-${indexToMonth(i)}-${(paySeq++).toString().padStart(4, "0")}` as string,
          docNumber: docNum("PAY", i),
          staffId: s.id as StaffId,
          period: indexToMonth(i),
          periodLabel: `${indexToMonth(i)} ${halves[h].label}`,
          date: isoDate(i, halves[h].day),
          grossPay: usd(gross),
          employeeTaxes: usd(employeeTaxes),
          benefits: usd(benefits),
          netPay: usd(r2(gross - employeeTaxes - benefits)),
        });
      }
    }
  }
  const payByMonth = new Array<number>(n).fill(0);
  for (const p of paychecks) payByMonth[monthToIndex(p.period)] += toMajor(p.grossPay);
  const payTie = payByMonth.every((t, i) => within(t, per.series.totalPayroll[i]));
  checks.push({
    label: "Paychecks (gross) roll up to total payroll",
    ok: payTie,
    detail: `${paychecks.length.toLocaleString()} paychecks (per-staff ramped comp via monthlyCompFor) · Σ gross/month === totalPayroll`,
    kind: "independent",
  });

  // ── 3) TIMESHEETS — per project: billable value (= recognized revenue) split into hours × rate;
  //        cost rate is fully-loaded so job-costed margin === the project's services margin ──
  // Realism (2026-06-18 audit): generated MONTH-MAJOR with a per-consultant LOAD LEDGER so the same
  // person isn't booked to many projects at once. Each project's crew is sized to its hours and
  // drawn LEAST-LOADED-FIRST from the active PS team; no (consultant, week) bills more than ~45h
  // and a consultant's monthly total stays near full-time when the team has capacity. Σ (hours ×
  // bill rate) per project-month is UNCHANGED — still === services recognized revenue.
  const timesheets: Timesheet[] = [];
  let tsSeq = 0;
  const psStaff = per.staff
    .filter((s) => s.departmentId === "professional-services")
    .map((s) => ({ id: s.id as StaffId, idx: Math.max(0, monthToIndex(s.startMonth)), comp: toMajor(s.baseComp) }));
  const projById = new Map(svc.projects.map((p) => [p.id as string, p]));
  const jobCost = new Map<string, { revenue: number; cost: number; hours: number }>();
  for (const row of svc.recByProject) jobCost.set(row.projectId, { revenue: 0, cost: 0, hours: 0 });
  // stable per-project bill rate + margin (one draw per project, not per month)
  const projRate = new Map<string, { billRate: number; margin: number }>();
  for (const row of svc.recByProject) {
    const proj = projById.get(row.projectId);
    if (!proj) continue;
    projRate.set(row.projectId, { billRate: 180 + Math.floor(rng() * 40), margin: proj.marginPct as number });
  }
  const WEEKS = 5; // up to 5 week-ending dates a month
  const TARGET_WEEK_HOURS = 30; // mean target used to size the crew (headroom for split/rate variance)
  const HARD_WEEK_HOURS = 45; // no single timesheet row exceeds this many hours
  for (let i = 0; i < n; i++) {
    // consultants active this month + their running load (hours booked so far this month)
    const active = psStaff.filter((s) => s.idx <= i);
    if (active.length === 0) continue;
    const load = new Map<string, number>(active.map((s) => [String(s.id), 0]));
    // process this month's project rows in a stable order
    for (const row of svc.recByProject) {
      const R = row.monthly[i];
      if (R < 1) continue;
      const proj = projById.get(row.projectId);
      if (!proj) continue;
      const { billRate: baseBillRate, margin } = projRate.get(row.projectId)!;
      const jc = jobCost.get(row.projectId)!;
      // crew sized to hit a ~TARGET_WEEK_HOURS mean cell
      const monthHours = R / baseBillRate;
      const needed = Math.max(1, Math.ceil(monthHours / (WEEKS * TARGET_WEEK_HOURS)));
      const crewSize = Math.min(needed, active.length);
      // pick the LEAST-LOADED consultants (ties broken by a deterministic RNG jitter)
      const ranked = active
        .map((s) => ({ s, key: (load.get(String(s.id)) ?? 0) + rng() * 0.001 }))
        .sort((a, b) => a.key - b.key)
        .slice(0, crewSize)
        .map((x) => x.s);
      const crewRates = ranked.map(() => baseBillRate + Math.floor(rng() * 21) - 10); // ±$10
      const valueParts = split(rng, R, crewSize * WEEKS);
      let k = 0;
      for (let ci = 0; ci < ranked.length; ci++) {
        const c = ranked[ci];
        const billRate = Math.max(120, crewRates[ci]);
        // Fully-loaded cost rate around the project's plan margin, with a ±6% per-consultant variance so
        // REALIZED job-cost margin drifts a point or two off plan instead of reconciling to 4 decimals
        // (audit #34). Cost is layer-1 texture — services CoR in the P&L is the assembled driver, not this
        // — so jittering it moves no tie-out (the timesheet reconciliation is on billable VALUE).
        const costRate = r2(billRate * (1 - margin) * (1 + (rng() * 0.12 - 0.06)));
        for (let w = 1; w <= WEEKS; w++) {
          const value = valueParts[k++];
          if (value <= 0) continue;
          const cellHours = value / billRate;
          // HARD CAP: split a heavy cell's VALUE across sub-rows so each row's hours ≤ the cap
          // (value/revenue total identical — only row count grows).
          const subRows = Math.max(1, Math.ceil(cellHours / HARD_WEEK_HOURS));
          const subValues = subRows > 1 ? split(rng, value, subRows) : [value];
          for (let sr = 0; sr < subValues.length; sr++) {
            const v = subValues[sr];
            if (v <= 0) continue;
            const hours = v / billRate;
            const laborCost = r2(hours * costRate);
            const weekDay = Math.min(31, w * 6 + 1 + sr + Math.floor(rng() * 2));
            timesheets.push({
              id: `TS-${indexToMonth(i)}-${(tsSeq++).toString().padStart(5, "0")}` as string,
              docNumber: docNum("TS", i),
              staffId: c.id,
              projectId: proj.id as ProjectId,
              period: indexToMonth(i),
              date: isoDate(i, weekDay),
              weekLabel: `${indexToMonth(i)}-W${w}${subRows > 1 ? `.${sr + 1}` : ""}`,
              hours: Math.round(hours * 10) / 10,
              billRate: usd(billRate),
              costRate: usd(costRate),
              billableValue: usd(v),
              laborCost: usd(laborCost),
            });
            load.set(String(c.id), (load.get(String(c.id)) ?? 0) + hours);
            jc.revenue += v;
            jc.cost += laborCost;
            jc.hours += hours;
          }
        }
      }
    }
  }
  const tsByMonth = new Array<number>(n).fill(0);
  for (const t of timesheets) tsByMonth[monthToIndex(t.period)] += toMajor(t.billableValue);
  const tsTie = tsByMonth.every((t, i) => within(t, svc.series.recognized[i]));
  checks.push({
    label: "Timesheet billable value rolls up to services recognized revenue (WIP driver)",
    ok: tsTie,
    detail: `${timesheets.length.toLocaleString()} timesheets · Σ (hours × bill rate)/month === services recognized`,
    kind: "independent",
  });
  const jobCostByProject: ProjectJobCost[] = svc.recByProject.map((row) => {
    const jc = jobCost.get(row.projectId) ?? { revenue: 0, cost: 0, hours: 0 };
    return {
      projectId: row.projectId as ProjectId,
      revenue: usd(jc.revenue),
      laborCost: usd(jc.cost),
      marginPct: jc.revenue > 0 ? (jc.revenue - jc.cost) / jc.revenue : 0,
      hours: Math.round(jc.hours),
    };
  });

  // ── 4) CUSTOMER INVOICES — subscription billing events + services %-complete (billed in arrears) ──
  // Each invoice now carries a date (subscription = the contract anniversary day; services = a day
  // late in the arrears month), a net-30 due date, a doc number, and open|paid status. Σ per month
  // is UNCHANGED. The invoices are kept in emission order so the FIFO receipt queue can apply true
  // oldest-first.
  // A mutable working record: carries the open balance + a FIFO position so receipts can apply
  // true oldest-first and we can stamp each invoice's final open|paid status after collections.
  interface InvoiceRec {
    id: string;
    docNumber: string;
    customerId: string;
    monthIdx: number;
    date: string;
    dueDate: string;
    amount: number;
    remaining: number;
    remainingAtClose?: number; // snapshot of `remaining` at the close month — drives open|paid + the AR foot
    invoice: CustomerInvoice & { status: "open" | "paid" }; // back-reference for status finalize
  }
  const allInvoiceRecs: InvoiceRec[] = []; // every positive + opening invoice (the global FIFO pool)
  const mutableInvoices: Array<CustomerInvoice & { status: "open" | "paid" }> = [];
  let invSeq = 0;
  // a stable per-contract anniversary day (1–28) so a customer always bills on the same day
  const anniversaryDay = (key: string): number => {
    let h = 0;
    for (let c = 0; c < key.length; c++) h = (h * 31 + key.charCodeAt(c)) % 28;
    return h + 1;
  };
  const pushInvoiceRec = (_customerId: string, rec: InvoiceRec) => {
    allInvoiceRecs.push(rec);
  };
  for (const ev of sub.invoices) {
    const day = anniversaryDay(ev.contractId);
    const date = isoDate(ev.monthIndex, day);
    const dueDate = addDays(date, 30);
    const docNumber = docNum("INV", ev.monthIndex);
    const id = `INV-S-${(invSeq++).toString().padStart(4, "0")}`;
    const invoice: CustomerInvoice & { status: "open" | "paid" } = {
      id,
      docNumber,
      customerId: ev.customerId as CustomerId,
      contractId: ev.contractId as ContractId,
      period: indexToMonth(ev.monthIndex),
      date,
      dueDate,
      // positive invoices finalize from the FIFO queue below; credit memos (refunds, amount <= 0) are
      // contra-AR that settle on issue against the customer balance — they must never read as open A/R.
      status: ev.amount > 0 ? "open" : "paid",
      stream: "subscription",
      kind: ev.kind,
      amount: usd(ev.amount),
    };
    mutableInvoices.push(invoice);
    if (ev.amount > 0) pushInvoiceRec(ev.customerId, { id, docNumber, customerId: ev.customerId, monthIdx: ev.monthIndex, date, dueDate, amount: ev.amount, remaining: ev.amount, invoice });
  }
  for (const row of svc.recByProject) {
    const proj = projById.get(row.projectId);
    if (!proj) continue;
    for (let i = 1; i < n; i++) {
      const amt = row.monthly[i - 1]; // billed in arrears
      if (amt < 1) continue;
      const day = 22 + (anniversaryDay(proj.id as string) % 6); // late-month services bill
      const date = isoDate(i, day);
      const dueDate = addDays(date, 30);
      const docNumber = docNum("INV", i);
      const id = `INV-V-${(invSeq++).toString().padStart(4, "0")}`;
      const invoice: CustomerInvoice & { status: "open" | "paid" } = {
        id,
        docNumber,
        customerId: proj.customerId,
        projectId: proj.id as ProjectId,
        period: indexToMonth(i),
        date,
        dueDate,
        status: "open",
        stream: "services",
        kind: "services_progress",
        amount: usd(amt),
      };
      mutableInvoices.push(invoice);
      pushInvoiceRec(proj.customerId as string, { id, docNumber, customerId: proj.customerId as string, monthIdx: i, date, dueDate, amount: amt, remaining: amt, invoice });
    }
  }
  // ── Opening A/R: the $520K pre-window receivable, as dated opening invoices in the FIFO queue ──
  // Without these the cumulative sub-ledger AR (Σ invoices − Σ receipts) sits a CONSTANT $520K below
  // the formula BS AR — the opening balance lives in collections (via ΔAR off bs.opening) but had no
  // invoice to clear — so an AR-aging drill never foots to the Balance Sheet. Allocate it across the
  // customers active at window start (∝ their first-month billing), dated just before the window so
  // true-FIFO collects them FIRST (they clear early — no implausibly-stale opening receivable).
  const m0Billing = new Map<string, number>();
  for (const rec of allInvoiceRecs) if (rec.monthIdx === 0) m0Billing.set(rec.customerId, (m0Billing.get(rec.customerId) ?? 0) + rec.amount);
  const m0Total = [...m0Billing.values()].reduce((a, b) => a + b, 0);
  const openingAr = bs.opening.accountsReceivable;
  if (m0Total > 0 && openingAr > 0) {
    const entries = [...m0Billing.entries()];
    let alloc = 0;
    entries.forEach(([cust, amt], k) => {
      const share = k === entries.length - 1 ? r2(openingAr - alloc) : r2((openingAr * amt) / m0Total);
      alloc = r2(alloc + share);
      if (share <= 0) return;
      const id = `INV-OB-${(invSeq++).toString().padStart(4, "0")}`;
      // Spread the opening receivable across late 2023 (pre-window) with a real INV-2023 doc series that
      // precedes every 2024 invoice — not all one day with a self-equal doc# (audit #17). monthIdx stays
      // 0 so true-FIFO still collects them FIRST (their 2023 dates sort ahead of all 2024 invoices).
      const obMonthNo = 7 + (k % 6); // 2023-07 .. 2023-12
      const obDay = 8 + ((k * 5) % 18); // 8..25
      const obDate = `2023-${obMonthNo.toString().padStart(2, "0")}-${obDay.toString().padStart(2, "0")}`;
      const obDue = addDays(obDate, 30);
      const docNumber = `INV-2023-${(k + 1).toString().padStart(4, "0")}`;
      const invoice: CustomerInvoice & { status: "open" | "paid" } = {
        id,
        docNumber,
        customerId: cust as CustomerId,
        period: month(2023, obMonthNo),
        date: obDate,
        dueDate: obDue,
        status: "open",
        stream: "subscription",
        kind: "opening_balance",
        amount: usd(share),
      };
      mutableInvoices.push(invoice);
      pushInvoiceRec(cust, { id, docNumber, customerId: cust, monthIdx: 0, date: obDate, dueDate: obDue, amount: share, remaining: share, invoice });
    });
  }

  const subInvByMonth = new Array<number>(n).fill(0);
  const svcInvByMonth = new Array<number>(n).fill(0);
  for (const iv of mutableInvoices) {
    if (iv.kind === "opening_balance") continue; // pre-window opening A/R — not an in-window billing event
    if (iv.stream === "subscription") subInvByMonth[monthToIndex(iv.period)] += toMajor(iv.amount);
    else svcInvByMonth[monthToIndex(iv.period)] += toMajor(iv.amount);
  }
  checks.push({
    label: "Subscription invoices roll up to subscription billings",
    ok: subInvByMonth.every((t, i) => within(t, sub.series.billings[i])),
    detail: `Σ subscription invoices/month === series.billings (emitted from the billing events)`,
    kind: "independent",
  });
  checks.push({
    label: "Services invoices roll up to services billed",
    ok: svcInvByMonth.every((t, i) => within(t, svc.series.billed[i])),
    detail: `Σ services invoices/month === series.billed (%-complete in arrears)`,
    kind: "independent",
  });

  // ── 5) CASH RECEIPTS — monthly collections (billings − ΔAR) applied GLOBAL oldest-first, in FULL ──
  // Bearing is annual-prepay: a customer settles an invoice in a LUMP (~DSO days after issue), not as a
  // long monthly drip. So each month's collection clears the GLOBALLY-oldest open invoices in FULL,
  // oldest-first (one receipt per invoice; at most one partial at the budget boundary). Old invoices
  // clear before newer ones get touched — the AR aging concentrates in current/30/60 with a thin 90+
  // tail, instead of a proportional sliver dripping every annual invoice down for ~28 months (a 45-day-
  // DSO book reading a third 90+ delinquent — the 2026-06-19 review's #1 credibility hole). Σ receipts/
  // month is UNCHANGED (=== collections); Σ open balances at close still foot to the formula BS AR.
  const cashReceipts: CashReceipt[] = [];
  let rcSeq = 0;
  const collectionsByMonth = new Array<number>(n).fill(0);
  // one global queue of all (positive + opening) invoices, oldest-first by date; a single cursor walks
  // it forward as each invoice clears (a partial keeps the cursor, so it always points at the oldest open).
  // sort by issue month FIRST, then date — so the `monthIdx > i` break is robust even if an invoice's
  // calendar date ever lands outside its monthIdx month (billing-date jitter), not just by emergent luck.
  const globalQueue = allInvoiceRecs.slice().sort((a, b) => a.monthIdx - b.monthIdx || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let gCursor = 0;
  for (let i = 0; i < n; i++) {
    // snapshot each invoice's open balance as it stood at the END of the close month (start of the
    // first post-close month) — robust to any month that `continue`s; drives status + the AR-to-BS foot.
    if (i === CLOSE_IDX + 1) for (const rec of allInvoiceRecs) rec.remainingAtClose = rec.remaining;
    const totalBillings = sub.series.billings[i] + svc.series.billed[i];
    const prevAr = i === 0 ? bs.opening.accountsReceivable : bs.series.accountsReceivable[i - 1];
    const dAr = bs.series.accountsReceivable[i] - prevAr;
    const collections = totalBillings - dAr;
    collectionsByMonth[i] = collections;
    if (collections <= 0) continue;
    // pay the globally-oldest COLLECTIBLE (issued ≤ i) open invoices in full, oldest-first, until this
    // month's budget is spent. The queue is date-sorted, so issued-≤-i invoices sit at the front; stop
    // at the first not-yet-issued one. collections ≤ Σ outstanding by construction, so the budget always
    // lands on a collectible invoice (no leak; any sub-cent remainder is absorbed by the ±$1 roll-up tol).
    let budget = collections;
    while (budget > 0.005 && gCursor < globalQueue.length) {
      const inv = globalQueue[gCursor];
      if (inv.monthIdx > i) break; // oldest open invoice isn't issued yet — wait for a later month
      if (inv.remaining <= 0.005) { gCursor++; continue; }
      const applied = r2(Math.min(budget, inv.remaining));
      inv.remaining = r2(inv.remaining - applied);
      budget = r2(budget - applied);
      // receipt date: lagged off the invoice date by a PER-CUSTOMER offset around DSO (some pay
      // net-30, some stretch to ~60), but kept inside THIS collection month (audit #18).
      const lagged = addDays(inv.date, custLag(inv.customerId as string));
      const day = monthToIndex(parseLooseMonth(lagged)) === i ? Number(lagged.slice(8, 10)) : 10 + Math.floor(rng() * 15);
      cashReceipts.push({
        id: `RC-${indexToMonth(i)}-${(rcSeq++).toString().padStart(4, "0")}` as string,
        docNumber: docNum("RC", i),
        customerId: inv.customerId as CustomerId,
        period: indexToMonth(i),
        date: isoDate(i, day),
        appliedInvoiceId: inv.id,
        appliedDocNumber: inv.docNumber,
        amount: usd(applied),
      });
      if (inv.remaining <= 0.005) gCursor++;
    }
    // the budget should always land on a collectible invoice (collections ≤ Σ outstanding); a material
    // leftover means a future calibration pushed a month's collections above the issued pool — fail loud.
    if (budget > 1) throw new Error(`collections exceed collectible invoices in ${indexToMonth(i)}: ${r2(budget)} unapplied`);
  }
  const rcByMonth = new Array<number>(n).fill(0);
  for (const r of cashReceipts) rcByMonth[monthToIndex(r.period)] += toMajor(r.amount);
  const rcTie = rcByMonth.every((t, i) => within(t, collectionsByMonth[i]));
  const distinctApplied = new Set(cashReceipts.map((r) => r.appliedInvoiceId).filter(Boolean)).size;
  checks.push({
    label: "Cash receipts roll up to collections (billings − ΔAR)",
    ok: rcTie,
    detail: `${cashReceipts.length.toLocaleString()} receipts → ${distinctApplied.toLocaleString()} distinct invoices (global oldest-first) · Σ/month === collections`,
    kind: "independent",
  });

  // finalize each invoice's open|paid status from its balance AT THE CLOSE: an actuals invoice is paid
  // iff fully collected by the close; anything still outstanding (or issued in a forecast month) is open.
  for (const rec of allInvoiceRecs) {
    const atClose = rec.remainingAtClose ?? rec.remaining;
    rec.invoice.status = rec.monthIdx <= CLOSE_IDX && atClose <= 0.005 ? "paid" : "open";
  }
  // AR sub-ledger foots to the Balance Sheet: Σ open invoice balances as-of close === the formula BS AR
  // (the drill a CFO runs — the AR aging must tie to the statement line). True by construction now that
  // the opening A/R is represented in the queue; would silently break if that injection regressed.
  // Net sub-ledger AR = open positive invoice balances at close MINUS the credit memos issued through
  // close. Credit memos (refunds) are contra-AR: they lower net billings/collections, so the positive
  // invoices alone are under-collected by exactly the refund total — netting them recovers the BS AR.
  const openPositives = allInvoiceRecs
    .filter((rec) => rec.monthIdx <= CLOSE_IDX)
    .reduce((s, rec) => s + (rec.remainingAtClose ?? rec.remaining), 0);
  const creditMemos = mutableInvoices
    .filter((iv) => iv.kind === "refund" && monthToIndex(iv.period) <= CLOSE_IDX)
    .reduce((s, iv) => s + toMajor(iv.amount), 0); // negative
  const subledgerAr = openPositives + creditMemos;
  const formulaAr = bs.series.accountsReceivable[CLOSE_IDX];
  checks.push({
    label: "AR sub-ledger foots to the BS (Σ open invoices as-of close === BS AR)",
    ok: within(subledgerAr, formulaAr),
    detail: `Σ open invoice balances ${Math.round(subledgerAr).toLocaleString()} === BS AR ${Math.round(formulaAr).toLocaleString()} @ ${CLOSE_THROUGH}`,
    kind: "independent",
  });
  const customerInvoices: readonly CustomerInvoice[] = mutableInvoices;

  return { vendorBills, paychecks, timesheets, customerInvoices, cashReceipts, jobCostByProject, checks };
}

/** Parse a "YYYY-MM-DD" back to its Month (used to test whether a DSO-lagged receipt date stays
 *  inside the same collection month). */
function parseLooseMonth(iso: string): Month {
  return iso.slice(0, 7) as Month;
}
