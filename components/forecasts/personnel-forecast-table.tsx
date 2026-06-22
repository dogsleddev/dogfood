import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, zeroMoney, type Money } from "@/lib/types/money";
import { monthIndex, monthYear, type Month } from "@/lib/types/period";
import type { PersonnelForecastLine } from "@/lib/types/drivers";
import type { CostFunction } from "@/lib/types/common";

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

const FUNCTION_LABEL: Record<CostFunction, string> = {
  direct: "Direct (CoR)",
  rnd: "R&D",
  sm: "S&M",
  ga: "G&A",
};

export interface PersonnelDept {
  readonly id: string;
  readonly name: string;
  readonly function: CostFunction;
  readonly lines: readonly PersonnelForecastLine[];
}

interface Row {
  key: string;
  label: string;
  level: 0 | 1;
  monthly: Money[];
  headsByMonth: number[];
  subtotal?: boolean;
}

const addRows = (a: Money[], b: Money[]): Money[] => a.map((m, i) => sumMoney([m, b[i] ?? zeroMoney()]));
const addHeads = (a: number[], b: number[]): number[] => a.map((h, i) => h + (b[i] ?? 0));

/**
 * The monthly Personnel grid (CLAUDE.md §8, layer 2). Pivots the live `getPersonnelForecast` lines
 * into base-comp rows grouped by cost function (Direct / R&D / S&M / G&A), each function expanded
 * into its departments. Function subtotals roll to a grand total whose every month === the seed's
 * total base-comp series, so it reconciles to the P&L payroll lines (Direct Payroll into Cost of
 * Revenue, the rest into the single Indirect Payroll line). The right rail shows the FY base comp
 * and the period-end headcount. Comp is base only — burden lives in the Employee Expenses OpEx group.
 */
export function PersonnelForecastTable({ departments }: { departments: readonly PersonnelDept[] }) {
  // Months are shared across departments; take the ordered list from the first dept with lines.
  const months = (departments.find((d) => d.lines.length > 0)?.lines ?? []).map((l) => l.period);
  const order: CostFunction[] = ["direct", "rnd", "sm", "ga"];

  const rows: Row[] = [];
  let grandComp: Money[] = months.map(() => zeroMoney());
  let grandHeads: number[] = months.map(() => 0);

  for (const fn of order) {
    const depts = departments.filter((d) => d.function === fn);
    if (depts.length === 0) continue;

    let fnComp: Money[] = months.map(() => zeroMoney());
    let fnHeads: number[] = months.map(() => 0);
    const deptRows: Row[] = [];

    for (const d of depts) {
      const comp = months.map((_, i) => d.lines[i]?.baseComp ?? zeroMoney());
      const heads = months.map((_, i) => d.lines[i]?.heads ?? 0);
      fnComp = addRows(fnComp, comp);
      fnHeads = addHeads(fnHeads, heads);
      deptRows.push({ key: d.id, label: d.name, level: 1, monthly: comp, headsByMonth: heads });
    }

    rows.push({
      key: `fn-${fn}`,
      label: FUNCTION_LABEL[fn],
      level: 0,
      monthly: fnComp,
      headsByMonth: fnHeads,
      subtotal: true,
    });
    rows.push(...deptRows);

    grandComp = addRows(grandComp, fnComp);
    grandHeads = addHeads(grandHeads, fnHeads);
  }

  rows.push({
    key: "total",
    label: "Total Payroll (base comp)",
    level: 0,
    monthly: grandComp,
    headsByMonth: grandHeads,
    subtotal: true,
  });

  const fyLabel = months[0] ? `FY${monthYear(months[0])}` : "FY";
  const endHeadsOf = (heads: number[]) => heads[heads.length - 1] ?? 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">
              Department · base comp
            </th>
            {months.map((m) => (
              <th
                key={m}
                className={cn("whitespace-nowrap px-2.5 py-2 text-right font-medium", colTone(statusOf(m)))}
              >
                {MONTH_ABBR[monthIndex(m) - 1]}
              </th>
            ))}
            <th className="whitespace-nowrap border-l border-parchment-line px-3 py-2 text-right font-medium">
              {fyLabel}
            </th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Heads</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fyTotal = sumMoney(row.monthly);
            return (
              <tr
                key={row.key}
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
                {row.monthly.map((v, i) => (
                  <td
                    key={months[i] ?? i}
                    className={cn(
                      "whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums",
                      months[i] ? colTone(statusOf(months[i])) : "",
                      row.subtotal ? "font-semibold text-ink" : "text-steel",
                    )}
                  >
                    {fmt(v)}
                  </td>
                ))}
                <td
                  className={cn(
                    "whitespace-nowrap border-l border-parchment-line px-3 py-1.5 text-right font-semibold tabular-nums text-ink",
                    row.subtotal ? "bg-secondary/40" : "bg-secondary/10",
                  )}
                >
                  {fmt(fyTotal)}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap px-3 py-1.5 text-right tabular-nums",
                    row.subtotal ? "font-semibold text-ink bg-secondary/40" : "text-steel bg-secondary/10",
                  )}
                >
                  {endHeadsOf(row.headsByMonth)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-parchment-line px-3 py-2 text-xs text-steel">
        Base comp by department, grouped by function. The Heads column is the period-end headcount.
        Burden (payroll taxes, medical, benefits) sits in the Employee Expenses OpEx group, not here.
      </div>
    </div>
  );
}
