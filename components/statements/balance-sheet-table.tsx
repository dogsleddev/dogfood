import { Fragment } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, zeroMoney, type Money } from "@/lib/types/money";
import type { BalanceSheet, BalanceSheetLine } from "@/lib/types/statements";

const fmt = (m?: Money) => (m ? formatMoney(m, { compact: true }) : "—");

const SECTIONS: readonly { key: BalanceSheetLine["section"]; label: string; subtotal: string }[] = [
  { key: "asset", label: "Assets", subtotal: "Total Assets" },
  { key: "liability", label: "Liabilities", subtotal: "Total Liabilities" },
  { key: "equity", label: "Equity", subtotal: "Total Equity" },
];

const sumCol = (lines: readonly BalanceSheetLine[], col: "actual" | "forecast"): Money =>
  sumMoney(lines.map((l) => l.values[col] ?? zeroMoney()));

function LineRow({ line, active }: { line: BalanceSheetLine; active: boolean }) {
  const href = `/statements/balance-sheet?inspect=${line.id}`;
  return (
    <tr className={cn("group border-t border-parchment-line/60", active && "bg-ember-tint/70")}>
      <td className="py-0">
        <Link href={href} className="block px-3 py-1.5 text-ink transition-colors hover:bg-ember-tint/60">
          {line.label}
        </Link>
      </td>
      {(["actual", "forecast"] as const).map((col) => (
        <td key={col} className="py-0">
          <Link
            href={href}
            className="block px-3 py-1.5 text-right tabular-nums text-ink transition-colors hover:bg-ember-tint/60"
          >
            {fmt(line.values[col])}
          </Link>
        </td>
      ))}
    </tr>
  );
}

function SubtotalRow({ label, actual, forecast, grand }: { label: string; actual: Money; forecast: Money; grand?: boolean }) {
  return (
    <tr className={cn("border-t border-parchment-line bg-secondary/20", grand && "bg-secondary/40")}>
      <td className={cn("px-3 py-1.5 font-semibold text-ink", grand && "text-ember-deep")}>{label}</td>
      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{fmt(actual)}</td>
      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{fmt(forecast)}</td>
    </tr>
  );
}

/**
 * Balance Sheet — Actual (as of close) vs Forecast (FY-end). Tap any number to peek its lineage in
 * the pane (§6). Section subtotals are computed from the leaves; the final Total Liabilities + Equity
 * equals Total Assets (A = L + E by construction).
 */
export function BalanceSheetTable({
  bs,
  inspect,
  actualLabel,
  forecastLabel,
}: {
  bs: BalanceSheet;
  inspect?: string;
  actualLabel: string;
  forecastLabel: string;
}) {
  const totalLE = {
    actual: sumMoney(bs.lines.filter((l) => l.section !== "asset").map((l) => l.values.actual ?? zeroMoney())),
    forecast: sumMoney(bs.lines.filter((l) => l.section !== "asset").map((l) => l.values.forecast ?? zeroMoney())),
  };

  return (
    <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary/50 text-xs uppercase tracking-wide text-steel">
            <th className="px-3 py-2 text-left font-medium">Balance Sheet</th>
            <th className="px-3 py-2 text-right font-medium">{actualLabel}</th>
            <th className="px-3 py-2 text-right font-medium">{forecastLabel}</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((section) => {
            const lines = bs.lines.filter((l) => l.section === section.key);
            return (
              <Fragment key={section.key}>
                <tr className="bg-secondary/30">
                  <td colSpan={3} className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">
                    {section.label}
                  </td>
                </tr>
                {lines.map((line) => (
                  <LineRow key={line.id} line={line} active={inspect === line.id} />
                ))}
                <SubtotalRow label={section.subtotal} actual={sumCol(lines, "actual")} forecast={sumCol(lines, "forecast")} />
              </Fragment>
            );
          })}
          <SubtotalRow label="Total Liabilities + Equity" actual={totalLE.actual} forecast={totalLE.forecast} grand />
        </tbody>
      </table>
    </div>
  );
}
