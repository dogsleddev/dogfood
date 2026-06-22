import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { Contract, ContractStatus, BookingType } from "@/lib/types/source";

export type StatusFilter = "all" | ContractStatus;

const STATUS_BADGE: Record<ContractStatus, string> = {
  active: "bg-sage/15 text-sage-deep",
  pending: "bg-amber/15 text-amber-deep",
  churned: "bg-steel/15 text-steel",
};

const BOOKING_BADGE: Record<BookingType, string> = {
  new: "bg-ember-tint text-ember-deep",
  expansion: "bg-sage/15 text-sage-deep",
  contraction: "bg-amber/15 text-amber-deep",
};

const fmt = (m: Money) => formatMoney(m, { compact: true });

function FilterChips({ active }: { active: StatusFilter }) {
  const chip = (status: StatusFilter, label: string) => {
    const href = status === "all" ? "/sales/contracts" : `/sales/contracts?status=${status}`;
    return (
      <Link
        href={href}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs transition-colors",
          active === status ? "bg-surface font-medium text-ink shadow-sm" : "text-steel hover:text-ink",
        )}
      >
        {label}
      </Link>
    );
  };
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-parchment-line bg-secondary/40 p-0.5">
      {chip("all", "All")}
      {chip("active", "Active")}
      {chip("pending", "Pending")}
      {chip("churned", "Churned")}
    </div>
  );
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * The Contracts register (CLAUDE.md §8, layer 1) — the signed-agreement source records that feed
 * 606 recognition, deferred, and AR. Reads `listContracts` (the live DataStore seam). Summary
 * counts are on the WHOLE book; the status chips filter the displayed rows.
 */
export function ContractsTable({ contracts, status }: { contracts: readonly Contract[]; status: StatusFilter }) {
  const active = contracts.filter((c) => c.status === "active");
  const churned = contracts.filter((c) => c.status === "churned");
  const activeArr = sumMoney(active.map((c) => c.arr));

  const rows = (status === "all" ? contracts : contracts.filter((c) => c.status === status))
    .slice()
    .sort((a, b) => b.arr.minor - a.arr.minor);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-steel">
          <span className="font-medium text-ink">{contracts.length}</span> contracts ·{" "}
          <span className="text-sage-deep">{active.length} active</span> ·{" "}
          <span className="text-steel">{churned.length} churned</span> ·{" "}
          <span className="font-medium text-ink tabular-nums">{fmt(activeArr)}</span> active ARR
        </div>
        <FilterChips active={status} />
      </div>

      <div className="max-h-[600px] overflow-y-auto rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Customer</TH>
              <TH>Stream</TH>
              <TH>Plan</TH>
              <TH right>ARR</TH>
              <TH>Start</TH>
              <TH right>Term</TH>
              <TH>Status</TH>
              <TH>Booking</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-parchment-line/60 hover:bg-ember-tint/40">
                <td className="px-3 py-1.5 text-ink">{c.customerName}</td>
                <td className="px-3 py-1.5 capitalize text-steel">{c.stream}</td>
                <td className="px-3 py-1.5 capitalize text-steel">{c.planTier ?? "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                  {c.status === "churned" ? <span className="text-steel">—</span> : fmt(c.arr)}
                </td>
                <td className="px-3 py-1.5 text-steel">{monthLabel(c.startMonth)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">{c.termMonths}mo</td>
                <td className="px-3 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[c.status])}>
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium capitalize", BOOKING_BADGE[c.bookingType])}>
                    {c.bookingType}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-steel">
                  No contracts match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
