import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, sumMoney, type Money } from "@/lib/types/money";
import { monthLabel, type Month } from "@/lib/types/period";
import type { VendorBill, DocStatus } from "@/lib/types/transactions";
import { SEED_EXPENSE_GROUPS } from "@/lib/target/placeholder";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const fmtFull = (m: Money) => formatMoney(m, { cents: true });

const GROUP_LABEL: Record<string, string> = Object.fromEntries(SEED_EXPENSE_GROUPS.map((g) => [g.id, g.label]));
export const prettyGroup = (id: string): string =>
  GROUP_LABEL[id] ?? id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bCor\b/, "CoR");

const STATUS_BADGE: Record<DocStatus, string> = {
  open: "bg-amber/15 text-amber-deep",
  paid: "bg-sage/15 text-sage-deep",
};

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

function GroupChips({ groups, active, period }: { groups: readonly string[]; active: string; period: Month }) {
  const href = (g: string) => {
    const params = new URLSearchParams({ period });
    if (g !== "all") params.set("group", g);
    return `/reporting/expense-transactions?${params.toString()}`;
  };
  const chip = (g: string, label: string) => (
    <Link
      key={g}
      href={href(g)}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs transition-colors",
        active === g ? "bg-surface font-medium text-ink shadow-sm" : "text-steel hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-parchment-line bg-secondary/40 p-0.5">
      {chip("all", "All")}
      {groups.map((g) => chip(g, prettyGroup(g)))}
    </div>
  );
}

/**
 * The Expense Transactions register (CLAUDE.md §8, layer 1) — GL-level expense detail where the P&L
 * expense lines bottom out, and the drill target for Flux Analysis. Reads `listExpenseTransactions`
 * (the live AP sub-ledger). Each row carries a stable `id` (the future flux-note anchor). The chips
 * filter by expense group; Σ(rows for an account-month) reconciles to that account's GL activity.
 */
export function ExpenseTable({
  bills,
  period,
  group,
  allGroups,
  notedIds,
  selectedId,
}: {
  bills: readonly VendorBill[];
  period: Month;
  group: string;
  allGroups: readonly string[];
  /** transaction ids that carry a flux note (for the row marker) */
  notedIds: ReadonlySet<string>;
  /** the row whose flux card is open (?note=) */
  selectedId?: string;
}) {
  const total = sumMoney(bills.map((b) => b.amount));
  const rows = [...bills].sort((a, b) => b.amount.minor - a.amount.minor);
  const noteHref = (id: string) => {
    const params = new URLSearchParams({ period });
    if (group !== "all") params.set("group", group);
    params.set("note", id);
    return `/reporting/expense-transactions?${params.toString()}`;
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-steel">
          <span className="font-medium text-ink">{bills.length}</span> transactions ·{" "}
          <span className="font-medium text-ink tabular-nums">{fmt(total)}</span>{" "}
          {group === "all" ? "total" : prettyGroup(group)} · {monthLabel(period)}
        </div>
        <GroupChips groups={allGroups} active={group} period={period} />
      </div>

      <div className="max-h-[600px] overflow-y-auto rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Doc #</TH>
              <TH>Date</TH>
              <TH>Vendor</TH>
              <TH>Group</TH>
              <TH>Function</TH>
              <TH right>Amount</TH>
              <TH>Status</TH>
              <TH>Flux</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr
                key={b.id}
                className={cn(
                  "border-t border-parchment-line/60 hover:bg-ember-tint/40",
                  selectedId === b.id && "bg-ember-tint/60",
                )}
                title={b.memo ?? undefined}
              >
                <td className="px-3 py-1.5 font-mono text-xs text-steel">{b.docNumber}</td>
                <td className="px-3 py-1.5 text-steel">{b.date}</td>
                <td className="px-3 py-1.5 text-ink">{b.vendor ?? "—"}</td>
                <td className="px-3 py-1.5 text-steel">{prettyGroup(b.groupId)}</td>
                <td className="px-3 py-1.5 uppercase text-steel">{b.function}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmtFull(b.amount)}</td>
                <td className="px-3 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[b.status])}>
                    {b.status}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <Link
                    href={noteHref(b.id)}
                    title={notedIds.has(b.id) ? "View flux notes" : "Add a flux note"}
                    className={cn(
                      "text-xs",
                      notedIds.has(b.id) ? "text-ember-deep" : "text-steel/40 hover:text-ember-deep",
                    )}
                  >
                    {notedIds.has(b.id) ? "● note" : "＋"}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-steel">
                  No expense transactions for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
