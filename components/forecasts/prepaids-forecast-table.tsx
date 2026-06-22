import { cn } from "@/lib/utils";
import { formatMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { PrepaidsForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: false });

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * The monthly Prepaids Budget series (CLAUDE.md §8, layer 2): one row per month of the fiscal year —
 * additions, amortization, and the closing prepaid balance. Reads the live `getPrepaidsForecast`
 * series; balance = prior + additions − amortization ties exactly, and the closing balance ===
 * the Balance Sheet Prepaid Expenses line by construction.
 */
export function PrepaidsForecastTable({
  lines,
  currentPeriod,
}: {
  lines: readonly PrepaidsForecastLine[];
  currentPeriod: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <TH>Month</TH>
            <TH right>Additions</TH>
            <TH right>Amortization</TH>
            <TH right>Closing balance</TH>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
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
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmt(line.additions)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">{fmt(line.amortization)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmt(line.balance)}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-sm text-steel">
                No prepaids forecast data for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
