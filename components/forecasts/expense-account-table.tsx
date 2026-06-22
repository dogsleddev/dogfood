import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthIndex, monthYear, type Month } from "@/lib/types/period";
import type { ExpenseForecastLine } from "@/lib/types/drivers";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (m: Money) => formatMoney(m, { compact: true });

/** Bearing close boundary (§11): Jan–May 2026 actual, Jun 2026 in close, Jul–Dec forecast. */
const CLOSE_YEAR = 2026;
const CLOSE_MONTH = 5;
type MonthStatus = "actual" | "in_close" | "forecast";
function statusOf(m: Month): MonthStatus {
  const y = monthYear(m);
  const mi = monthIndex(m);
  if (y < CLOSE_YEAR || (y === CLOSE_YEAR && mi <= CLOSE_MONTH)) return "actual";
  if (y === CLOSE_YEAR && mi === CLOSE_MONTH + 1) return "in_close";
  return "forecast";
}
const colTone = (s: MonthStatus): string =>
  s === "forecast" ? "bg-secondary/25" : s === "in_close" ? "bg-amber/10" : "";

interface Acct {
  readonly accountId: string;
  readonly subCode: string;
  readonly label: string;
}

/**
 * The OpEx group's GL SUB-ACCOUNTS spread across the fiscal year (§7): one row per sub-account, one
 * column per month, + the group total row. Each sub-account row links to ?account=<id> (focuses the
 * vendor breakdown below it). Σ sub-accounts per month === the group monthly === the P&L OpEx line.
 */
export function ExpenseAccountTable({
  lines,
  groupId,
  focusMonth,
}: {
  lines: readonly ExpenseForecastLine[]; // breakdown: "account"
  groupId: string;
  focusMonth: Month;
}) {
  const months: Month[] = Array.from(new Set(lines.map((l) => l.period))).sort() as Month[];
  // ordered unique sub-accounts (by subCode)
  const acctMap = new Map<string, Acct>();
  for (const l of lines) {
    if (l.accountId && !acctMap.has(l.accountId)) {
      acctMap.set(l.accountId, { accountId: l.accountId, subCode: l.subCode ?? "", label: l.accountLabel ?? l.accountId });
    }
  }
  const accts = [...acctMap.values()].sort((a, b) => a.subCode.localeCompare(b.subCode));

  const monthlyFor = (accountId: string): Money[] =>
    months.map((m) => sumMoney(lines.filter((l) => l.period === m && l.accountId === accountId).map((l) => l.amount)));
  const totalRow: Money[] = months.map((m) => sumMoney(lines.filter((l) => l.period === m).map((l) => l.amount)));

  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">GL account</th>
            {months.map((m) => (
              <th key={m} className={cn("whitespace-nowrap px-2.5 py-2 text-right font-medium", colTone(statusOf(m)), m === focusMonth && "ring-1 ring-inset ring-ember/40")}>
                {MONTH_ABBR[monthIndex(m) - 1]}
              </th>
            ))}
            <th className="whitespace-nowrap border-l border-parchment-line px-3 py-2 text-right font-medium">
              FY{months[0] ? monthYear(months[0]) : ""}
            </th>
          </tr>
        </thead>
        <tbody>
          {accts.map((a) => {
            const monthly = monthlyFor(a.accountId);
            return (
              <tr key={a.accountId} className="border-t border-parchment-line/60 hover:bg-ember-tint/40">
                <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface px-3 py-1.5 text-left font-normal text-ink">
                  <a href={`/forecasts/expenses/${groupId}?account=${a.accountId}&month=${focusMonth}`} className="hover:text-ember-deep hover:underline">
                    <span className="mr-2 font-mono text-xs text-steel">{a.subCode}</span>
                    {a.label}
                  </a>
                </th>
                {monthly.map((v, i) => (
                  <td key={months[i] ?? i} className={cn("whitespace-nowrap px-2.5 py-1.5 text-right tabular-nums text-steel", months[i] ? colTone(statusOf(months[i])) : "", months[i] === focusMonth && "bg-ember-tint/30 font-medium text-ink")}>
                    {fmt(v)}
                  </td>
                ))}
                <td className="whitespace-nowrap border-l border-parchment-line bg-secondary/10 px-3 py-1.5 text-right font-semibold tabular-nums text-ink">
                  {fmt(sumMoney(monthly))}
                </td>
              </tr>
            );
          })}
          <tr className="border-t border-t-parchment-line bg-secondary/20">
            <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-secondary px-3 py-1.5 text-left font-semibold text-ink">
              Group total
            </th>
            {totalRow.map((v, i) => (
              <td key={months[i] ?? i} className={cn("whitespace-nowrap px-2.5 py-1.5 text-right font-semibold tabular-nums text-ink", months[i] ? colTone(statusOf(months[i])) : "")}>
                {fmt(v)}
              </td>
            ))}
            <td className="whitespace-nowrap border-l border-parchment-line bg-secondary/40 px-3 py-1.5 text-right font-semibold tabular-nums text-ink">
              {fmt(sumMoney(totalRow))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
