/** Overview · Dashboard + Board Package (layer 5 — CLAUDE.md §8). */
import type { Month } from "@/lib/types/period";
import type { MetricId } from "@/lib/types/common";
import type { DashboardSummary, KpiTile, BoardPackage } from "@/lib/types/dashboard";
import { getDataStore } from "@/lib/datastore";
import { type ScenarioOpt } from "./util";

/**
 * Reads through the DataStore seam (§4). The Financial family is derived from the same seed P&L
 * getPnL reads, so the Dashboard's Revenue tile === the P&L Total Revenue (one source, two callers).
 * scenarioId is ignored here: the Dashboard is always Base + actuals (containment, §9).
 */
export async function getDashboardSummary(period: Month, _opts: ScenarioOpt = {}): Promise<DashboardSummary> {
  return getDataStore().getDashboardSummary(period);
}

export async function getKpiTile(metricId: MetricId, period: Month): Promise<KpiTile> {
  const tile = await getDataStore().getKpiTile(metricId, period);
  if (!tile) throw new Error(`unknown metric: ${metricId}`);
  return tile;
}

/**
 * The exportable board deliverable (§8) — COMPOSED, not recomputed. Assembles the live Dashboard
 * summary (the metric tiles, by family) into board sections, so every figure === its Dashboard tile
 * (one source, two callers). Each metric family becomes a section, preserving the catalog order.
 */
export async function getBoardPackage(period: Month): Promise<BoardPackage> {
  const summary = await getDataStore().getDashboardSummary(period);
  return {
    period: summary.period,
    sections: summary.families.map((f) => ({ title: f.label, tiles: f.tiles })),
  };
}
