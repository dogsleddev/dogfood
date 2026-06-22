-- 0001_init.sql — Bearing / Dogfood initial schema.
-- Single-tenant production prototype (one client; firm scoping lives at this DB, not per-row).
-- Conventions: money = numeric(16,2) USD dollars; period = text 'YYYY-MM'; dates = date.
-- The deterministic generator seeds these tables ONCE (scripts/seed-supabase.ts); after that the
-- app reads/writes Supabase. Statements stay computed in TS over the stored records + series.
-- Run: `supabase db push`  (or paste into the Supabase SQL editor).
-- Access model (DECIDED): single-tenant, trusted server-side service-role (which bypasses RLS), with
-- edge HTTP Basic Auth (middleware.ts) as the real gate. RLS is OPTIONAL here, not a prerequisite.

-- ── config / account mapping ──────────────────────────────────────────────
create table firm (
  id          text primary key,
  name        text not null,
  short_code  text not null
);

create table settings (
  id                      int  primary key default 1 check (id = 1),  -- single row
  currency                text not null default 'USD',
  fiscal_year_start_month int  not null default 1,
  close_through           text not null,                 -- last fully-closed month (the global as-of)
  in_close_month          text,
  forecast_horizon_start  text not null,
  forecast_horizon_end    text not null
);

create table departments (
  id        text primary key,
  name      text not null,
  function  text not null check (function in ('direct','rnd','sm','ga'))
);

create table expense_groups (
  id              text primary key,
  label           text not null,
  classification  text not null check (classification in ('cost_of_revenue','operating_expense')),
  function        text,
  sort_order      int  not null
);

create table gl_accounts (
  code            text primary key,
  name            text not null,
  account_type    text not null check (account_type in
                    ('asset','liability','equity','contra_equity','revenue',
                     'cost_of_revenue','operating_expense','other_income','tax')),
  classification  text,
  function        text,
  statement_line  text not null            -- the Account Mapping seam
);

-- ── layer 1 · source records ──────────────────────────────────────────────
create table customers (
  id           text primary key,
  name         text not null,
  segment      text,
  start_month  text not null,
  status       text not null check (status in ('active','churned')),
  arr          numeric(16,2) not null default 0,
  churn_month  text                      -- set only when status = 'churned'
);

create table contracts (
  id            text primary key,
  customer_id   text not null references customers(id),
  customer_name text,
  stream        text not null check (stream in ('subscription','services')),
  plan_tier     text,
  arr           numeric(16,2) not null default 0,
  start_month   text not null,
  term_months   int,
  status        text not null check (status in ('active','pending','churned')),
  booking_type  text check (booking_type in ('new','expansion','contraction'))
);

create table pipeline (
  id             text primary key,
  customer_name  text,
  stream         text,
  stage          text,
  arr            numeric(16,2),
  owner          text,
  expected_close text,
  probability    double precision,            -- display ratio; full float so it round-trips the generator exactly
  kind           text check (kind in ('new_logo','expansion'))   -- new prospect vs expansion on an active account
);

create table renewals (
  id                  text primary key,
  contract_id         text references contracts(id),
  customer_id         text references customers(id),
  due_month           text,
  arr_up_for_renewal  numeric(16,2),
  new_arr             numeric(16,2),       -- ARR after the renewal resolves (null while open)
  status              text check (status in ('open','renewed','expanded','contracted','churned'))
);

create table projects (
  id             text primary key,
  name           text,
  customer_id    text references customers(id),
  status         text,
  pct_complete   double precision,            -- display ratios; full float so they round-trip the generator exactly
  contract_value numeric(16,2),
  wip            numeric(16,2),
  margin_pct     double precision
);

create table staff (
  id                text primary key,
  name              text,
  department_id     text references departments(id),
  function          text,
  title             text,
  start_month       text,
  end_month         text,
  fte               numeric(4,2),
  annual_base_comp  numeric(16,2)
);

-- ── general ledger ────────────────────────────────────────────────────────
create table journal_entries (
  id      text primary key,
  period  text not null,
  memo    text,
  doc_ref text,
  source  text check (source in ('invoice','payroll','ap_bill','depreciation','prepaid_amort','manual'))
);

create table journal_lines (
  id          bigserial primary key,
  entry_id    text not null references journal_entries(id),
  account_id  text not null references gl_accounts(code),
  debit       numeric(16,2) not null default 0,
  credit      numeric(16,2) not null default 0
);

-- ── layer 1 · transaction sub-ledger (lowest level; stable ids = flux-note anchors) ──
create table vendor_bills (
  id        text primary key,
  doc_number text,
  period    text not null,
  date      date,
  due_date  date,
  account_id text references gl_accounts(code),
  sub_code  text,                                 -- GL sub-account display code within the group (folded from 0006)
  group_id  text,
  function  text,
  vendor    text,
  amount    numeric(16,2) not null,
  status    text check (status in ('open','paid')),
  memo      text
);

