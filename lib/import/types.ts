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

/** A single (account, period) reconciliation outcome — imported TB movement vs generator GL activity. */
export interface ReconFinding {
  readonly accountCode: string;
  readonly accountName: string;
  readonly period: Month;
  /** the imported TB figure (natural-balance: P&L = FYTD activity, BS = period-end balance) */
  readonly tbAmount: number;
  /** what the generator's GL says it should be (the "detail") */
  readonly detailAmount: number;
  readonly gap: number; // signed: tb − detail
  readonly reconciled: boolean; // |gap| <= threshold
}

export interface ReconResult {
  readonly reconciled: boolean; // every finding within threshold
  readonly findings: readonly ReconFinding[];
  /** the Σ|gap| of the unreconciled findings (the §16 "needs attention" dollar total) */
  readonly unreconciledTotal: number;
}
