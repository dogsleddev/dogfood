import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import type { ExpenseForecastLine } from "@/lib/types/drivers";
import type { ExpenseGroup } from "@/lib/types/common";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const pct = (part: Money, whole: Money) =>
  whole.minor === 0 ? "—" : `${Math.round((part.minor / whole.minor) * 100)}%`;

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "muted" | "total" }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 ${tone === "total" ? "mt-1 border-t border-parchment-line/70 pt-2" : ""}`}
    >
      <span className={`text-sm ${tone === "total" ? "font-medium text-ink" : "text-steel"}`}>{label}</span>
      <span
        className={`text-sm tabular-nums ${tone === "total" ? "font-semibold text-ink" : tone === "muted" ? "text-steel" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The FY roll-ups for the Expense Forecast driver (CLAUDE.md §8, layer 2): non-payroll OpEx only.
 * Reads the same live `getExpenseForecast` series the monthly grid renders — the FY total across the
 * 8 config-driven groups, the largest groups by spend, and the group count. Σ groups per month ===
 * the seed OpEx total === the P&L non-payroll OpEx lines by construction.
 */
export function ExpenseForecastCards({
  lines,
  groups,
}: {
  lines: readonly ExpenseForecastLine[];
  groups: readonly ExpenseGroup[];
}) {
  const fyTotal = sumMoney(lines.map((l) => l.amount));

  // FY spend by group, ordered largest-first.
  const byGroup = new Map<string, Money>();
  for (const g of groups) byGroup.set(g.id, sumMoney(lines.filter((l) => l.groupId === g.id).map((l) => l.amount)));

  const ranked = groups
    .map((g) => ({ group: g, total: byGroup.get(g.id) ?? sumMoney([]) }))
    .sort((a, b) => b.total.minor - a.total.minor);

  const top = ranked.slice(0, 3);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker="FY non-payroll OpEx">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(fyTotal)}</div>
        <Line label="Across" value={`${groups.length} groups`} tone="muted" />
        <Line label="Excludes" value="payroll + CoR" tone="muted" />
      </Card>

      <Card kicker="Largest groups · FY">
        {top.map(({ group, total }) => (
          <Line key={group.id} label={group.label} value={fmt(total)} tone="muted" />
        ))}
        <Line label="Total OpEx" value={fmt(fyTotal)} tone="total" />
      </Card>

      <Card kicker="Top group · share of OpEx">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">
          {top[0] ? pct(top[0].total, fyTotal) : "—"}
        </div>
        <Line label={top[0]?.group.label ?? "—"} value={top[0] ? fmt(top[0].total) : "—"} tone="muted" />
        <Line label="of FY OpEx" value={fmt(fyTotal)} tone="muted" />
      </Card>
    </div>
  );
}
