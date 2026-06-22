import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthLabel, monthIndex, monthYear, type Month } from "@/lib/types/period";
import type { ExpenseForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: false });
const signedFull = (minor: number, currency: Money["currency"]) =>
  `${minor > 0 ? "+" : minor < 0 ? "−" : ""}${formatMoney({ minor: Math.abs(minor), currency }, { compact: false })}`;

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
const STATUS_LABEL: Record<MonthStatus, string> = {
  actual: "Actual",
  in_close: "In close",
  forecast: "Forecast",
};

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * The monthly Expense Forecast series for one OpEx group (CLAUDE.md §8, layer 2): one row per month
 * of the fiscal year — the group's spend, its month-over-month change, and the actual/in-close/forecast
 * status against the close boundary. Reads the live `getExpenseForecast` group slice; each amount sums
 * into the all-groups OpEx total and reconciles to the P&L non-payroll OpEx lines by construction.
 * Change for the first in-series month shows "—" (no in-window prior).
 */
export function ExpenseGroupTable({
  lines,
  currentPeriod,
}: {
  lines: readonly ExpenseForecastLine[];
  currentPeriod: string;
}) {
  const fyTotal = sumMoney(lines.map((l) => l.amount));

  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <TH>Month</TH>
            <TH>Status</TH>
            <TH right>Amount</TH>
            <TH right>Change</TH>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const prior = lines[i - 1];
            const changeMinor = prior ? line.amount.minor - prior.amount.minor : null;
            const isCurrent = line.period === currentPeriod;
            const status = statusOf(line.period);
            return (
              <tr
                key={line.period}
                className={cn(
                  "border-t border-parchment-line/60 hover:bg-ember-tint/40",
                  isCurrent && "bg-ember-tint/30",
                )}
              >
                <td className="px-3 py-1.5 text-ink">
                  {monthLabel(line.period)}
                  {isCurrent && <span className="ml-2 text-xs text-ember-deep">current</span>}
                </td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-xs",
                    status === "forecast" ? "text-steel" : status === "in_close" ? "text-amber-deep" : "text-sage-deep",
                  )}
                >
                  {STATUS_LABEL[status]}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmt(line.amount)}</td>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right tabular-nums",
                    changeMinor === null
                      ? "text-steel"
                      : changeMinor > 0
                        ? "text-ember-deep"
                        : changeMinor < 0
                          ? "text-sage-deep"
                          : "text-steel",
                  )}
                >
                  {changeMinor === null ? "—" : signedFull(changeMinor, line.amount.currency)}
                </td>
              </tr>
            );
          })}
          {lines.length > 0 && (
            <tr className="border-t border-parchment-line bg-secondary/30 font-semibold text-ink">
              <td className="px-3 py-2">FY{monthYear(lines[0].period)} total</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right tabular-nums">{fmt(fyTotal)}</td>
              <td className="px-3 py-2" />
            </tr>
          )}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-sm text-steel">
                No expense forecast data for this group.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
