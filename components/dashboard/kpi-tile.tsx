import Link from "next/link";
import { PanelRight } from "lucide-react";
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
 * A Dashboard metric tile (diagrams/drilldowns-dashboard.svg) — current value, a trend sparkline,
 * delta vs budget, and the prior-year + budget comparators. The whole tile is the peek trigger:
 * tapping it opens the right-side pane (?inspect=<metricId>) with the lineage in place (§6 — peek
 * where you read). Peek tiles carry "Open full ↗" in the pane; pure metrics decompose there.
 *
 * `readOnly` renders the tile as a plain card (no inspect link, no peek footer) — used on the
 * mobile home, where the side pane has no room and "go deeper" is handled by Scout instead.
 */
export function KpiTileCard({ tile, selected, readOnly }: { tile: KpiTile; selected?: boolean; readOnly?: boolean }) {
  const { definition, value, priorYear, budget, trail } = tile;
  const delta = deltaVsBudget(tile);

  const higherBetter = definition.higherIsBetter !== false;
  const cur = metricMagnitude(value);
  const py = priorYear ? metricMagnitude(priorYear) : cur;
  const trendFavorable = higherBetter ? cur >= py : cur <= py;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-steel">{definition.label}</span>
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

      {!readOnly && (
        <div className="mt-3 border-t border-parchment-line/60 pt-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              selected ? "text-ember-deep" : "text-steel",
            )}
          >
            <PanelRight className="size-3" /> Inspect
          </span>
        </div>
      )}
    </>
  );

  if (readOnly) {
    return <div className="flex flex-col rounded-xl border border-parchment-line bg-surface p-4">{body}</div>;
  }

  return (
    <Link
      href={`/dashboard?inspect=${definition.id}`}
      scroll={false}
      aria-label={`Inspect ${definition.label}`}
      className={cn(
        "flex flex-col rounded-xl border bg-surface p-4 transition-colors",
        selected
          ? "border-ember bg-ember-tint/30 ring-1 ring-ember/30"
          : "border-parchment-line hover:border-ember/40",
      )}
    >
      {body}
    </Link>
  );
}
