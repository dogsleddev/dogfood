import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthLabel } from "@/lib/types/period";
import type { Customer, CustomerStatus, PlanTier } from "@/lib/types/source";

export type StatusFilter = "all" | CustomerStatus;

const STATUS_BADGE: Record<CustomerStatus, string> = {
  active: "bg-sage/15 text-sage-deep",
  churned: "bg-steel/15 text-steel",
};

// Segment === plan tier (§8). Entry → mid → top, by spend.
const SEGMENT_BADGE: Record<PlanTier, string> = {
  starter: "bg-steel/15 text-steel",
  growth: "bg-amber/15 text-amber-deep",
  scale: "bg-ember-tint text-ember-deep",
};

const fmt = (m: Money) => formatMoney(m, { compact: true });

function FilterChips({ active }: { active: StatusFilter }) {
  const chip = (status: StatusFilter, label: string) => {
    const href = status === "all" ? "/sales/customers" : `/sales/customers?status=${status}`;
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
      {chip("churned", "Churned")}
    </div>
  );
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * The Customers register (CLAUDE.md §8, layer 1) — the accounts behind the ARR: logo, segment,
 * tenure, and current ARR. Reads `listCustomers` (the live DataStore seam). Summary counts +
 * active ARR (the book run-rate) are on the WHOLE book; the status chips filter the displayed rows.
 * Active-customer ARR sums to the exit ARR by construction (subscription tie-out, a third path).
 */
export function CustomersTable({ customers, status }: { customers: readonly Customer[]; status: StatusFilter }) {
  const active = customers.filter((c) => c.status === "active");
  const churned = customers.filter((c) => c.status === "churned");
  const activeArr = sumMoney(active.map((c) => c.arr));

  const rows = (status === "all" ? customers : customers.filter((c) => c.status === status))
    .slice()
    .sort((a, b) => b.arr.minor - a.arr.minor);

  const pctOfBook = (c: Customer): string =>
    c.status === "active" && activeArr.minor > 0 ? `${((c.arr.minor / activeArr.minor) * 100).toFixed(1)}%` : "—";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-steel">
          <span className="font-medium text-ink">{customers.length}</span> customers ·{" "}
          <span className="text-sage-deep">{active.length} active</span> ·{" "}
          <span className="text-steel">{churned.length} churned</span> ·{" "}
          <span className="font-medium text-ink tabular-nums">{fmt(activeArr)}</span> run-rate ARR
        </div>
        <FilterChips active={status} />
      </div>

      <div className="max-h-[600px] overflow-y-auto rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Customer</TH>
              <TH>Segment</TH>
              <TH>Customer since</TH>
              <TH right>ARR</TH>
              <TH right>% of book</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-parchment-line/60 hover:bg-ember-tint/40">
                <td className="px-3 py-1.5 text-ink">{c.name}</td>
                <td className="px-3 py-1.5">
                  {c.segment ? (
                    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium capitalize", SEGMENT_BADGE[c.segment as PlanTier])}>
                      {c.segment}
                    </span>
                  ) : (
                    <span className="text-steel">—</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-steel">{monthLabel(c.startMonth)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                  {c.status === "churned" ? <span className="text-steel">—</span> : fmt(c.arr)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">{pctOfBook(c)}</td>
                <td className="px-3 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[c.status])}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-steel">
                  No customers match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
