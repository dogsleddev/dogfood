# Flux Analysis — guide + design spec

> **What this doc is.** A deep how-to for running a flux (variance) analysis in Dogfood, where the
> reviewer annotates a number with a note that is keyed to a **transaction** or an **account/line**
> and stays visible on the right-hand drilldown card **wherever you are in the tool** — summary view
> or transaction detail.
>
> **Status (2026-06-21, the Run).** Design **confirmed by Chris** and the **first write path is BUILT**.
> The note model, the trial-balance account anchor, the transaction drawer, resolve semantics, and
> expenses-first are locked (Part 2 → "Decisions"). **BUILT + live on Supabase (both backends):** the
> `flux_notes` write store (migration `0003_flux_notes.sql` — the 3 anchor grains, `source`, the
> multi-author thread), the DataStore seam (`listFluxNotes`/`addFluxNote`/`setFluxNoteResolved`/
> `deleteFluxNote`), the query layer (`lib/queries/flux.ts`, with author + roll-up denormalization),
> **the right-hand note card on the Expense Transactions register** (`?note=<txnId>`); the **P&L
> peek-pane Notes section** (`?inspect=<lineId>` → line notes anchored to the last closed month, with
> the account/transaction notes **rolled up via the denormalized `statement_line`**, a composer, and
> resolve/delete); `getFluxDetail` (the variance decomposition — line actual/forecast/budget/variance +
> the bills composing it); and the **Scout flux tools** (`getFluxNotes` read · `getFluxDetail` · and
> `addFluxNote`, Scout's first WRITE). All Server Actions, no client JS. **Note semantics resolved:**
> statement/pane notes anchor to the **last closed month** (flux is done on closed months). **Not yet
> built (the smaller surfaces):** the trial-balance / Account-Mapping **account-grain card** (anchor
> `(account_code, period)` — the schema + `addFluxNote` query already support it) and the **Balance
> Sheet / Cash Flow peek panes** (parity with the P&L pane; reuse `PnlFluxNotes`). So **Part 1 is the
> user guide prose** (ready to graduate into `lib/guides/content.ts` as guide #7) and **Part 2 is the
> design/build spec**. CLAUDE.md §16 / §8 / §10 updated.

---

# Part 1 — The guide (user-facing)

## What flux analysis is

A flux analysis is the monthly discipline of explaining your variances. After a month closes you
compare what happened to what you planned, find the lines that moved more than they should have, and
write down **why** each one moved. The "why" is the deliverable: a board, an auditor, or future-you
opening the period should be able to read the explanation next to the number without asking anyone.

Dogfood does not run your close, and flux analysis is not a separate set of numbers. The variances
already live on your statements (the Budget / Actual / Variance / Forecast columns, and the monthly
board view). Flux analysis adds the missing layer on top of them: **a durable note attached to the
thing that moved**, written once and visible everywhere that number appears.

## Where the variances live

You flux against numbers that are already on the screen:

- **Forecasted P&L** carries **Budget · Actual · Variance · Forecast** columns. Variance is Forecast
  minus Budget, colored by whether the line is better high (revenue, margin) or better low (cost).
  Switch the header toggle to **Monthly** to see every line spread across the months of the year, so
  you can spot the single month a line jumped.
- **Balance Sheet** and **Cash Flow Forecast** show the same period-over-period movement on their
  lines.

Flux makes sense on **closed** months. For Bearing today that is January 2024 through May 2026
(Actual); June 2026 is in close, so treat it as provisional; July through December is forecast, not
yet a variance to explain. Most flux work happens on the last closed month.

## The two altitudes you annotate

You will want to explain a variance at one of two levels, and Dogfood lets you write a note at either:

- **Account / line level.** The headline explanation for a whole line or account in a period. *"Sales
  & Marketing is $40K over budget in May, Q3 campaign pull-forward, approved by the VP."* This is the
  note a board reader wants: one sentence on the line that moved. You can write it from the P&L line,
  or directly on the account from the trial balance / Account Mapping when you do not want to drill to
  a single bill to make your point.
- **Transaction level.** The pin-point note on a single document that drives the variance. *"This
  $38K Google Ads bill is the pull-forward."* This is the note an auditor or a teammate doing the
  next close wants: the exact bill, called out.

The two are complementary. A line or account note says *what happened*; a transaction note says
*which item proves it*. You can write either, both, or neither, and they share one card and one editor
so it never matters which one you reach for first.

Your note is always your own writing layered on top of the books. The transactions and the trial
balance come from your ERP (uploaded as a CSV) and stay untouched; the note is the one thing you add
in Dogfood, and it is pinned to the exact bill or account it explains so it stays put when the data is
re-uploaded.

## The card on the right — one card, two ways in

Every note is written and read on **the drilldown card that opens on the right**. There are two ways
to open that card, and they lead to the same note surface:

**1. From a summary view (the peek pane).** On the Dashboard and the statements — the reading
surfaces — the first tap on a number opens the right-hand **peek pane** for that line and period. The
pane shows the line's values and its drill targets (the §6 peek-vs-place behavior). Flux analysis
adds a **Notes** section to that pane:

- The **line note** for this line and period sits at the top — the headline explanation, editable in
  place.
- Below it, a **roll-up of the transaction notes** attached to the documents that compose this line
  in this period (a count plus the notes inline), so you can read what has already been pinned
  without leaving the summary.
- An **Add note** affordance writes a new line note, or jumps you to the transaction list to pin one
  on a specific document.

So you can stand on the P&L's Sales & Marketing line, open the pane, read the existing explanation,
and add yours — without going anywhere.

**2. From the transaction detail.** When you need the specific document, open **Expense Transactions**
(Reporting → Expense Transactions), or click **Open full ↗ → register** from the peek pane. The
register lists every bill for the period with a stable id, vendor, group, amount, and status. Opening
a transaction (clicking its row) slides out **the same card on the right**, now scoped to that one
bill, with the same note editor. Write the note here and it pins to that transaction's stable id.

The point: **the note-writing surface is the right-hand card, and it is the same card whether you
arrived from a summary line or from a transaction row.** That is what makes flux easy to do no matter
where you are — you never have to learn a second place to write a note.

## Writing a note

A note is short and structured:

- **Body** — the explanation, in plain language. One or two sentences is the norm.
- **Author** — every note records **who wrote it** and shows it on the card. In Bearing today that is
  Chris, CFO. Notes on the same bill or account stack into a short **thread**, so a teammate can add a
  follow-up without overwriting the first explanation.
- **Resolved** — a toggle. Open variances are the worklist for this close; resolved ones are the
  explanations you have signed off. The flux is "done" for a line when its material variances are all
  resolved.

Every note can be **edited, resolved, or deleted** from the card. Delete is always available, so a
note added by mistake (your own or one Scout wrote for you) is one click to remove.

When you save, Dogfood also snapshots the **amount at the time of the note** behind the scenes (see
"Notes are durable" below). You do not type that; it is captured for you.

You are **not editing the actuals.** Imported transactions and closed statements stay immutable —
Dogfood reads a clean close. A note is a separate layer written on top, the same way a scenario
adjustment is a delta off Base. Your note never changes a statement number; it explains it.

## How notes stay visible everywhere

A note you write once shows up at every altitude where its number appears, because notes roll up by
**(line, period)**:

- A **transaction note** is visible on that transaction's card **and** rolls up into the line's peek
  pane (it appears in the line's transaction-notes section). Pin the Google Ads bill, and the Sales &
  Marketing line's pane shows it.
- A **line note** is visible on the line's peek pane **and** is carried as context when you drop into
  that line's transactions, so the person pinning a document sees the headline already written.
- A small **note marker** appears next to any line or row that carries a note, so you can scan a
  statement or the register and see what has already been explained before you open anything.

One write, surfaced everywhere it is relevant — read it from the summary, read it from the detail.

## Notes are durable (restatement)

Flux notes are built to survive the thing that usually destroys annotations: re-importing a period.

- Notes key on a **stable id** — the ERP transaction id for a transaction note, or the (line, period)
  for a line note — never on row position, sort order, or page. Re-sort, re-paginate, or re-import,
  and the note still attaches.
- Because Dogfood snapshots the **amount at the time of the note**, if a prior month is restated and
  the underlying number moves, the card shows that the figure changed since you wrote — a
  flux-on-the-flux signal that the explanation may need a second look.
- If a re-import **removes** the transaction a note was pinned to, the note is flagged **orphaned /
  needs re-review** rather than silently dropped.

## Asking Scout about flux

Scout reads the same notes you write (one source, two callers), so once a line is explained you can
ask Scout about it and it narrates the variance with your reasoning folded in:

- *"Why is Sales & Marketing over budget in May?"* → if the line is already explained, Scout reports
  the variance and quotes the reviewer's note ("the reviewer flagged the Google Ads line as a Q3
  campaign pull-forward").
- *"Why is Sales & Marketing over budget in May?"* with **no notes yet** → instead of "no notes,"
  Scout shows you the **breakdown so you can write one**: the actual transactions for that line in
  that period, largest first, set against the budget detail, smallest first, laid out as a table with
  **Actual, Forecast, and Budget columns**. Where an item exists on both sides (an account or group)
  the three columns sit on one row with the variance; where it does not (a vendor bill with no
  budgeted line, or a planned item with no spend) it shows on its own row with the missing cells
  blank, because the actuals and the budget do not always line up. That table is the starting point
  for your explanation, and you can add the note straight from it.
- *"What's still unexplained in the May flux?"* → Scout lists the material variances with no resolved
  note yet — your remaining worklist.

Scout can also **add a note for you**. Tell it, in plain language, what to record and where:

- *"For account 6200, add a note that the overage is the Q3 campaign pull-forward."* → Scout finds the
  account (6200 is Sales & Marketing), writes the comment, and attributes it to you. It shows a write receipt confirming exactly
  what it added, with three actions: **Undo** (reverse the write), **View note** (jump to where the
  note now lives, at its own level and location), and **Delete** (remove it).

A note Scout writes is the same note you would have typed — same anchor, same thread, same card. It is
stamped with **your name as the author** (Scout is recording on your behalf, not posing as the author)
and flagged as entered via Scout, so the trail stays honest. Every Scout answer still carries a
receipt, so you can click through to the line or transaction the note is on.

## Worked example: Sales & Marketing, May 2026

1. Open the **Forecasted P&L**, switch to **Monthly**, and scan the variance coloring. Sales &
   Marketing is red in May — roughly $40K over plan.
2. Tap the **Sales & Marketing** number to open the right-hand pane. The pane shows Budget vs Actual
   for May and confirms the $40K. No note yet.
3. Write the **line note**: *"S&M $40K over in May — pulled the Q3 brand campaign forward to ride the
   product launch. Approved by VP Marketing."* Set author, leave it open for now.
4. Click **Open full ↗ → register** to see the bills. The register opens on May, filtered to the
   Sales & Marketing group.
5. Find the Google Ads bill, click the row, and the card slides out on the right. Add a **transaction
   note**: *"This is the pull-forward — $38K of the $40K."* Save.
6. Back on the P&L, the Sales & Marketing pane now shows both the line note and the pinned Google Ads
   note rolled up under it. Mark the line note **resolved** once you are satisfied. The flux for that
   line is done, and Scout can now explain it on demand.

## The monthly flux workflow (SOP)

A repeatable close-time routine:

1. **Set the period** to the last closed month.
2. On the **Forecasted P&L (Monthly view)**, identify every line whose variance exceeds your
   materiality threshold.
3. For each, **peek the line**, confirm the driver, and write a **line note** explaining it.
4. Where the explanation rests on a specific document, **drill to the transaction** and pin a
   **transaction note**.
5. **Resolve** each line note as you finish it. Unresolved material variances are your open worklist.
6. Repeat on the **Balance Sheet** and **Cash Flow** for any material working-capital or cash moves.
7. Ask **Scout** *"what's still unexplained this month"* as a final completeness check before you
   close the flux.

---

# Part 2 — Design & build spec (for validation)

This part is for deciding and building, not for end users. It records the model the guide above
assumes, the one schema change account-level notes require, the components, and the open decisions.

## What is already true (don't rebuild)

- **The right-hand card exists** on the reading surfaces: `InspectPane` (P&L) and
  `StatementInspectPane` (BS/CF), addressed by `?inspect=<lineId>` (CLAUDE.md §6). They render values
  + drill targets today; they have **no Notes section**.
- **The transaction surface exists**: the Expense Transactions register
  (`app/reporting/expense-transactions`, `components/reporting/expense-table.tsx`). Each row is a
  `VendorBill` with a **stable `id`** — the flux-note anchor — but rows do not yet open a detail card.
- **The table exists**: `flux_notes` in `supabase/migrations/0001_init.sql`:
  `{ id, transaction_id (not null), statement_line, period, author, body, amount_at_note, resolved,
  created_at, updated_at }`, indexed on `(transaction_id)` and `(period, statement_line)`.
- **The rationale exists**: durable keying / restatement / one-source-two-callers, written up in
  `import-templates/README.md` ("Transaction detail & Flux Analysis").

## The note key — a Dogfood write tied back to immutable ERP data

The load-bearing decision (Chris, 2026-06-20). **The data is ERP-sourced and immutable**: transactions
arrive as an uploaded CSV sub-ledger, and the account totals arrive as the trial balance. Dogfood reads
a clean close and never edits it. **The note is the Dogfood-native write** — the first user-write
surface in the app — so it cannot live *inside* the data. It points *at* the data with a **stable
foreign key**, the same delta-off-immutable-Base pattern as `scenario_inputs`.

So every note has two keys: its **own surrogate id** (`flux_notes.id`, a uuid) and a **stable anchor**
that ties it back to the immutable source. The anchor takes one of three grains, depending on how deep
the reviewer went:

| Grain | Anchor (the FK back to the source) | Source / immutability | Used when |
|---|---|---|---|
| **Transaction** | `transaction_id` (ERP sub-ledger / CSV row id) | imported, immutable | The reviewer drilled to a specific bill. |
| **Account (trial balance)** | `(account_code, period)` (ERP COA code + month) | imported, immutable | The reviewer wants to note the **expense from the trial balance** without drilling to one bill. |
| **Statement line / metric** | `(statement_line, period)` | Dogfood-derived | The line aggregates several accounts, or it is a **pure computed metric** (Gross Profit, margins) with no account or transaction underneath. |

The anchor always ties to immutable ERP data where any exists (`transaction_id`, then `account_code`),
and to the Dogfood line only when nothing below it is stored (the computed-metric case). Because the
key is the ERP id, **the note survives re-import**: re-upload the CSV and the bill or account is the
same id, so the note re-attaches. It never keys on row position, sort order, or a Dogfood-mutable field.

## The note model — roll-up (the "visible everywhere" requirement)

Every note carries a **denormalized `statement_line`** computed at write time (a transaction's
`account_code` → its line via Account Mapping; an account's `account_code` → its line; a line note is
already at that grain). That denormalized line is the single roll-up axis, so a note written at any
grain surfaces at the line:

The peek pane for `(statement_line, period)` renders, top to bottom:
1. the **line / metric note** for that key, if any (the headline explanation), then
2. the **account notes** for accounts mapping to that line in that period, then
3. the **transaction notes** for transactions on those accounts in that period.

A transaction's own card renders its transaction note plus a pointer up to its account and line notes.
The trial-balance / Account Mapping view renders an account's note plus the transaction notes beneath
it. **One write, surfaced at every altitude it rolls up through** — read it from the summary line, the
TB account, or the document.

## The schema changes (anchors, comment thread, attribution)

`flux_notes` today (`supabase/migrations/0001_init.sql`) has `transaction_id (not null)`,
`statement_line`, `period`, `author`, `resolved`, but **no `account_code`** and **no provenance**, and
the unique-per-anchor assumption blocks a comment thread. Three changes:

1. **Anchors.** Add `account_code` (the trial-balance grain) and let a note anchor to a transaction,
   an account-period, or a line-period.
2. **Comment thread.** Allow **many notes per anchor** (your "Scout can add a comment" + threads), so
   drop the singleton constraint and index the anchors for fast thread fetch.
3. **Attribution.** Keep `author` as the **user who made the note**, and add `source` to record
   whether it came from the card or from Scout-on-your-behalf.

```sql
alter table flux_notes alter column transaction_id drop not null;
alter table flux_notes add column account_code text;   -- ERP COA code; the trial-balance anchor
alter table flux_notes add column source text not null default 'ui'
  check (source in ('ui', 'scout'));                   -- provenance; author stays = the user

-- a note must anchor to exactly one grain (most specific available wins at write time)
alter table flux_notes add constraint flux_notes_anchor_ck check (
  transaction_id is not null                                 -- (1) transaction (sub-ledger)
  or (account_code is not null and period is not null)       -- (2) trial-balance account
  or (statement_line is not null and period is not null)     -- (3) statement line / pure metric
);

-- a thread per anchor: plain indexes, NOT unique (multiple authored comments allowed)
create index flux_notes_acct_ix on flux_notes (account_code, period);
create index flux_notes_line_ix on flux_notes (statement_line, period);
-- flux_notes (transaction_id) and (period, statement_line) indexes already exist
```

`statement_line` stays the **denormalized roll-up axis** on every row (derived via Account Mapping at
write). `resolved` becomes **anchor-level** (the variance is explained), surfaced as the card's Resolve
toggle; store it latest-wins on the thread rather than adding a `flux_resolution` table. (Alternative
considered: a `target_type` discriminator column — rejected; the nullable anchors + check encode the
grain cleanly and read naturally in queries.)

## Components to build (shared, so the card is identical everywhere)

The "same card, two entry points" promise is delivered by sharing the leaf components, not by
duplicating them:

- **`FluxNoteEditor`** — textarea + author + Save + Resolve toggle. One write path
  (`upsertFluxNote`). Embedded in both the peek pane and the transaction detail card.
- **`FluxNoteList`** — renders a note + rolled-up notes (with the amount-at-note / orphan flags).
  Embedded in both cards.
- **Peek-pane Notes + Flux section** — add to `InspectPane` and `StatementInspectPane`: `FluxNoteList`
  (line note + rolled-up txn notes for `(line, period)`) then `FluxNoteEditor`, **and** a
  `FluxDetailTable` (the budget-vs-actual decomposition from `getFluxDetail`, collapsible). The two
  sit together so you read the explanation and the numbers behind it in one card.
- **Transaction detail card** — give the register a row→card interaction (a right-hand drawer, the
  same visual as the peek pane) that hosts `FluxNoteList` + `FluxNoteEditor` scoped to the txn id.
  This is the only genuinely new surface; it makes "the card on the right" true on the working
  surface too.
- **Note markers** — a small dot/badge next to any line or row that carries a note, so a statement or
  the register shows what's been explained at a glance.

## Queries + Scout (one source, two callers — now read AND write)

- **Reads:** `getFluxNotes({ transactionId?, accountCode?, statementLine?, period? })` in
  `lib/queries/` → serves the pane, the transaction card, the markers, **and** Scout. Resolves the
  anchor and returns the rolled-up thread (line note + account notes + transaction notes).
- **`getFluxDetail(statementLine, period)`** (a **sibling** read, see below): the variance
  **decomposition table** for a line. Callable on its own, or **alongside** `getFluxNotes` so the card
  and Scout can show the existing notes **and** the budget-vs-actual table together. Composes existing
  spine reads (`listExpenseTransactions` for the actual detail, the budget snapshot for budget items,
  Base for forecast) — no new data path.
- **Writes (the first user-write path):** `addFluxNote(anchor, body, author, source)` and
  `resolveFlux(anchor, resolved)`. Behind the `DataStore` seam: a mutable in-memory map now, the
  `flux_notes` table after the Supabase swap (the write path is paused with the rest of Supabase,
  Handoff next-steps A). `author` is filled from the current user (`getSettings()` → "Chris · CFO");
  `source` is `ui` from a card, `scout` when Scout writes.
- **Scout read tool — `getFluxNotes`:** narration ("S&M up $40K; the reviewer flagged the Google Ads
  line as a Q3 pull-forward"). Wired per the per-register recipe (registry → impl + receipt → eval).
- **Scout WRITE tool — `addFluxNote` (Scout's first write):**
  - **Input:** `{ target: { transactionId? | accountCode? | statementLine? }, period?, body, resolve? }`.
    Scout maps "for account 6200" → `accountCode: "6200"`, `period` = the current as-of, derives
    `statement_line` via Account Mapping for the roll-up, sets `author` = the current user and
    `source: "scout"`. It never invents the author — it records on your behalf.
  - **Write receipt (distinct from a read receipt), `[LOCKED — write-then-undo]`:** Scout writes
    immediately (no blocking pre-confirm — it is the user's own single-tenant data), then shows a
    receipt with the resolved anchor (e.g. "account 6200 · Sales & Marketing · May 2026"), the note body,
    and the author. The receipt carries **three stacked actions**: **Undo** (reverse the just-made
    write), then below it **View note** (deep-link to the note at its own level and location — the
    account card / transaction drawer / line pane the note now lives on), and **Delete** (remove it).
  - **Safety rails:** Scout may **add** a note and **resolve** an anchor, and may **Undo / Delete the
    note it just wrote**. It does **not** edit or delete another author's existing comment. The human
    user, by contrast, can **delete any note at any time** from its card (Delete is always available —
    a note added by mistake is one click to remove). Validate the anchor exists (known `account_code`
    in the COA, a real `transaction_id`, a real line) before writing, and fail loud if not.
  - **Eval:** add routing cases ("for account 6200 add a note…" → `addFluxNote` with the right
    anchor; "why is S&M over?" → `getFluxNotes`, read, not write) so a write tool never steals a read
    route. Writes run against the in-memory store in the eval, never a shared backend.

## The flux decomposition table — `getFluxDetail` (a sibling, shown with or without notes)

`getFluxNotes` (the thread) and `getFluxDetail` (the budget-vs-actual table) are **independent sibling
reads**, and the card and Scout can show **either or both**:

- **Notes exist, "why is it over":** show the notes thread, and offer the table beneath it — a reviewer
  often wants the explanation **and** the numbers that back it on screen at once.
- **No notes yet:** the table leads (it is what you need to write the note), with the empty thread + an
  Add-note affordance above it.
- **"Show me the breakdown" (even when explained):** return the table regardless of notes.

So the Scout read path calls `getFluxNotes`, and **also** `getFluxDetail` whenever the question is
about *why/what's driving* a variance (not just "is there a note"); the card always renders both
sections. (Two single-responsibility queries; the caller composes them. The receipt shows whichever
ran — often both.)

`getFluxDetail(statementLine, period)` returns a **variance table** with one row per sub-item and the
columns **Item · Actual · Forecast · Budget · Variance** (Variance = Actual − Budget):

- **Alignment is best-effort, because the actuals and the budget do not always line up.** Actuals
  decompose to transactions (vendor/account); the budget snapshot is itemized only to the
  account/group grain, not per vendor. So the table has two regions:
  - **Matched rows** — keyed on the finest shared dimension (account / expense group). All three
    columns populated, plus the variance. These tie out: Σ matched + unmatched === the line's
    Actual / Forecast / Budget on the statement.
  - **Unmatched rows** — an actual with no budgeted line, or a budgeted item with no spend. Shown with
    the missing cells blank, never force-fit onto a row that is not really the same thing.
- **Sort.** Matched rows by **variance descending** (biggest overspend first — what the reviewer
  chases). Within the unmatched region, **actual-only rows by amount descending** and **budget-only
  rows by amount ascending** (your "transactions high→low, budgeted items low→high"), so the biggest
  unplanned spend and the most-cut planned items surface at the top of their lists.
- **Drill.** A matched account row expands to its transactions (actual-only detail, descending), so
  the reviewer goes from "IT is +$40K" to the Google Ads bill in one step, then writes the note from
  there. (Reuses `listExpenseTransactions`; the row already carries the `account_code` / `txn_id`
  anchors, so "Add note" from any row pins at the right grain.)
- Built by **composing** existing spine reads (transactions, budget snapshot, Base forecast) — no new
  data path; `getFluxDetail` is the assembling query. (It overlaps the existing `explainVariance`
  tool, which narrates; `getFluxDetail` returns the structured table. Decide at build time whether to
  extend `explainVariance` or add `getFluxDetail` as a sibling — recommend the sibling for a clean
  result schema.)

## Decisions (resolved 2026-06-20, Chris)

1. **Flux Analysis is in scope** — a deliberate addition on top of the §16 variance columns + Scout
   narrative. Update CLAUDE.md §16/§17 when the build is scheduled.
2. **Account note anchors at the trial-balance grain `(account_code, period)`**, not the rolled-up
   line — because the TB (immutable, ERP-sourced) is keyed by account, and that is the "note the
   expense from the trial balance without drilling to a bill" path. Adds the `account_code` column. A
   `(statement_line, period)` note still exists as the third grain for multi-account lines and pure
   computed metrics that have no account underneath.
3. **The transaction card is a right-hand drawer** mirroring the peek pane, so "the card on the right"
   is the one note surface whether you arrived from a summary line, a TB account, or a document.
4. **Resolve is a per-note flag.** "Line flux complete" = every material variance on the line has a
   resolved note. A period-level "flux signed off" rollup can sit on top later if wanted.
5. **Expenses first.** The built drill target is vendor bills; the same anchor model extends to
   revenue / payroll / AR lines as those registers ship (Scout Follows Modules).
6. **Notes are a comment thread, each comment authored.** Many comments per anchor (not one note);
   every comment carries `author` = the user and `source` = `ui` | `scout`. Resolution is anchor-level.
7. **Scout can write, attributed to the user, write-then-undo `[LOCKED]`.** Scout's `addFluxNote`
   records a comment on your behalf (`author` = you, `source` = `scout`) immediately (no pre-confirm),
   then shows a receipt with **Undo / View note / Delete**. **Delete is always available** on any note
   from its card; Scout never edits/deletes another author's existing comment. Read stays `getFluxNotes`.
8. **`getFluxDetail` is a sibling read; notes and the table show together `[LOCKED]`.** A separate
   tool from `getFluxNotes` (clean result schema, not an extension of `explainVariance`). The card and
   Scout can render the notes thread **and** the Actual / Forecast / Budget / Variance table at once —
   table leads when nothing is explained, both show when it is. Matched rows by variance; unmatched
   actuals high→low and budget low→high; drillable to transactions; best-effort row alignment (blank
   cells where the two sides do not line up).

## Open (smaller, non-blocking)
- **Multi-account line UX.** When a P&L line maps to several accounts, the pane offers "note the line"
  (grain 3) or "note an account" (grain 2, pick the account). Confirm the default at build time.
