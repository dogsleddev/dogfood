import { formatMoney, sumMoney, zeroMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { ExpenseForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const signedFull = (m: Money) =>
  `${m.minor > 0 ? "+" : m.minor < 0 ? "−" : ""}${formatMoney({ minor: Math.abs(m.minor), currency: m.currency }, { compact: true })}`;

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "muted" }) {
  const valueClass =
    tone === "pos" ? "text-sage-deep" : tone === "neg" ? "text-ember-deep" : tone === "muted" ? "text-steel" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-steel">{label}</span>
      <span className={`text-sm tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * The current-period roll-ups for one Expense Forecast group (CLAUDE.md §8, layer 2): the FY total
 * for the group, the current month's spend with its implied run-rate, and the year-end-vs-start
 * trajectory. Reads the live `getExpenseForecast` group slice — the monthly amounts sum into the
 * all-groups OpEx total and reconcile to the P&L non-payroll OpEx lines by construction.
 */
export function ExpenseGroupCards({
  lines,
  label,
  currentPeriod,
}: {
  lines: readonly ExpenseForecastLine[];
  label: string;
  currentPeriod: string;
}) {
  const current = lines.find((l) => l.period === currentPeriod) ?? lines[lines.length - 1];
  const first = lines[0];
  const last = lines[lines.length - 1];

  const fyTotal = sumMoney(lines.map((l) => l.amount));
  const monthlyAvg: Money =
    lines.length > 0
      ? { minor: Math.round(fyTotal.minor / lines.length), currency: fyTotal.currency }
      : zeroMoney();

  const trajectoryMinor = last && first ? last.amount.minor - first.amount.minor : 0;
  const trajectory: Money = { minor: trajectoryMinor, currency: (last ?? first)?.amount.currency ?? "USD" };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker={`${label} · FY total`}>
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(fyTotal)}</div>
        <Line label="Monthly average" value={fmt(monthlyAvg)} tone="muted" />
        <Line label="Months" value={String(lines.length)} tone="muted" />
      </Card>

      <Card kicker="Current month">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">
          {current ? fmt(current.amount) : "—"}
        </div>
        <Line label="As of" value={current ? monthLabel(current.period) : "—"} tone="muted" />
        <Line
          label="Annualized run-rate"
          value={current ? fmt({ minor: current.amount.minor * 12, currency: current.amount.currency }) : "—"}
        />
      </Card>

      <Card kicker="Trajectory · FY span">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{signedFull(trajectory)}</div>
        <Line
          label={first ? monthLabel(first.period) : "—"}
          value={first ? fmt(first.amount) : "—"}
          tone="muted"
        />
        <Line label={last ? monthLabel(last.period) : "—"} value={last ? fmt(last.amount) : "—"} tone="muted" />
      </Card>
    </div>
  );
}
