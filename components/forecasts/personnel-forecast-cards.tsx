import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { PersonnelForecastLine } from "@/lib/types/drivers";
import type { CostFunction } from "@/lib/types/common";

const fmt = (m: Money) => formatMoney(m, { compact: true });

const FUNCTION_LABEL: Record<CostFunction, string> = {
  direct: "Direct (CoR)",
  rnd: "R&D",
  sm: "S&M",
  ga: "G&A",
};

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

function Line({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "muted" | "total";
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-1 ${
        tone === "total" ? "mt-1 border-t border-parchment-line/70 pt-2" : ""
      }`}
    >
      <span className={`text-sm ${tone === "total" ? "font-medium text-ink" : "text-steel"}`}>{label}</span>
      <span className="flex items-baseline gap-2 tabular-nums">
        {sub ? <span className="text-xs text-steel">{sub}</span> : null}
        <span className={`text-sm ${tone === "total" ? "font-semibold text-ink" : "text-ink"}`}>{value}</span>
      </span>
    </div>
  );
}

/**
 * The FY roll-ups for the Personnel driver (CLAUDE.md §8, layer 2). Reads the same live
 * `getPersonnelForecast` series the monthly table renders: the current-period headcount + base
 * comp, the FY base-comp total, and the by-function split (Direct / R&D / S&M / G&A) at the
 * current period. Base comp only — payroll burden lives in the Employee Expenses OpEx group, and
 * Direct-function payroll rolls into Cost of Revenue while the rest is the P&L Indirect Payroll line.
 */
export function PersonnelForecastCards({
  total,
  byFunction,
  currentPeriod,
}: {
  total: readonly PersonnelForecastLine[];
  byFunction: ReadonlyArray<{ function: CostFunction; lines: readonly PersonnelForecastLine[] }>;
  currentPeriod: string;
}) {
  const current = total.find((l) => l.period === currentPeriod) ?? total[total.length - 1];
  const first = total[0];
  const fyComp = sumMoney(total.map((l) => l.baseComp));

  const headDelta = current && first ? current.heads - first.heads : 0;

  // By-function values at the current period (point-in-time heads + monthly comp).
  const fnNow = byFunction.map(({ function: fn, lines }) => {
    const line = lines.find((l) => l.period === currentPeriod) ?? lines[lines.length - 1];
    return { fn, heads: line?.heads ?? 0, comp: line?.baseComp ?? sumMoney([]) };
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card kicker="Headcount · current">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">
          {current ? current.heads : "—"}
        </div>
        <Line label="As of" value={current ? monthLabel(current.period) : "—"} tone="muted" />
        <Line
          label="Since FY start"
          value={`${headDelta >= 0 ? "+" : "−"}${Math.abs(headDelta)}`}
          tone="muted"
        />
      </Card>

      <Card kicker="Base comp · current month">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">
          {current ? fmt(current.baseComp) : "—"}
        </div>
        <Line label="As of" value={current ? monthLabel(current.period) : "—"} tone="muted" />
        <Line label="Base only" value="burden in Employee Expenses" tone="muted" />
      </Card>

      <Card kicker="Base comp · FY total">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(fyComp)}</div>
        <Line label="Direct → Cost of Revenue" value="" tone="muted" />
        <Line label="R&D / S&M / G&A → Indirect Payroll" value="" tone="muted" />
      </Card>

      <Card kicker="By function · current month">
        {fnNow.map(({ fn, heads, comp }) => (
          <Line key={fn} label={FUNCTION_LABEL[fn]} value={fmt(comp)} sub={`${heads} hd`} />
        ))}
        <Line
          label="Total"
          value={fmt(sumMoney(fnNow.map((f) => f.comp)))}
          sub={`${fnNow.reduce((s, f) => s + f.heads, 0)} hd`}
          tone="total"
        />
      </Card>
    </div>
  );
}
