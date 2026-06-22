import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { formatMoney, type Money } from "@/lib/types/money";
import type { MonthlyCashFlow, MonthlyCashFlowLine } from "@/lib/types/statements";
import { MonthlyHeader, MonthlyValueCell, colTone } from "./monthly-shared";

const fmt = (m: Money) => formatMoney(m, { compact: true });

const SECTION_LABEL: Partial<Record<MonthlyCashFlowLine["section"], string>> = {
  operating: "Operating Activities",
  investing: "Investing Activities",
  financing: "Financing Activities",
};

/**
 * Cash Flow (indirect method) spread across the months of the fiscal year — each cell is that month's
 * flow. The operating-CF and net-change subtotals are carried in the data (emphasized); the
 * working-capital deltas are month-over-month, so each line's Total (Σ months) equals the FY Cash Flow
 * Forecast column by construction.
 */
export function MonthlyCashFlowTable({ cf }: { cf: MonthlyCashFlow }) {
  const n = cf.months.length;
  let lastSection: MonthlyCashFlowLine["section"] | undefined;
  return (
    <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <MonthlyHeader months={cf.months} title={cf.label ?? "Cash Flow"} fyLabel={cf.label ?? "FY"} />
          <tbody>
            {cf.lines.map((line) => {
              const header = SECTION_LABEL[line.section];
              const showHeader = !!header && line.section !== lastSection;
              lastSection = line.section;
              const grand = line.section === "total";
              const negTotal = line.total.minor < 0;
              return (
                <Fragment key={line.id}>
                  {showHeader && (
                    <tr className="bg-secondary/30">
                      <th
                        scope="colgroup"
                        colSpan={n + 2}
                        className="px-3 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wider text-ember-deep"
                      >
                        {header}
                      </th>
                    </tr>
                  )}
                  <tr
                    className={cn(
                      "border-t border-parchment-line/60",
                      line.isSubtotal && "border-t-parchment-line bg-secondary/20",
                      grand && "bg-secondary/40",
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 whitespace-nowrap px-3 py-1.5 text-left",
                        line.isSubtotal ? "bg-secondary font-semibold text-ink" : "bg-surface font-normal text-ink",
                        !line.isSubtotal && "pl-5",
                        grand && "text-ember-deep",
                      )}
                    >
                      {line.label}
                    </th>
                    {line.monthly.map((v, i) => (
                      <MonthlyValueCell
                        key={cf.months[i].month}
                        value={v}
                        statusTone={cn(colTone(cf.months[i].status), grand && "bg-secondary/40")}
                        bold={line.isSubtotal}
                      />
                    ))}
                    <td
                      className={cn(
                        "whitespace-nowrap border-l border-parchment-line px-3 py-1.5 text-right font-semibold tabular-nums",
                        grand ? "bg-secondary/40" : line.isSubtotal ? "bg-secondary/40" : "bg-secondary/10",
                        negTotal ? "text-ember-deep" : grand ? "text-ember-deep" : "text-ink",
                      )}
                    >
                      {fmt(line.total)}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
