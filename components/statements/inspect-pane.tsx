import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";
import { formatMoney, formatPercent, sumMoney, type Money } from "@/lib/types/money";
import { month } from "@/lib/types/period";
import type { PnL, PnLLineId } from "@/lib/types/statements";
import type { ExpenseGroupId } from "@/lib/types/common";
import { getExpenseForecast } from "@/lib/queries";
import { PNL_DRILL, PNL_DECOMPOSITION, OPEX_LINE_GROUP, type DrillTarget } from "./drill-map";
import { StatementFluxNotes } from "./statement-flux-notes";
import { addLineFluxNoteAction, resolvePnlFluxNoteAction, deletePnlFluxNoteAction } from "@/app/statements/pnl/actions";

const fmt = (m?: Money) => (m ? formatMoney(m, { compact: true }) : "—");
const PEEK_PERIOD = month(2026, 6);

/**
 * "By account" mini-breakdown for an OpEx line (§7): the group's GL sub-accounts with their FY total,
 * each linking to the Expense Forecast drill (group -> account -> vendor). Async server component — a
 * spine caller like the rest of the pane (one source, two callers).
 */
async function OpExAccountPeek({ groupId }: { groupId: string }) {
  const lines = await getExpenseForecast(PEEK_PERIOD, { groupId: groupId as ExpenseGroupId, breakdown: "account" });
  const byAcct = new Map<string, { label: string; subCode: string; amts: Money[] }>();
  for (const l of lines) {
    if (!l.accountId) continue;
    const e = byAcct.get(l.accountId) ?? { label: l.accountLabel ?? l.accountId, subCode: l.subCode ?? "", amts: [] };
    e.amts.push(l.amount);
    byAcct.set(l.accountId, e);
  }
  const accts = [...byAcct.entries()]
    .map(([id, e]) => ({ id, label: e.label, subCode: e.subCode, total: sumMoney(e.amts) }))
    .sort((a, b) => b.total.minor - a.total.minor);
  if (accts.length === 0) return null;
  return (
    <div className="border-t border-parchment-line px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-steel">By account · FY26</div>
      <ul className="mt-2 space-y-1">
        {accts.map((a) => (
          <li key={a.id}>
            <Link
              href={`/forecasts/expenses/${groupId}?account=${a.id}`}
              className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-ember-tint/60"
            >
              <span className="text-ink">
                <span className="mr-1.5 font-mono text-xs text-steel">{a.subCode}</span>
                {a.label}
              </span>
              <span className="tabular-nums text-steel">{fmt(a.total)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-steel">Open the Expense Forecast to drill each account to its vendors.</p>
    </div>
  );
}

function ValueRow({ label, value }: { label: string; value?: Money }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-steel">{label}</span>
      <span className="tabular-nums text-ink">{fmt(value)}</span>
    </div>
  );
}

function DrillLink({ kind, target }: { kind: string; target: DrillTarget }) {
  return (
    <Link
      href={target.href}
      className="block rounded-lg border border-parchment-line px-3 py-2 transition-colors hover:border-ember/50 hover:bg-ember-tint/40"
    >
      <div className="text-[11px] uppercase tracking-wide text-steel">{kind}</div>
      <div className="flex items-center justify-between gap-2 text-sm text-ink">
        <span>{target.label}</span>
        <ArrowUpRight className="size-3.5 shrink-0 text-ember" />
      </div>
    </Link>
  );
}

/**
 * The peek pane — "just another spine caller" (CLAUDE.md §6). Addressed by ?inspect=<lineId>.
 * Peek lines show their register (actual) + driver (forecast) "Open full" targets; pure
 * metrics decompose into their component lines (no working surface to open).
 */
export function InspectPane({ pnl, lineId }: { pnl: PnL; lineId: PnLLineId }) {
  const line = pnl.lines.find((l) => l.id === lineId);
  if (!line) return null;
  const drill = PNL_DRILL[lineId];
  const decomp = PNL_DECOMPOSITION[lineId];
  const paneOnly = line.firstTap === "pane_only";

  return (
    <aside className="sticky top-6 w-[340px] shrink-0 rounded-xl border border-parchment-line bg-surface">
      <div className="flex items-start justify-between border-b border-parchment-line px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-steel">Inspect</div>
          <div className="font-heading text-lg text-ink">{line.label}</div>
        </div>
        <Link href="/statements/pnl" className="rounded-md p-1 text-steel hover:bg-secondary hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </Link>
      </div>

      <div className="px-4 py-3">
        <ValueRow label="Budget FY26" value={line.values.budget} />
        <ValueRow label="Actual YTD" value={line.values.actual} />
        <ValueRow label="Forecast FY26" value={line.values.forecast} />
        <div className="my-1 border-t border-parchment-line/60" />
        <ValueRow label="Variance (Fcst−Bud)" value={line.values.variance} />
        {line.marginPct !== undefined && (
          <div className="mt-1 flex items-center justify-between text-sm">
            <span className="text-steel">Margin</span>
            <span className="text-sage-deep">{formatPercent(line.marginPct, 1)}</span>
          </div>
        )}
      </div>

      {paneOnly ? (
        <div className="border-t border-parchment-line px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-deep">Pure metric</div>
          {decomp && <p className="mt-1 text-sm text-steel">{decomp.formula}</p>}
          {decomp && (
            <ul className="mt-2 space-y-1">
              {decomp.parts.map((pid) => {
                const part = pnl.lines.find((l) => l.id === pid);
                if (!part) return null;
                return (
                  <li key={pid}>
                    <Link
                      href={`/statements/pnl?inspect=${pid}`}
                      className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-ember-tint/60"
                    >
                      <span className="text-ink">{part.label}</span>
                      <span className="tabular-nums text-steel">{fmt(part.values.forecast)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-steel">
            Pure metrics are pane-only — they decompose into the lines that compose them (§6).
          </p>
        </div>
      ) : (
        <div className="border-t border-parchment-line px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-steel">Open full ↗</div>
          <p className="mt-1 text-xs text-steel">Actual months open the register; forecast months open the driver.</p>
          <div className="mt-2 space-y-2">
            {drill?.register && <DrillLink kind="Actual → register" target={drill.register} />}
            {drill?.driver && <DrillLink kind="Forecast → driver" target={drill.driver} />}
            {!drill && <p className="text-sm text-steel">No working surface mapped for this line.</p>}
          </div>
        </div>
      )}

      {/* OpEx lines: a "By account" mini-breakdown (drills to vendors on the Expense Forecast, §7). */}
      {OPEX_LINE_GROUP[lineId] && <OpExAccountPeek groupId={OPEX_LINE_GROUP[lineId]!} />}

      {/* Flux Analysis: the line note + rolled-up account/transaction notes for the close period. */}
      <StatementFluxNotes
        lineId={lineId}
        actions={{ add: addLineFluxNoteAction, resolve: resolvePnlFluxNoteAction, remove: deletePnlFluxNoteAction }}
      />
    </aside>
  );
}
