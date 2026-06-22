import { cn } from "@/lib/utils";
import { formatMoney, type Money, type Days } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { ArForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: false });
const fmtDays = (d: Days) => `${Math.round(d)}`;
const signedFull = (minor: number, currency: Money["currency"]) =>
  `${minor > 0 ? "+" : minor < 0 ? "−" : ""}${formatMoney({ minor: Math.abs(minor), currency }, { compact: false })}`;

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * The monthly AR Forecast series (CLAUDE.md §8, layer 2): one row per month of the fiscal year —
 * the receivables balance, implied DSO, and the month-over-month change in AR. Reads the live
 * `getArForecast` series; the balance === the Balance Sheet AR line and the Δ === the cash-flow
 * change-in-AR by construction. Change for the first in-series month shows "—" (no in-window prior).
 */
export function ArForecastTable({
  lines,
  currentPeriod,
}: {
  lines: readonly ArForecastLine[];
  currentPeriod: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <TH>Month</TH>
            <TH right>AR balance</TH>
            <TH right>Implied DSO</TH>
            <TH right>Change in AR</TH>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const prior = lines[i - 1];
            const changeMinor = prior ? line.balance.minor - prior.balance.minor : null;
            const isCurrent = line.period === currentPeriod;
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
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmt(line.balance)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">{fmtDays(line.dso)}</td>
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
                  {changeMinor === null ? "—" : signedFull(changeMinor, line.balance.currency)}
                </td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-sm text-steel">
                No AR forecast data for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
