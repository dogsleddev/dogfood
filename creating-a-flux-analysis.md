<!-- Detailed user guide (generated 2026-06-20 via the flux-guide workflow; 9 agents, adversarially fact-checked). Ready to graduate into lib/guides/content.ts as guide #7. Account codes verified against import-templates/chart_of_accounts.csv: Sales & Marketing = 6200, IT = 6400. The full design/build spec is flux-analysis.md. -->

slug: creating-a-flux-analysis
title: Creating a flux analysis
summary: How to explain each month's variances with durable, authored notes pinned to the immutable actuals: where variances live, the three altitudes you can annotate through one shared note card, the budget-vs-actual table, and how Scout reads and writes flux notes for you.

## What a flux analysis is, and why you do it

A flux analysis is the monthly discipline of explaining your variances. After a month closes, you compare what actually happened to what you planned, find the lines that moved more than they should have, and write down why. That "why" is the real deliverable. It is the note a board member, an auditor, or you six months from now reads sitting right next to the number.

Dogfood does not run the close. It reads a clean close from your ERP. The trial balance gives the account totals, the uploaded sub-ledger gives the transaction detail, and the statements are already built and tied out before you sit down. Flux does not change any of that. You are not recomputing anything and you are not editing the actuals. You are explaining numbers that are already on the screen, and every note you write traces back to the source it explains.

You flux on **closed** months. For Bearing, January 2024 through May 2026 is closed (Actual), June 2026 is in close (provisional), and July through December 2026 is Forecast. Most of your flux work lands on the last fully closed month, which today is **May 2026**.

## Where the variances live

You do not hunt for variances. They are already on the statements:

- The **Forecasted P&L** carries four columns per line: **Budget**, **Actual**, **Variance**, and **Forecast**. On the statement columns, **Variance is Forecast minus Budget**, your full-year read against the locked plan.
- The header **Monthly** toggle (`?view=monthly`) spreads every line across the months. This is where you find the single month a line jumped, which is exactly what you want for closed-month flux.
- The **Balance Sheet** and **Cash Flow** show period-over-period movement, so you can flux a balance that swung as easily as an expense that ran hot.

Everything ties out by construction. Each statement line traces down to its accounts, and each account down to its transactions, so any variance you see can be drilled to the source that caused it.

## The three altitudes you can annotate

A note pins to the exact grain that explains the variance. There are three, and all three roll up to the statement line for display, so a note written at any altitude is visible from the line above it.

- **Transaction.** A single vendor bill from the sub-ledger, anchored on its `transaction_id`. Use this when one bill explains the move (a specific Google Ads invoice, say).
- **Account (trial balance).** A trial-balance account, anchored on `(account_code, period)`. The `account_code` is a GL code from your chart of accounts (Sales & Marketing is `6200`, IT is `6400`). Use this when you want to explain "the expense from the trial balance" for the month without singling out one bill.
- **Statement line or metric.** Anchored on `(statement_line, period)`. Use this for a line that aggregates several accounts, or for a **pure computed metric** that has no account or transaction underneath it (Gross Profit, Gross Margin %, Operating Income, Net Margin %). A pure metric is pane-only: there is nothing to drill into, so it decomposes into its component lines and you note the line.

The rule of thumb: anchor to immutable ERP data wherever it exists. Reach for the `transaction_id` first, then the `account_code`. Use the line or metric grain only when nothing concrete sits beneath it. Whatever altitude you choose, the note carries a `statement_line` so it always knows which line to roll up onto.

### Peek where you read, navigate where you work

The card behaves a little differently depending on the surface, by design.

- On **reading surfaces** (the Dashboard and the three statements), the first tap on a number opens the right-hand **peek pane** at URL `?inspect=<line>`. It shows the lineage in place and carries an **Open full** link to the working surface. Actual months peek their register, forecast months peek their driver, and pure metrics decompose into the lines that compose them.
- On **working surfaces** (registers and drivers), a row navigates straight to detail, and the transaction drawer hosts the note card directly.

## One card, three ways in

Wherever a number can move, there is one shared note card. It is the same editor and the same comment thread no matter how you open it. You reach it three ways:

- From a **summary line**: tap a number on the Dashboard or a statement, and the right-hand peek pane opens with the note card in it.
- From an **account**: open the trial balance or Account Mapping view and pick the account.
- From a **transaction**: open a row on the Expense Transactions register, and a right-hand drawer slides out with the same card.

Because it is one card, a note you write at one altitude shows up at the others. A transaction note **rolls up** onto its account's card and its statement line's card. A line note is **carried down** and shown on the transactions beneath it. This is the heart of it: one write, surfaced everywhere. You annotate from wherever you happen to be reading, and the note finds its way to every view of that number. A small **note marker** appears on any line or row that already carries a note, so you can see at a glance what has been explained and what has not.

