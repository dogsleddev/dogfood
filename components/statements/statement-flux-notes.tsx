import { listFluxNotes } from "@/lib/queries";
import { PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import { monthLabel } from "@/lib/types/period";
import type { FluxNote } from "@/lib/types/flux";

/**
 * The three flux write actions a reading-surface pane needs. They are Server Actions whose only
 * difference per statement is the `revalidatePath` they call (P&L / Balance Sheet / Cash Flow), so
 * the section is generic and each page passes its own — "one source, two callers" at the action seam.
 */
export interface StatementFluxActions {
  /** add a line note — form fields: statementLine, period, body, resolved? */
  readonly add: (formData: FormData) => Promise<void>;
  /** toggle resolved — form fields: id, resolved */
  readonly resolve: (formData: FormData) => Promise<void>;
  /** delete — form field: id */
  readonly remove: (formData: FormData) => Promise<void>;
}

const when = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
};

function LineNote({ note, actions }: { note: FluxNote; actions: StatementFluxActions }) {
  return (
    <div className="rounded-lg border border-parchment-line bg-parchment/60 p-2.5">
      <p className="text-sm text-ink whitespace-pre-wrap">{note.body}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-steel">
        <span className="font-medium text-ink">{note.author}</span>
        <span>· {when(note.createdAt)}</span>
        {note.source === "scout" && <span className="rounded bg-ember-tint px-1.5 py-0.5 text-ember-deep">via Scout</span>}
        {note.resolved && <span className="rounded bg-sage/15 px-1.5 py-0.5 text-sage-deep">resolved</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[11px]">
        <form action={actions.resolve}>
          <input type="hidden" name="id" value={note.id} />
          <input type="hidden" name="resolved" value={(!note.resolved).toString()} />
          <button type="submit" className="text-steel hover:text-ink">{note.resolved ? "Reopen" : "Resolve"}</button>
        </form>
        <form action={actions.remove}>
          <input type="hidden" name="id" value={note.id} />
          <button type="submit" className="text-steel hover:text-ember-deep">Delete</button>
        </form>
      </div>
    </div>
  );
}

/**
 * The Flux Analysis Notes section of a statement peek pane (flux-analysis.md) — shared by the P&L,
 * Balance Sheet, and Cash Flow panes. Flux happens on the last closed month, so a line note anchors
 * to (statementLine, closeThrough). One query rolls up every grain: because each note carries a
 * denormalized `statement_line`, listing by (line, period) returns the line note PLUS the account-
 * and transaction-grain notes that roll up to it. Line notes are editable here; the deeper notes are
 * shown as a read-only roll-up with a pointer to where they live.
 */
export async function StatementFluxNotes({ lineId, actions }: { lineId: string; actions: StatementFluxActions }) {
  const period = PLACEHOLDER_SETTINGS.closeThrough;
  const notes = await listFluxNotes({ statementLine: lineId, period });
  const lineNotes = notes.filter((n) => !n.transactionId && !n.accountCode);
  const rolledUp = notes.filter((n) => n.transactionId || n.accountCode);

  return (
    <div className="border-t border-parchment-line px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-ember-deep">Flux notes · {monthLabel(period)}</div>

      <div className="mt-2 space-y-2">
        {lineNotes.length === 0 && rolledUp.length === 0 && (
          <p className="text-xs text-steel">No notes yet. Explain this line&apos;s variance — it stays visible wherever this number appears.</p>
        )}
        {lineNotes.map((n) => <LineNote key={n.id} note={n} actions={actions} />)}
      </div>

      {rolledUp.length > 0 && (
        <div className="mt-2 rounded-lg border border-parchment-line/70 bg-secondary/30 p-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-steel">
            Rolled up · {rolledUp.length} note{rolledUp.length === 1 ? "" : "s"} on accounts / transactions
          </div>
          <ul className="mt-1 space-y-1">
            {rolledUp.map((n) => (
              <li key={n.id} className="text-[11px] text-steel">
                <span className="text-ink">“{n.body}”</span> — {n.author}
                {n.transactionId ? ` · txn ${n.transactionId}` : n.accountCode ? ` · acct ${n.accountCode}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-steel/80">Open the register or Account Mapping to edit a deeper note.</p>
        </div>
      )}

      <form action={actions.add} className="mt-2 space-y-2">
        <input type="hidden" name="statementLine" value={lineId} />
        <input type="hidden" name="period" value={period} />
        <textarea
          name="body"
          required
          rows={2}
          placeholder="Add a line note…"
          className="w-full resize-y rounded-lg border border-parchment-line bg-parchment/40 p-2 text-xs text-ink placeholder:text-steel/70 focus:border-ember focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11px] text-steel">
            <input type="checkbox" name="resolved" className="accent-ember" /> Resolve
          </label>
          <button type="submit" className="rounded-lg bg-ember px-2.5 py-1 text-[11px] font-medium text-white hover:bg-ember-deep">
            Add note
          </button>
        </div>
      </form>
    </div>
  );
}
