import { formatMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { PrepaidsForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const sumMinor = (lines: readonly PrepaidsForecastLine[], pick: (l: PrepaidsForecastLine) => Money) =>
  lines.reduce((acc, l) => acc + pick(l).minor, 0);

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
 * The current-period roll-ups for the Prepaids Budget driver (CLAUDE.md §8, layer 2): the current
 * prepaid balance (=== the Balance Sheet Prepaid Expenses line) and the full-year additions and
 * amortization. Reads the live `getPrepaidsForecast` series; balance = prior + additions − amortization
 * ties exactly by construction.
 */
export function PrepaidsForecastCards({
  lines,
  currentPeriod,
}: {
  lines: readonly PrepaidsForecastLine[];
  currentPeriod: string;
}) {
  const current = lines.find((l) => l.period === currentPeriod) ?? lines[lines.length - 1];
  const currency = (current ?? lines[0])?.balance.currency ?? "USD";

  const fyAmort: Money = { minor: sumMinor(lines, (l) => l.amortization), currency };
  const fyAdditions: Money = { minor: sumMinor(lines, (l) => l.additions), currency };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker="Prepaid balance · current">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">
          {current ? fmt(current.balance) : "—"}
        </div>
        <Line label="As of" value={current ? monthLabel(current.period) : "—"} tone="muted" />
        <Line label="Basis" value="Balance Sheet Prepaid Expenses" tone="muted" />
      </Card>

      <Card kicker="Amortization · FY total">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(fyAmort)}</div>
        <Line label="Recognized to OpEx" value="straight-line run-off" tone="muted" />
        <Line label="Months" value={String(lines.length)} tone="muted" />
      </Card>

      <Card kicker="Additions · FY total">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(fyAdditions)}</div>
        <Line label="New prepaids capitalized" value="plug to the balance" tone="muted" />
        <Line label="Months" value={String(lines.length)} tone="muted" />
      </Card>
    </div>
  );
}
