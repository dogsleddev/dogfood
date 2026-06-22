import Link from "next/link";
import type { GlAccount } from "@/lib/types/source";
import type { StatementClassification, CostFunction } from "@/lib/types/common";
import { setAccountLineAction, setAccountTagsAction, resetAccountMappingAction } from "@/app/setup/account-mapping/actions";
import { prettyStatementLine } from "./account-mapping-table";

const CLASS_LABEL: Record<StatementClassification, string> = { cost_of_revenue: "Cost of Revenue", operating_expense: "Operating Expense" };
const FUNCTION_LABEL: Record<CostFunction, string> = { direct: "Direct", rnd: "R&D", sm: "S&M", ga: "G&A" };
const FUNCTIONS: readonly CostFunction[] = ["direct", "rnd", "sm", "ga"];
// the P&L lines that roll into Total Cost of Revenue (everything else expense → Operating Expenses).
const COR_LINES: ReadonlySet<string> = new Set(["direct_payroll", "non_employee_cor"]);

const isExpense = (a: GlAccount): boolean => a.accountType === "cost_of_revenue" || a.accountType === "operating_expense";

const selectCls =
  "w-full rounded-lg border border-parchment-line bg-parchment/40 px-2 py-1.5 text-sm text-ink focus:border-ember focus:outline-none";

/**
 * The Account-Mapping EDIT card (override layer §17). Re-point an account to a different statement line
 * (within its section/nature — the query guard enforces it) and watch the statement Actual columns move;
 * edit the descriptive classification / function tags; or reset to the default mapping. Server-rendered,
 * Server-Action powered (no client JS). The `account` is the EFFECTIVE (composed) mapping; `baseAccount`
 * is the immutable default, used to show what changed and whether a reset is available.
 */
export function AccountEditPanel({
  account,
  baseAccount,
  targets,
  closeHref,
}: {
  account: GlAccount;
  baseAccount: GlAccount;
  targets: readonly string[];
  closeHref: string;
}) {
  const overridden =
    account.statementLineId !== baseAccount.statementLineId ||
    account.classification !== baseAccount.classification ||
    account.function !== baseAccount.function;
  const repointable = targets.length > 0;
  // the "labeled-CoR-but-rolls-to-OpEx" trap: the tag says one thing, the statement line rolls another way.
  const lineClass: StatementClassification | undefined = isExpense(account)
    ? COR_LINES.has(account.statementLineId)
      ? "cost_of_revenue"
      : "operating_expense"
    : undefined;
  const mismatch = !!account.classification && !!lineClass && account.classification !== lineClass;
  const lineOptions = [account.statementLineId, ...targets];

  return (
    <aside className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ember-deep">Edit mapping</div>
          <div className="mt-0.5 font-heading text-lg text-ink">{account.name}</div>
        </div>
        <Link href={closeHref} className="text-steel hover:text-ink" aria-label="Close">✕</Link>
      </div>

      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-steel">Code</dt><dd className="text-right font-mono text-ink">{account.code}</dd>
        <dt className="text-steel">Default line</dt><dd className="text-right text-ink">{prettyStatementLine(baseAccount.statementLineId)}</dd>
        {overridden && (
          <>
            <dt className="text-steel">Currently</dt>
            <dd className="text-right font-medium text-ember-deep">{prettyStatementLine(account.statementLineId)} · edited</dd>
          </>
        )}
      </dl>

      {mismatch && (
        <div className="mb-3 rounded-lg border border-amber/40 bg-amber/10 p-2.5 text-[11px] text-amber-deep">
          ⚠ This account is tagged <strong>{CLASS_LABEL[account.classification!]}</strong> but its statement line rolls into{" "}
          <strong>{lineClass === "cost_of_revenue" ? "Cost of Revenue" : "Operating Expenses"}</strong>. The tag is descriptive;
          the statement line is what moves the dollars.
        </div>
      )}

      {/* Re-point the statement line — this MOVES the Actual columns */}
      <form action={setAccountLineAction} className="mb-4 space-y-2 border-t border-parchment-line/70 pt-3">
        <input type="hidden" name="accountCode" value={account.code} />
        <label className="block text-xs font-medium text-steel">Statement line</label>
        {repointable ? (
          <>
            <select name="statementLineId" defaultValue={account.statementLineId} className={selectCls}>
              {lineOptions.map((id) => (
                <option key={id} value={id}>{prettyStatementLine(id)}</option>
              ))}
            </select>
            <p className="text-[10px] text-steel">
              Re-pointing moves this account&apos;s closed activity to the chosen line on the P&amp;L, Balance Sheet,
              and Cash Flow (within its section/nature). The FY Actual column moves; the forecast plan does not.
            </p>
            <button type="submit" className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-white hover:bg-ember-deep">
              Apply re-point
            </button>
          </>
        ) : (
          <p className="text-[11px] text-steel">
            This account&apos;s line is not editable ({prettyStatementLine(account.statementLineId)} — equity or
            below-the-line lines are fixed).
          </p>
        )}
      </form>

      {/* Classification / function — descriptive tags (expense accounts only); number-neutral */}
      {isExpense(account) && (
        <form action={setAccountTagsAction} className="mb-4 space-y-2 border-t border-parchment-line/70 pt-3">
          <input type="hidden" name="accountCode" value={account.code} />
          <label className="block text-xs font-medium text-steel">Classification &amp; function (descriptive tags)</label>
          <div className="grid grid-cols-2 gap-2">
            <select name="classification" defaultValue={account.classification ?? "operating_expense"} className={selectCls}>
              {(["cost_of_revenue", "operating_expense"] as StatementClassification[]).map((c) => (
                <option key={c} value={c}>{CLASS_LABEL[c]}</option>
              ))}
            </select>
            <select name="function" defaultValue={account.function ?? "ga"} className={selectCls}>
              {FUNCTIONS.map((f) => (
                <option key={f} value={f}>{FUNCTION_LABEL[f]}</option>
              ))}
            </select>
          </div>
          <p className="text-[10px] text-steel">
            Tags drive metric views (CAC, R&amp;D %), not the statement totals — re-point the statement line to move dollars
            between Cost of Revenue and Operating Expenses.
          </p>
          <button type="submit" className="rounded-lg border border-ember/60 px-3 py-1.5 text-xs font-medium text-ember-deep hover:bg-ember-tint">
            Save tags
          </button>
        </form>
      )}

      {overridden && (
        <form action={resetAccountMappingAction} className="border-t border-parchment-line/70 pt-3">
          <input type="hidden" name="accountCode" value={account.code} />
          <button type="submit" className="text-xs text-steel hover:text-ember-deep">Reset to default mapping</button>
        </form>
      )}
    </aside>
  );
}
