/**
 * Layer 4 — Metrics reads (CLAUDE.md §5). Surfaced through the Dashboard.
 * Design (the catalog) is decided in Harness; the values + drill-downs are built in the Run.
 */
import type { Month } from "@/lib/types/period";
import type { MetricId } from "@/lib/types/common";
import type { MetricFamily, MetricValue, MetricDefinition } from "@/lib/types/metrics";
import { METRIC_CATALOG } from "@/lib/types/metrics";
import { getDataStore } from "@/lib/datastore";

/** The locked metric design (the 19-tile catalog). Static — safe to read now. */
export function listMetricDefinitions(family?: MetricFamily): readonly MetricDefinition[] {
  return family ? METRIC_CATALOG.filter((d) => d.family === family) : METRIC_CATALOG;
}

export async function getMetric(metricId: MetricId, period: Month): Promise<MetricValue> {
  const value = await getDataStore().getMetricValue(metricId, period);
  if (!value) throw new Error(`unknown metric: ${metricId}`);
  return value;
}

export async function getMetricSet(period: Month, opts: { family?: MetricFamily } = {}): Promise<readonly MetricValue[]> {
  const defs = opts.family ? METRIC_CATALOG.filter((d) => d.family === opts.family) : METRIC_CATALOG;
  const store = getDataStore();
  const values = await Promise.all(defs.map((d) => store.getMetricValue(d.id, period)));
  return values.filter((v): v is MetricValue => v !== undefined);
}
