import { cn } from "@/lib/utils";
import { getDashboardSummary } from "@/lib/queries";
import { month } from "@/lib/types/period";
import type { MetricFamily } from "@/lib/types/metrics";
import { KpiTileCard } from "@/components/dashboard/kpi-tile";
import { MetricInspectPane } from "@/components/dashboard/metric-inspect-pane";
import { TrendsSection } from "@/components/dashboard/trends-section";

const FAMILY_DOT: Record<MetricFamily, string> = {
  financial: "bg-ember",
  growth_retention: "bg-sage",
  unit_economics: "bg-amber",
  cash_efficiency: "bg-steel",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ inspect?: string }>;
}) {
  const [{ inspect }, summary] = await Promise.all([searchParams, getDashboardSummary(month(2026, 6))]);
  const allTiles = summary.families.flatMap((f) => f.tiles);
  const inspectTile = inspect ? allTiles.find((t) => (t.definition.id as string) === inspect) : undefined;

  return (
    <div className={cn("mx-auto px-8 py-8", inspectTile ? "max-w-[1400px]" : "max-w-6xl")}>
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Overview · Layer 5</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Dashboard</h1>
          <span className="text-sm text-steel">FY{summary.period.slice(0, 4)} · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-steel">
          The live cockpit. Each tile is a Metrics-layer KPI — tap one to peek its lineage in the
          pane (§6): a peek tile carries Open full ↗ to its working surface; a pure metric decomposes
          into the lines that compose it. Financial-family tiles tie to the P&amp;L by construction
          (one source, two callers).
        </p>
      </header>

      <TrendsSection period={month(2026, 6)} />

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-8">
          {summary.families.map((family) => (
            <section key={family.family}>
              <div className="mb-3 flex items-center gap-2">
                <span className={cn("size-2 rounded-full", FAMILY_DOT[family.family])} />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-steel">{family.label}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {family.tiles.map((tile) => (
                  <KpiTileCard
                    key={tile.definition.id}
                    tile={tile}
                    selected={inspectTile?.definition.id === tile.definition.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        {inspectTile && <MetricInspectPane tile={inspectTile} summary={summary} />}
      </div>
    </div>
  );
}
