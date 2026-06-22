import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, type Money } from "@/lib/types/money";
import type { PnLLineId } from "@/lib/types/statements";
import type { ScenarioPnLResult, ScenarioPnLLine } from "@/lib/queries";

/** Section headers inserted before these lines (mirrors the Forecasted P&L layout, §8). */
const SECTION_BEFORE: Partial<Record<PnLLineId, string>> = {
  subscription: "Revenue",
  direct_payroll: "Cost of Revenue",
  indirect_payroll: "Operating Expenses",
};

const fmt = (m: Money) => formatMoney(m, { compact: true });

/** Signed delta in compact notation; "—" when flat. */
const fmtDelta = (m: Money) => {
  if (m.minor === 0) return "—";
  const s = formatMoney(m, { compact: true });
  return m.minor > 0 ? `+${s}` : s;
};

/**
 * Delta colouring is purely directional here (scenario vs its baseline) — a positive delta on any
 * line is shown sage, a negative ember. The Scenario P&L is a shape view (§9), not a favourable /
 * unfavourable variance read, so we do not flip polarity by line.
 */
const deltaClass = (minor: number) =>
  minor === 0 ? "text-steel" : minor > 0 ? "text-sage-deep" : "text-ember-deep";

function ValueCell({ children, emphasis }: { children: React.ReactNode; emphasis?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-1.5 text-right tabular-nums text-ink",
        emphasis && "font-semibold",
      )}
    >
      {children}
    </td>
  );
}

function Row({ line, baselineLabel }: { line: ScenarioPnLLine; baselineLabel: string }) {
  void baselineLabel;
  const head = line.level === 0;
  return (
    <tr className={cn("border-t border-parchment-line/60", head && "border-t-parchment-line bg-secondary/20")}>
      <td className="px-3 py-1.5">
        <span className={cn("flex items-baseline gap-2", head ? "font-semibold text-ink" : "text-ink")}>
          <span>{line.label}</span>
          {line.marginPct !== undefined && (
            <span className="text-xs font-normal text-sage-deep">{formatPercent(line.marginPct, 1)} margin</span>
          )}
        </span>
      </td>
      <ValueCell emphasis={head}>{fmt(line.scenario)}</ValueCell>
      <ValueCell emphasis={head}>{fmt(line.baseline)}</ValueCell>
      <td className={cn("px-3 py-1.5 text-right tabular-nums", deltaClass(line.delta.minor), head && "font-semibold")}>
        {fmtDelta(line.delta)}
      </td>
    </tr>
  );
}

/**
 * The contained Scenario P&L (CLAUDE.md §9): the selected scenario's forecast P&L beside its
 * comparison baseline (Base working forecast or the locked Budget snapshot), with the variance.
 * Read-only — the scenario value reads the FORECAST column re-derived by the engine; actuals and
 * Budget stay Base (containment). Columns: Scenario · Baseline · Variance.
 */
export function ScenarioPnLTable({ result }: { result: ScenarioPnLResult }) {
  const baselineLabel = result.comparedTo === "budget" ? "Budget" : "Base Forecast";
  return (
    <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
            <th className="px-3 py-2 text-left font-medium">{result.scenarioName} · FY26 forecast</th>
            <th className="px-3 py-2 text-right font-medium">{result.scenarioName}</th>
            <th className="px-3 py-2 text-right font-medium">{baselineLabel}</th>
            <th className="px-3 py-2 text-right font-medium">Variance</th>
          </tr>
        </thead>
        <tbody>
          {result.lines.map((line) => {
            const section = SECTION_BEFORE[line.id];
            return (
              <Fragment key={line.id}>
                {section && (
                  <tr className="bg-secondary/30">
                    <td colSpan={4} className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">
                      {section}
                    </td>
                  </tr>
                )}
                <Row line={line} baselineLabel={baselineLabel} />
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
