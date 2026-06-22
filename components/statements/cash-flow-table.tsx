import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, type Money } from "@/lib/types/money";
import type { CashFlow, CashFlowLine } from "@/lib/types/statements";

const fmt = (m?: Money) => (m ? formatMoney(m, { compact: true }) : "—");

const SECTION_LABEL: Partial<Record<CashFlowLine["section"], string>> = {
  operating: "Operating Activities",
  investing: "Investing Activities",
  financing: "Financing Activities",
};

function Cell({ line, col }: { line: CashFlowLine; col: "actual" | "forecast" }) {
  return (
    <td className="py-0">
      <Link
        href={`/statements/cash-flow?inspect=${line.id}`}
        className={cn(
          "block px-3 py-1.5 text-right tabular-nums text-ink transition-colors hover:bg-ember-tint/60",
          line.isSubtotal && "font-semibold",
        )}
      >
        {fmt(line.values[col])}
      </Link>
    </td>
  );
}

/**
 * Cash Flow Forecast (indirect method) — Actual YTD vs Forecast FY. Net income flows through D&A and
 * the working-capital changes to operating cash flow, then capex + financing to the net change in
 * cash. Tap any number to peek its driver in the pane (§6). Subtotals (operating CF, net change) are
 * carried in the data and rendered emphasized.
 */
export function CashFlowTable({
  cf,
  inspect,
  actualLabel,
  forecastLabel,
}: {
  cf: CashFlow;
  inspect?: string;
  actualLabel: string;
  forecastLabel: string;
}) {
  let lastSection: CashFlowLine["section"] | undefined;
  return (
    <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
            <th className="px-3 py-2 text-left font-medium">Cash Flow Forecast</th>
            <th className="px-3 py-2 text-right font-medium">{actualLabel}</th>
            <th className="px-3 py-2 text-right font-medium">{forecastLabel}</th>
          </tr>
        </thead>
        <tbody>
          {cf.lines.map((line) => {
            const header = SECTION_LABEL[line.section];
            const showHeader = !!header && line.section !== lastSection;
            lastSection = line.section;
            const active = inspect === line.id;
            return (
              <Fragment key={line.id}>
                {showHeader && (
                  <tr className="bg-secondary/30">
                    <td colSpan={3} className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">
                      {header}
                    </td>
                  </tr>
                )}
                <tr
                  className={cn(
                    "group border-t border-parchment-line/60",
                    line.isSubtotal && "border-t-parchment-line bg-secondary/20",
                    line.section === "total" && "bg-secondary/40",
                    active && "bg-ember-tint/70",
                  )}
                >
                  <td className="py-0">
                    <Link
                      href={`/statements/cash-flow?inspect=${line.id}`}
                      className={cn(
                        "block px-3 py-1.5 transition-colors hover:bg-ember-tint/60",
                        line.isSubtotal ? "font-semibold text-ink" : "text-ink",
                        line.section === "total" && "text-ember-deep",
                      )}
                    >
                      {line.label}
                    </Link>
                  </td>
                  <Cell line={line} col="actual" />
                  <Cell line={line} col="forecast" />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
