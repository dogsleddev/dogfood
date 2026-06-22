import { cn } from "@/lib/utils";
import { formatMetricValue, metricMagnitude, type MetricValue } from "@/lib/types/metrics";
import { percent, ratio } from "@/lib/types/money";
import type { MetricId } from "@/lib/types/common";
import type { ScenarioBaseline } from "@/lib/types/scenario";
import type { ScenarioListItem, ScenarioDashboardResult } from "@/lib/queries";

/** The headline KPIs each scenario row reports a delta on (vs Base). */
const HEADLINE_METRICS: readonly { id: MetricId; label: string }[] = [
  { id: "revenue" as MetricId, label: "Revenue" },
  { id: "net_income" as MetricId, label: "Net income" },
  { id: "runway" as MetricId, label: "Runway" },
];

const BASELINE_BADGE: Record<ScenarioBaseline, string> = {
  base: "bg-frost/20 text-steel",
  budget: "bg-amber/15 text-amber-deep",
};

const BASELINE_LABEL: Record<ScenarioBaseline, string> = {
  base: "vs Base",
  budget: "vs Budget",
};

/** Pull one metric value out of a dashboard column by metric id. */
function tileValue(
  columns: ScenarioDashboardResult["columns"],
  scenarioId: string,
  metricId: MetricId,
): MetricValue | undefined {
  const col = columns.find((c) => c.scenarioId === scenarioId);
  if (!col) return undefined;
  for (const family of col.dashboard.families) {
    for (const tile of family.tiles) {
      if (tile.definition.id === metricId) return tile.value;
    }
  }
  return undefined;
}

/** Format a signed delta (scenario − Base) in the metric's own units. */
function formatDelta(scenario: MetricValue | undefined, base: MetricValue | undefined): { text: string; tone: "pos" | "neg" | "flat" } {
  if (!scenario || !base) return { text: "—", tone: "flat" };
  const diff = metricMagnitude(scenario) - metricMagnitude(base);
  if (Math.abs(diff) < 1e-9) return { text: "no change", tone: "flat" };
  // Reuse the metric value formatter on a synthetic delta value of the same kind.
  const sign = diff > 0 ? "+" : "−";
  const magnitudeValue: MetricValue = { ...scenario };
  const abs = Math.abs(diff);
  let body: string;
  switch (scenario.kind) {
    case "money":
      body = formatMetricValue({ ...magnitudeValue, money: { ...scenario.money!, minor: Math.round(abs * 100) } });
      break;
    case "percent":
      body = formatMetricValue({ ...magnitudeValue, percent: percent(abs) });
      break;
    case "ratio":
      body = formatMetricValue({ ...magnitudeValue, ratio: ratio(abs) });
      break;
    case "count":
      body = formatMetricValue({ ...magnitudeValue, count: Math.round(abs) });
      break;
  }
  return { text: `${sign}${body}`, tone: diff > 0 ? "pos" : "neg" };
}

function HeadlineDeltas({
  scenarioId,
  columns,
}: {
  scenarioId: string;
  columns: ScenarioDashboardResult["columns"];
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {HEADLINE_METRICS.map((metric) => {
        const scenarioVal = tileValue(columns, scenarioId, metric.id);
        const baseVal = tileValue(columns, "base", metric.id);
        const delta = formatDelta(scenarioVal, baseVal);
        const toneClass =
          delta.tone === "pos" ? "text-sage-deep" : delta.tone === "neg" ? "text-ember-deep" : "text-steel";
        return (
          <div key={metric.id} className="rounded-lg border border-parchment-line/70 bg-secondary/30 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-steel/80">{metric.label}</div>
            <div className="mt-0.5 text-sm tabular-nums text-ink">
              {scenarioVal ? formatMetricValue(scenarioVal) : "—"}
            </div>
            <div className={cn("text-xs tabular-nums", toneClass)}>{delta.text}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The Scenario Manager list (CLAUDE.md §9): Base + the three seed presets, each as a card with its
 * baseline, adjustment count, and a few headline KPI deltas vs Base. Read-only — authoring (create /
 * duplicate / reset) lands with the persistence layer; this phase renders the contained model only.
 */
export function ScenarioList({
  scenarios,
  dashboard,
}: {
  scenarios: readonly ScenarioListItem[];
  dashboard: ScenarioDashboardResult;
}) {
  const base = scenarios.find((s) => s.isBase);
  const others = scenarios.filter((s) => !s.isBase);

  return (
    <div className="space-y-4">
      {base && (
        <div className="rounded-xl border border-parchment-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-ember" />
              <h2 className="font-heading text-xl text-ink">{base.name}</h2>
              <span className="rounded px-1.5 py-0.5 text-xs font-medium text-ember-deep">Anchor</span>
            </div>
            <span className="text-xs text-steel">No adjustments · the working forecast + actuals</span>
          </div>
          <p className="mt-2 text-sm text-steel">
            The default everywhere outside this group. Every scenario below stacks its adjustments on Base
            and reports the deltas it produces.
          </p>
        </div>
      )}

      {others.map((scenario) => (
        <div key={scenario.id} className="rounded-xl border border-parchment-line bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl text-ink">{scenario.name}</h2>
              {scenario.isPreset && (
                <span className="rounded bg-ember-tint px-1.5 py-0.5 text-xs font-medium text-ember-deep">
                  Preset
                </span>
              )}
              <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", BASELINE_BADGE[scenario.baseline])}>
                {BASELINE_LABEL[scenario.baseline]}
              </span>
            </div>
            <span className="text-sm text-steel">
              <span className="font-medium text-ink tabular-nums">{scenario.adjustmentCount}</span>{" "}
              {scenario.adjustmentCount === 1 ? "adjustment" : "adjustments"}
            </span>
          </div>
          <HeadlineDeltas scenarioId={scenario.id} columns={dashboard.columns} />
        </div>
      ))}
    </div>
  );
}
