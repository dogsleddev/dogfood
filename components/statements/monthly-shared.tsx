import { cn } from "@/lib/utils";
import { formatMoney, type Money } from "@/lib/types/money";
import type { MonthStatus, MonthlyColumn } from "@/lib/types/statements";

/** Status → cell tone. Forecast is muted; the in-close month gets a faint amber wash. */
export const colTone = (status: MonthStatus): string =>
  status === "forecast" ? "bg-secondary/25" : status === "in_close" ? "bg-amber/10" : "";

export const bandLabel = (s: MonthStatus): string =>
  s === "actual" ? "Actual" : s === "in_close" ? "In close" : "Forecast";

/** Group the month columns into ACTUAL / IN CLOSE / FORECAST bands for the top header row. */
export function statusBands(months: readonly MonthlyColumn[]) {
  const bands: { label: string; span: number; status: MonthStatus }[] = [];
  for (const c of months) {
    const last = bands[bands.length - 1];
    if (last && last.status === c.status) last.span += 1;
    else bands.push({ label: bandLabel(c.status), span: 1, status: c.status });
  }
  return bands;
}

/** The two header rows shared by the monthly statement tables: a status-band row (Actual / In close /
 *  Forecast) and the month-label row, plus the leading sticky cell and the trailing Total cell. */
export function MonthlyHeader({
  months,
  title,
  fyLabel,
}: {
  months: readonly MonthlyColumn[];
  title: string;
  fyLabel: string;
}) {
  const bands = statusBands(months);
  return (
    <thead>
      <tr className="border-b border-parchment-line/60 text-[10px] uppercase tracking-wider text-steel">
        <th className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left" />
        {bands.map((b, i) => (
          <th
            key={`${b.status}-${i}`}
            colSpan={b.span}
            className={cn(
              "px-2.5 py-1.5 text-center font-semibold",
              b.status === "forecast"
                ? "bg-secondary/25 text-ember-deep"
                : b.status === "in_close"
                  ? "bg-amber/10 text-amber-deep"
                  : "text-sage-deep",
            )}
          >
            {b.label}
          </th>
        ))}
        <th className="border-l border-parchment-line bg-secondary/20 px-3 py-1.5 text-right font-semibold text-ink">
          {fyLabel}
        </th>
      </tr>
      <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
        <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">{title}</th>
        {months.map((c) => (
          <th key={c.month} className={cn("px-2.5 py-2 text-right font-medium", colTone(c.status))}>
            {c.label}
          </th>
        ))}
        <th className="border-l border-parchment-line px-3 py-2 text-right font-medium">Total</th>
      </tr>
    </thead>
  );
}

/** A single month value cell — compact $, negatives in ember, optional bold for subtotals. */
export function MonthlyValueCell({
  value,
  statusTone,
  bold,
}: {
  value: Money;
  statusTone?: string;
  bold?: boolean;
}) {
  const negative = value.minor < 0;
  return (
    <td
      className={cn(
        "whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums",
        statusTone,
        bold && "font-semibold",
        negative ? "text-ember-deep" : "text-ink",
      )}
    >
      {formatMoney(value, { compact: true })}
    </td>
  );
}
