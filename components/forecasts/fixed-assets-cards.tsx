import { formatMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { FixedAssetForecastLine } from "@/lib/types/drivers";

const fmt = (m: Money) => formatMoney(m, { compact: true });

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "muted" }) {
  const valueClass = tone === "muted" ? "text-steel" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-sm text-steel">{label}</span>
      <span className={`text-sm tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * The current-period roll-ups for the Fixed Asset Budget driver (CLAUDE.md §8, layer 2): gross PP&E
 * (opening net book value + cumulative capex over the in-series window), net PP&E (the authoritative
 * `netBookValue` — === the Balance Sheet Fixed Assets line), and full-year depreciation (Σ of the
 * monthly `depreciation`, which === the P&L D&A line). Reads the live `getFixedAssetForecast` series.
 */
export function FixedAssetsCards({
  lines,
  currentPeriod,
}: {
  lines: readonly FixedAssetForecastLine[];
  currentPeriod: string;
}) {
  const current = lines.find((l) => l.period === currentPeriod) ?? lines[lines.length - 1];
  const first = lines[0];
  const last = lines[lines.length - 1];
  const currency = (current ?? first)?.netBookValue.currency ?? "USD";

  // Opening net book value = first month's closing NBV rolled back one month (− its capex + its depreciation).
  const openingNbvMinor = first ? first.netBookValue.minor - first.capex.minor + first.depreciation.minor : 0;

  // Cumulative capex across the in-series window (opening → current).
  const idxCurrent = current ? lines.indexOf(current) : -1;
  const window = idxCurrent >= 0 ? lines.slice(0, idxCurrent + 1) : lines;
  const cumulativeCapexMinor = window.reduce((s, l) => s + l.capex.minor, 0);

  // Gross PP&E (derived) = opening NBV + cumulative capex; accumulated depreciation = gross − net.
  const grossMinor = openingNbvMinor + cumulativeCapexMinor;
  const grossPpe: Money = { minor: grossMinor, currency };
  const accumDeprMinor = current ? grossMinor - current.netBookValue.minor : 0;
  const accumDepr: Money = { minor: accumDeprMinor, currency };

  // Full-year depreciation across the whole series.
  const fyDeprMinor = lines.reduce((s, l) => s + l.depreciation.minor, 0);
  const fyDepr: Money = { minor: fyDeprMinor, currency };
  const fyCapexMinor = lines.reduce((s, l) => s + l.capex.minor, 0);
  const fyCapex: Money = { minor: fyCapexMinor, currency };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker="Gross PP&E · current">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(grossPpe)}</div>
        <Line label="As of" value={current ? monthLabel(current.period) : "—"} tone="muted" />
        <Line label="Accumulated depreciation" value={fmt(accumDepr)} tone="muted" />
      </Card>

      <Card kicker="Net PP&E · current">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">
          {current ? fmt(current.netBookValue) : "—"}
        </div>
        <Line label="As of" value={current ? monthLabel(current.period) : "—"} tone="muted" />
        <Line label="Ties to" value="Balance Sheet · Fixed Assets" tone="muted" />
      </Card>

      <Card kicker="Depreciation · FY span">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(fyDepr)}</div>
        <Line
          label={first && last ? `${monthLabel(first.period)} – ${monthLabel(last.period)}` : "—"}
          value="straight-line"
          tone="muted"
        />
        <Line label="Capex · FY span" value={fmt(fyCapex)} tone="muted" />
      </Card>
    </div>
  );
}
