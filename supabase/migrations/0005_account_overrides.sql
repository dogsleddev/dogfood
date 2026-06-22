-- 0005_account_overrides.sql — the Account-Mapping override layer (CLAUDE.md §16/§17).
--
-- Field-level deltas off the immutable gl_accounts chart, keyed by account `code` (the re-import-stable
-- anchor). Same immutable-source + user-delta pattern as flux_notes / scenarios: the COA row stays
-- immutable and is re-seeded / re-imported to its generator/ERP value; the CFO's re-point layers on top
-- by code and re-applies on read (composeGlAccounts), so it survives re-import.
--
-- NO hard FK to gl_accounts(code) — deliberate, mirroring flux_notes.account_code: the seed loader does
-- delete-all + reinsert on gl_accounts every re-seed, so a cascade FK would wipe the override and a
-- restrict FK would block the re-seed. The override must outlive the base row's delete-and-reinsert; an
-- override whose code no longer exists is dropped at compose time (orphan), not by the DB.
--
-- Folded into 0001_init.sql too, for fresh applies (per the 0003/0004 convention). set_updated_at()
-- is created in 0001.

create table if not exists account_overrides (
  code            text primary key,
  statement_line  text,                       -- the re-point (null ⇒ inherit the base mapping)
  classification  text check (classification in ('cost_of_revenue','operating_expense')),
  function        text check (function in ('direct','rnd','sm','ga')),
  source          text not null default 'ui' check (source in ('ui','import')),
  updated_at      timestamptz not null default now()
);

drop trigger if exists account_overrides_updated_at on account_overrides;
create trigger account_overrides_updated_at before update on account_overrides
  for each row execute function set_updated_at();
