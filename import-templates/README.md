# Dogfood import templates

How to format ERP- and sub-system-generated reports into the CSV shapes Dogfood ingests to update
actuals and refresh every statement, the Dashboard, and Scout. This folder is the **contract** the
importer reads. **Build status (2026-06-22):** the importer FOUNDATION is built — trial-balance
parsing + validation (`lib/import/`, the file below foots + validates clean) and a writable global
as-of (closing a month advances the actual/forecast split, proven tie-out-neutral). The
**reconciliation control total** (the detail-to-TB back-check) and the Setup → Data Import UI are the
active next build (see `Handoff.md`). The trial balance is the single source of truth; the detailed
transactions reconcile UP to it with a control total, and a gap is a blocking "needs attention" flag,
never a plug (the model below is the spec).

## The model (read this first)

Dogfood is **plan-to-perform**: it does NOT run the close. Your ERP closes the books; Dogfood
*reads* the closed result and plans forward off it. Concretely:

- The three statements are a **view of the general ledger**.
- The general ledger is built from your **chart of accounts** + each period's **trial balance**.
- **Account Mapping** (the `statement_line` column of the chart of accounts) routes every GL account
  onto its P&L / Balance Sheet line. Map an account once and it reports correctly everywhere —
  statements, drill-downs, and Scout.

So the two files that actually drive the numbers are `chart_of_accounts.csv` (setup, occasional) and
`trial_balance.csv` (every month). Everything else is sub-ledger / operational detail that backs the
registers and drivers.

**Two levels, on purpose.** The trial balance is *summary* — account totals. To **drill from a
statement line to the actual expense** (and to hang a Flux Analysis note on a specific bill), you
also import the **transaction detail** (`expense_transactions.csv` and its siblings). The detail
reconciles up to the summary by construction: Σ(transactions for an account in a month) === that
account's monthly GL activity, which rolls into the trial balance. See "Transaction detail & Flux
Analysis" below.

## The global "as of" date

Dogfood has ONE app-wide close boundary — the "as of" date. Every surface (P&L, Balance Sheet, Cash
Flow, Dashboard, Scout) reads it: months on/before it are **Actual**, the boundary month is **In
close**, everything after is **Forecast**. You do not set it per report.

Today (the seed): actuals through **May 2026**, **June 2026** in close, Jul–Dec 2026 forecast.

## What a new month looks like

1. Your ERP closes month N (say June 2026).
2. Export the **trial balance** for month N → save as `trial_balance.csv`.
3. Drop it in Setup → Data Import. Dogfood validates it (see Validation), rolls it into the GL, and
   re-derives the statements.
4. The **global as-of advances** to month N: June flips In close → Actual, July becomes the new In
   close, and the Forecast horizon shrinks by a month. Budget/Variance now compares actual June vs
   the locked plan, and the Base forecast rolls forward off the new actuals.

One trial balance per closed month. That's the whole monthly loop.

## What a prior-month change looks like (restatement)

A month that was already closed gets corrected in the ERP (a late accrual, a reclass, an audit
adjustment):

1. Re-export that month's **trial balance** with the corrected figures.
2. Re-import it. Import is **idempotent per period** — the same `period` key **overwrites** that
   period, never appends a duplicate.
3. The GL re-rolls forward from that month, so every later balance-sheet balance and the YTD P&L
   update and Variance recomputes. The global as-of does **not** move — you are correcting history,
   not advancing it.

(If instead you want to *reopen* a period — show the books as they stood earlier — move the global
as-of date back in Settings. Later months keep their data; they just reclassify Actual → Forecast
until you re-advance. No re-import needed.)

## File index

| File | Source report | Feeds | Cadence |
|------|---------------|-------|---------|
| `chart_of_accounts.csv` | ERP chart of accounts | Account Mapping + GL accounts | Setup; on COA change |
| `trial_balance.csv` | ERP trial balance | GL → all 3 statements | **Every month** |
| `expense_transactions.csv` | ERP AP / expense detail | Expense Transactions register, **drill-down + Flux notes** | Every month |
| `journal_entries.csv` | ERP GL detail (optional) | transaction drill | Optional |
| `headcount.csv` | HRIS roster | Staff / Personnel driver | Monthly / on change |
| `customers.csv` | Billing / CRM | Customers register, ARR | Monthly |
| `vendors.csv` | AP system | Expense Transactions, vendor names | On change |
| `ar_aging.csv` | ERP AR aging | AR balance + aging | Monthly |
| `ap_aging.csv` | ERP AP aging | AP balance + aging | Monthly |
| `budget.csv` | Approved plan | Budget snapshot / Variance | Once at plan lock |
| `fx_rates.csv` | Rate provider | multi-currency (Bearing is USD-only) | If multi-currency |

