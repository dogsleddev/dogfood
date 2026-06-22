import { formatMoney, sumMoney, moneyFromMinor, type Money } from "@/lib/types/money";
import { monthYear } from "@/lib/types/period";
import type { Customer, PlanTier } from "@/lib/types/source";

const fmt = (m: Money) => formatMoney(m, { compact: true });

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "pos" | "muted" | "total" }) {
  const valueClass = tone === "pos" ? "text-sage-deep" : tone === "muted" ? "text-steel" : "text-ink";
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${tone === "total" ? "border-t border-parchment-line/70 mt-1 pt-2" : ""}`}>
      <span className={`text-sm ${tone === "total" ? "font-medium text-ink" : "text-steel"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${tone === "total" ? "font-semibold text-ink" : valueClass}`}>{value}</span>
    </div>
  );
}

const SEGMENT_ORDER: readonly PlanTier[] = ["starter", "growth", "scale"];
const SEGMENT_LABEL: Record<PlanTier, string> = { starter: "Starter", growth: "Growth", scale: "Scale" };

/**
 * The three summary views over the Customers register (CLAUDE.md §8, layer 1), derived purely from
 * the `listCustomers` records (no extra query): the book of business (run-rate ARR + logos), the
 * active book by segment, and the new-logo acquisition ramp by cohort year. The records carry each
 * customer's current ARR, so Σ active === the exit/run-rate ARR by construction (subscription
 * tie-out) — a forward run-rate, NOT the point-in-time June ARR the Dashboard tile shows. Labeled
 * as run-rate so the two surfaces don't read as contradictory.
 */
export function CustomerCards({ customers }: { customers: readonly Customer[] }) {
  const active = customers.filter((c) => c.status === "active");
  const churned = customers.filter((c) => c.status === "churned");
  const activeArr = sumMoney(active.map((c) => c.arr));
  const arrPerLogo = active.length > 0 ? moneyFromMinor(Math.round(activeArr.minor / active.length)) : moneyFromMinor(0);

  const bySegment = SEGMENT_ORDER.map((tier) => {
    const rows = active.filter((c) => c.segment === tier);
    return { tier, logos: rows.length, arr: sumMoney(rows.map((c) => c.arr)) };
  });

  // New logos by acquisition cohort. 2023 starts are the pre-existing book (negative start index).
  const cohort = (year: number) => customers.filter((c) => monthYear(c.startMonth) === year).length;
  const base = cohort(2023);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker="Book of business · run-rate">
        <div className="font-heading text-2xl text-ink tabular-nums">{fmt(activeArr)}</div>
        <div className="mb-2 text-[11px] leading-snug text-steel">
          Exit run-rate ARR. The Dashboard ARR tile shows the point-in-time June balance.
        </div>
        <Line label="Active logos" value={active.length.toLocaleString()} tone="pos" />
        <Line label="Churned logos" value={churned.length.toLocaleString()} tone="muted" />
        <Line label="ARR per logo" value={fmt(arrPerLogo)} tone="total" />
      </Card>

      <Card kicker="Active book · by segment">
        {bySegment.map((s) => (
          <Line key={s.tier} label={SEGMENT_LABEL[s.tier]} value={`${s.logos} · ${fmt(s.arr)}`} />
        ))}
        <Line label="All segments" value={`${active.length} · ${fmt(activeArr)}`} tone="total" />
      </Card>

      <Card kicker="Acquisition · new logos by cohort">
        <Line label="Pre-FY24 base" value={base.toLocaleString()} tone="muted" />
        <Line label="FY2024" value={`+${cohort(2024)}`} tone="pos" />
        <Line label="FY2025" value={`+${cohort(2025)}`} tone="pos" />
        <Line label="FY2026" value={`+${cohort(2026)}`} tone="pos" />
        <Line label="All logos" value={customers.length.toLocaleString()} tone="total" />
      </Card>
    </div>
  );
}