## Writing a note

A note is your first write surface in Dogfood, and it is a layer on top of immutable data. The transactions come from your ERP as an uploaded CSV sub-ledger, and the account totals come from the trial balance. Dogfood never edits either one. Your note points at that data with a stable key, the same delta-off-Base pattern Dogfood uses for scenarios.

Notes are a **comment thread**, not a single field. You can stack many comments on one anchor as the explanation develops or as a reviewer signs off. Each comment carries:

- **`body`**: the explanation you write.
- **`author`**: the user who wrote it. For Bearing that is "Chris Â· CFO", read from your settings. Dogfood never invents the author.
- **`source`**: either `ui` (you typed it on a card) or `scout` (Scout wrote it for you).
- **`amount_at_note`**: a snapshot of the figure at the moment you wrote the comment, so the note remembers what it was explaining.
- **`resolved`** and **`created_at`**.

**Resolve is anchor-level.** When you flip the Resolve toggle, you are signing off that the variance is explained, not marking one comment done. Every comment can be **edited**, **resolved**, or **deleted** from its card, and **Delete is always available**. Because the underlying actuals are immutable, deleting or editing a note never touches a transaction or a statement figure. You are only ever editing your own explanation.

## The budget-vs-actual table

Alongside the notes thread, the card (and Scout) can show a decomposition table from `getFluxDetail`, a sibling read to `getFluxNotes`. The table is how you see what is driving a line before you write the note, so when nothing is explained yet, the table leads. Once there is a note, you see both together.

Its columns are **Item**, **Actual**, **Forecast**, **Budget**, and **Variance**. Keep one distinction straight: in this table, **Variance is Actual minus Budget**, whereas the P&L statement column is Forecast minus Budget. The table is Actual versus Budget because flux is on a closed month, where the actual is the truth.

The actuals and the budget do not always line up, so the table aligns rows best-effort:

- **Matched rows**, where both sides exist on a shared dimension (an account or an expense group), show every column plus variance, **sorted by variance descending** so the biggest overspend is on top. A matched account row **drills to its transactions**.
- **Unmatched rows** show on their own lines with blank cells: an actual with no budget line, or a budget item with no spend. Unmatched actuals sort high to low, unmatched budget items low to high.

The matched plus unmatched rows sum to the line, so the table totals tie to the statement line you peeked. It composes the same reads the registers and statements use, so there is no new data path and nothing to reconcile by hand.

## How notes stay durable through a restatement

Notes survive your data changing. Because a note keys on a stable ERP id (or on line plus period), never on a row's position, sort, or page, it stays attached through a re-import.

- `amount_at_note` snapshots the figure at write time. If a restatement moves the number, the card shows you it changed, so you can flux the flux instead of staring at a silently stale comment.
- If a re-import removes the transaction a note was pinned to, the note is flagged **orphaned / needs re-review**. It is never silently dropped.

This is the same promise as the rest of Dogfood: every number traces to a source, and your work on top of those numbers is durable.

## Asking Scout

Scout launches from the button at the bottom of the nav rail and opens as a floating panel in the lower right. It reads the same spine you do, and every answer carries a click-through **receipt**, so you can audit every number it quotes. For flux, Scout both reads and writes.

### Scout reads: narrate the variance and show the table

Ask Scout why something moved and it does two things at once. It calls `getFluxNotes` to narrate the variance and quote any note already on it, and it calls `getFluxDetail` to show the decomposition table. You see the explanation and the numbers behind it together.

> **You:** Why is Sales & Marketing over budget in May?
>
> **Scout:** Sales & Marketing came in about $40K over budget in May 2026. The reviewer flagged the Google Ads line as a Q3 campaign pull-forward. Here is the breakdown:
>
> | Item | Actual | Forecast | Budget | Variance |
> |---|---|---|---|---|
> | Programs | ... | ... | ... | ... |
> | Google Ads | ~$38K | | | |
> | ... | ... | ... | ... | ... |

The matched rows (an account or expense group) carry every column and a variance; the Google Ads bill shows as an actual-only row with blank Budget and appears in full when you drill its matched account to the transactions. Scout already narrated plain variances before flux existed, through `explainVariance`. Flux adds the durable, authored, resolvable note on top of that narrative, and Scout quotes that note back to you. To see your open worklist, ask **"what's still unexplained this month?"** Scout lists the material variances that have no resolved note. That list is your flux to-do.

### Scout writes: add a note in plain language

`addFluxNote` is Scout's first write. Tell Scout, in plain language, what to record and where, and it does the rest.

> **You:** For account `6200`, add a note that the S&M overage is the Q3 campaign pull-forward.
>
> **Scout:** Done. I added a note on account `6200` (Sales & Marketing), May 2026.

