/**
 * The detail-to-TB RECONCILIATION control total (CLAUDE.md §16; import-templates/README.md
 * "Reconciliation"). The trial balance is the single source of truth for the statements' Actual; this
 * is the back-check that the DETAIL (the sub-ledger a CFO drills into) actually explains it: for each
 * account that has a sub-ledger, Σ(detail for the account, period) === the TB figure, within a
 * materiality threshold. A gap over threshold is a BLOCKING "needs attention" flag — never a plug,
 * fix-upstream (§16). Accounts with no sub-ledger are TB-ONLY (authoritative; they can never throw a
 * false variance — this sidesteps the derived-equity / closing-entry trap).
 *
 * Pure + deterministic: reads the generator sub-ledger + GL directly (like every gate + statement
 * builder), so it is identical on both the in-memory and Supabase backends (the statements are
 * generator-computed on both; the sub-ledger is parity-exact). The reconcile math is at the ACCOUNT
 * grain (code → code), independent of any Account-Mapping re-point — only `statementLineId` (used to
 * roll the control total up to a statement line for display) reads the effective map.
 */
import { CHART_OF_ACCOUNTS, accountTrialBalanceAt } from "@/lib/seed/gl";
import { getTransactionsSeed } from "@/lib/seed/transactions";
import { getPersonnelSeed } from "@/lib/seed";
import { monthToIndex, fyStartIndex, type Month } from "@/lib/types/period";
import { toMajor } from "@/lib/types/money";
import type { GlAccount } from "@/lib/types/source";
import type { ReconFinding, ReconResult, TbOnlyAccount } from "./types";

// Vendor bills post to their group account (non-employee CoR + the 8 OpEx group accounts).
const VENDOR_BILL_ACCOUNTS: ReadonlySet<string> = new Set(["5100", "6100", "6200", "6300", "6400", "6500", "6600", "6700", "6800"]);

/**
 * The accounts that carry a transaction SUB-LEDGER we can independently re-derive and reconcile UP to
 * the TB. Everything else (cash, prepaid, fixed assets, ROU, deferred revenue, AP, equity, D&A, SBC,
 * interest, tax, AND subscription revenue — recognized ratably from the deferred waterfall, no
 * per-transaction recognition event) is TB-ONLY (§16).
 *   vendor bills        → their posting account (5100 + the 8 OpEx group accounts)
 *   paychecks           → 5000 (Direct, function 'direct') / 6000 (Indirect, the rest)
 *   timesheets          → 4100 services revenue (billable value === recognized)
 *   invoices − receipts → 1100 AR (the billings/collections that move the receivable; cumulative)
 */
export const DETAILED_ACCOUNTS: ReadonlySet<string> = new Set(["1100", "4100", "5000", "6000", ...VENDOR_BILL_ACCOUNTS]);

/** Materiality: a gap under max($1, 0.1%·|line|) is reconciled (the §16 / Handoff threshold). */
export const reconThreshold = (lineAmount: number): number => Math.max(1, Math.abs(lineAmount) * 0.001);

/**
 * Σ the sub-ledger detail per detailed account at `period`, in NATURAL balance to match the TB:
 * P&L accounts FYTD (Σ over [fyStart..period]); the AR balance cumulatively (Σ all invoices − Σ all
 * receipts through `period`, which includes the pre-window opening invoices + credit memos, so it foots
 * to the receivable balance). Reads the generator sub-ledger.
 */
export function detailByAccount(period: Month): Map<string, number> {
  const tx = getTransactionsSeed();
  const directIds = new Set(getPersonnelSeed().staff.filter((s) => s.function === "direct").map((s) => String(s.id)));
  const i = monthToIndex(period);
  const fy0 = fyStartIndex(period);
  const inFy = (p: Month) => {
    const k = monthToIndex(p);
    return k >= fy0 && k <= i;
  };
  const upTo = (p: Month) => monthToIndex(p) <= i;

  const d = new Map<string, number>();
  for (const code of DETAILED_ACCOUNTS) d.set(code, 0); // present even at $0, so a missing detail reads as a gap
  const add = (code: string, v: number) => d.set(code, (d.get(code) ?? 0) + v);

  // vendor bills → their posting account, FYTD (the opening AP bill is pre-window → never in any FY)
  for (const b of tx.vendorBills) {
    const code = String(b.glAccountId);
    if (VENDOR_BILL_ACCOUNTS.has(code) && inFy(b.period)) add(code, toMajor(b.amount));
  }
  // paychecks → Direct / Indirect payroll, FYTD
  for (const p of tx.paychecks) if (inFy(p.period)) add(directIds.has(String(p.staffId)) ? "5000" : "6000", toMajor(p.grossPay));
  // timesheets → services recognized revenue, FYTD
  for (const t of tx.timesheets) if (inFy(t.period)) add("4100", toMajor(t.billableValue));
  // AR = Σ invoices − Σ receipts, cumulative (incl. opening invoices + negative credit memos)
  for (const v of tx.customerInvoices) if (upTo(v.period)) add("1100", toMajor(v.amount));
  for (const r of tx.cashReceipts) if (upTo(r.period)) add("1100", -toMajor(r.amount));
  return d;
}

/**
 * Reconcile the sub-ledger detail UP to a trial balance, per account at `period`. `tbByCode` is the TB
 * side in natural balance — the IMPORTED TB for an upload, or the seed's own `accountTrialBalanceAt`
 * for the standing control total. Detailed accounts yield a ReconFinding (TB vs Σdetail, signed gap,
 * reconciled iff |gap| ≤ threshold); TB-only accounts are returned as authoritative. Never plugs (§16).
 * `accounts` carries the EFFECTIVE Account Mapping (chart ⊕ overrides) for the statement-line roll-up.
 */
export function reconcile(
  period: Month,
  tbByCode: Map<string, number>,
  accounts: readonly GlAccount[] = CHART_OF_ACCOUNTS,
): ReconResult {
  const detail = detailByAccount(period);
  const findings: ReconFinding[] = [];
  const tbOnly: TbOnlyAccount[] = [];
  let unreconciledTotal = 0;
  for (const a of accounts) {
    const tbAmount = tbByCode.get(a.code) ?? 0;
    if (!DETAILED_ACCOUNTS.has(a.code)) {
      tbOnly.push({ accountCode: a.code, accountName: a.name, statementLineId: a.statementLineId, tbAmount });
      continue;
    }
    const detailAmount = detail.get(a.code) ?? 0;
    const gap = tbAmount - detailAmount;
    const threshold = reconThreshold(tbAmount);
    const reconciled = Math.abs(gap) <= threshold;
    if (!reconciled) unreconciledTotal += Math.abs(gap);
    findings.push({ accountCode: a.code, accountName: a.name, statementLineId: a.statementLineId, period, tbAmount, detailAmount, gap, threshold, reconciled });
  }
  return { period, reconciled: findings.every((f) => f.reconciled), findings, tbOnly, unreconciledTotal };
}

/** The standing reconciliation control total over the seed's OWN books (TB = the GL trial balance). */
export function reconcileSeedBooks(period: Month, accounts: readonly GlAccount[] = CHART_OF_ACCOUNTS): ReconResult {
  return reconcile(period, accountTrialBalanceAt(period, accounts), accounts);
}