create table paychecks (
  id             text primary key,
  doc_number     text,
  staff_id       text references staff(id),
  period         text not null,
  period_label   text,
  date           date,
  gross_pay      numeric(16,2),
  employee_taxes numeric(16,2),
  benefits       numeric(16,2),
  net_pay        numeric(16,2)
);

create table timesheets (
  id             text primary key,
  doc_number     text,
  staff_id       text references staff(id),
  project_id     text references projects(id),
  period         text not null,
  date           date,
  week_label     text,
  hours          numeric(8,2),
  bill_rate      numeric(16,2),
  cost_rate      numeric(16,2),
  billable_value numeric(16,2),
  labor_cost     numeric(16,2)
);

create table customer_invoices (
  id          text primary key,
  doc_number  text,
  customer_id text references customers(id),
  contract_id text,
  project_id  text,
  period      text not null,
  date        date,
  due_date    date,
  status      text,
  stream      text,
  kind        text,
  amount      numeric(16,2)
);

create table cash_receipts (
  id                   text primary key,
  doc_number           text,
  customer_id          text references customers(id),
  period               text not null,
  date                 date,
  applied_invoice_id   text,
  applied_doc_number   text,               -- human doc# of the applied invoice (AR-aging views)
  amount               numeric(16,2)
);

-- ── derived series (stored so the TS statement builders run over Supabase data) ──
create table monthly_series (
  period text not null,
  name   text not null,                  -- e.g. arr, subscription_recognized, bs_cash …
  value  numeric(18,4) not null,
  primary key (period, name)
);

create table revrec_by_contract (
  contract_id   text not null,
  period        text not null,
  customer_id   text,
  customer_name text,
  tier          text,
  recognized    numeric(16,2),
  deferred      numeric(16,2),
  arr           numeric(16,2),
  primary key (contract_id, period)
);

create table revrec_by_project (
  project_id   text not null,
  period       text not null,
  project_name text,
  recognized   numeric(16,2),
  primary key (project_id, period)
);

-- ── write tables (the CFO's work — persisted, the first mutable surfaces) ──
create table flux_notes (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  text,                  -- stable sub-ledger id; null for account/line notes (folded from 0003)
  account_code    text,                  -- the trial-balance grain (ERP COA code) (folded from 0003)
  statement_line  text,
  period          text,
  author          text,
  body            text not null,
  amount_at_note  numeric(16,2),         -- snapshot → flags flux-on-the-flux after a restatement
  resolved        boolean not null default false,
  source          text not null default 'ui' check (source in ('ui', 'scout')),  -- provenance (folded from 0003)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- a note must anchor to exactly one grain (folded from 0003)
  constraint flux_notes_anchor_ck check (
    transaction_id is not null
    or (account_code is not null and period is not null)
    or (statement_line is not null and period is not null)
  )
);

create table scenarios (
  id          text primary key,
  name        text not null,
  baseline    text not null default 'base' check (baseline in ('base','budget')),
  -- the full typed Adjustment[] stored losslessly as JSONB (see 0004_scenario_jsonb.sql)
  adjustments jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- DEPRECATED (0004): scenario adjustments now live in scenarios.adjustments (jsonb). The flat
-- columns below cannot hold the discriminated Adjustment/Magnitude unions. This table is unused
-- and never written; kept only so a fresh apply matches the live DB (which was migrated, not dropped).
create table scenario_inputs (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   text not null references scenarios(id) on delete cascade,
  lever         text not null,
  sub_dimension text,
  magnitude     numeric(10,4),
  start_month   text,
  end_month     text,
  shape         text check (shape in ('step','ramp'))
);

create table budget_snapshots (
  id             uuid primary key default gen_random_uuid(),
  locked_at      text,
  sourced_from   text check (sourced_from in ('base','scenario')),
  statement_line text,
  period         text,
  amount         numeric(16,2)
);

-- the Account-Mapping override layer (field-level deltas off the immutable chart — §16/§17; see
-- 0005_account_overrides.sql). NO hard FK to gl_accounts(code): the override must survive the seed
-- loader's delete-and-reinsert of gl_accounts (orphans dropped at compose time, not by the DB).
create table account_overrides (
  code            text primary key,
  statement_line  text,                       -- the re-point (null ⇒ inherit the base mapping)
  classification  text check (classification in ('cost_of_revenue','operating_expense')),
  function        text check (function in ('direct','rnd','sm','ga')),
  source          text not null default 'ui' check (source in ('ui','import')),
  updated_at      timestamptz not null default now()
);

-- ── indexes for period-filtered + drill reads ──
create index on vendor_bills (period);
create index on paychecks (period);
create index on timesheets (period);
create index on customer_invoices (period);
create index on cash_receipts (period);
create index on journal_entries (period);
create index on journal_lines (entry_id);
create index on flux_notes (transaction_id);
create index on flux_notes (period, statement_line);
create index if not exists flux_notes_acct_ix on flux_notes (account_code, period);  -- (folded from 0003)

-- updated_at maintenance for the mutable tables
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
create trigger flux_notes_updated_at before update on flux_notes
  for each row execute function set_updated_at();
create trigger account_overrides_updated_at before update on account_overrides
  for each row execute function set_updated_at();
