import { cn } from "@/lib/utils";
import type { ReconResult } from "@/lib/import/types";
import { prettyStatementLine } from "./account-mapping-table";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
// round to whole dollars and normalize -0 → 0 so a sub-dollar reconciliation reads "$0", not "-$0".
const usd0 = (n: number) => fmt.format(Math.round(n) === 0 ? 0 : Math.round(n));

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * The detail-to-TB reconciliation control total (CLAUDE.md §16). For every account WITH a sub-ledger,
 * the trial-balance figure vs Σ(detail) — green when it ties within materiality, an ember "needs
 * attention" when it doesn't (never plugged, fix-upstream). Accounts with no sub-ledger are listed
 * separately as authoritative (TB-only). The statement line each account rolls up to is shown, so the
 * control total reads at the line grain too.
 */
export function ReconciliationTable({ result }: { result: ReconResult }) {
  const findings = [...result.findings].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const tbOnly = [...result.tbOnly].sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Account</TH>
              <TH>Statement line</TH>
              <TH right>Trial balance</TH>
              <TH right>Detail (sub-ledger)</TH>
              <TH right>Variance</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {findings.map((f) => (
              <tr key={f.accountCode} className={cn("border-t border-parchment-line/60", !f.reconciled && "bg-ember-tint/40")}>
                <td className="px-3 py-1.5 text-ink">
                  <span className="tabular-nums text-steel">{f.accountCode}</span> {f.accountName}
                </td>
                <td className="px-3 py-1.5 text-steel">{prettyStatementLine(f.statementLineId)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{usd0(f.tbAmount)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{usd0(f.detailAmount)}</td>
                <td className={cn("px-3 py-1.5 text-right tabular-nums", f.reconciled ? "text-steel" : "font-semibold text-ember-deep")}>
                  {usd0(f.gap)}
                </td>
                <td className="px-3 py-1.5">
                  {f.reconciled ? (
                    <span className="rounded bg-sage/15 px-1.5 py-0.5 text-xs font-medium text-sage-deep">✓ Tied</span>
                  ) : (
                    <span className="rounded bg-ember-tint px-1.5 py-0.5 text-xs font-medium text-ember-deep">Needs attention</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="group rounded-xl border border-parchment-line bg-surface">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-sm text-steel marker:content-none">
          <span className="font-medium text-ink">{tbOnly.length} authoritative accounts</span> with no sub-ledger
          (subscription revenue, equity, deferred revenue, D&A, cash, taxes…) — taken straight from the trial
          balance, nothing to reconcile up. <span className="text-ember-deep group-open:hidden">Show</span>
          <span className="hidden text-ember-deep group-open:inline">Hide</span>
        </summary>
        <table className="w-full border-collapse border-t border-parchment-line text-sm">
          <tbody>
            {tbOnly.map((a) => (
              <tr key={a.accountCode} className="border-t border-parchment-line/60">
                <td className="px-3 py-1.5 text-ink">
                  <span className="tabular-nums text-steel">{a.accountCode}</span> {a.accountName}
                </td>
                <td className="px-3 py-1.5 text-steel">{prettyStatementLine(a.statementLineId)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{usd0(a.tbAmount)}</td>
                <td className="px-3 py-1.5 text-steel">authoritative</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
