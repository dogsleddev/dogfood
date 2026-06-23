/**
 * The CSV importer orchestrator (CLAUDE.md §16; import-templates/README.md) — the query-spine entry
 * point for Setup → Data Import. Two surfaces:
 *
 *   getReconciliation(period)    — the STANDING reconciliation control total: for each account WITH a
 *                                  sub-ledger, the TB figure vs Σ(detail), green when it ties. This is
 *                                  the always-on proof the books reconcile (the Loom centerpiece).
 *   runTrialBalanceImport(csv)   — the new-month flow: parse → validate → reconcile against the imported
 *                                  TB → if clean AND it's the next in-close month, advance the global
 *                                  as-of (commit). A gap is a BLOCKING "needs attention" flag, never a
 *                                  plug, fix-upstream (§16). Every run is recorded in import_runs.
 *
 * Reads through the DataStore (works on both backends); the reconcile + TB math read the generator
 * (statements are generator-computed on both, so the books are identical).
 */
import { getDataStore } from "@/lib/datastore";
import type { AppSettings } from "@/lib/datastore";
import { parseTrialBalanceCsv, validateTrialBalance } from "@/lib/import/validate";
import { reconcile, reconcileSeedBooks } from "@/lib/import/reconcile";
import { isDebitNormal } from "@/lib/seed/gl";
import { month, monthToIndex, type Month } from "@/lib/types/period";
import type { ValidationResult, ReconResult, ImportRun } from "@/lib/import/types";

/** The seed has GL activity through Dec 2026 — an imported period past it has no detail to reconcile. */
const HORIZON_END = month(2026, 12);

/** The standing reconciliation control total over the seed's own books at `period` (default: the close). */
export async function getReconciliation(period?: Month): Promise<ReconResult> {
  const store = getDataStore();
  const settings = await store.getSettings(); // read-repairs the as-of on Supabase
  const accounts = await store.listGlAccounts(); // EFFECTIVE map (for the statement-line roll-up)
  return reconcileSeedBooks(period ?? settings.closeThrough, accounts);
}

export async function listImportRuns(): Promise<readonly ImportRun[]> {
  return getDataStore().listImportRuns();
}

/** Everything the Setup → Data Import surface renders, in one read-repaired call. */
export async function getDataImportView(period?: Month): Promise<{
  settings: AppSettings;
  reconciliation: ReconResult;
  runs: readonly ImportRun[];
}> {
  const store = getDataStore();
  const settings = await store.getSettings(); // read-repairs the as-of on Supabase
  const [accounts, runs] = await Promise.all([store.listGlAccounts(), store.listImportRuns()]);
  return { settings, reconciliation: reconcileSeedBooks(period ?? settings.closeThrough, accounts), runs };
}

export interface ImportOutcome {
  /** true iff parsed + validated + reconciled (a clean import) */
  readonly ok: boolean;
  readonly period?: string;
  readonly parseError?: string;
  readonly validation?: ValidationResult;
  readonly reconciliation?: ReconResult;
  /** whether this import advanced the global as-of (a clean next-in-close-month commit) */
  readonly advancedAsOf: boolean;
  readonly run: ImportRun;
  readonly message: string;
}

/**
 * Import a trial-balance CSV: parse → validate → reconcile → (clean next month) commit. Records an
 * audit row and returns the outcome the Data Import surface renders. Never overlays imported numbers
 * onto the statements (the generator stays the source); a contradiction is surfaced, not absorbed (§16).
 */
