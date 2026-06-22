import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { compareMonth, monthLabel } from "@/lib/types/period";
import type { Renewal, RenewalStatus } from "@/lib/types/source";

const fmt = (m: Money) => formatMoney(m, { compact: true });

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

const CLOSED_STATUSES: readonly RenewalStatus[] = ["renewed", "expanded", "contracted", "churned"];

/**
 * Three summary views over the Renewals register (CLAUDE.md §8, layer 1 — the retention motion),
 * derived purely from the `listRenewals` records (no extra query): the forward worklist (the open
 * book of ARR up for renewal that defends the contracted base), the resolved outcomes by status,
 * and a gross-retention read on the closed book (renewed + expanded + contracted dollars kept vs
 * churned dollars lost). All amounts are `arrUpForRenewal` off the same records the table shows.
 */
export function RenewalCards({ renewals }: { renewals: readonly Renewal[] }) {
  const open = renewals.filter((r) => r.status === "open");
  const closed = renewals.filter((r) => CLOSED_STATUSES.includes(r.status));
  const openArr = sumMoney(open.map((r) => r.arrUpForRenewal));

  // Outcomes by status on the resolved book.
  const byStatus = (s: RenewalStatus) => closed.filter((r) => r.status === s);
  const renewed = byStatus("renewed");
  const expanded = byStatus("expanded");
  const contracted = byStatus("contracted");
  const churned = byStatus("churned");

  // Gross dollar retention on the closed book: kept (renewed + expanded + contracted face value) vs
  // churned (lost), against the total face value that came up for renewal.
  const keptArr = sumMoney([...renewed, ...expanded, ...contracted].map((r) => r.arrUpForRenewal));
  const churnedArr = sumMoney(churned.map((r) => r.arrUpForRenewal));
  const closedArr = sumMoney(closed.map((r) => r.arrUpForRenewal));
  const grrPct = closedArr.minor > 0 ? `${((keptArr.minor / closedArr.minor) * 100).toFixed(1)}%` : "—";

  // Next-up window: the soonest open renewal due month.
  const nextDue = open.length > 0 ? [...open].sort((a, b) => compareMonth(a.dueMonth, b.dueMonth))[0] : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker="Forward worklist · open renewals">
        <div className="font-heading text-2xl text-ink tabular-nums">{fmt(openArr)}</div>
        <div className="mb-2 text-[11px] leading-snug text-steel">
          ARR up for renewal on the open book — the contracted base under active defense.
        </div>
        <Line label="Open renewals" value={open.length.toLocaleString()} tone="pos" />
        <Line label="Resolved" value={closed.length.toLocaleString()} tone="muted" />
        <Line label="Total tracked" value={renewals.length.toLocaleString()} tone="total" />
      </Card>

      <Card kicker="Resolved outcomes · by status">
        <Line label="Renewed" value={`${renewed.length} · ${fmt(sumMoney(renewed.map((r) => r.arrUpForRenewal)))}`} tone="pos" />
        <Line label="Expanded" value={`${expanded.length} · ${fmt(sumMoney(expanded.map((r) => r.arrUpForRenewal)))}`} tone="pos" />
        <Line label="Contracted" value={`${contracted.length} · ${fmt(sumMoney(contracted.map((r) => r.arrUpForRenewal)))}`} tone="neg" />
        <Line label="Churned" value={`${churned.length} · ${fmt(churnedArr)}`} tone="neg" />
        <Line label="All resolved" value={`${closed.length} · ${fmt(closedArr)}`} tone="total" />
      </Card>

      <Card kicker="Gross dollar retention · closed book">
        <div className="font-heading text-2xl text-ink tabular-nums">{grrPct}</div>
        <div className="mb-2 text-[11px] leading-snug text-steel">
          Face-value ARR kept (renewed + expanded + contracted) over ARR up for renewal on the
          resolved book.
        </div>
        <Line label="Kept" value={fmt(keptArr)} tone="pos" />
        <Line label="Churned" value={fmt(churnedArr)} tone="neg" />
        <Line label="Next due" value={nextDue ? monthLabel(nextDue.dueMonth) : "—"} tone="total" />
      </Card>
    </div>
  );
}
