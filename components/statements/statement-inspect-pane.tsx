import Link from "next/link";
import { X, ArrowUpRight } from "lucide-react";
import { formatMoney, type Money } from "@/lib/types/money";
import type { LineDrill, DrillTarget } from "./drill-map";
import { StatementFluxNotes, type StatementFluxActions } from "./statement-flux-notes";

const fmt = (m?: Money) => (m ? formatMoney(m, { compact: true }) : "—");

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
 * The peek pane for the Balance Sheet + Cash Flow reading surfaces — "just another spine caller"
 * (CLAUDE.md §6). Addressed by ?inspect=<lineId>. Shows the line's Actual / Forecast values, then
 * either the register/driver "Open full" targets (peek-then-navigate) or a note for lines that
 * have no working surface to open (leases, equity, pure subtotals).
 */
export function StatementInspectPane({
  lineId,
  label,
  actualLabel,
  forecastLabel,
  actual,
  forecast,
  drill,
  note,
  closeHref,
  fluxActions,
}: {
  lineId: string;
  label: string;
  actualLabel: string;
  forecastLabel: string;
  actual?: Money;
  forecast?: Money;
  drill?: LineDrill;
  note?: string;
  closeHref: string;
  fluxActions: StatementFluxActions;
}) {
  const hasDrill = !!(drill?.register || drill?.driver);
  return (
    <aside className="sticky top-6 w-[340px] shrink-0 rounded-xl border border-parchment-line bg-surface">
      <div className="flex items-start justify-between border-b border-parchment-line px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-steel">Inspect</div>
          <div className="font-heading text-lg text-ink">{label}</div>
        </div>
        <Link href={closeHref} className="rounded-md p-1 text-steel hover:bg-secondary hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </Link>
      </div>

      <div className="px-4 py-3">
        <ValueRow label={actualLabel} value={actual} />
        <ValueRow label={forecastLabel} value={forecast} />
      </div>

      {hasDrill ? (
        <div className="border-t border-parchment-line px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-steel">Open full ↗</div>
          <p className="mt-1 text-xs text-steel">Actual months open the register; forecast months open the driver.</p>
          <div className="mt-2 space-y-2">
            {drill?.register && <DrillLink kind="Actual → register" target={drill.register} />}
            {drill?.driver && <DrillLink kind="Forecast → driver" target={drill.driver} />}
          </div>
        </div>
      ) : (
        <div className="border-t border-parchment-line px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-deep">No working surface</div>
          <p className="mt-1 text-sm text-steel">{note ?? "This line has no editable driver to open."}</p>
        </div>
      )}

      {/* Flux Analysis: the line note + rolled-up account/transaction notes for the close period. */}
      <StatementFluxNotes lineId={lineId} actions={fluxActions} />
    </aside>
  );
}