## Reconciliation — when the detail doesn't match the trial balance

The statements **always** equal the trial balance (the TB is the source, and it balances). What can
disagree is the **transaction detail vs the TB**: `Σ(detail for an account in a month)` should equal
that account's TB movement. On import, Dogfood runs that check per (account, period):

- **Tie (gap ≤ threshold)** → reconciled.
- **Variance (gap > threshold)** → flagged, with the dollar gap. The statement number is unaffected
  (it is the TB) — the gap means the line-item feed is missing or mis-tagged something the ERP booked
  (a manual accrual, a reclass, a JE with no sub-ledger doc).

**How you'll know.** A reconciliation status per account, rolled up to each statement line (a badge /
exception list), and on drill-down: *"TB $X · detail sums to $Y · unreconciled $Z."* A materiality
threshold (e.g. $1 or 0.1% of the line) keeps rounding noise off the exception list.

**No plugs — everything must reconcile `[2026-06-20, Chris]`.** A gap is **never** force-balanced
with a plug line. There is one honest path, and the TB is never bent to the detail:

- **Fix upstream (the only path):** an unresolved gap means the line-item feed is missing or
  mis-tagging something the ERP booked (a manual JE, an accrual, a reclass). Pull the missing detail
  into the feed, or correct the Account Mapping if it's a tagging issue, then re-import — the gap
  clears on its own.
- Until it clears, the account is surfaced as a **blocking "unreconciled / needs attention" flag**
  with the dollar gap. It is not silently absorbed and not papered over with an "uncategorized"
  reconciling line.

So the statements never go un-tied (they equal the TB, which balances on its own — not a plug), and
reconciliation is about whether the *explanation* (the detail) is complete. The exception list is the
worklist you clear by fixing upstream, never by plugging.

## Transaction detail & Flux Analysis

The trial balance can't be drilled — it's account totals. To open a P&L expense line and see *which
bills* make it up (and to attach a reviewer note to one of them), import the **transaction detail**.
For expenses that's `expense_transactions.csv` (the AP / vendor-bill register); payroll, billing, and
receipts follow the same shape if you want those streams too. Each row is one document with a
**stable `transaction_id`** (sourced from the ERP — the bill/voucher id, never a row number). The
detail reconciles to the summary by construction: Σ(rows for an account in a month) === that
account's monthly GL activity → the trial balance. The example file is real Bearing May-2026 AP detail.

### Flux Analysis notes — keying on the transaction

A Flux Analysis lets a reviewer explain a variance and **leave a note on a specific expense**, saved
against that transaction. The design that makes notes durable:

- **Notes key on the stable `transaction_id`, never on row position, sort order, or a hash of mutable
  fields.** A note is `{ transaction_id, statement_line, period, author, body, amount_at_note,
  created_at, resolved }`. Because it points at the ERP-sourced id, the note survives re-sorting,
  re-pagination, and — critically — **re-import (restatement)**.
- **Notes are a separate write store, not an edit to the actuals.** Imported transactions stay
  **immutable** (Dogfood reads a clean close). Notes live alongside them in a `flux_notes` table FK'd
  to `transaction_id` — the same pattern as `scenario_inputs` (a delta store off Base, never mutating
  the source). This is the *first* user-write surface in the app; everything before it is read-only.
- **Restatement behavior (the audit-friendly part).** When a prior month is re-imported and a bill
  changes, the note still attaches (the id persists), and because we snapshot `amount_at_note`, the
  reviewer immediately sees the underlying number moved — a flux-on-the-flux signal. If a re-import
  *removes* a transaction, its note is flagged **orphaned / needs re-review** rather than silently
  lost.
- **One source, two callers.** The same `expense_transactions` records feed the Flux drill UI **and**
  Scout, so Scout can read the reviewer's notes and use them to narrate the variance ("S&M is up
  $40K; reviewer flagged the Google Ads line as a Q3 campaign pull-forward").

