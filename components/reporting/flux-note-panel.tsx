import Link from "next/link";
import { formatMoney, type Money } from "@/lib/types/money";
import type { VendorBill } from "@/lib/types/transactions";
import type { FluxNote } from "@/lib/types/flux";
import { addFluxNoteAction, resolveFluxNoteAction, deleteFluxNoteAction } from "@/app/reporting/expense-transactions/actions";
import { prettyGroup } from "./expense-table";

const full = (m?: Money) => (m ? formatMoney(m, { cents: true }) : "—");
const when = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
};

/** One note in the thread: body + author/provenance/time, the amount snapshot (flux-on-the-flux flag), resolve + delete. */
function NoteCard({ note, currentAmount }: { note: FluxNote; currentAmount?: Money }) {
  const changed = note.amountAtNote && currentAmount && note.amountAtNote.minor !== currentAmount.minor;
  return (
    <div className="rounded-lg border border-parchment-line bg-parchment/60 p-3">
      <p className="text-sm text-ink whitespace-pre-wrap">{note.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-steel">
        <span className="font-medium text-ink">{note.author}</span>
        <span>· {when(note.createdAt)}</span>
        {note.source === "scout" && <span className="rounded bg-ember-tint px-1.5 py-0.5 text-ember-deep">via Scout</span>}
        {note.resolved && <span className="rounded bg-sage/15 px-1.5 py-0.5 text-sage-deep">resolved</span>}
        {note.amountAtNote && (
          <span title="the figure when the note was written">@ {full(note.amountAtNote)}</span>
        )}
        {changed && (
          <span className="rounded bg-amber/15 px-1.5 py-0.5 text-amber-deep" title="the underlying figure moved since this note">
            ⚠ figure changed
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <form action={resolveFluxNoteAction}>
          <input type="hidden" name="id" value={note.id} />
          <input type="hidden" name="resolved" value={(!note.resolved).toString()} />
          <button type="submit" className="text-steel hover:text-ink">{note.resolved ? "Reopen" : "Resolve"}</button>
        </form>
        <form action={deleteFluxNoteAction}>
          <input type="hidden" name="id" value={note.id} />
          <button type="submit" className="text-steel hover:text-ember-deep">Delete</button>
        </form>
      </div>
    </div>
  );
}

/**
 * The right-hand Flux Analysis card for one transaction (flux-analysis.md): the bill summary, its note
 * thread, and the note composer. A note is a Dogfood write pinned to the bill's stable id — it never
 * edits the actuals. Server Actions power the writes (no client JS required).
 */
export function FluxNotePanel({ bill, notes, closeHref }: { bill: VendorBill; notes: readonly FluxNote[]; closeHref: string }) {
  const open = notes.filter((n) => !n.resolved).length;
  return (
    <aside className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ember-deep">Flux note</div>
          <div className="mt-0.5 font-heading text-lg text-ink">{bill.vendor ?? "—"}</div>
        </div>
        <Link href={closeHref} className="text-steel hover:text-ink" aria-label="Close">✕</Link>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-steel">Doc #</dt><dd className="text-right font-mono text-ink">{bill.docNumber}</dd>
        <dt className="text-steel">Amount</dt><dd className="text-right tabular-nums text-ink">{full(bill.amount)}</dd>
        <dt className="text-steel">Group</dt><dd className="text-right text-ink">{prettyGroup(bill.groupId)}</dd>
        <dt className="text-steel">Date</dt><dd className="text-right text-ink">{bill.date}</dd>
        <dt className="text-steel">Status</dt><dd className="text-right capitalize text-ink">{bill.status}</dd>
      </dl>

      <div className="mb-3 space-y-2">
        {notes.length === 0 ? (
          <p className="text-xs text-steel">No notes yet. Explain why this bill drove its variance — pinned to its stable id, it survives re-import.</p>
        ) : (
          <>
            <div className="text-[11px] text-steel">{notes.length} note{notes.length === 1 ? "" : "s"} · {open} open</div>
            {notes.map((n) => <NoteCard key={n.id} note={n} currentAmount={bill.amount} />)}
          </>
        )}
      </div>

      <form action={addFluxNoteAction} className="space-y-2 border-t border-parchment-line/70 pt-3">
        <input type="hidden" name="transactionId" value={bill.id} />
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Explain this variance…"
          className="w-full resize-y rounded-lg border border-parchment-line bg-parchment/40 p-2 text-sm text-ink placeholder:text-steel/70 focus:border-ember focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs text-steel">
            <input type="checkbox" name="resolved" className="accent-ember" /> Mark resolved
          </label>
          <button type="submit" className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-white hover:bg-ember-deep">
            Add note
          </button>
        </div>
      </form>
    </aside>
  );
}
