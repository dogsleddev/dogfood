/**
 * Flux Analysis notes — the first user-WRITE path on the spine (flux-analysis.md; CLAUDE.md §16/§17).
 * One source, two callers: the register UI today, Scout later. Reads/writes route through the
 * DataStore seam (in-memory now, Supabase when `DATASTORE=supabase`). A note is a delta off immutable
 * ERP data, pinned by a stable anchor — never an edit to the actuals.
 */
import { getDataStore } from "@/lib/datastore";
import { getPnLLine } from "./statements";
import { listExpenseTransactions } from "./reporting";
import type { Month } from "@/lib/types/period";
import type { Money } from "@/lib/types/money";
import type { PnLLineId } from "@/lib/types/statements";
import type { FluxNote, FluxNoteAnchor, FluxNoteSource, FluxNoteFilter } from "@/lib/types/flux";

/** Trusted single-tenant: one user (the nav footer's "Chris · CFO"). Swap for an auth lookup at login. */
export function getCurrentUser(): string {
  return "Chris";
}

export async function listFluxNotes(filter: FluxNoteFilter = {}): Promise<readonly FluxNote[]> {
  return getDataStore().listFluxNotes(filter);
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
  /** the line's columns from the P&L (undefined if `statementLine` isn't a P&L line) */
  readonly line: { readonly label: string; readonly actual?: Money; readonly forecast?: Money; readonly budget?: Money; readonly variance?: Money };
  /** the actual transactions composing the line this period, largest first — what to write the note from */
  readonly transactions: readonly FluxDetailTxn[];
}

/**
 * The variance decomposition for a statement line: the line's Actual / Forecast / Budget / Variance
 * (from the P&L) plus the actual transactions that compose it (the bills on the accounts mapping to
 * the line, largest first). Composes existing spine reads — no new data path. Pairs with getFluxNotes:
 * the notes explain *why*, this shows the numbers *behind* it (so a reviewer can write the note).
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
    const pl = await getPnLLine(statementLine as PnLLineId, period);
    line = { label: pl.label, actual: pl.values.actual, forecast: pl.values.forecast, budget: pl.values.budget, variance: pl.values.variance };
  } catch {
    // statementLine may be an account-only grain or not a P&L line — leave the totals undefined.
  }
  return { statementLine, period, line, transactions };
}

export async function resolveFluxNote(id: string, resolved: boolean): Promise<void> {
  return getDataStore().setFluxNoteResolved(id, resolved);
}

export async function deleteFluxNote(id: string): Promise<void> {
  return getDataStore().deleteFluxNote(id);
}
