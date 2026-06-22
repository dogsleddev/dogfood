import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, zeroMoney, type Money } from "@/lib/types/money";
import type { MonthlyBalanceSheet, MonthlyBalanceSheetLine } from "@/lib/types/statements";
import { MonthlyHeader, MonthlyValueCell, colTone } from "./monthly-shared";

const fmt = (m: Money) => formatMoney(m, { compact: true });

const SECTIONS: readonly { key: MonthlyBalanceSheetLine["section"]; label: string; subtotal: string }[] = [
  { key: "asset", label: "Assets", subtotal: "Total Assets" },
  { key: "liability", label: "Liabilities", subtotal: "Total Liabilities" },
  { key: "equity", label: "Equity", subtotal: "Total Equity" },
];

/** Per-column + Total sum of a set of lines (the section subtotals; computed from the leaves). */
function sumLines(lines: readonly MonthlyBalanceSheetLine[], n: number): { monthly: Money[]; total: Money } {
  return {
    monthly: Array.from({ length: n }, (_, j) => sumMoney(lines.map((l) => l.monthly[j] ?? zeroMoney()))),
    total: sumMoney(lines.map((l) => l.total)),
  };
}

function LineRow({ line, months }: { line: MonthlyBalanceSheetLine; months: MonthlyBalanceSheet["months"] }) {
  const negTotal = line.total.minor < 0;
  return (
    <tr className="border-t border-parchment-line/60">
      <th
        scope="row"
        className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 pl-5 text-left font-normal text-ink"
      >
        {line.label}
      </th>
      {line.monthly.map((v, i) => (
        <MonthlyValueCell key={months[i].month} value={v} statusTone={colTone(months[i].status)} />
      ))}
      <td
        className={cn(
          "whitespace-nowrap border-l border-parchment-line bg-secondary/10 px-3 py-1.5 text-right font-semibold tabular-nums",
          negTotal ? "text-ember-deep" : "text-ink",
        )}
      >
        {fmt(line.total)}
      </td>
    </tr>
  );
}

function SubtotalRow({
  label,
  monthly,
  total,
  months,
  grand,
}: {
  label: string;
  monthly: readonly Money[];
  total: Money;
  months: MonthlyBalanceSheet["months"];
  grand?: boolean;
}) {
  const negTotal = total.minor < 0;
  return (
    <tr className={cn("border-t border-parchment-line bg-secondary/20", grand && "bg-secondary/40")}>
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 whitespace-nowrap px-3 py-1.5 text-left font-semibold",
          grand ? "bg-secondary text-ember-deep" : "bg-secondary text-ink",
        )}
      >
        {label}
      </th>
      {monthly.map((v, i) => (
        <MonthlyValueCell
          key={months[i].month}
          value={v}
          statusTone={cn(colTone(months[i].status), grand && "bg-secondary/40")}
          bold
        />
      ))}
      <td
        className={cn(
          "whitespace-nowrap border-l border-parchment-line px-3 py-1.5 text-right font-semibold tabular-nums",
          grand ? "bg-secondary/40" : "bg-secondary/40",
          negTotal ? "text-ember-deep" : grand ? "text-ember-deep" : "text-ink",
        )}
      >
        {fmt(total)}
      </td>
    </tr>
  );
}

/**
 * Balance Sheet spread across the months of the fiscal year (month-end snapshots). Section subtotals
 * (Total Assets / Liabilities / Equity) are summed from the leaves per column; the grand Total
 * Liabilities + Equity equals Total Assets by construction. Each line's Total column is the FY-end
 * balance (= the FY Balance Sheet Forecast column).
 */
export function MonthlyBalanceSheetTable({ bs }: { bs: MonthlyBalanceSheet }) {
  const n = bs.months.length;
  const le = sumLines(
    bs.lines.filter((l) => l.section !== "asset"),
    n,
  );
  return (
    <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <MonthlyHeader months={bs.months} title={bs.label ?? "Balance Sheet"} fyLabel={bs.label ?? "FY"} />
          <tbody>
            {SECTIONS.map((section) => {
              const lines = bs.lines.filter((l) => l.section === section.key);
              const sub = sumLines(lines, n);
              return (
                <Fragment key={section.key}>
                  <tr className="bg-secondary/30">
                    <th
                      scope="colgroup"
                      colSpan={n + 2}
                      className="px-3 pb-1 pt-3 text-left text-xs font-semibold uppercase tracking-wider text-ember-deep"
                    >
                      {section.label}
                    </th>
                  </tr>
                  {lines.map((line) => (
                    <LineRow key={line.id} line={line} months={bs.months} />
                  ))}
                  <SubtotalRow label={section.subtotal} monthly={sub.monthly} total={sub.total} months={bs.months} />
                </Fragment>
              );
            })}
            <SubtotalRow
              label="Total Liabilities + Equity"
              monthly={le.monthly}
              total={le.total}
              months={bs.months}
              grand
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
