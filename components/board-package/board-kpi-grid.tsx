import { cn } from "@/lib/utils";
import type { KpiTile } from "@/lib/types/dashboard";
import { formatMetricValue, metricMagnitude } from "@/lib/types/metrics";

/**
 * The board-deliverable rendering of a metric tile (CLAUDE.md §8, layer 5). Read-only and dense —
 * value + the PY / Budget comparators + a vs-budget delta — so a section of these reads like a
 * board-book KPI block. Every figure is the live Dashboard tile (getBoardPackage composes the
 * Dashboard summary; one source, two callers), never recomputed here.
 */
function deltaVsBudget(tile: KpiTile): { text: string; favorable: boolean } | null {
  if (!tile.budget) return null;
  const cur = metricMagnitude(tile.value);
  const bud = metricMagnitude(tile.budget);
  const higherBetter = tile.definition.higherIsBetter !== false;
  const favorable = higherBetter ? cur >= bud : cur <= bud;
  if (tile.definition.kind === "percent") {
    const pp = (cur - bud) * 100;
    return { text: `${pp >= 0 ? "+" : ""}${pp.toFixed(1)}pp vs Bud`, favorable };
  }
  const pct = bud !== 0 ? ((cur - bud) / Math.abs(bud)) * 100 : 0;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}% vs Bud`, favorable };
}

function BoardTile({ tile }: { tile: KpiTile }) {
  const { definition, value, priorYear, budget } = tile;
  const delta = deltaVsBudget(tile);
  return (
    <div className="flex flex-col rounded-xl border border-parchment-line bg-surface p-4">
      <span className="text-xs font-medium text-steel">{definition.label}</span>
      <span className="mt-1 font-heading text-2xl leading-tight text-ink tabular-nums">
        {formatMetricValue(value)}
      </span>
      {delta && (
        <span
          className={cn(
            "mt-1.5 text-xs font-medium",
            delta.favorable ? "text-sage-deep" : "text-ember-deep",
          )}
        >
          {delta.text}
        </span>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-steel">
        {budget && <span>Bud {formatMetricValue(budget)}</span>}
        {priorYear && <span>PY {formatMetricValue(priorYear)}</span>}
      </div>
    </div>
  );
}

/** A board section: a metric family title + its tiles in a responsive grid. */
export function BoardKpiSection({ title, tiles }: { title: string; tiles: readonly KpiTile[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-heading text-xl text-ink">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <BoardTile key={tile.definition.id} tile={tile} />
        ))}
      </div>
    </section>
  );
}