Behind that one sentence, Scout:

- **Resolves the anchor** (account `6200`) and confirms it exists before writing.
- **Derives the `statement_line`** through Account Mapping, so the note rolls up correctly.
- **Writes the comment** and stamps it with **`author` = you** (Chris Â· CFO) and **`source` = `scout`**. Scout never invents the author.
- **Writes then lets you undo.** There is no pre-confirm prompt, because this is your own single-tenant data. Scout writes immediately and gives you a clean way to back out.

Scout then shows a **write receipt** with three actions:

- **Undo**: reverse the write you just made.
- **View note**: a deep link to the note at its level and location.
- **Delete**: remove the note.

There is one firm safety rail. Scout may add, resolve, undo, or delete the note **it just wrote**, but it never edits or deletes a comment written by another author. You, the human, can delete any note at any time.

Name the closed month you are fluxing in your request ("for May 2026, note that...") so the note lands on the period you mean rather than Scout's current working period.

## Worked example: the May Sales & Marketing overage

Sales & Marketing came in roughly **$40K over budget in May 2026**, driven mostly by a **Google Ads** bill of about **$38K**. Here is the whole loop, both by hand and with Scout.

**The manual path:**

1. Set the as-of to the last closed month, **May 2026**. Open the **Forecasted P&L** and switch the header to **Monthly**. Scan down the operating-expense lines for material moves. Sales & Marketing stands out for May.
2. Tap the Sales & Marketing number. The right-hand **peek pane** opens with the note card and, since nothing is explained yet, the **budget-vs-actual table** leading. The matched rows are sorted by variance descending, so the overspend is right at the top, and the totals tie to the line you tapped.
3. Click **Open full** to go to the working surface. The Expense Transactions register opens on **May 2026**, filtered to the Sales & Marketing group. The **Google Ads** bill (about $38K) is the largest row.
4. Open the Google Ads row. In the right-hand drawer, write the note on the transaction: *"S&M about $40K over in May, pulled the Q3 brand campaign forward to ride the product launch. Approved by VP Marketing."* It is stamped Chris Â· CFO, `source` is `ui`, and `amount_at_note` snapshots the figure.
5. Flip **Resolve** on the anchor. A note marker now shows on the Google Ads row, on account `6200`, and on the Sales & Marketing line, because it rolled up.

**The Scout-assisted path:**

1. Open Scout and ask: *"Why did Sales & Marketing run over in May 2026?"* Scout calls `getFluxNotes` and `getFluxDetail`, narrates the variance, and shows the table with the Sales & Marketing rows, all with a receipt.
2. Tell Scout: *"For account `6200`, add a note for May 2026 that the overage is the Q3 campaign pull-forward, approved by VP Marketing."* Naming May explicitly lands the note on the closed month you are fluxing.
3. Scout writes the comment to account `6200`, stamps it Chris Â· CFO with `source` = `scout`, and shows the write receipt with **Undo**, **View note**, and **Delete**. Tap **View note** to confirm it landed on the Sales & Marketing line.
4. Later, ask *"what's still unexplained in May?"* Sales & Marketing no longer appears, because the anchor is resolved.

Either path writes to the same place and surfaces the same note everywhere, visible on the bill, the account, and the line, on a number that still ties out.

## The monthly flux SOP checklist

Work this list each time a month closes. For Bearing, that means working the last closed month (May 2026 today):

1. **Set the period** to the last closed month. Confirm the month is closed, not in close, and set your statement views and the Expense Transactions register to it.
2. **Scan the P&L on Monthly** for lines that moved beyond your materiality threshold. Start with operating expenses, then Cost of Revenue.
3. **Scan the Balance Sheet and Cash Flow** for material period-over-period swings, and flag those too.
4. **For each material variance, peek the line and read the table first.** Let `getFluxDetail` show you the biggest matched overspend, and check the unmatched rows for an actual with no budget or a budget item with no spend.
5. **Drill to the right altitude.** Matched account rows go to their transactions. Pin the note where the explanation lives: the transaction if one bill explains it, the account if the whole account moved, the line or metric if there is nothing stored beneath it. By hand or by Scout, your call.
6. **Write the why and resolve it.** Record the explanation with enough detail that a board member or auditor needs no follow-up, confirm the author and `source` are right, then mark the anchor resolved. A line is complete when every material variance on it has a resolved note.
7. **Ask Scout for the gaps.** Finish by asking *"what's still unexplained this month?"* Anything Scout lists is an open variance with no resolved note. Clear it before you close the review.
8. **Confirm it ties out.** Each note's table totals reconcile to its statement line, the markers show your explanations are in place across every view, and the explained book is the closed book with reasons attached.

When the worklist is empty and every material variance carries a resolved note, your flux for the month is complete, and every number on the statements traces to both a source and a reason.