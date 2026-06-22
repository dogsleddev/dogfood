import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { PipelineOpportunity, PipelineStage } from "@/lib/types/source";
import { STAGE_LABEL } from "@/components/sales/pipeline-cards";

export type StageFilter = "all" | PipelineStage;

const fmt = (m: Money) => formatMoney(m, { compact: true });

const STAGE_BADGE: Record<PipelineStage, string> = {
  lead: "bg-steel/15 text-steel",
  qualified: "bg-frost/25 text-ink",
  proposal: "bg-amber/15 text-amber-deep",
  negotiation: "bg-ember-tint text-ember-deep",
  closed_won: "bg-sage/15 text-sage-deep",
  closed_lost: "bg-steel/15 text-steel",
};

const STAGE_VALUES: readonly StageFilter[] = ["all", "lead", "qualified", "proposal", "negotiation"];

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

function buildHref(stage: StageFilter, owner: string | undefined) {
  const params = new URLSearchParams();
  if (stage !== "all") params.set("stage", stage);
  if (owner) params.set("owner", owner);
  const qs = params.toString();
  return qs ? `/sales/pipeline?${qs}` : "/sales/pipeline";
}

function StageChips({ active, owner }: { active: StageFilter; owner: string | undefined }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-parchment-line bg-secondary/40 p-0.5">
      {STAGE_VALUES.map((s) => (
        <Link
          key={s}
          href={buildHref(s, owner)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            active === s ? "bg-surface font-medium text-ink shadow-sm" : "text-steel hover:text-ink",
          )}
        >
          {s === "all" ? "All stages" : STAGE_LABEL[s]}
        </Link>
      ))}
    </div>
  );
}

function OwnerFilter({ owners, active, stage }: { owners: readonly string[]; active: string | undefined; stage: StageFilter }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link
        href={buildHref(stage, undefined)}
        className={cn(
          "rounded-md border px-2.5 py-1 text-xs transition-colors",
          !active ? "border-ember/40 bg-ember-tint font-medium text-ember-deep" : "border-parchment-line text-steel hover:text-ink",
        )}
      >
        All reps
      </Link>
      {owners.map((o) => (
        <Link
          key={o}
          href={buildHref(stage, o)}
          className={cn(
            "rounded-md border px-2.5 py-1 text-xs transition-colors",
            active === o ? "border-ember/40 bg-ember-tint font-medium text-ember-deep" : "border-parchment-line text-steel hover:text-ink",
          )}
        >
          {o}
        </Link>
      ))}
    </div>
  );
}

/**
 * The Pipeline register (CLAUDE.md §8, layer 1) — open opportunities that feed the Revenue Forecast.
 * Reads `listPipeline` (the live DataStore seam). The stage chips + rep chips filter the displayed
 * rows; the summary line is over the full open book. Owners are the real S&M staff roster.
 */
export function PipelineTable({
  all,
  rows,
  owners,
  stage,
  owner,
}: {
  all: readonly PipelineOpportunity[];
  rows: readonly PipelineOpportunity[];
  owners: readonly string[];
  stage: StageFilter;
  owner: string | undefined;
}) {
  const sorted = rows.slice().sort((a, b) => b.arr.minor - a.arr.minor);

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-steel">
            <span className="font-medium text-ink">{all.length}</span> open opportunities ·{" "}
            <span className="font-medium text-ink">{rows.length}</span> shown
          </div>
          <StageChips active={stage} owner={owner} />
        </div>
        <OwnerFilter owners={owners} active={owner} stage={stage} />
      </div>

      <div className="max-h-[600px] overflow-y-auto rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Opportunity</TH>
              <TH>Stream</TH>
              <TH>Stage</TH>
              <TH>Owner</TH>
              <TH right>ARR</TH>
              <TH right>Win %</TH>
              <TH>Expected close</TH>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.id} className="border-t border-parchment-line/60 hover:bg-ember-tint/40">
                <td className="px-3 py-1.5 text-ink">{o.customerName}</td>
                <td className="px-3 py-1.5 capitalize text-steel">{o.stream}</td>
                <td className="px-3 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STAGE_BADGE[o.stage])}>
                    {STAGE_LABEL[o.stage]}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-steel">{o.owner}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmt(o.arr)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">{formatPercent(o.probability, 0)}</td>
                <td className="px-3 py-1.5 text-steel">{monthLabel(o.expectedClose)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-steel">
                  No opportunities match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { STAGE_VALUES };
