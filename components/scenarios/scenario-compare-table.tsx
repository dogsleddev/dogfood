import { cn } from "@/lib/utils";
import type { ScenarioDashboardResult } from "@/lib/queries";
import type { MetricId } from "@/lib/types/common";
import type { MetricValue, MetricValueKind } from "@/lib/types/metrics";
import { formatMetricValue, metricMagnitude, metricValueFromMagnitude } from "@/lib/types/metrics";
import { formatPercent, percent, type Percent } from "@/lib/types/money";
import type { Month } from "@/lib/types/period";

/**
 * The compare / board view (CLAUDE.md §9): 2–3 scenarios (and Base) side by side, one KPI per row,
 * each scenario a column with its value and a delta vs Base. Read-only — the engine read API
 * (getScenarioDashboard) is the only data path; the Scenario lens stays contained to this group.
 */

/** A KPI row spec: a label, how to pull its value from a scenario dashboard, and direction. */
interface KpiRowSpec {
  readonly key: string;
  readonly label: string;
  readonly note: string;
  readonly higherIsBetter: boolean;
  /** pull the metric value for one scenario column; undefined → "—" */
  readonly pull: (tiles: Map<MetricId, MetricValue>, period: Month) => MetricValue | undefined;
}

const mid = (s: string): MetricId => s as MetricId;

/** A plain metric pulled straight from the dashboard by id. */
function direct(id: string): KpiRowSpec["pull"] {
  return (tiles) => tiles.get(mid(id));
}

/** Operating margin % is derived (operating_income ÷ revenue) — no standalone catalog tile. */
function operatingMargin(tiles: Map<MetricId, MetricValue>, period: Month): MetricValue | undefined {
  const opInc = tiles.get(mid("operating_income"));
  const rev = tiles.get(mid("revenue"));
  if (!opInc?.money || !rev?.money || rev.money.minor === 0) return undefined;
  const frac = opInc.money.minor / rev.money.minor;
  return metricValueFromMagnitude(mid("operating_margin"), period, "percent" as MetricValueKind, frac);
}

const ROWS: readonly KpiRowSpec[] = [
  { key: "revenue", label: "Revenue", note: "FY recognized", higherIsBetter: true, pull: direct("revenue") },
  { key: "operating_margin", label: "Operating margin", note: "operating income ÷ revenue", higherIsBetter: true, pull: operatingMargin },
  { key: "net_income", label: "Net income", note: "after interest & tax", higherIsBetter: true, pull: direct("net_income") },
  { key: "runway", label: "Runway", note: "cash ÷ net burn", higherIsBetter: true, pull: direct("runway") },
  { key: "nrr", label: "Net revenue retention", note: "i-12 cohort (Base lens)", higherIsBetter: true, pull: direct("nrr") },
  { key: "rule_of_40", label: "Rule of 40", note: "growth % + non-GAAP op margin %", higherIsBetter: true, pull: direct("rule_of_40") },
];

function tilesById(dashboard: ScenarioDashboardResult["columns"][number]["dashboard"]): Map<MetricId, MetricValue> {
  const map = new Map<MetricId, MetricValue>();
  for (const family of dashboard.families) {
    for (const tile of family.tiles) map.set(tile.definition.id, tile.value);
  }
  return map;
}

/** Format a signed delta between two same-kind metric values, relative to the base column. */
function formatDelta(
  value: MetricValue,
  base: MetricValue | undefined,
  higherIsBetter: boolean,
): { text: string; favorable: boolean } | null {
  if (!base) return null;
  const cur = metricMagnitude(value);
  const ref = metricMagnitude(base);
  const diff = cur - ref;
  if (Math.abs(diff) < 1e-9) return { text: "—", favorable: true };
  const favorable = higherIsBetter ? diff > 0 : diff < 0;
  let text: string;
  switch (value.kind) {
    case "percent":
      text = `${diff >= 0 ? "+" : ""}${formatPercent(percent(diff) as Percent, 1).replace("%", "")}pp`;
      break;
    case "ratio":
      text = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}x`;
      break;
    case "count":
      text = `${diff >= 0 ? "+" : ""}${Math.round(diff)} mo`;
      break;
    case "money": {
      const pct = ref !== 0 ? (diff / Math.abs(ref)) * 100 : 0;
      text = `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
      break;
    }
  }
  return { text, favorable };
}

export function ScenarioCompareTable({ result }: { result: ScenarioDashboardResult }) {
  const { period, columns } = result;
  const baseCol = columns.find((c) => c.isBase) ?? columns[0];
  const baseTiles = baseCol ? tilesById(baseCol.dashboard) : new Map<MetricId, MetricValue>();
  const colTiles = columns.map((c) => ({ col: c, tiles: tilesById(c.dashboard) }));

  return (
    <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary/40">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-steel">
              KPI
            </th>
            {colTiles.map(({ col }) => (
              <th key={col.scenarioId} className="px-5 py-3 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-heading text-base text-ink">{col.scenarioName}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      col.isBase ? "bg-ember-tint text-ember-deep" : "bg-secondary text-steel",
                    )}
                  >
                    {col.isBase ? "Base + actuals" : "scenario"}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const baseValue = row.pull(baseTiles, period);
            return (
              <tr key={row.key} className="border-b border-parchment-line/60 last:border-0">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{row.label}</div>
                  <div className="text-[11px] text-steel">{row.note}</div>
                </td>
                {colTiles.map(({ col, tiles }) => {
                  const value = row.pull(tiles, period);
                  const delta = !col.isBase && value ? formatDelta(value, baseValue, row.higherIsBetter) : null;
                  return (
                    <td key={col.scenarioId} className="px-5 py-3 text-right align-top">
                      <div className="font-heading text-lg tabular-nums text-ink">
                        {value ? formatMetricValue(value) : "—"}
                      </div>
                      {delta && (
                        <div
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            delta.text === "—"
                              ? "text-steel"
                              : delta.favorable
                                ? "text-sage-deep"
                                : "text-ember-deep",
                          )}
                        >
                          {delta.text} vs Base
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
