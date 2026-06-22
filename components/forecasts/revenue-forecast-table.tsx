import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, zeroMoney, type Money } from "@/lib/types/money";
import { monthIndex, monthYear, type Month } from "@/lib/types/period";
import type { RevenueForecastLine } from "@/lib/types/drivers";

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

interface Row {
  label: string;
  level: 0 | 1;
  monthly: Money[];
  subtotal?: boolean;
}

/**
 * The monthly Revenue Forecast grid (CLAUDE.md §8, layer 2). Pivots the live `getRevenueForecast`
 * lines into rows by stream, splitting each into its contracted (signed-book) and new-business
 * components — the wedge opens only in the forecast tail. Subscription + Services === Total Revenue,
 * the authoritative recognized series, so each Total reconciles to the P&L revenue lines by month.
 */
export function RevenueForecastTable({ lines }: { lines: readonly RevenueForecastLine[] }) {
  // Months are shared across streams; take the ordered unique list from subscription lines.
  const months = lines.filter((l) => l.stream === "subscription").map((l) => l.period);
  const byStream = (stream: "subscription" | "services") =>
    lines.filter((l) => l.stream === stream);

  const pick = (stream: "subscription" | "services", key: "contracted" | "newBusiness" | "total"): Money[] =>
    byStream(stream).map((l) => l[key]);

  const addRows = (a: Money[], b: Money[]): Money[] => a.map((m, i) => sumMoney([m, b[i] ?? zeroMoney()]));

  const subTotal = pick("subscription", "total");
  const svcTotal = pick("services", "total");
  const grandTotal = addRows(subTotal, svcTotal);
  const contractedTotal = addRows(pick("subscription", "contracted"), pick("services", "contracted"));
  const newBusinessTotal = addRows(pick("subscription", "newBusiness"), pick("services", "newBusiness"));

  const rows: Row[] = [
    { label: "Subscription", level: 0, monthly: subTotal, subtotal: true },
    { label: "Contracted", level: 1, monthly: pick("subscription", "contracted") },
    { label: "New business", level: 1, monthly: pick("subscription", "newBusiness") },
    { label: "Services", level: 0, monthly: svcTotal, subtotal: true },
    { label: "Contracted", level: 1, monthly: pick("services", "contracted") },
    { label: "New business", level: 1, monthly: pick("services", "newBusiness") },
    { label: "Total Revenue", level: 0, monthly: grandTotal, subtotal: true },
    { label: "of which contracted", level: 1, monthly: contractedTotal },
    { label: "of which new business", level: 1, monthly: newBusinessTotal },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-parchment-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
            <th className="sticky left-0 z-10 bg-secondary px-3 py-2 text-left font-medium">Stream</th>
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
          {rows.map((row, ri) => {
            const fyTotal = sumMoney(row.monthly);
            return (
              <tr
                key={`${row.label}-${ri}`}
                className={cn("border-t border-parchment-line/60", row.subtotal && "border-t-parchment-line bg-secondary/20")}
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
