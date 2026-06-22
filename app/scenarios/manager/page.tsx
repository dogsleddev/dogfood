import { listScenarios, getScenarioDashboard } from "@/lib/queries";
import type { ScenarioId } from "@/lib/types/common";
import { ScenarioList } from "@/components/scenarios/scenario-list";

export default async function ScenarioManagerPage() {
  const scenarios = await listScenarios();
  // One pass over the engine: Base anchors the deltas, the others report against it.
  const ids = scenarios.map((s) => s.id as ScenarioId);
  const dashboard = await getScenarioDashboard(ids);

  const presetCount = scenarios.filter((s) => s.isPreset).length;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Scenarios · contained group
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Scenario Manager</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          Base plus {presetCount} seed presets. Each scenario stacks time-bounded adjustments on Base and
          re-derives only the contained Scenario P&L and Scenario Dashboard. Everything outside this group
          stays Base plus actuals. Headline deltas below compare each scenario against Base.
        </p>
      </header>

      <ScenarioList scenarios={scenarios} dashboard={dashboard} />

      <p className="mt-5 text-xs text-steel">
        Create a scenario above, or duplicate any row (presets included) to start from a known shape; reset or
        delete your own from each card. Base and the presets are immutable starting points — only your scenarios
        persist. Edit the levers on Scenario Drivers.
      </p>
    </div>
  );
}
