import Link from "next/link";
import { getScenarioDashboard, listScenarios } from "@/lib/queries";
import type { ScenarioListItem } from "@/lib/queries";
import type { ScenarioId } from "@/lib/types/common";
import { monthLabel } from "@/lib/types/period";
import { cn } from "@/lib/utils";
import { ScenarioCompareTable } from "@/components/scenarios/scenario-compare-table";

const BASE_ID = "base" as ScenarioId;
const MAX_COLUMNS = 4; // Base + up to 3 scenarios (§9: 2–3 side by side)

/** Parse the `?ids=` compare set; always anchored by Base, capped, de-duplicated, valid ids only. */
function resolveSelection(raw: string | undefined, all: readonly ScenarioListItem[]): ScenarioId[] {
  const known = new Set(all.map((s) => s.id));
  const requested = (raw ?? "")
    .split(",")
    .map((s) => s.trim() as ScenarioId)
    .filter((id) => id.length > 0 && known.has(id) && id !== BASE_ID);

  // Default: Base + the three presets (the board view) when nothing is requested.
  const presets = all.filter((s) => s.isPreset).map((s) => s.id);
  const chosen = requested.length > 0 ? requested : presets;

  const ordered: ScenarioId[] = [BASE_ID];
  for (const id of chosen) {
    if (!ordered.includes(id) && ordered.length < MAX_COLUMNS) ordered.push(id);
  }
  return ordered;
}

/** Build a `?ids=` href that toggles one scenario into / out of the current compare set. */
function toggleHref(selected: readonly ScenarioId[], id: ScenarioId): string {
  const others = selected.filter((s) => s !== BASE_ID);
  const next = others.includes(id) ? others.filter((s) => s !== id) : [...others, id];
  return next.length > 0 ? `?ids=${next.join(",")}` : "/scenarios/dashboard";
}

export default async function ScenarioDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids: rawIds } = await searchParams;
  const all = await listScenarios();
  const selected = resolveSelection(rawIds, all);
  const result = await getScenarioDashboard(selected);

  // Selectable scenarios = everything except Base (Base always anchors the board).
  const selectable = all.filter((s) => !s.isBase);
  const atCap = selected.filter((s) => s !== BASE_ID).length >= MAX_COLUMNS - 1;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Scenarios · contained group (§9)
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Scenario Dashboard</h1>
          <span className="text-sm text-steel">FY2026 · as of {monthLabel(result.period)}</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The compare / board view. Base and up to three scenarios side by side, each KPI a row with its
          delta vs Base. Forecast-tail levers move the FY P&amp;L and cash KPIs; growth and retention
          metrics stay on the Base lens. Read-only: scenarios are built on the Scenario Drivers board.
        </p>
      </header>

      <div className="mb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel">Compare</div>
        <div className="flex flex-wrap gap-2">
          {selectable.map((s) => {
            const active = selected.includes(s.id);
            const disabled = !active && atCap;
            return (
              <Link
                key={s.id}
                href={disabled ? "#" : toggleHref(selected, s.id)}
                aria-disabled={disabled}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                  active
                    ? "border-ember bg-ember-tint text-ember-deep"
                    : disabled
                      ? "cursor-not-allowed border-parchment-line text-steel/50"
                      : "border-parchment-line bg-surface text-steel hover:border-ember/40 hover:text-ink",
                )}
              >
                <span>{s.name}</span>
                {s.isPreset && (
                  <span className="rounded bg-secondary px-1 py-0.5 text-[10px] font-medium text-steel">
                    preset
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-steel">
          Base anchors the board. Pick up to three scenarios to compare. Comparing{" "}
          {result.columns.length} column{result.columns.length === 1 ? "" : "s"}.
        </p>
      </div>

      <ScenarioCompareTable result={result} />
    </div>
  );
}
