import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthIndex, monthYear, type Month } from "@/lib/types/period";
import type { ExpenseForecastLine } from "@/lib/types/drivers";
import type { ExpenseGroup } from "@/lib/types/common";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fmt = (m: Money) => formatMoney(m, { compact: true });

/** Bearing close boundary (§11): Jan–May 2026 actual, Jun 2026 in close, Jul–Dec forecast. */
type MonthStatus = "actual" | "in_close" | "forecast";
const CLOSE_YEAR = 2026;
const CLOSE_MONTH = 5; // May, last fully-closed month
function statusOf(m: Month): MonthStatus {
  const y = monthYear(m);
  const mi = monthIndex(m);
  if (y < CLOSE_YEAR || (y === CLOSE_YEAR && mi <= CLOSE_MONTH)) return "actual";
  if (y === CLOSE_YEAR && mi === CLOSE_MONTH + 1) return "in_close";
  return "forecast";
}
const colTone = (s: MonthStatus): string =>
  s === "forecast" ? "bg-secondary/25" : s === "in_close" ? "bg-amber/10" : "";

/**
 * The monthly Expense Forecast grid (CLAUDE.md §8, layer 2): non-payroll OpEx only, one row per
 * config-driven group, one column per month of the fiscal year, plus the OpEx total row. Each group
 * row links to its drill page (/forecasts/expenses/<group>). Σ groups per month === the seed OpEx
 * total === the P&L non-payroll OpEx lines by construction.
 */
export function ExpenseForecastTable({
  lines,
  groups,
}: {
  lines: readonly ExpenseForecastLine[];
  groups: readonly ExpenseGroup[];
}) {
  // Ordered unique month list (groups share the same fiscal-year span).
  const months: Month[] = Array.from(new Set(lines.map((l) => l.period))).sort() as Month[];

  const ordered = groups.slice().sort((a, b) => a.order - b.order);

  const monthlyFor = (groupId: string): Money[] =>
    months.map((m) =>
      sumMoney(lines.filter((l) => l.period === m && l.groupId === groupId).map((l) => l.amount)),
    );
  const totalRow: Money[] = months.map((m) =>
    sumMoney(lines.filter((l) => l.period === m).map((l) => l.amount)),
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">Group</th>
            {months.map((m) => (
              <th
                key={m}
                className={cn("whitespace-nowrap px-2.5 py-2 text-right font-medium", colTone(statusOf(m)))}
              >
                {MONTH_ABBR[monthIndex(m) - 1]}
              </th>
            ))}
            <th className="whitespace-nowrap border-l border-parchment-line px-3 py-2 text-right font-medium">
              FY{months[0] ? monthYear(months[0]) : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((g) => {
            const monthly = monthlyFor(g.id);
            const fyTotal = sumMoney(monthly);
            return (
              <tr key={g.id} className="border-t border-parchment-line/60 hover:bg-ember-tint/40">
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 text-left font-normal text-ink"
                >
                  <Link href={`/forecasts/expenses/${g.id}`} className="hover:text-ember-deep hover:underline">
                    {g.label}
                  </Link>
                </th>
                {monthly.map((v, i) => (
                  <td
                    key={months[i] ?? i}
                    className={cn(
                      "whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums text-steel",
                      months[i] ? colTone(statusOf(months[i])) : "",
                    )}
                  >
                    {fmt(v)}
                  </td>
                ))}
                <td className="whitespace-nowrap border-l border-parchment-line bg-secondary/10 px-3 py-1.5 text-right font-semibold tabular-nums text-ink">
                  {fmt(fyTotal)}
                </td>
              </tr>
            );
          })}

          <tr className="border-t border-t-parchment-line bg-secondary/20">
            <th
              scope="row"
              className="sticky left-0 z-10 whitespace-nowrap bg-secondary px-3 py-1.5 text-left font-semibold text-ink"
            >
              Total OpEx
            </th>
            {totalRow.map((v, i) => (
              <td
                key={months[i] ?? i}
                className={cn(
                  "whitespace-nowrap px-2.5 py-1.5 text-right font-semibold tabular-nums text-ink",
                  months[i] ? colTone(statusOf(months[i])) : "",
                )}
              >
                {fmt(v)}
              </td>
            ))}
            <td className="whitespace-nowrap border-l border-parchment-line bg-secondary/40 px-3 py-1.5 text-right font-semibold tabular-nums text-ink">
              {fmt(sumMoney(totalRow))}
            </td>
          </tr>

          {ordered.length === 0 && (
            <tr>
              <td colSpan={months.length + 2} className="px-3 py-8 text-center text-sm text-steel">
                No expense forecast data for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
