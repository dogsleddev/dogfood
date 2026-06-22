import type { KpiTile } from "@/lib/types/dashboard";
import { formatMetricValue } from "@/lib/types/metrics";

/** The marquee metrics a board opens on, in order. Drawn from the live tile set, not recomputed. */
const HEADLINE_IDS = ["revenue", "growth_rate", "arr_mrr", "gross_margin_pct", "net_income", "runway"];

/**
 * The board-package headline strip (CLAUDE.md §8, layer 5): the handful of marquee KPIs a board
 * opens on. Reads the live composed tiles (getBoardPackage → Dashboard summary), so each figure ===
 * its Dashboard tile. Read-only.
 */
export function BoardHeadline({ tiles }: { tiles: readonly KpiTile[] }) {
  const byId = new Map(tiles.map((t) => [t.definition.id as string, t]));
  const headline = HEADLINE_IDS.map((id) => byId.get(id)).filter((t): t is KpiTile => Boolean(t));

  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-parchment-line bg-parchment-line sm:grid-cols-3 lg:grid-cols-6">
      {headline.map((tile) => (
        <div key={tile.definition.id} className="bg-surface p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-steel">
            {tile.definition.label}
          </div>
          <div className="mt-1 font-heading text-2xl leading-tight text-ink tabular-nums">
            {formatMetricValue(tile.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
