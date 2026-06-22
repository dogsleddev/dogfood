import { cn } from "@/lib/utils";
import { formatMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { FixedAssetForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: false });
const fmtMinor = (minor: number, currency: Money["currency"]) => fmt({ minor, currency });

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * The monthly Fixed Asset Budget schedule (CLAUDE.md §8, layer 2): one row per month of the fiscal
 * year — capex, depreciation, and the running net book value. Gross PP&E and accumulated depreciation
 * are derived running figures (opening NBV + cumulative capex). The `netBookValue` === the Balance
 * Sheet Fixed Assets line and `depreciation` === the P&L D&A line, by construction.
 */
export function FixedAssetsTable({
  lines,
  currentPeriod,
}: {
  lines: readonly FixedAssetForecastLine[];
  currentPeriod: string;
}) {
  const first = lines[0];
  const currency = first?.netBookValue.currency ?? "USD";
  // Opening net book value = first month's closing NBV rolled back one month.
  const openingNbvMinor = first ? first.netBookValue.minor - first.capex.minor + first.depreciation.minor : 0;

  let cumulativeCapexMinor = 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <TH>Month</TH>
            <TH right>Capex</TH>
            <TH right>Depreciation</TH>
            <TH right>Gross PP&E</TH>
            <TH right>Accum. depr.</TH>
            <TH right>Net PP&E</TH>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            cumulativeCapexMinor += line.capex.minor;
            const grossMinor = openingNbvMinor + cumulativeCapexMinor;
            const accumMinor = grossMinor - line.netBookValue.minor;
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
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmt(line.capex)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">{fmt(line.depreciation)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">
                  {fmtMinor(grossMinor, currency)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">
                  {fmtMinor(accumMinor, currency)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmt(line.netBookValue)}</td>
              </tr>
            );
          })}
          {lines.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-sm text-steel">
                No fixed asset forecast data for this period.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
