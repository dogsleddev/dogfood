import { cn } from "@/lib/utils";
import { getDashboardSummary } from "@/lib/queries";
import { month } from "@/lib/types/period";
import type { MetricFamily } from "@/lib/types/metrics";
import { KpiTileCard } from "@/components/dashboard/kpi-tile";

const FAMILY_DOT: Record<MetricFamily, string> = {
  financial: "bg-ember",
  growth_retention: "bg-sage",
  unit_economics: "bg-amber",
  cash_efficiency: "bg-steel",
};

export default async function DashboardPage() {
  const summary = await getDashboardSummary(month(2026, 6));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Overview · Layer 5</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Dashboard</h1>
          <span className="text-sm text-steel">FY{summary.period.slice(0, 4)} · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-steel">
          The live cockpit. Tiles are the Metrics layer surfaced here; each peek tile opens to its
          working surface, while a pure metric shows its tie-out basis (it decomposes into its
          component lines in the statement peek panes). Financial-family tiles tie to the P&amp;L by
          construction (one source, two callers).
        </p>
      </header>

      <div className="space-y-8">
        {summary.families.map((family) => (
          <section key={family.family}>
            <div className="mb-3 flex items-center gap-2">
              <span className={cn("size-2 rounded-full", FAMILY_DOT[family.family])} />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-steel">{family.label}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {family.tiles.map((tile) => (
                <KpiTileCard key={tile.definition.id} tile={tile} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
