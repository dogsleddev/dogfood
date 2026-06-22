import { listScenarios, getScenario } from "@/lib/queries/scenarios";
import type { ScenarioId } from "@/lib/types/common";
import { ScenarioPicker } from "@/components/scenarios/scenario-picker";
import { AdjustmentBoard } from "@/components/scenarios/adjustment-board";

/**
 * Scenario Drivers — the read-only adjustment board (CLAUDE.md §9; diagrams/scenario-drivers.svg).
 * Reads the contained scenario read API ONLY (listScenarios / getScenario); no engine internals,
 * no editing UI. Default scenario is the first preset; `?scenario=` switches via the picker links.
 * The Scenarios group is contained — nothing here touches Base + actuals on the rest of the app.
 */
export default async function ScenarioDriversPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { scenario: rawId } = await searchParams;
  const scenarios = await listScenarios();

  // Default to the first non-Base scenario (a preset) so the board has levers to show.
  const fallback = scenarios.find((s) => !s.isBase) ?? scenarios[0];
  const requested = rawId ? scenarios.find((s) => s.id === rawId) : undefined;
  const selectedItem = requested ?? fallback;
  const selectedId = selectedItem?.id ?? ("base" as ScenarioId);

  const selected = selectedItem ? await getScenario(selectedId) : undefined;

  const baselineLabel =
    selected?.baseline === "budget" ? "Budget (locked plan)" : "Base (working forecast)";

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Scenarios · contained group (§9)
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Scenario Drivers</h1>
          <span className="text-sm text-steel">FY2026 · forecast tail Jul–Dec 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The adjustment board. Each scenario stacks a few levers from the closed typed set, each with
          a magnitude, a monthly window, and a Step or Ramp shape. Scenarios branch only the forecast
          months. The deterministic engine re-derives the Scenario P&L and Scenario Dashboard from
          these; this surface reads them and never leaves the group.
        </p>
      </header>

      <div className="mb-6">
        <ScenarioPicker scenarios={scenarios} selectedId={selectedId} />
      </div>

      {selected ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-parchment-line bg-surface px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wider text-steel/70">Scenario</span>
              <span className="font-heading text-lg text-ink">{selected.name}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wider text-steel/70">Compares to</span>
              <span className="text-sm font-medium text-ink">{baselineLabel}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wider text-steel/70">Adjustments</span>
              <span className="text-sm font-medium tabular-nums text-ink">
                {selected.adjustments.length}
              </span>
            </div>
            {selected.isPreset ? (
              <span className="ml-auto rounded-full bg-amber/15 px-3 py-1 text-xs font-medium text-amber-deep">
                Seed preset · editable starting point
              </span>
            ) : null}
          </div>

          <AdjustmentBoard adjustments={selected.adjustments} />
        </>
      ) : (
        <div className="rounded-xl border border-parchment-line bg-surface p-8 text-center text-sm text-steel">
          No scenarios available.
        </div>
      )}
    </div>
  );
}
