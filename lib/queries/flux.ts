/**
 * Flux Analysis notes — the first user-WRITE path on the spine (flux-analysis.md; CLAUDE.md §16/§17).
 * One source, two callers: the register UI today, Scout later. Reads/writes route through the
 * DataStore seam (in-memory now, Supabase when `DATASTORE=supabase`). A note is a delta off immutable
 * ERP data, pinned by a stable anchor — never an edit to the actuals.
 */
import { getDataStore } from "@/lib/datastore";
import { getPnLLine, getMonthlyPnL } from "./statements";
import { listExpenseTransactions } from "./reporting";
import { compareMonth, type Month } from "@/lib/types/period";
import type { Money } from "@/lib/types/money";
import type { PnLLineId, MonthStatus } from "@/lib/types/statements";
import type { FluxNote, FluxNoteAnchor, FluxNoteSource, FluxNoteFilter } from "@/lib/types/flux";

/** Trusted single-tenant: one user (the nav footer's "Max · Chief Barking Officer"). Swap for an auth lookup at login. */
export function getCurrentUser(): string {
  return "Max";
}

export async function listFluxNotes(filter: FluxNoteFilter = {}): Promise<readonly FluxNote[]> {
  const ds = getDataStore();
  // F4: when filtering by statement line, resolve each account/transaction-anchored note's EFFECTIVE
  // line from the CURRENT Account Mapping (chart ⊕ overrides) rather than the line denormalized at
  // write time — a re-point must move the note to its new line on the statement peek pane. Notes
  // anchored directly to a line (grain 3, no account) keep their stored line; it can't go stale.
  if (filter.statementLine !== undefined) {
    const { statementLine: wantLine, ...rest } = filter;
    const notes = await ds.listFluxNotes(rest);
    if (notes.length === 0) return notes;
    const lineByCode = new Map(
      (await ds.listGlAccounts()).map((g) => [g.code, g.statementLineId as string]),
    );
    return notes.filter((n) => {
      const effective = n.accountCode ? lineByCode.get(n.accountCode) ?? n.statementLine : n.statementLine;
      return effective === wantLine;
    });
  }
  return ds.listFluxNotes(filter);
}

/**
 * Add a note. Resolves the author (current user by default) and DENORMALIZES the roll-up axis: for a
 * transaction anchor it derives the account code, period, and amount-at-note from the bill, and the
 * statement line from Account Mapping — so the note rolls up to its line wherever it's read. Fails loud
 * if the anchor resolves to none of the three grains.
 */
export async function addFluxNote(input: {
  readonly anchor: FluxNoteAnchor;
  readonly body: string;
  readonly author?: string;
  readonly source?: FluxNoteSource;
  readonly resolved?: boolean;
}): Promise<FluxNote> {
  const ds = getDataStore();
  const body = input.body.trim();
  if (!body) throw new Error("addFluxNote: a note body is required");

  const a = input.anchor;
  let accountCode = a.accountCode;
  let statementLine = a.statementLine as string | undefined;
  let period: Month | undefined = a.period;
  let amountAtNote: Money | undefined;

  if (a.transactionId) {
    const bill = (await ds.listExpenseTransactions()).find((b) => b.id === a.transactionId);
    if (!bill) throw new Error(`addFluxNote: no transaction "${a.transactionId}"`);
    accountCode = accountCode ?? (bill.glAccountId as string);
    period = period ?? bill.period;
    amountAtNote = bill.amount;
  }
  // Denormalize the statement line from the account (the single roll-up axis), where we have one.
  if (!statementLine && accountCode) {
    const acct = (await ds.listGlAccounts()).find((g) => g.code === accountCode);
    statementLine = acct?.statementLineId as string | undefined;
  }

  const anchored = !!a.transactionId || (!!accountCode && !!period) || (!!statementLine && !!period);
  if (!anchored) {
    throw new Error("addFluxNote: a note must anchor to a transaction, an account + period, or a line + period");
  }

  return ds.addFluxNote({
    transactionId: a.transactionId,
    accountCode,
    statementLine,
    period,
    author: input.author ?? getCurrentUser(),
    body,
    amountAtNote,
    source: input.source ?? "ui",
    resolved: input.resolved ?? false,
  });
}

