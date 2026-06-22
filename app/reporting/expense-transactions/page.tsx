import { listExpenseTransactions, listFluxNotes } from "@/lib/queries";
import { month, monthLabel, parseMonth, type Month } from "@/lib/types/period";
import { sumMoney, formatMoney, type Money } from "@/lib/types/money";
import type { VendorBill } from "@/lib/types/transactions";
import { ExpenseTable, prettyGroup } from "@/components/reporting/expense-table";
import { FluxNotePanel } from "@/components/reporting/flux-note-panel";

// Default to the last fully closed month — where reviewing actual expense detail (and a Flux
// Analysis) makes sense. The drill from a P&L line passes ?period=&group=.
const DEFAULT_PERIOD = month(2026, 5);
const fmt = (m: Money) => formatMoney(m, { compact: true });

export default async function ExpenseTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; group?: string; note?: string }>;
}) {
  const { period: rawPeriod, group: rawGroup, note: rawNote } = await searchParams;
  let period: Month = DEFAULT_PERIOD;
  try {
    if (rawPeriod) period = parseMonth(rawPeriod);
  } catch {
    period = DEFAULT_PERIOD;
  }

  // The live query returns ExpenseTransaction[]; the InMemory store serves VendorBills (the AP
  // sub-ledger), which carry the doc#/date/status fields the register shows.
  const allBills = (await listExpenseTransactions({ period })) as readonly VendorBill[];
  const allGroups: string[] = [...new Set(allBills.map((b) => b.groupId as string))].sort();
  const group = rawGroup && allGroups.includes(rawGroup) ? rawGroup : "all";
  const bills = group === "all" ? allBills : allBills.filter((b) => (b.groupId as string) === group);

  const total = sumMoney(allBills.map((b) => b.amount));
  const byGroup = allGroups
    .map((g) => {
      const rows = allBills.filter((b) => (b.groupId as string) === g);
      return { id: g, count: rows.length, amount: sumMoney(rows.map((b) => b.amount)) };
    })
    .sort((a, b) => b.amount.minor - a.amount.minor);

  // Flux notes: which rows carry a note (the marker), and the open transaction's thread (the card).
  const periodNotes = await listFluxNotes({ period });
  const notedIds = new Set(periodNotes.map((n) => n.transactionId).filter((x): x is string => !!x));
  const selected = rawNote ? allBills.find((b) => b.id === rawNote) : undefined;
  const selectedNotes = selected ? await listFluxNotes({ transactionId: selected.id }) : [];
  const closeHref = `/reporting/expense-transactions?period=${period}${group !== "all" ? `&group=${group}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Reporting · Layer 1</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Expense Transactions</h1>
          <span className="text-sm text-steel">{monthLabel(period)} · last closed month</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          GL-level expense detail — where the P&L expense lines bottom out, and the drill target for
          Flux Analysis. Each row is one vendor bill with a stable id; the per-account totals reconcile
          to the general ledger by construction. Click a row&apos;s flux marker to add a note explaining its variance.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {byGroup.map((g) => (
          <div key={g.id} className="rounded-xl border border-parchment-line bg-surface p-3.5">
            <div className="truncate text-xs font-medium text-steel" title={prettyGroup(g.id)}>{prettyGroup(g.id)}</div>
            <div className="mt-1 font-heading text-lg text-ink tabular-nums">{fmt(g.amount)}</div>
            <div className="text-[11px] text-steel">
              {g.count} txns · {((g.amount.minor / total.minor) * 100).toFixed(0)}% of {fmt(total)}
            </div>
          </div>
        ))}
      </div>

      <div className={selected ? "grid items-start gap-6 lg:grid-cols-[1fr_22rem]" : ""}>
        <ExpenseTable bills={bills} period={period} group={group} allGroups={allGroups} notedIds={notedIds} selectedId={selected?.id} />
        {selected && <FluxNotePanel bill={selected} notes={selectedNotes} closeHref={closeHref} />}
      </div>
    </div>
  );
}