Scope note: today the spec (CLAUDE.md §16) scopes variance as *the Budget/Actual/Forecast columns +
Scout's narrative*, not a standalone module. A Flux Analysis surface with persistent per-transaction
notes is a deliberate **scope addition** — confirm and the spec gets updated alongside the build.

## Conventions (all files)

- **Period**: `YYYY-MM` (a calendar month). Bearing runs a calendar fiscal year.
- **Money**: plain decimals, no symbols or thousands separators (`1054495.83`, not `$1,054,495.83`).
- **Currency**: USD only for Bearing; `fx_rates.csv` covers multi-currency if ever needed.
- **Quoting**: quote any field containing a comma (e.g. `"Fixed Assets, net"`).
- **Encoding**: UTF-8, header row required.

## Validation (what the importer checks)

- **Trial balance balances**: Σ debit === Σ credit for each period (the hard gate).
- **Known accounts**: every `account_code` in a trial balance exists in `chart_of_accounts.csv`.
- **Mapped accounts**: every account maps to exactly one `statement_line` (no orphans, no gaps).
- **One row per (period, account)** in a trial balance; re-importing a period overwrites it.
- **Period format + no gaps** across the closed range.

## Column specs

### chart_of_accounts.csv
`account_code` · `account_name` · `account_type` (asset | liability | equity | contra_equity |
revenue | cost_of_revenue | operating_expense | other_income | tax) · `statement_line` (the Dogfood
P&L/BS line id this account rolls up to — the Account Mapping) · `classification` (cost_of_revenue |
operating_expense | blank) · `function` (direct | rnd | sm | ga | blank).

### trial_balance.csv
`period` · `account_code` · `account_name` · `debit` · `credit`. Balance-sheet accounts carry their
period-end balance; P&L accounts carry fiscal-year-to-date activity; exactly one of debit/credit is
non-zero per row. The example file is Bearing's **real May-2026 trial balance** and balances to the
penny ($59,587,121.23 each side) — import it and the May Balance Sheet, P&L (YTD), and Cash Flow
reproduce.

### expense_transactions.csv
`transaction_id` (stable ERP id — the **flux-note key**; must persist across re-imports) ·
`doc_number` (human bill no.) · `period` · `date` · `due_date` · `account_code` (must exist in the
COA) · `expense_group` (an OpEx group id, or `cost_of_revenue` for hosting/inference) · `vendor` ·
`amount` · `status` (open | paid) · `memo`. Σ rows per (account_code, period) === that account's
monthly GL activity, so the detail reconciles to the trial balance. The example is real Bearing
May-2026 AP detail. (Payroll / billing / receipts detail follow the same row-per-document shape.)

### journal_entries.csv (optional)
`entry_id` · `period` · `entry_date` · `doc_ref` · `source` (invoice | payroll | ap_bill |
depreciation | prepaid_amort | manual) · `account_code` · `debit` · `credit` · `memo`. One row per
line; rows sharing an `entry_id` must balance. Only needed if you want Scout / the registers to drill
GL → individual entry; the trial balance alone drives the statements.

### headcount.csv
`employee_id` · `name` · `department` · `function` (direct | rnd | sm | ga) · `title` ·
`start_month` · `end_month` (blank if active) · `fte` · `annual_base_comp`. Burden (taxes/benefits)
is NOT here — it lives in the Employee Expenses OpEx group.

### customers.csv
`customer_id` · `name` · `segment` (starter | growth | scale) · `start_month` · `status` (active |
churned) · `arr`.

### vendors.csv
`vendor_id` · `name` · `expense_group` (an OpEx group id, or `cost_of_revenue` for hosting/inference).

### ar_aging.csv / ap_aging.csv
`period` · `customer`/`vendor` · `current` · `d1_30` · `d31_60` · `d61_90` · `d90_plus` · `total`.
The per-bucket amounts sum to `total`; the period total must reconcile to the AR/AP balance on that
period's trial balance.

### budget.csv
`period` · `statement_line` · `budget_amount`. The locked plan (a frozen snapshot of the layer-2
drivers). Loaded once when the Budget is locked; the Forecasted P&L's Budget/Variance columns read it.

### fx_rates.csv
`period` · `from_currency` · `to_currency` · `rate`. Bearing is USD-only, so this is a single
identity row; needed only if you add a non-USD entity.