export async function runTrialBalanceImport(csvText: string): Promise<ImportOutcome> {
  const store = getDataStore();
  const [accounts, settings] = await Promise.all([store.listGlAccounts(), store.getSettings()]);

  // 1) parse — a structurally-wrong header is a rejected import
  let parsed;
  try {
    parsed = parseTrialBalanceCsv(csvText);
  } catch (e) {
    const message = (e as Error).message;
    const run = await store.recordImportRun({ kind: "trial_balance", period: "—", status: "rejected", advancedAsOf: false, unreconciledTotal: 0, note: message });
    return { ok: false, parseError: message, advancedAsOf: false, run, message };
  }

  // 2) validate — TB balances, known + mapped accounts, one row per (period, account), in-horizon
  const validation = validateTrialBalance(parsed, { accounts, horizonEnd: HORIZON_END });
  if (!validation.ok) {
    const codes = [...new Set(validation.issues.map((i) => i.code))];
    const note = `Validation failed: ${codes.slice(0, 4).join(", ")}${codes.length > 4 ? "…" : ""}`;
    const run = await store.recordImportRun({ kind: "trial_balance", period: validation.periods[0] ?? "—", status: "rejected", advancedAsOf: false, unreconciledTotal: 0, note });
    return { ok: false, period: validation.periods[0], validation, advancedAsOf: false, run, message: note };
  }
  // EXACTLY ONE period per import (the locked contract — one TB per closed month, §16). 0 periods means
  // a header-only/empty file (which would otherwise vacuously "reconcile" against a NaN sentinel); >1
  // means a multi-period file whose earlier periods would BYPASS the single-period reconcile and could
  // silently advance the as-of. Both are rejected, never reconciled.
  if (validation.periods.length !== 1) {
    const note =
      validation.periods.length === 0
        ? "Rejected: no trial-balance rows found (the file is header-only or empty)."
        : `Rejected: ${validation.periods.length} periods in one file (${validation.periods.join(", ")}). Import one month per trial balance.`;
    const run = await store.recordImportRun({ kind: "trial_balance", period: validation.periods[0] ?? "—", status: "rejected", advancedAsOf: false, unreconciledTotal: 0, note });
    return { ok: false, period: validation.periods[0], validation, advancedAsOf: false, run, message: note };
  }
  const importPeriod = validation.periods[0] as Month;

  // 3) reconcile the imported TB (converted to natural balance) against the sub-ledger detail
  const typeByCode = new Map(accounts.map((a) => [a.code, a.accountType]));
  const tbByCode = new Map<string, number>();
  for (const row of parsed.rows) {
    if (row.period !== importPeriod) continue;
    const t = typeByCode.get(row.accountCode);
    const natural = t && isDebitNormal(t) ? row.debit - row.credit : row.credit - row.debit;
    tbByCode.set(row.accountCode, (tbByCode.get(row.accountCode) ?? 0) + natural);
  }
  const reconciliation = reconcile(importPeriod, tbByCode, accounts);

  // 4) a gap BLOCKS — needs attention, fix upstream, as-of unmoved (§16: no plug)
  if (!reconciliation.reconciled) {
    const bad = reconciliation.findings.filter((f) => !f.reconciled);
    const detail = bad.slice(0, 3).map((f) => `${f.accountCode} ${f.accountName} (variance $${Math.round(f.gap).toLocaleString()})`).join("; ");
    const note = `Needs attention: ${bad.length} account(s) don't reconcile to the detail (Σ|gap| $${Math.round(reconciliation.unreconciledTotal).toLocaleString()}) — ${detail}. Fix upstream and re-import (no plug).`;
    const run = await store.recordImportRun({ kind: "trial_balance", period: String(importPeriod), status: "needs_attention", advancedAsOf: false, unreconciledTotal: reconciliation.unreconciledTotal, note });
    return { ok: false, period: String(importPeriod), validation, reconciliation, advancedAsOf: false, run, message: note };
  }

  // 5) clean — advance the as-of iff this is the next in-close month; else a restatement / non-adjacent
  //    month is a green reconcile with the as-of unmoved (a restatement no-op).
  let advancedAsOf = false;
  let message = `Reconciled — all ${reconciliation.findings.length} detailed accounts tie.`;
  if (settings.inCloseMonth && importPeriod === settings.inCloseMonth) {
    try {
      await store.advanceClose(importPeriod);
      advancedAsOf = true;
      message = `Reconciled and committed — the close advanced to ${importPeriod}; it now reports as Actual everywhere.`;
    } catch (e) {
      message = `Reconciled, but the as-of was not advanced: ${(e as Error).message}`;
    }
  } else if (monthToIndex(importPeriod) <= monthToIndex(settings.closeThrough)) {
    message = `Reconciled — ${importPeriod} is already closed (a restatement re-import); the as-of stays at ${settings.closeThrough}.`;
  }
  const run = await store.recordImportRun({ kind: "trial_balance", period: String(importPeriod), status: "reconciled", advancedAsOf, unreconciledTotal: 0, note: message });
  return { ok: true, period: String(importPeriod), validation, reconciliation, advancedAsOf, run, message };
}
