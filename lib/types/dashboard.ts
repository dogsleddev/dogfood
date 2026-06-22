/**
 * Layer 5 — Summaries: the roll-ups (CLAUDE.md §5).
 * Dashboard = the live cockpit; tiles ARE the Metrics layer surfaced here (§5, §6).
 */
import type { Month } from "./period";
import type { MetricFamily, MetricDefinition, MetricValue } from "./metrics";

export interface KpiTile {
  readonly definition: MetricDefinition;
  /** current period value */
  readonly value: MetricValue;
  /** prior-year actual, for YoY comparison */
  readonly priorYear?: MetricValue;
  /** current budget (FY plan) */
  readonly budget?: MetricValue;
  /** trailing magnitudes for a sparkline (oldest → newest) */
  readonly trail?: readonly number[];
}

export interface DashboardFamilyGroup {
  readonly family: MetricFamily;
  readonly label: string;
  readonly tiles: readonly KpiTile[];
}

export interface DashboardSummary {
  readonly period: Month;
  readonly families: readonly DashboardFamilyGroup[];
}

export interface BoardPackageSection {
  readonly title: string;
  readonly tiles: readonly KpiTile[];
}

export interface BoardPackage {
  readonly period: Month;
  readonly sections: readonly BoardPackageSection[];
}
