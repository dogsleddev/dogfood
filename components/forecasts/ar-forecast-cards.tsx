import { formatMoney, type Money, type Days } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { ArForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const fmtDays = (d: Days) => `${Math.round(d)} days`;
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
 * The current-period roll-ups for the AR Forecast driver (CLAUDE.md §8, layer 2): the current
 * receivables balance + implied DSO, and the full-year change in AR. Reads the live `getArForecast`
 * series — the balance === the Balance Sheet AR line and the FY Δ === Σ of the cash-flow change-in-AR.
 */
export function ArForecastCards({
  lines,
  currentPeriod,
}: {
  lines: readonly ArForecastLine[];
  currentPeriod: string;
}) {
  const current = lines.find((l) => l.period === currentPeriod) ?? lines[lines.length - 1];
  const first = lines[0];
  const last = lines[lines.length - 1];

  // Full-year change in AR: closing (last) − opening basis (first month's balance net of its own change).
  // We show the in-series span: first month's closing → last month's closing.
  const fyChangeMinor = last && first ? last.balance.minor - first.balance.minor : 0;
  const fyChange: Money = { minor: fyChangeMinor, currency: (last ?? first)?.balance.currency ?? "USD" };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker="Accounts receivable · current">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">
          {current ? fmt(current.balance) : "—"}
        </div>
        <Line label="As of" value={current ? monthLabel(current.period) : "—"} tone="muted" />
        <Line label="Implied DSO" value={current ? fmtDays(current.dso) : "—"} />
      </Card>

      <Card kicker="Days sales outstanding · DSO">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">
          {current ? fmtDays(current.dso) : "—"}
        </div>
        <Line label="Basis" value="DSO ÷ 365 × trailing billings" tone="muted" />
        <Line label="Constant across the year" value="assumption" tone="muted" />
      </Card>

      <Card kicker="Change in AR · FY span">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{signedFull(fyChange)}</div>
        <Line
          label={first ? monthLabel(first.period) : "—"}
          value={first ? fmt(first.balance) : "—"}
          tone="muted"
        />
        <Line label={last ? monthLabel(last.period) : "—"} value={last ? fmt(last.balance) : "—"} tone="muted" />
      </Card>
    </div>
  );
}
