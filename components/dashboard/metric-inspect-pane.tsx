import Link from "next/link";
import { X, ArrowUpRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KpiTile, DashboardSummary } from "@/lib/types/dashboard";
import { formatMetricValue, metricMagnitude, type MetricValue } from "@/lib/types/metrics";
import { Sparkline } from "./sparkline";
import { METRIC_DECOMPOSITION, routeLabel } from "./metric-decomposition";

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

function ValueRow({ label, value }: { label: string; value?: MetricValue }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-steel">{label}</span>
      <span className="tabular-nums text-ink">{value ? formatMetricValue(value) : "—"}</span>
    </div>
  );
}

/**
 * The Dashboard peek pane — "just another spine caller" (CLAUDE.md §6). Addressed by ?inspect=<metricId>.
 * Peek tiles carry "Open full ↗" to their working surface; pure (pane-only) metrics decompose into
 * the lines/metrics that compose them (no working surface to open) — peek where you read.
 */
export function MetricInspectPane({ tile, summary }: { tile: KpiTile; summary: DashboardSummary }) {
  const { definition, value, priorYear, budget, trail } = tile;
  const paneOnly = definition.firstTap === "pane_only";
  const delta = deltaVsBudget(tile);
  const decomp = METRIC_DECOMPOSITION[definition.id as string];

  const byId = new Map<string, KpiTile>();
  for (const fam of summary.families) for (const t of fam.tiles) byId.set(t.definition.id as string, t);

  const higherBetter = definition.higherIsBetter !== false;
  const cur = metricMagnitude(value);
  const py = priorYear ? metricMagnitude(priorYear) : cur;
  const trendFavorable = higherBetter ? cur >= py : cur <= py;

  return (
    <aside className="sticky top-8 w-[340px] shrink-0 rounded-xl border border-parchment-line bg-surface">
      <div className="flex items-start justify-between border-b border-parchment-line px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-steel">Inspect</div>
          <div className="font-heading text-lg text-ink">{definition.label}</div>
        </div>
        <Link href="/dashboard" scroll={false} className="rounded-md p-1 text-steel hover:bg-secondary hover:text-ink" aria-label="Close">
          <X className="size-4" />
        </Link>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-end justify-between gap-2">
          <span className="font-heading text-2xl leading-tight text-ink">{formatMetricValue(value)}</span>
          {trail && <Sparkline points={trail} className={trendFavorable ? "text-sage-deep" : "text-ember"} />}
        </div>
        <div className="mt-2">
          <ValueRow label="Prior year" value={priorYear} />
          <ValueRow label="Budget FY26" value={budget} />
          {delta && (
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-steel">vs budget</span>
              <span className={cn("font-medium", delta.favorable ? "text-sage-deep" : "text-ember-deep")}>{delta.text}</span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-parchment-line px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-steel">Basis</div>
        <p className="mt-1 text-sm text-steel">{definition.basis}</p>
      </div>

      {paneOnly ? (
        <div className="border-t border-parchment-line px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-deep">Pure metric · decomposes into</div>
          {decomp ? (
            <>
              <p className="mt-1 text-sm text-steel">{decomp.formula}</p>
              <ul className="mt-2 space-y-1">
                {decomp.parts.map((part) => {
                  const partTile = part.metricId ? byId.get(part.metricId) : undefined;
                  return (
                    <li key={part.label + part.href}>
                      <Link
                        href={part.href}
                        scroll={false}
                        className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-ember-tint/60"
                      >
                        <span className="text-ink">{part.label}</span>
                        <span className="flex items-center gap-1 tabular-nums text-steel">
                          {partTile ? formatMetricValue(partTile.value) : null}
                          <ChevronRight className="size-3.5 text-ember" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mt-1 text-sm text-steel">Decomposes into its component lines on the statements.</p>
          )}
          <p className="mt-2 text-xs text-steel">Pure metrics are pane-only — they decompose into the lines that compose them (§6).</p>
        </div>
      ) : (
        <div className="border-t border-parchment-line px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-steel">Open full ↗</div>
          <p className="mt-1 text-xs text-steel">Drill to the working surface this metric reads from.</p>
          <div className="mt-2 space-y-2">
            {(definition.openFull ?? []).map((href) => (
              <Link
                key={href}
                href={href}
                className="block rounded-lg border border-parchment-line px-3 py-2 transition-colors hover:border-ember/50 hover:bg-ember-tint/40"
              >
                <div className="flex items-center justify-between gap-2 text-sm text-ink">
                  <span>{routeLabel(href)}</span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-ember" />
                </div>
              </Link>
            ))}
            {!definition.openFull?.length && (
              <p className="text-sm text-steel">No working surface mapped for this metric.</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
