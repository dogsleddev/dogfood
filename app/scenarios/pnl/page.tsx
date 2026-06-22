import { listScenarios, getScenarioPnL, type ScenarioPnLLine } from "@/lib/queries";
import { monthLabel } from "@/lib/types/period";
import { formatMoney, type Money } from "@/lib/types/money";
import type { ScenarioId } from "@/lib/types/common";
import type { ScenarioBaseline } from "@/lib/types/scenario";
import { cn } from "@/lib/utils";
import { ScenarioPnLPicker } from "@/components/scenarios/scenario-pnl-picker";
import { ScenarioPnLTable } from "@/components/scenarios/scenario-pnl-table";

const BASELINES: readonly ScenarioBaseline[] = ["base", "budget"];

/** Headline lines surfaced as delta cards above the table. */
const HEADLINE_LINES: readonly { id: string; label: string }[] = [
  { id: "total_revenue", label: "Total Revenue" },
  { id: "gross_profit", label: "Gross Profit" },
  { id: "operating_income", label: "Operating Income" },
  { id: "net_income", label: "Net Income" },
];

const fmtDelta = (m: Money) => {
  if (m.minor === 0) return "—";
  const s = formatMoney(m, { compact: true });
  return m.minor > 0 ? `+${s}` : s;
};

const deltaClass = (minor: number) =>
  minor === 0 ? "text-steel" : minor > 0 ? "text-sage-deep" : "text-ember-deep";

function HeadlineCards({ lines }: { lines: readonly ScenarioPnLLine[] }) {
  const byId = new Map(lines.map((l) => [l.id as string, l]));
  const cards = HEADLINE_LINES.map((h) => ({ ...h, line: byId.get(h.id) })).filter(
    (c): c is typeof c & { line: ScenarioPnLLine } => c.line !== undefined,
  );
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.id} className="rounded-xl border border-parchment-line bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-steel">{c.label}</div>
          <div className="mt-1 font-heading text-2xl tabular-nums text-ink">
            {formatMoney(c.line.scenario, { compact: true })}
          </div>
          <div className={cn("mt-1 text-sm tabular-nums", deltaClass(c.line.delta.minor))}>
            {fmtDelta(c.line.delta)} vs baseline
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ScenarioPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; baseline?: string }>;
}) {
  const { scenario: rawScenario, baseline: rawBaseline } = await searchParams;
  const scenarios = await listScenarios();

  // Default to the first preset (a contained result), never Base (the comparison anchor).
  const choices = scenarios.filter((s) => !s.isBase);
  const requested = choices.find((s) => s.id === (rawScenario as ScenarioId));
  const selected = requested ?? choices[0];

  const baseline: ScenarioBaseline = BASELINES.includes(rawBaseline as ScenarioBaseline)
    ? (rawBaseline as ScenarioBaseline)
    : (selected?.baseline ?? "base");

  const result = selected ? await getScenarioPnL(selected.id, baseline) : undefined;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Scenarios · contained group (§9)
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Scenario P&amp;L</h1>
          <span className="text-sm text-steel">
            {result ? `FY${monthLabel(result.period).split(" ")[1].slice(2)} forecast` : "FY2026 forecast"}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The contained result: a selected scenario&apos;s forecast P&amp;L beside its comparison baseline
          (the working Base forecast, or the locked Budget snapshot), with the variance. Only the forecast
          months branch; actuals stay Base, and nothing outside the Scenarios group changes. Read-only.
        </p>
      </header>

      {selected ? (
        <>
          <div className="mb-6">
            <ScenarioPnLPicker scenarios={scenarios} selectedId={selected.id} baseline={baseline} />
          </div>
          {result ? (
            <>
              <HeadlineCards lines={result.lines} />
              <ScenarioPnLTable result={result} />
              <p className="mt-3 text-xs text-steel">
                {`Comparing ${result.scenarioName} vs ${
                  result.comparedTo === "budget" ? "the locked Budget snapshot" : "the live Base forecast"
                }. Scenario figures are the engine-derived forecast column; the variance is Scenario minus baseline.`}
              </p>
            </>
          ) : (
            <p className="text-sm text-steel">No result for the selected scenario.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-steel">No scenarios available.</p>
      )}
    </div>
  );
}
