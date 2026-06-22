-- 0003 — Flux Analysis notes: the first user-WRITE surface (flux-analysis.md Part 2).
-- The 0001 table assumed one transaction note per row; widen it to the three anchor grains
-- (transaction · trial-balance account · statement line/metric) as a multi-author comment thread,
-- with provenance. The note is a Dogfood-native write pinned by a STABLE anchor to immutable ERP data
-- (same delta-off-Base pattern as scenario_inputs) — so it survives re-import.

alter table flux_notes alter column transaction_id drop not null;          -- account/line notes have no txn
alter table flux_notes add column if not exists account_code text;          -- the trial-balance grain (ERP COA code)
alter table flux_notes add column if not exists source text not null default 'ui'
  check (source in ('ui', 'scout'));                                        -- provenance; author stays = the user

-- a note must anchor to exactly one grain (most specific available wins at write time)
alter table flux_notes drop constraint if exists flux_notes_anchor_ck;
alter table flux_notes add constraint flux_notes_anchor_ck check (
  transaction_id is not null                                 -- (1) transaction (sub-ledger)
  or (account_code is not null and period is not null)       -- (2) trial-balance account
  or (statement_line is not null and period is not null)     -- (3) statement line / pure metric
);

-- thread per anchor: plain (non-unique) indexes; (transaction_id) + (period, statement_line) exist from 0001
create index if not exists flux_notes_acct_ix on flux_notes (account_code, period);