// ── Flux decomposition (the budget-vs-actual table — the sibling of getFluxNotes; flux-analysis.md) ──

export interface FluxDetailTxn {
  readonly transactionId: string;
  readonly vendor: string;
  readonly accountCode: string;
  readonly amount: Money;
}
export interface FluxDetail {
  readonly statementLine: string;
  readonly period: Month;
  readonly line: {
    readonly label: string;
    /**
     * THIS month's actual for the line — the figure that ties to `transactions` (same period). For a
     * closed month it rolls up from the GL, so for a vendor-bill-backed line it equals Σ `transactions`
     * (the tie-out). undefined if `statementLine` isn't a P&L line.
     */
    readonly monthActual?: Money;
    /** closed (actual) / in_close / forecast — so a reader knows whether `monthActual` is a real actual. */
    readonly periodStatus?: MonthStatus;
    /** full-year P&L context for the line (NOT this month): the FY Actual / Forecast / Budget / Variance. */
    readonly fullYear?: { readonly actual?: Money; readonly forecast?: Money; readonly budget?: Money; readonly variance?: Money };
  };
  /** the actual transactions composing the line this period, largest first — what to write the note from */
  readonly transactions: readonly FluxDetailTxn[];
}

/**
 * The variance decomposition for a statement line: THIS month's actual for the line (the figure that
 * ties to the transactions below) + the full-year P&L context + the actual transactions composing the
 * line this period (the bills on the accounts mapping to the line, largest first). Composes existing
 * spine reads — no new data path. Pairs with getFluxNotes: the notes explain *why*, this shows the
 * numbers *behind* it (so a reviewer can write the note).
 *
 * Grain note (the tie-out): `transactions` are month-grain (this `period`), so the headline figure is
 * `line.monthActual` — the line's cell for THIS month from the monthly P&L (closed months roll up from
 * the GL → a vendor-bill-backed line's month actual === Σ its bills). The FY columns live under
 * `line.fullYear`, explicitly labeled, so an FY total is never shown as if it were the month's.
 */
export async function getFluxDetail(statementLine: string, period: Month): Promise<FluxDetail> {
  const ds = getDataStore();
  const codes = new Set((await ds.listGlAccounts()).filter((a) => (a.statementLineId as string) === statementLine).map((a) => a.code));
  const bills = (await listExpenseTransactions({ period })).filter((b) => codes.has(b.glAccountId as string));
  const transactions: FluxDetailTxn[] = [...bills]
    .sort((a, b) => b.amount.minor - a.amount.minor)
    .map((b) => ({ transactionId: b.id as string, vendor: b.vendor ?? "—", accountCode: b.glAccountId as string, amount: b.amount }));

  let line: FluxDetail["line"] = { label: statementLine };
  try {
    const fy = await getPnLLine(statementLine as PnLLineId, period); // FY columns + the canonical label
    // The MONTH actual (what ties to `transactions`) is the line's cell for this month in the monthly P&L.
    const monthly = await getMonthlyPnL(period);
    const idx = monthly.months.findIndex((c) => compareMonth(c.month, period) === 0);
    const ml = monthly.lines.find((l) => (l.id as string) === statementLine);
    line = {
      label: fy.label,
      monthActual: idx >= 0 && ml ? ml.monthly[idx] : undefined,
      periodStatus: idx >= 0 ? monthly.months[idx].status : undefined,
      fullYear: { actual: fy.values.actual, forecast: fy.values.forecast, budget: fy.values.budget, variance: fy.values.variance },
    };
  } catch {
    // statementLine may be an account-only grain or not a P&L line — leave the figures undefined.
  }
  return { statementLine, period, line, transactions };
}

export async function resolveFluxNote(id: string, resolved: boolean): Promise<void> {
  return getDataStore().setFluxNoteResolved(id, resolved);
}

export async function deleteFluxNote(id: string): Promise<void> {
  return getDataStore().deleteFluxNote(id);
}
