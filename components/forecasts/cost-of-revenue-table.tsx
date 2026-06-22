import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, sumMoney, percent, type Money } from "@/lib/types/money";
import { monthIndex, monthYear, type Month } from "@/lib/types/period";
import type { CostOfRevenueLine, RevenueForecastLine } from "@/lib/types/drivers";

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

type RowKind = "money" | "pct";
interface Row {
  label: string;
  level: 0 | 1;
  kind: RowKind;
  monthly: Money[];
  /** for pct rows: the per-month fraction (1 === 100%); FY uses the FY aggregate */
  monthlyPct?: number[];
  fyPct?: number;
  subtotal?: boolean;
}

/**
 * The monthly Cost of Revenue grid (CLAUDE.md §8, layer 2). Pivots the live `getCostOfRevenue`
 * lines into the assembled buildup — Direct Payroll (from Personnel's Direct-function depts) plus
 * the non-employee cost-to-serve (rate × revenue) split subscription/services — then the Total Cost
 * of Revenue line, and the Gross Margin % linkage (Revenue − CoR ÷ Revenue). Total Cost of Revenue
 * === the seed CoR series === the P&L Total Cost of Revenue line by construction; Gross Margin %
 * === the P&L Gross Margin %.
 */
export function CostOfRevenueTable({
  lines,
  subLines,
  svcLines,
  revLines,
}: {
  lines: readonly CostOfRevenueLine[];
  subLines: readonly CostOfRevenueLine[];
  svcLines: readonly CostOfRevenueLine[];
  revLines: readonly RevenueForecastLine[];
}) {
  const months = lines.map((l) => l.period);

  const directPayroll = lines.map((l) => l.directPayroll);
  const subNonEmp = subLines.map((l) => l.nonEmployee);
  const svcNonEmp = svcLines.map((l) => l.nonEmployee);
  const totalCor = lines.map((l) => l.total);

  // Revenue per month (subscription + services), for the gross-margin linkage.
  const revByMonth = months.map((m) => {
    const sub = revLines.find((l) => l.stream === "subscription" && l.period === m)?.total.minor ?? 0;
    const svc = revLines.find((l) => l.stream === "services" && l.period === m)?.total.minor ?? 0;
    return sub + svc;
  });
  const grossMarginPct = months.map((_, i) => {
    const rev = revByMonth[i] ?? 0;
    return rev > 0 ? (rev - (totalCor[i]?.minor ?? 0)) / rev : 0;
  });
  const fyRev = revByMonth.reduce((a, b) => a + b, 0);
  const fyCor = sumMoney(totalCor).minor;
  const fyGrossMarginPct = fyRev > 0 ? (fyRev - fyCor) / fyRev : 0;

  const rows: Row[] = [
    { label: "Direct payroll", level: 1, kind: "money", monthly: directPayroll },
    { label: "Non-employee · subscription", level: 1, kind: "money", monthly: subNonEmp },
    { label: "Non-employee · services", level: 1, kind: "money", monthly: svcNonEmp },
    { label: "Total Cost of Revenue", level: 0, kind: "money", monthly: totalCor, subtotal: true },
    {
      label: "Gross Margin %",
      level: 0,
      kind: "pct",
      monthly: [],
      monthlyPct: grossMarginPct,
      fyPct: fyGrossMarginPct,
      subtotal: true,
    },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">Cost of revenue</th>
            {months.map((m) => (
              <th key={m} className={cn("whitespace-nowrap px-2.5 py-2 text-right font-medium", colTone(statusOf(m)))}>
                {MONTH_ABBR[monthIndex(m) - 1]}
              </th>
            ))}
            <th className="whitespace-nowrap border-l border-parchment-line px-3 py-2 text-right font-medium">
              FY{months[0] ? monthYear(months[0]) : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={`${row.label}-${ri}`}
              className={cn(
                "border-t border-parchment-line/60",
                row.subtotal && "border-t-parchment-line bg-secondary/20",
              )}
            >
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 whitespace-nowrap px-3 py-1.5 text-left font-normal",
                  row.subtotal ? "bg-secondary font-semibold text-ink" : "bg-surface text-steel",
                )}
              >
                <span className={cn(row.level === 1 && "pl-3")}>{row.label}</span>
              </th>
              {months.map((m, i) => (
                <td
                  key={m}
                  className={cn(
                    "whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums",
                    colTone(statusOf(m)),
                    row.subtotal ? "font-semibold text-ink" : "text-steel",
                  )}
                >
                  {row.kind === "pct"
                    ? formatPercent(percent(row.monthlyPct?.[i] ?? 0), 0)
                    : fmt(row.monthly[i] ?? { minor: 0, currency: "USD" })}
                </td>
              ))}
              <td
                className={cn(
                  "whitespace-nowrap border-l border-parchment-line px-3 py-1.5 text-right font-semibold tabular-nums text-ink",
                  row.subtotal ? "bg-secondary/40" : "bg-secondary/10",
                )}
              >
                {row.kind === "pct"
                  ? formatPercent(percent(row.fyPct ?? 0), 0)
                  : fmt(sumMoney(row.monthly))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
