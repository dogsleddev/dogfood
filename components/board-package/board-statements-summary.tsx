import { cn } from "@/lib/utils";
import { formatMoney, formatPercent, zeroMoney, type Money } from "@/lib/types/money";
import type { Percent } from "@/lib/types/money";
import type { ColumnValues, PnL, BalanceSheet, CashFlow } from "@/lib/types/statements";

const fmt = (m: Money) => formatMoney(m, { compact: true });

/**
 * The FY figure for a statement line. The Forecasted P&L carries Budget · Actual · Variance ·
 * Forecast columns (§8); for the board summary the Forecast column is the full-year view (actuals
 * to date + forecast tail), falling back to Actual then Budget so partial-year lines still read.
 */
function fyValue(values: ColumnValues): Money {
  return values.forecast ?? values.actual ?? values.budget ?? zeroMoney();
}

interface SummaryRow {
  label: string;
  value: Money;
  tone?: "muted" | "total";
  marginPct?: Percent;
}

function StatementCard({
  kicker,
  rows,
}: {
  kicker: string;
  rows: readonly SummaryRow[];
}) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      <dl>
        {rows.map((row, i) => (
          <div
            key={`${row.label}-${i}`}
            className={cn(
              "flex items-baseline justify-between gap-3 py-1",
              row.tone === "total" && "mt-1 border-t border-parchment-line/70 pt-2",
            )}
          >
            <dt className={cn("text-sm", row.tone === "total" ? "font-medium text-ink" : "text-steel")}>
              {row.label}
            </dt>
            <dd className="flex items-baseline gap-2">
              {row.marginPct !== undefined && (
                <span className="text-xs tabular-nums text-steel">{formatPercent(row.marginPct, 0)}</span>
              )}
              <span
                className={cn(
                  "text-sm tabular-nums",
                  row.tone === "total" ? "font-semibold text-ink" : "text-ink",
                )}
              >
                {fmt(row.value)}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The three-statements summary for the board package (CLAUDE.md §8, layer 5): the P&L headline lines,
 * the Balance Sheet by section, and the Cash Flow subtotals. Each row reads the live statement query
 * (getPnL / getBalanceSheet / getCashFlow) — the same tying-out source the statement pages render, so
 * Revenue here === the P&L Total Revenue line, cash === the Balance Sheet cash line, and so on.
 */
export function BoardStatementsSummary({
  pnl,
  balanceSheet,
  cashFlow,
}: {
  pnl: PnL;
  balanceSheet: BalanceSheet;
  cashFlow: CashFlow;
}) {
  const pnlLine = (id: string) => pnl.lines.find((l) => l.id === id);
  const bsLine = (id: string) => balanceSheet.lines.find((l) => l.id === id);
  const cfLine = (id: string) => cashFlow.lines.find((l) => l.id === id);

  const pnlRow = (id: string, label: string, tone?: SummaryRow["tone"]): SummaryRow => {
    const l = pnlLine(id);
    return { label, value: l ? fyValue(l.values) : zeroMoney(), tone, marginPct: l?.marginPct };
  };
  const bsRow = (id: string, label: string, tone?: SummaryRow["tone"]): SummaryRow => {
    const l = bsLine(id);
    return { label, value: l ? fyValue(l.values) : zeroMoney(), tone };
  };
  const cfRow = (id: string, label: string, tone?: SummaryRow["tone"]): SummaryRow => {
    const l = cfLine(id);
    return { label, value: l ? fyValue(l.values) : zeroMoney(), tone };
  };

  const sumSection = (section: "asset" | "liability" | "equity"): Money =>
    balanceSheet.lines
      .filter((l) => l.section === section)
      .reduce<Money>((acc, l) => ({ minor: acc.minor + fyValue(l.values).minor, currency: "USD" }), zeroMoney());

  const pnlRows: SummaryRow[] = [
    pnlRow("total_revenue", "Total revenue"),
    pnlRow("total_cor", "Cost of revenue", "muted"),
    pnlRow("gross_profit", "Gross profit", "total"),
    pnlRow("total_opex", "Operating expenses", "muted"),
    pnlRow("operating_income", "Operating income", "total"),
    pnlRow("net_income", "Net income", "total"),
  ];

  const bsRows: SummaryRow[] = [
    { label: "Total assets", value: sumSection("asset"), tone: "total" },
    bsRow("cash", "Cash", "muted"),
    bsRow("accounts_receivable", "Accounts receivable", "muted"),
    bsRow("deferred_revenue", "Deferred revenue", "muted"),
    { label: "Total liabilities", value: sumSection("liability"), tone: "total" },
    { label: "Total equity", value: sumSection("equity"), tone: "total" },
  ];

  const cfRows: SummaryRow[] = [
    cfRow("net_income", "Net income", "muted"),
    cfRow("operating_cash_flow", "Operating cash flow", "total"),
    cfRow("capex", "Capital expenditure", "muted"),
    cfRow("financing", "Financing", "muted"),
    cfRow("net_change_in_cash", "Net change in cash", "total"),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <StatementCard kicker="Profit & loss · FY" rows={pnlRows} />
      <StatementCard kicker="Balance sheet · period end" rows={bsRows} />
      <StatementCard kicker="Cash flow · FY" rows={cfRows} />
    </div>
  );
}
