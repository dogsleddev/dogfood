import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthLabel, compareMonth } from "@/lib/types/period";
import type { Renewal, RenewalStatus } from "@/lib/types/source";

export type StatusFilter = "all" | RenewalStatus;

export const STATUS_VALUES: readonly RenewalStatus[] = ["open", "renewed", "expanded", "contracted", "churned"];

const STATUS_BADGE: Record<RenewalStatus, string> = {
  open: "bg-amber/15 text-amber-deep",
  renewed: "bg-sage/15 text-sage-deep",
  expanded: "bg-ember-tint text-ember-deep",
  contracted: "bg-amber/15 text-amber-deep",
  churned: "bg-steel/15 text-steel",
};

const STATUS_LABEL: Record<RenewalStatus, string> = {
  open: "Open",
  renewed: "Renewed",
  expanded: "Expanded",
  contracted: "Contracted",
  churned: "Churned",
};

const fmt = (m: Money) => formatMoney(m, { compact: true });

function FilterChips({ active, present }: { active: StatusFilter; present: ReadonlySet<RenewalStatus> }) {
  const chip = (status: StatusFilter, label: string) => {
    const href = status === "all" ? "/sales/renewals" : `/sales/renewals?status=${status}`;
    return (
      <Link
        key={status}
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
      {STATUS_VALUES.filter((s) => present.has(s)).map((s) => chip(s, STATUS_LABEL[s]))}
    </div>
  );
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

/**
 * The Renewals register (CLAUDE.md §8, layer 1) — the retention worklist that defends the contracted
 * base. Each row is one renewal: the customer (joined from `listCustomers`), the contract, the due
 * month, the ARR up for renewal, and the outcome. Summary counts + open ARR are on the WHOLE book;
 * the status chips filter the displayed rows. Open renewals sort by due month (the worklist order);
 * resolved ones by ARR.
 */
export function RenewalsTable({
  renewals,
  customerNames,
  status,
}: {
  renewals: readonly Renewal[];
  customerNames: ReadonlyMap<string, string>;
  status: StatusFilter;
}) {
  const open = renewals.filter((r) => r.status === "open");
  const openArr = sumMoney(open.map((r) => r.arrUpForRenewal));
  const churned = renewals.filter((r) => r.status === "churned");

  const present = new Set(renewals.map((r) => r.status));

  const rows = (status === "all" ? renewals : renewals.filter((r) => r.status === status))
    .slice()
    .sort((a, b) => {
      // Open worklist first by soonest due; everything else by largest ARR.
      const dueCmp = compareMonth(a.dueMonth, b.dueMonth);
      if (a.status === "open" && b.status === "open") return dueCmp;
      return b.arrUpForRenewal.minor - a.arrUpForRenewal.minor || dueCmp;
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-steel">
          <span className="font-medium text-ink">{renewals.length}</span> renewals ·{" "}
          <span className="text-amber-deep">{open.length} open</span> ·{" "}
          <span className="text-steel">{churned.length} churned</span> ·{" "}
          <span className="font-medium text-ink tabular-nums">{fmt(openArr)}</span> open ARR
        </div>
        <FilterChips active={status} present={present} />
      </div>

      <div className="max-h-[600px] overflow-y-auto rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Customer</TH>
              <TH>Contract</TH>
              <TH>Due</TH>
              <TH right>ARR up for renewal</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-parchment-line/60 hover:bg-ember-tint/40">
                <td className="px-3 py-1.5 text-ink">{customerNames.get(r.customerId) ?? r.customerId}</td>
                <td className="px-3 py-1.5 font-mono text-xs text-steel">{r.contractId}</td>
                <td className="px-3 py-1.5 text-steel">{monthLabel(r.dueMonth)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">
                  {r.status === "churned" ? <span className="text-steel">—</span> : fmt(r.arrUpForRenewal)}
                </td>
                <td className="px-3 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_BADGE[r.status])}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-steel">
                  No renewals match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
