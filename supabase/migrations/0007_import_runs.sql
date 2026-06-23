-- 0007_import_runs.sql — the CSV importer audit trail (CLAUDE.md §16; import-templates/README.md).
--
-- One row per committed import run on Setup → Data Import: a trial-balance (or COA) import, its
-- reconcile outcome, and whether it advanced the global as-of. It's the on-camera import HISTORY and
-- the audit record that a closed month was reconciled before the as-of moved. A write table, like
-- flux_notes / scenarios / account_overrides — EXCLUDED from the seed-loader's clear array, so a
-- re-seed never erases the import history or un-advances the as-of.
--
-- Folded into 0001_init.sql too, for fresh applies (per the 0003/0004/0005/0006 convention).

create table if not exists import_runs (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null default 'trial_balance' check (kind in ('trial_balance','chart_of_accounts')),
  period             text not null,
  status             text not null check (status in ('reconciled','needs_attention','rejected')),
  advanced_as_of     boolean not null default false,
  unreconciled_total numeric(16,2) not null default 0,
  note               text,
  created_at         timestamptz not null default now()
);

create index if not exists import_runs_created_ix on import_runs (created_at desc);
