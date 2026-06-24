import { cn } from "@/lib/utils";
import { getDashboardSummary } from "@/lib/queries";
import { month } from "@/lib/types/period";
import type { MetricFamily } from "@/lib/types/metrics";
import { KpiTileCard } from "@/components/dashboard/kpi-tile";
import { MobileScoutCta } from "@/components/shell/mobile-scout-cta";

const FAMILY_DOT: Record<MetricFamily, string> = {
  financial: "bg-ember",
  growth_retention: "bg-sage",
  unit_economics: "bg-amber",
  cash_efficiency: "bg-steel",
};

function TrailMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline points="3,17 7,14 3,11" stroke="var(--color-frost)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9,15 13,12 9,9" stroke="var(--color-steel)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15,13 19,10 15,7" stroke="var(--color-ember)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Mobile home (`md:hidden`). The dense, multi-column working surfaces (5-column statements, 12-month
 * board views, the wide registers) are desktop-only by design — they cannot be made genuinely usable
 * at phone width without becoming a pinch-zoom mess. So instead of the desktop app shrunk down, phones
 * get a purpose-built mobile-native slice: a glanceable READ-ONLY KPI snapshot (the same Dashboard
 * tiles, drill/peek suppressed) plus Scout, which IS mobile-native and is how you "go deeper" here.
 *
 * Rendered in the shell's mobile slot (the desktop frame is `hidden md:flex` alongside, untouched).
 * `getDashboardSummary()` is the same deterministic in-memory builder the Dashboard reads — no extra
 * data path. The full workspace stays on desktop; this is "ask the agent," not "shrink the spreadsheet."
 */
export async function MobileHome() {
  const summary = await getDashboardSummary(month(2026, 6));

  return (
    <div className="flex min-h-screen flex-col bg-background md:hidden">
      {/* top bar — Midnight, with Scout always one tap away */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3"
        style={{ background: "linear-gradient(180deg, var(--color-midnight), var(--color-midnight-2))" }}
      >
        <div className="flex items-center gap-2">
          <TrailMark />
          <span className="font-heading text-lg text-parchment">
            dogfood<span className="text-steel">.cafe</span>
          </span>
        </div>
        <MobileScoutCta variant="compact" />
      </header>

      <main className="flex-1 px-4 py-5">
        <div className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-ember-deep">Overview</div>
        <h1 className="font-heading text-2xl text-ink">Dashboard</h1>
        <p className="mt-0.5 text-sm text-steel">Bearing · FY{summary.period.slice(0, 4)} · as of June 2026</p>

        <div className="mt-4">
          <MobileScoutCta variant="hero" />
        </div>

        <div className="mt-6 space-y-6">
          {summary.families.map((family) => (
            <section key={family.family}>
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("size-2 rounded-full", FAMILY_DOT[family.family])} />
                <h2 className="text-xs font-semibold uppercase tracking-wide text-steel">{family.label}</h2>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {family.tiles.map((tile) => (
                  <KpiTileCard key={tile.definition.id} tile={tile} readOnly />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-7 rounded-lg border border-parchment-line bg-secondary/60 px-4 py-3 text-center text-xs text-steel">
          This is the mobile snapshot. Open the full workspace — statements, forecasts, and scenarios —
          at <span className="font-medium text-ink">1024px</span> or wider on a laptop or desktop.
        </div>
      </main>
    </div>
  );
}
