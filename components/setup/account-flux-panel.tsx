import Link from "next/link";
import { listFluxNotes } from "@/lib/queries";
import { PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import { monthLabel } from "@/lib/types/period";
import type { GlAccount } from "@/lib/types/source";
import type { FluxNote } from "@/lib/types/flux";
import type { StatementClassification, CostFunction } from "@/lib/types/common";
import {
  addAccountFluxNoteAction,
  resolveAccountFluxNoteAction,
  deleteAccountFluxNoteAction,
} from "@/app/setup/account-mapping/actions";
import { prettyStatementLine } from "./account-mapping-table";

const CLASS_LABEL: Record<StatementClassification, string> = {
  cost_of_revenue: "CoR",
  operating_expense: "OpEx",
};
const FUNCTION_LABEL: Record<CostFunction, string> = {
  direct: "Direct",
  rnd: "R&D",
  sm: "S&M",
  ga: "G&A",
};

const when = (iso: string) => {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
};

/** One account-grain note: body + author/provenance/time, resolve + delete. */
function NoteCard({ note }: { note: FluxNote }) {
  return (
    <div className="rounded-lg border border-parchment-line bg-parchment/60 p-3">
      <p className="text-sm text-ink whitespace-pre-wrap">{note.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-steel">
        <span className="font-medium text-ink">{note.author}</span>
        <span>· {when(note.createdAt)}</span>
        {note.source === "scout" && <span className="rounded bg-ember-tint px-1.5 py-0.5 text-ember-deep">via Scout</span>}
        {note.resolved && <span className="rounded bg-sage/15 px-1.5 py-0.5 text-sage-deep">resolved</span>}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px]">
        <form action={resolveAccountFluxNoteAction}>
          <input type="hidden" name="id" value={note.id} />
          <input type="hidden" name="resolved" value={(!note.resolved).toString()} />
          <button type="submit" className="text-steel hover:text-ink">{note.resolved ? "Reopen" : "Resolve"}</button>
        </form>
        <form action={deleteAccountFluxNoteAction}>
          <input type="hidden" name="id" value={note.id} />
          <button type="submit" className="text-steel hover:text-ember-deep">Delete</button>
        </form>
      </div>
    </div>
  );
}

/**
 * The Flux Analysis card for one trial-balance account (flux-analysis.md). A note here anchors to
 * (accountCode, closeThrough) — the account-grain explanation for the close period. Because the query
 * denormalizes the statement line, the account note also rolls up into that line's P&L / BS / CF peek
 * pane. Transaction notes that roll up to this account (from the Expense register) show read-only,
 * with a pointer to where they're edited. Account-grain notes are editable here; Server Actions power
 * the writes (no client JS).
 */
export async function AccountFluxPanel({ account, closeHref }: { account: GlAccount; closeHref: string }) {
  const period = PLACEHOLDER_SETTINGS.closeThrough;
  const notes = await listFluxNotes({ accountCode: account.code, period });
  const accountNotes = notes.filter((n) => !n.transactionId);
  const txnNotes = notes.filter((n) => n.transactionId);
  const open = accountNotes.filter((n) => !n.resolved).length;

  return (
    <aside className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ember-deep">Flux note · {monthLabel(period)}</div>
          <div className="mt-0.5 font-heading text-lg text-ink">{account.name}</div>
        </div>
        <Link href={closeHref} className="text-steel hover:text-ink" aria-label="Close">✕</Link>
      </div>

      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-steel">Code</dt><dd className="text-right font-mono text-ink">{account.code}</dd>
        <dt className="text-steel">Statement line</dt><dd className="text-right text-ink">{prettyStatementLine(account.statementLineId)}</dd>
        {account.classification && (
          <>
            <dt className="text-steel">Class</dt><dd className="text-right text-ink">{CLASS_LABEL[account.classification]}</dd>
          </>
        )}
        {account.function && (
          <>
            <dt className="text-steel">Function</dt><dd className="text-right text-ink">{FUNCTION_LABEL[account.function]}</dd>
          </>
        )}
      </dl>

      <div className="mb-3 space-y-2">
        {accountNotes.length === 0 ? (
          <p className="text-xs text-steel">
            No account note yet. Explain this account&apos;s variance for the close period — pinned to the account, it
            survives re-import and rolls up to its statement line.
          </p>
        ) : (
          <>
            <div className="text-[11px] text-steel">{accountNotes.length} note{accountNotes.length === 1 ? "" : "s"} · {open} open</div>
            {accountNotes.map((n) => <NoteCard key={n.id} note={n} />)}
          </>
        )}
      </div>

      {txnNotes.length > 0 && (
        <div className="mb-3 rounded-lg border border-parchment-line/70 bg-secondary/30 p-2.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-steel">
            Rolled up · {txnNotes.length} transaction note{txnNotes.length === 1 ? "" : "s"} on this account
          </div>
          <ul className="mt-1 space-y-1">
            {txnNotes.map((n) => (
              <li key={n.id} className="text-[11px] text-steel">
                <span className="text-ink">“{n.body}”</span> — {n.author} · txn {n.transactionId}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] text-steel/80">Open Expense Transactions to edit a transaction note.</p>
        </div>
      )}

      <form action={addAccountFluxNoteAction} className="space-y-2 border-t border-parchment-line/70 pt-3">
        <input type="hidden" name="accountCode" value={account.code} />
        <input type="hidden" name="period" value={period} />
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Explain this account&apos;s variance…"
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
