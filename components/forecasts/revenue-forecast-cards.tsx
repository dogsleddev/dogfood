import { formatMoney, addMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { RevenueForecastLine } from "@/lib/types/drivers";
import type { DeferredWaterfall, ContractedRevenue } from "@/lib/queries/sales";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const signed = (m: Money) => (m.minor > 0 ? `+${fmt(m)}` : fmt(m));

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "muted" | "total" }) {
  const valueClass =
    tone === "pos" ? "text-sage-deep" : tone === "neg" ? "text-ember-deep" : tone === "muted" ? "text-steel" : "text-ink";
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${tone === "total" ? "border-t border-parchment-line/70 mt-1 pt-2" : ""}`}>
      <span className={`text-sm ${tone === "total" ? "font-medium text-ink" : "text-steel"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${tone === "total" ? "font-semibold text-ink" : valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * The FY roll-ups for the Revenue Forecast driver (CLAUDE.md §8, layer 2). Reads the same live
 * series the monthly table renders: the FY revenue total split subscription/services, the
 * contracted-vs-new wedge (the forecast tail's new-business assumption layered on the signed book),
 * the deferred-revenue waterfall for the period, and the contracted-revenue (RPO) bridge.
 */
export function RevenueForecastCards({
  lines,
  deferred,
  contracted,
}: {
  lines: readonly RevenueForecastLine[];
  deferred: DeferredWaterfall;
  contracted: ContractedRevenue;
}) {
  const subLines = lines.filter((l) => l.stream === "subscription");
  const svcLines = lines.filter((l) => l.stream === "services");

  const subTotal = sumMoney(subLines.map((l) => l.total));
  const svcTotal = sumMoney(svcLines.map((l) => l.total));
  const fyTotal = sumMoney(lines.map((l) => l.total));

  const contractedFy = sumMoney(lines.map((l) => l.contracted));
  const newBusinessFy = sumMoney(lines.map((l) => l.newBusiness));

  const totalContracted = addMoney(contracted.recognizedToDate, contracted.contractedForward);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card kicker="FY revenue · by stream">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(fyTotal)}</div>
        <Line label="Subscription" value={fmt(subTotal)} tone="muted" />
        <Line label="Services" value={fmt(svcTotal)} tone="muted" />
        <Line label="Total revenue" value={fmt(fyTotal)} tone="total" />
      </Card>

      <Card kicker="FY revenue · contracted vs new">
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{fmt(contractedFy)}</div>
        <Line label="Contracted (signed book)" value={fmt(contractedFy)} tone="pos" />
        <Line label="New business / retention" value={signed(newBusinessFy)} tone="pos" />
        <Line label="Total revenue" value={fmt(fyTotal)} tone="total" />
      </Card>

      <Card kicker={`Deferred revenue · ${monthLabel(deferred.period)}`}>
        <Line label="Opening" value={fmt(deferred.opening)} tone="muted" />
        <Line label="+ Billings" value={signed(deferred.additions)} tone="pos" />
        <Line label="− Recognized" value={`−${fmt(deferred.recognized)}`} tone="neg" />
        <Line label="Closing balance" value={fmt(deferred.closing)} tone="total" />
      </Card>

      <Card kicker={`Contracted revenue · RPO · ${monthLabel(contracted.period)}`}>
        <Line label="Recognized to date" value={fmt(contracted.recognizedToDate)} tone="muted" />
        <Line label="Contracted forward (RPO)" value={fmt(contracted.contractedForward)} tone="pos" />
        <Line label="Total contracted" value={fmt(totalContracted)} tone="total" />
      </Card>
    </div>
  );
}
