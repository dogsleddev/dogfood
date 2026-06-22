import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiTile } from "@/lib/types/dashboard";
import { formatMetricValue, metricMagnitude } from "@/lib/types/metrics";
import { Sparkline } from "./sparkline";

function deltaVsBudget(tile: KpiTile): { text: string; favorable: boolean } | null {
  if (!tile.budget) return null;
  const cur = metricMagnitude(tile.value);
  const bud = metricMagnitude(tile.budget);
  const higherBetter = tile.definition.higherIsBetter !== false;
  const favorable = higherBetter ? cur >= bud : cur <= bud;
  if (tile.definition.kind === "percent") {
    const pp = (cur - bud) * 100;
    return { text: `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp vs budget`, favorable };
  }
  const pct = bud !== 0 ? ((cur - bud) / Math.abs(bud)) * 100 : 0;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs budget`, favorable };
}

/**
 * A Dashboard metric tile (diagrams/drilldowns-dashboard.svg) — now with current value,
 * a trend sparkline, delta vs budget, and the prior-year + budget comparators.
 * Peek tiles carry "Open full ↗"; pane-only pure metrics show their tie-out basis.
 */
export function KpiTileCard({ tile }: { tile: KpiTile }) {
  const { definition, value, priorYear, budget, trail } = tile;
  const isPeek = definition.firstTap === "peek";
  const delta = deltaVsBudget(tile);

  const higherBetter = definition.higherIsBetter !== false;
  const cur = metricMagnitude(value);
  const py = priorYear ? metricMagnitude(priorYear) : cur;
  const trendFavorable = higherBetter ? cur >= py : cur <= py;

  return (
    <div className="flex flex-col rounded-xl border border-parchment-line bg-surface p-4 transition-colors hover:border-ember/40">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-steel">{definition.label}</span>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
            isPeek ? "bg-ember-tint text-ember-deep" : "bg-secondary text-steel",
          )}
        >
          {isPeek ? "peek" : "pane"}
        </span>
      </div>

      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="font-heading text-2xl leading-tight text-ink">{formatMetricValue(value)}</span>
        {trail && (
          <Sparkline points={trail} className={trendFavorable ? "text-sage-deep" : "text-ember"} />
        )}
      </div>

      {delta && (
        <div className="mt-2">
          <span className={cn("text-xs font-medium", delta.favorable ? "text-sage-deep" : "text-ember-deep")}>
            {delta.text}
          </span>
        </div>
      )}

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-steel">
        {budget && <span>Bud {formatMetricValue(budget)}</span>}
        {priorYear && <span>PY {formatMetricValue(priorYear)}</span>}
      </div>

      <div className="mt-3 border-t border-parchment-line/60 pt-2">
        {isPeek && definition.openFull?.length ? (
          <Link
            href={definition.openFull[0]}
            className="inline-flex items-center gap-1 text-xs font-medium text-ember-deep hover:underline"
          >
            Open full <ArrowUpRight className="size-3" />
          </Link>
        ) : (
          <span className="text-xs leading-tight text-steel">{definition.basis}</span>
        )}
      </div>
    </div>
  );
}
