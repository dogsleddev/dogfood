/**
 * Flux Analysis notes (CLAUDE.md §16/§17; flux-analysis.md) — the first user-WRITE surface.
 * A note is a Dogfood-native write pinned by a STABLE anchor to immutable ERP data (transaction id,
 * or trial-balance account+period, or statement-line+period), the same delta-off-Base pattern as
 * scenario_inputs — so it survives re-import. Notes are a multi-author comment thread per anchor.
 */
import type { Money } from "./money";
import type { Month } from "./period";
import type { StatementLineId } from "./common";

export type FluxNoteSource = "ui" | "scout";

/** The thing a note explains — exactly one grain (most specific available wins at write time). */
export interface FluxNoteAnchor {
  /** sub-ledger / CSV transaction id (grain 1 — a specific bill) */
  readonly transactionId?: string;
  /** ERP chart-of-accounts code (grain 2 — the trial-balance account) */
  readonly accountCode?: string;
  /** statement line / pure computed metric (grain 3 — multi-account lines & metrics) */
  readonly statementLine?: StatementLineId | string;
  /** the period the note explains (required for the account / line grains) */
  readonly period?: Month;
}

export interface FluxNote {
  readonly id: string;
  readonly transactionId?: string;
  readonly accountCode?: string;
  /** denormalized roll-up axis (derived via Account Mapping at write) — present on every note */
  readonly statementLine?: string;
  readonly period?: Month;
  readonly author: string;
  readonly body: string;
  /** the variance figure snapshotted when the note was written (flux-on-the-flux after restatement) */
  readonly amountAtNote?: Money;
  readonly resolved: boolean;
  readonly source: FluxNoteSource;
  readonly createdAt: string; // ISO timestamp
  readonly updatedAt: string;
}

/** A new note to persist (the DataStore fills id / created_at / updated_at). */
export interface NewFluxNote {
  readonly transactionId?: string;
  readonly accountCode?: string;
  readonly statementLine?: string;
  readonly period?: Month;
  readonly author: string;
  readonly body: string;
  readonly amountAtNote?: Money;
  readonly source: FluxNoteSource;
  readonly resolved?: boolean;
}

/** Read filter — any subset; AND semantics across the provided keys. */
export interface FluxNoteFilter {
  readonly transactionId?: string;
  readonly accountCode?: string;
  readonly statementLine?: string;
  readonly period?: Month;
}
