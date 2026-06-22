/**
 * Trial-balance VALIDATION (CLAUDE.md §16; import-templates/README.md "Validation"). Pure, no engine
 * contact. Parses the CSV and checks the structural + accounting gates BEFORE anything is reconciled
 * or committed: the TB balances per period (Σdebit === Σcredit — the hard gate), every account_code
 * exists in the chart and maps to a statement line, one row per (period, account), valid period
 * format, and (optionally) no period beyond the seed horizon. Reconciliation (detail-vs-TB) and the
 * as-of advance happen only after this passes.
 */
import { CHART_OF_ACCOUNTS } from "@/lib/seed/gl";
import { compareMonth } from "@/lib/types/period";
import type { Month } from "@/lib/types/period";
import type { GlAccount } from "@/lib/types/source";
import { parseCsv } from "./parse-csv";
import type { ParsedTrialBalance, TbRow, ValidationResult, ImportIssue, PeriodFooting } from "./types";

const TB_HEADER = ["period", "account_code", "account_name", "debit", "credit"] as const;
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const FOOT_TOLERANCE = 0.005; // half a cent — the TB must balance to the penny

/** Parse a number that may carry $ / thousands separators; NaN signals a bad cell. */
function num(s: string): number {
  const n = Number(String(s).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

/** Parse trial_balance.csv into rows. Throws only on a structurally wrong header (a rejected import). */
export function parseTrialBalanceCsv(text: string): ParsedTrialBalance {
  const grid = parseCsv(text);
  if (grid.length === 0) throw new Error("trial balance: the file is empty");
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const headerOk = TB_HEADER.every((h, i) => header[i] === h);
  if (!headerOk) {
    throw new Error(`trial balance: unexpected header (expected "${TB_HEADER.join(",")}", got "${header.join(",")}")`);
  }
  const rows: TbRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    if (r.length < 5) continue;
    rows.push({
      period: r[0].trim(),
      accountCode: r[1].trim(),
      accountName: r[2].trim(),
      debit: num(r[3]),
      credit: num(r[4]),
    });
  }
  return { rows };
}

export interface ValidateOptions {
  readonly accounts?: readonly GlAccount[];
  /** the last period with generator data (reject anything past it); omit to skip the horizon check */
  readonly horizonEnd?: Month;
}

export function validateTrialBalance(parsed: ParsedTrialBalance, opts: ValidateOptions = {}): ValidationResult {
  const accounts = opts.accounts ?? CHART_OF_ACCOUNTS;
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const issues: ImportIssue[] = [];

  const seen = new Set<string>(); // (period|code) for the duplicate check
  const footing = new Map<string, { debit: number; credit: number }>();

  for (const r of parsed.rows) {
    if (!PERIOD_RE.test(r.period)) {
      issues.push({ code: "bad_period_format", message: `"${r.period}" is not a YYYY-MM period`, period: r.period, accountCode: r.accountCode });
      continue;
    }
    if (opts.horizonEnd && compareMonth(r.period as Month, opts.horizonEnd) > 0) {
      issues.push({ code: "past_horizon", message: `${r.period} is beyond the seed horizon (${opts.horizonEnd})`, period: r.period, accountCode: r.accountCode });
    }
    if (Number.isNaN(r.debit) || Number.isNaN(r.credit)) {
      issues.push({ code: "bad_amount", message: `non-numeric debit/credit on account ${r.accountCode}`, period: r.period, accountCode: r.accountCode });
      continue;
    }
    if (r.debit !== 0 && r.credit !== 0) {
      issues.push({ code: "both_sides_nonzero", message: `account ${r.accountCode} has both a debit and a credit`, period: r.period, accountCode: r.accountCode });
    }
    const acct = byCode.get(r.accountCode);
    if (!acct) {
      issues.push({ code: "unknown_account", message: `account ${r.accountCode} (${r.accountName}) is not in the chart of accounts`, period: r.period, accountCode: r.accountCode });
    } else if (!acct.statementLineId) {
      issues.push({ code: "unmapped_account", message: `account ${r.accountCode} maps to no statement line`, period: r.period, accountCode: r.accountCode });
    }
    const key = `${r.period}|${r.accountCode}`;
    if (seen.has(key)) {
      issues.push({ code: "duplicate_row", message: `duplicate row for ${r.accountCode} in ${r.period}`, period: r.period, accountCode: r.accountCode });
    }
    seen.add(key);

    const f = footing.get(r.period) ?? { debit: 0, credit: 0 };
    f.debit += r.debit || 0;
    f.credit += r.credit || 0;
    footing.set(r.period, f);
  }

  const periods = [...footing.keys()].sort();
  const footingRows: PeriodFooting[] = periods.map((period) => {
    const f = footing.get(period)!;
    const balanced = Math.abs(f.debit - f.credit) < FOOT_TOLERANCE;
    if (!balanced) {
      issues.push({
        code: "unbalanced_period",
        message: `${period} does not balance: Σdebit ${f.debit.toFixed(2)} vs Σcredit ${f.credit.toFixed(2)} (Δ ${(f.debit - f.credit).toFixed(2)})`,
        period,
      });
    }
    return { period, debit: f.debit, credit: f.credit, balanced };
  });

  return { ok: issues.length === 0, issues, periods, footing: footingRows };
}
