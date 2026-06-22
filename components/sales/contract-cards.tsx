import { formatMoney, addMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { Bookings, DeferredWaterfall, ContractedRevenue } from "@/lib/queries/sales";

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
 * The three views that make Contracts the 606 / deferred / RPO pivot (CLAUDE.md §8), for one period:
 * Bookings (period ΔARR), the deferred-revenue waterfall, and the contracted-revenue (RPO) bridge.
 * Each reads a live query; the numbers tie to the subscription tie-out + the Balance Sheet by construction.
 */
export function ContractCards({
  bookings,
  deferred,
  contracted,
}: {
  bookings: Bookings;
  deferred: DeferredWaterfall;
  contracted: ContractedRevenue;
}) {
  const totalContracted = addMoney(contracted.recognizedToDate, contracted.contractedForward);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker={`Bookings · ΔARR · ${monthLabel(bookings.period)}`}>
        <div className="mb-2 font-heading text-2xl text-ink tabular-nums">{signed(bookings.net)}</div>
        <Line label="New business" value={signed(bookings.newBusiness)} tone="pos" />
        <Line label="Expansion" value={signed(bookings.expansion)} tone="pos" />
        <Line label="Contraction" value={signed(bookings.contraction).replace("+", "−")} tone="neg" />
        <Line label="Net ΔARR" value={signed(bookings.net)} tone="total" />
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
