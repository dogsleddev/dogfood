import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, type Money } from "@/lib/types/money";
import type { MonthlyPnL, MonthlyPnLLine, MonthStatus, PnLLineId } from "@/lib/types/statements";
import { METRIC_CATALOG, formatMetricValue, type MetricValue } from "@/lib/types/metrics";

const SECTION_BEFORE: Partial<Record<PnLLineId, string>> = {
  subscription: "Revenue",
  direct_payroll: "Cost of Revenue",
  indirect_payroll: "Operating Expenses",
};

/** Compact $ for a dense grid; negatives carry the minus from Intl. */
const fmt = (m: Money) => formatMoney(m, { compact: true });

/** Status → cell tone. Forecast is muted; the in-close month gets a faint amber wash. */
const colTone = (status: MonthStatus): string =>
  status === "forecast" ? "bg-secondary/25" : status === "in_close" ? "bg-amber/10" : "";

function ValueCell({ value, status, subtotal }: { value: Money; status: MonthStatus; subtotal: boolean }) {
  const negative = value.minor < 0;
  return (
    <td
      className={cn(
        "whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums",
        colTone(status),
        subtotal && "font-semibold",
        negative ? "text-ember-deep" : "text-ink",
      )}
    >
      {fmt(value)}
    </td>
  );
}

function MonthlyRow({ line, months }: { line: MonthlyPnLLine; months: MonthlyPnL["months"] }) {
  const negativeTotal = line.total.minor < 0;
  return (
    <tr
      className={cn(
        "border-t border-parchment-line/60",
        line.isSubtotal && "border-t-parchment-line bg-secondary/20",
      )}
    >
      <th
        scope="row"
        className={cn(
          // opaque bg (no alpha) so horizontally-scrolled value cells don't bleed under the sticky column
          "sticky left-0 z-10 whitespace-nowrap px-3 py-1.5 text-left font-normal",
          line.isSubtotal ? "bg-secondary font-semibold text-ink" : "bg-surface text-ink",
        )}
      >
        <span className="flex items-baseline gap-2">
          <span className={cn(line.level === 1 && "pl-2")}>{line.label}</span>
          {line.marginPct !== undefined && (
            <span className="text-xs font-normal text-sage-deep">{formatPercent(line.marginPct, 1)}</span>
          )}
        </span>
      </th>
      {line.monthly.map((v, i) => (
        <ValueCell key={months[i].month} value={v} status={months[i].status} subtotal={line.isSubtotal} />
      ))}
      <td
        className={cn(
          "whitespace-nowrap border-l border-parchment-line px-3 py-1.5 text-right font-semibold tabular-nums",
          line.isSubtotal ? "bg-secondary/40" : "bg-secondary/10",
          negativeTotal ? "text-ember-deep" : "text-ink",
        )}
      >
        {fmt(line.total)}
      </td>
    </tr>
  );
}

/** Group the month columns into ACTUAL / IN CLOSE / FORECAST bands for the top header row. */
function statusBands(months: MonthlyPnL["months"]) {
  const bands: { label: string; span: number; status: MonthStatus }[] = [];
  for (const c of months) {
    const last = bands[bands.length - 1];
    if (last && last.status === c.status) last.span += 1;
    else bands.push({ label: bandLabel(c.status), span: 1, status: c.status });
  }
  return bands;
}
const bandLabel = (s: MonthStatus): string => (s === "actual" ? "Actual" : s === "in_close" ? "In close" : "Forecast");

export function MonthlyPnlTable({ pnl, kpis }: { pnl: MonthlyPnL; kpis: readonly MetricValue[] }) {
  const bands = statusBands(pnl.months);
  return (
    <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {/* band row: Actual / In close / Forecast */}
            <tr className="border-b border-parchment-line/60 text-[10px] uppercase tracking-wider text-steel">
              <th className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left" />
              {bands.map((b, i) => (
                <th
                  key={`${b.status}-${i}`}
                  colSpan={b.span}
                  className={cn(
                    "px-2.5 py-1.5 text-center font-semibold",
                    b.status === "forecast" ? "bg-secondary/25 text-ember-deep" : b.status === "in_close" ? "bg-amber/10 text-amber-deep" : "text-sage-deep",
                  )}
                >
                  {b.label}
                </th>
              ))}
              <th className="border-l border-parchment-line bg-secondary/20 px-3 py-1.5 text-right font-semibold text-ink">
                {pnl.label ?? "FY"}
              </th>
            </tr>
            {/* month label row */}
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">{pnl.label ?? "P&L"}</th>
              {pnl.months.map((c) => (
                <th key={c.month} className={cn("px-2.5 py-2 text-right font-medium", colTone(c.status))}>
                  {c.label}
                </th>
              ))}
              <th className="border-l border-parchment-line px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {pnl.lines.map((line) => {
              const section = SECTION_BEFORE[line.id];
              return (
                <Fragment key={line.id}>
                  {section && (
                    <tr className="bg-secondary/30">
                      <th
                        scope="colgroup"
                        colSpan={pnl.months.length + 2}
                        className="px-3 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wider text-ember-deep"
                      >
                        {section}
                      </th>
                    </tr>
                  )}
                  <MonthlyRow line={line} months={pnl.months} />
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <KpiFooter kpis={kpis} />
    </div>
  );
}

const KPI_LABEL = new Map(METRIC_CATALOG.map((d) => [d.id, d.label] as const));

function KpiFooter({ kpis }: { kpis: readonly MetricValue[] }) {
  if (kpis.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-px border-t border-parchment-line bg-parchment-line sm:grid-cols-4 lg:grid-cols-8">
      {kpis.map((k) => (
        <div key={k.id} className="bg-surface px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wider text-steel">{KPI_LABEL.get(k.id) ?? k.id}</div>
          <div className="mt-0.5 font-heading text-lg text-ink tabular-nums">{formatMetricValue(k)}</div>
        </div>
      ))}
    </div>
  );
}
