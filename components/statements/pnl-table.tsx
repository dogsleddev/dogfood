import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, type Money } from "@/lib/types/money";
import type { PnL, PnLLine, PnLLineId, LinePolarity } from "@/lib/types/statements";

const SECTION_BEFORE: Partial<Record<PnLLineId, string>> = {
  subscription: "Revenue",
  direct_payroll: "Cost of Revenue",
  indirect_payroll: "Operating Expenses",
};

const fmt = (m?: Money) => (m ? formatMoney(m, { compact: true }) : "—");

const fmtVar = (m?: Money) => {
  if (!m) return "—";
  const s = formatMoney(m, { compact: true });
  return m.minor > 0 ? `+${s}` : s;
};

const varianceClass = (polarity: LinePolarity | undefined, minor: number) => {
  if (!polarity || polarity === "neutral" || minor === 0) return "text-steel";
  const favorable = polarity === "positive" ? minor > 0 : minor < 0;
  return favorable ? "text-sage-deep" : "text-ember-deep";
};

function Cell({ line, column, value }: { line: PnLLine; column: string; value?: Money }) {
  const variance = column === "variance";
  return (
    <td className="py-0">
      <Link
        href={`/statements/pnl?inspect=${line.id}`}
        className={cn(
          "block px-3 py-1.5 text-right tabular-nums transition-colors hover:bg-ember-tint/60",
          variance ? varianceClass(line.polarity, value?.minor ?? 0) : "text-ink",
          line.level === 0 && "font-semibold",
        )}
      >
        {variance ? fmtVar(value) : fmt(value)}
      </Link>
    </td>
  );
}

export function PnlTable({ pnl, inspect }: { pnl: PnL; inspect?: PnLLineId }) {
  return (
    <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
            <th className="px-3 py-2 text-left font-medium">{pnl.label ?? "Forecasted P&L"}</th>
            <th className="px-3 py-2 text-right font-medium">Budget FY26</th>
            <th className="px-3 py-2 text-right font-medium">Actual YTD</th>
            <th className="px-3 py-2 text-right font-medium">Forecast FY26</th>
            <th className="px-3 py-2 text-right font-medium">Var (Fcst−Bud)</th>
          </tr>
        </thead>
        <tbody>
          {pnl.lines.map((line) => {
            const section = SECTION_BEFORE[line.id];
            const active = inspect === line.id;
            return (
              <Fragment key={line.id}>
                {section && (
                  <tr className="bg-secondary/30">
                    <td colSpan={5} className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">
                      {section}
                    </td>
                  </tr>
                )}
                <tr
                  className={cn(
                    "group border-t border-parchment-line/60",
                    line.level === 0 && "border-t-parchment-line bg-secondary/20",
                    active && "bg-ember-tint/70",
                  )}
                >
                  <td className="py-0">
                    <Link
                      href={`/statements/pnl?inspect=${line.id}`}
                      className={cn(
                        "flex items-baseline gap-2 px-3 py-1.5 transition-colors hover:bg-ember-tint/60",
                        line.level === 0 ? "font-semibold text-ink" : "text-ink",
                      )}
                    >
                      <span>{line.label}</span>
                      {line.marginPct !== undefined && (
                        <span className="text-xs font-normal text-sage-deep">{formatPercent(line.marginPct, 1)} margin</span>
                      )}
                      {line.firstTap === "pane_only" && (
                        <span className="rounded bg-secondary px-1 py-0.5 text-[10px] font-medium text-steel">pane</span>
                      )}
                    </Link>
                  </td>
                  <Cell line={line} column="budget" value={line.values.budget} />
                  <Cell line={line} column="actual" value={line.values.actual} />
                  <Cell line={line} column="forecast" value={line.values.forecast} />
                  <Cell line={line} column="variance" value={line.values.variance} />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
