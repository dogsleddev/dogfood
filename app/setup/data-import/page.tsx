import { getDataImportView } from "@/lib/queries";
import { monthLabel } from "@/lib/types/period";
import { cn } from "@/lib/utils";
import { ReconciliationTable } from "@/components/setup/reconciliation-table";
import { importTrialBalanceAction, resetDemoAction } from "./actions";
import { isAdmin } from "@/lib/auth/admin";
import type { ImportRun } from "@/lib/import/types";

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_STYLE: Record<ImportRun["status"], { dot: string; text: string; label: string }> = {
  reconciled: { dot: "bg-sage-deep", text: "text-sage-deep", label: "Reconciled" },
  needs_attention: { dot: "bg-ember", text: "text-ember-deep", label: "Needs attention" },
  rejected: { dot: "bg-amber-deep", text: "text-amber-deep", label: "Rejected" },
};

export default async function DataImportPage() {
  const { settings, reconciliation, runs } = await getDataImportView();
  const admin = await isAdmin();
  const close = settings.closeThrough;
  const inClose = settings.inCloseMonth;
  const reconciled = reconciliation.reconciled;
  const exceptions = reconciliation.findings.filter((f) => !f.reconciled);
  const last = runs[0];

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Setup · Config</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Data Import</h1>
          <span className="text-sm text-steel">FY2026 · as of {monthLabel(close)}</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The trial balance is the single source of truth for the statements. Every closed month imports as a
          trial balance and the detailed sub-ledgers reconcile UP to it — a control total per account. A gap
          is a blocking &ldquo;needs attention&rdquo; flag, fixed upstream, never plugged.
        </p>
      </header>

      {/* ── the standing reconciliation control total ── */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-heading text-xl text-ink">Reconciliation control total</h2>
          <span className="text-sm text-steel">detail vs trial balance · as of {monthLabel(close)}</span>
        </div>

        <div
          className={cn(
            "mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
            reconciled ? "border-sage/30 bg-sage/10 text-sage-deep" : "border-ember/30 bg-ember-tint/60 text-ember-deep",
          )}
        >
          <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", reconciled ? "bg-sage-deep" : "bg-ember")} />
          {reconciled ? (
            <div>
              <div className="font-semibold text-ink">Books reconciled — $0 variance.</div>
              <div className="text-steel">
                All {reconciliation.findings.length} accounts with a sub-ledger tie to the trial balance to the
                dollar ({reconciliation.tbOnly.length} more are authoritative with no sub-ledger). The detail
                fully explains the books.
              </div>
            </div>
          ) : (
            <div>
              <div className="font-semibold text-ink">{exceptions.length} account(s) need attention — Σ|gap| {usd0.format(reconciliation.unreconciledTotal)}.</div>
              <div className="text-steel">The detail doesn&rsquo;t fully explain the trial balance. Fix upstream and re-import — no plug.</div>
            </div>
          )}
        </div>

        <ReconciliationTable result={reconciliation} />
      </section>

      {/* ── import a trial balance ── */}
      <section className="mb-10">
        <h2 className="mb-1 font-heading text-xl text-ink">Import a trial balance</h2>
        <p className="mb-4 max-w-3xl text-sm text-steel">
          Importing the in-close month{inClose ? ` (${monthLabel(inClose)})` : ""} runs the same control total;
          a clean reconcile commits it and advances the global as-of, so that month flips to Actual everywhere.
          A contradicting figure is blocked. Re-importing a closed month is a restatement (the as-of stays put).
        </p>

        {admin && last && (
          <div className={cn("mb-4 rounded-xl border px-4 py-3 text-sm", last.status === "reconciled" ? "border-sage/30 bg-sage/10" : last.status === "needs_attention" ? "border-ember/30 bg-ember-tint/60" : "border-amber/30 bg-amber/10")}>
            <div className="mb-0.5 flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", STATUS_STYLE[last.status].dot)} />
              <span className={cn("text-xs font-semibold uppercase tracking-wide", STATUS_STYLE[last.status].text)}>
                Last import · {STATUS_STYLE[last.status].label}
                {last.advancedAsOf && " · as-of advanced"}
              </span>
            </div>
            <div className="text-ink">{last.note}</div>
          </div>
        )}

        {admin ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form action={importTrialBalanceAction} className="rounded-xl border border-parchment-line bg-surface p-4">
            <div className="mb-2 text-sm font-medium text-ink">Upload a trial balance (CSV)</div>
            <p className="mb-3 text-xs text-steel">
              Columns: <code className="rounded bg-secondary px-1">period, account_code, account_name, debit, credit</code>.
              Template + samples live in <code className="rounded bg-secondary px-1">import-templates/</code>.
            </p>
            <input
              type="file"
              name="tb"
              accept=".csv,text/csv"
              className="mb-3 block w-full text-sm text-steel file:mr-3 file:rounded-md file:border-0 file:bg-ember file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-ember-deep"
            />
            <button type="submit" className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-white hover:bg-ink/90">
              Parse, validate &amp; reconcile
            </button>
          </form>

          <form action={importTrialBalanceAction} className="rounded-xl border border-parchment-line bg-surface p-4">
            <div className="mb-2 text-sm font-medium text-ink">Or run a demo import</div>
            <p className="mb-3 text-xs text-steel">Generated live from the current books, so each always matches.</p>
            <div className="flex flex-col gap-2">
              <button name="sample" value="next-month" className="rounded-md border border-sage/40 bg-sage/10 px-3 py-2 text-left text-sm text-sage-deep hover:bg-sage/20">
                ✓ Import {inClose ? monthLabel(inClose) : "the next month"} — clean, advances the close
              </button>
              <button name="sample" value="broken" className="rounded-md border border-ember/40 bg-ember-tint/60 px-3 py-2 text-left text-sm text-ember-deep hover:bg-ember-tint">
                ⚠ Import a contradicting {monthLabel(close)} — a blocking exception
              </button>
              <button name="sample" value="current" className="rounded-md border border-parchment-line bg-secondary px-3 py-2 text-left text-sm text-steel hover:bg-secondary/70">
                ↺ Re-import {monthLabel(close)} — a restatement (as-of unmoved)
              </button>
            </div>
          </form>
        </div>
        ) : (
          <div className="rounded-xl border border-parchment-line bg-secondary/40 px-4 py-3 text-sm text-steel">
            Importing is admin-only on the live trial — the reconciliation above always reflects the current
            books. <a href="/admin" className="font-medium text-ember-deep underline">Sign in as admin</a> to import a trial balance.
          </div>
        )}
        {admin && (
          <form action={resetDemoAction} className="mt-4">
            <button type="submit" className="rounded-md border border-parchment-line bg-secondary px-3 py-1.5 text-xs text-steel hover:bg-secondary/70">
              ↺ Reset demo — clear scenarios + flux notes and restore the as-of
            </button>
          </form>
        )}
      </section>

      {/* ── import history ── */}
      {runs.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-xl text-ink">Import history</h2>
          <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
                  <th className="px-3 py-2 text-left font-medium">When</th>
                  <th className="px-3 py-2 text-left font-medium">Period</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 12).map((r) => (
                  <tr key={r.id} className="border-t border-parchment-line/60 align-top">
                    <td className="whitespace-nowrap px-3 py-1.5 text-steel">{new Date(r.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-ink">{r.period}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", STATUS_STYLE[r.status].text)}>
                        <span className={cn("h-2 w-2 rounded-full", STATUS_STYLE[r.status].dot)} />
                        {STATUS_STYLE[r.status].label}{r.advancedAsOf && " · advanced"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-steel">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
