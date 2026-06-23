import { getCashBurnBridge } from "@/lib/queries";
import { type Month, monthLabel } from "@/lib/types/period";
import { formatMoney, formatPercent, type Money } from "@/lib/types/money";
import { cn } from "@/lib/utils";

/**
 * The FY cash bridge (CLAUDE.md §11) — why Bearing's GAAP net loss is a much smaller cash burn: the
 * annual-prepay deferred-revenue inflow. Reads getCashBurnBridge (one source, two callers — Scout's
 * getCashBurnBridge reads the same). The waterfall is the FY26 window (ties to the Forecast column in
 * the table below); the runway strip above is trailing-12-month — the footnote keeps the two distinct.
 */
const fmt = (m: Money) => formatMoney(m, { compact: true });
const tone = (m: Money) => (m.minor > 0 ? "text-sage-deep" : m.minor < 0 ? "text-ember-deep" : "text-ink");

function Row({ label, value, kind }: { label: string; value: Money; kind?: "subtotal" | "headline" }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-1.5 text-sm", kind === "subtotal" && "mt-1 border-t border-parchment-line pt-2")}>
      <span className={cn("text-ink", kind === "headline" && "font-medium")}>{label}</span>
      <span className={cn("tabular-nums", kind === "subtotal" ? "font-semibold text-ink" : tone(value), kind === "headline" && "font-semibold")}>
        {fmt(value)}
      </span>
    </div>
  );
}

export async function CashBurnBridge({ period }: { period: Month }) {
  const b = await getCashBurnBridge(period);
  const fy = `FY${period.slice(0, 4)}`;
  return (
    <section className="mb-6 rounded-xl border border-parchment-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="font-heading text-base text-ink">{fy} cash bridge</h2>
        <span className="text-xs text-steel">
          how a {formatPercent(b.gaapNetMargin, 0)} GAAP margin becomes a {formatPercent(b.freeCashFlowMargin, 0)} cash-flow margin
        </span>
      </div>

      <div className="mt-3 max-w-xl">
        <Row label="GAAP net income" value={b.gaapNetIncome} />
        <Row label="Non-cash add-backs (D&amp;A + stock comp)" value={b.nonCashAddbacks} />
        <Row label="Deferred revenue — annual prepay" value={b.deferredRevenueInflow} kind="headline" />
        <Row label="Other working capital" value={b.otherWorkingCapital} />
        <Row label="Operating cash flow" value={b.operatingCashFlow} kind="subtotal" />
        <Row label="Capital expenditure" value={b.capex} />
        <Row label="Free cash flow" value={b.freeCashFlow} kind="subtotal" />
      </div>

      <p className="mt-3 max-w-2xl text-xs leading-5 text-steel">
        Bearing bills annual-prepay, so growth collects cash up front — the {fmt(b.deferredRevenueInflow)} deferred-revenue
        inflow is what turns a {formatPercent(b.gaapNetMargin, 0)} GAAP loss into a {formatPercent(b.freeCashFlowMargin, 0)}{" "}
        free-cash-flow margin. The long runway is a structural consequence of the prepay model, not an over-raised balance sheet.
      </p>
      <p className="mt-1 text-[11px] leading-4 text-steel/70">
        Bridge shown on the {fy} window (ties to the Forecast column below). The net burn and runway above use a
        trailing-12-month window ending {monthLabel(b.runway.asOf)}.
      </p>
    </section>
  );
}
