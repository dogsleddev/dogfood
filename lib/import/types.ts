/**
 * CSV importer types (CLAUDE.md §16; import-templates/README.md). The importer parses an ERP export,
 * VALIDATES it (TB balances, known + mapped accounts), RECONCILES the imported summary against the
 * generator's GL activity per (account, period), and — on a clean new-month trial balance — advances
 * the global as-of. It never overlays imported numbers onto the deterministic engine (the statements
 * stay generator-truth); a contradicting import is a blocking "needs attention" flag, fixed upstream.
 */
import type { Month } from "@/lib/types/period";

export type ImportKind = "trial_balance" | "chart_of_accounts";

/** One parsed trial-balance row (raw, pre-validation; amounts in major dollars). */
export interface TbRow {
  readonly period: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly debit: number;
  readonly credit: number;
}

export interface ParsedTrialBalance {
  readonly rows: readonly TbRow[];
}

export type ImportIssueCode =
  | "bad_header"
  | "unbalanced_period" // Σdebit !== Σcredit for a period (the hard gate)
  | "unknown_account" // a code not in the chart of accounts
  | "unmapped_account" // a known account with no statement line
  | "both_sides_nonzero" // debit AND credit non-zero on one row
  | "bad_amount" // a non-numeric debit/credit
  | "duplicate_row" // two rows for the same (period, account)
  | "bad_period_format"
  | "past_horizon"; // a period beyond the seed horizon (no generator data)

export interface ImportIssue {
  readonly code: ImportIssueCode;
  readonly message: string;
  readonly period?: string;
  readonly accountCode?: string;
}

/** Per-period footing (the Σdebit === Σcredit gate). */
export interface PeriodFooting {
  readonly period: string;
  readonly debit: number;
  readonly credit: number;
  readonly balanced: boolean;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ImportIssue[];
  /** the distinct periods present, sorted */
  readonly periods: readonly string[];
  readonly footing: readonly PeriodFooting[];
}

/** A single (account, period) reconciliation outcome — TB figure vs the sub-ledger detail it should explain. */
export interface ReconFinding {
  readonly accountCode: string;
  readonly accountName: string;
  /** the statement line the account maps to (the EFFECTIVE map), for rolling the control total up to a line */
  readonly statementLineId: string;
  readonly period: Month;
  /** the TB figure (natural-balance: P&L = FYTD activity, BS = period-end balance) */
  readonly tbAmount: number;
  /** what the sub-ledger detail sums to (the independent re-derivation) */
  readonly detailAmount: number;
  readonly gap: number; // signed: tb − detail
  /** the materiality threshold for this line: max($1, 0.1%·|tbAmount|) */
  readonly threshold: number;
  readonly reconciled: boolean; // |gap| <= threshold
}

/** A TB account with NO sub-ledger to reconcile up — authoritative from the TB (§16; never false-flagged). */
export interface TbOnlyAccount {
  readonly accountCode: string;
  readonly accountName: string;
  readonly statementLineId: string;
  readonly tbAmount: number;
}

export interface ReconResult {
  readonly period: Month;
  readonly reconciled: boolean; // every detailed finding within threshold
  readonly findings: readonly ReconFinding[];
  /** accounts with no sub-ledger (equity, D&A, SBC, deferred, cash, …) — authoritative, not reconciled */
  readonly tbOnly: readonly TbOnlyAccount[];
  /** the Σ|gap| of the unreconciled findings (the §16 "needs attention" dollar total) */
  readonly unreconciledTotal: number;
}

/** An audit row for a committed import run (the §16 import history; persisted in `import_runs`). */
export interface ImportRun {
  readonly id: string;
  readonly kind: ImportKind;
  readonly period: string;
  /** "reconciled" (clean), "needs_attention" (an unreconciled gap), or "rejected" (validation failed) */
  readonly status: "reconciled" | "needs_attention" | "rejected";
  /** whether this run advanced the global as-of (a clean new in-close month) */
  readonly advancedAsOf: boolean;
  readonly unreconciledTotal: number;
  readonly note: string;
  readonly createdAt: string;
}

/** A new import-run audit row (the store stamps `id` + `createdAt`). */
export type NewImportRun = Omit<ImportRun, "id" | "createdAt">;
