import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ScenarioId } from "@/lib/types/common";
import type { ScenarioBaseline } from "@/lib/types/scenario";
import type { ScenarioListItem } from "@/lib/queries";

const BASE_PATH = "/scenarios/pnl";

function href(scenarioId: ScenarioId, baseline?: ScenarioBaseline) {
  const params = new URLSearchParams({ scenario: scenarioId });
  if (baseline) params.set("baseline", baseline);
  return `${BASE_PATH}?${params.toString()}`;
}

/**
 * Read-only selectors for the Scenario P&L surface: which scenario (?scenario=) and which comparison
 * baseline (?baseline=base|budget — the version dropdown, §9). Base is excluded from the scenario
 * list (it is the comparison anchor, not a contained result). Navigation only; no editing.
 */
export function ScenarioPnLPicker({
  scenarios,
  selectedId,
  baseline,
}: {
  scenarios: readonly ScenarioListItem[];
  selectedId: ScenarioId;
  baseline: ScenarioBaseline;
}) {
  const choices = scenarios.filter((s) => !s.isBase);

  const scenarioChip = (s: ScenarioListItem) => (
    <Link
      key={s.id}
      href={href(s.id, baseline)}
      aria-current={s.id === selectedId ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors",
        s.id === selectedId
          ? "border-ember bg-ember/10 text-ember-deep"
          : "border-parchment-line bg-surface text-steel hover:border-ember/50 hover:text-ink",
      )}
    >
      <span className={s.id === selectedId ? "font-semibold" : "font-medium"}>{s.name}</span>
      {s.isPreset && <span className="rounded-full bg-frost/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate">preset</span>}
    </Link>
  );

  const baselineTab = (value: ScenarioBaseline, label: string) => (
    <Link
      href={href(selectedId, value)}
      className={cn(
        "rounded-md px-3 py-1 text-sm transition-colors",
        baseline === value ? "bg-surface font-medium text-ink shadow-sm" : "text-steel hover:text-ink",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">{choices.map(scenarioChip)}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-steel">Compare vs</span>
        <div className="inline-flex items-center gap-1 rounded-lg border border-parchment-line bg-secondary/40 p-0.5">
          {baselineTab("base", "Base Forecast")}
          {baselineTab("budget", "Budget")}
        </div>
      </div>
    </div>
  );
}
