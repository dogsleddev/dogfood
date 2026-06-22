-- 0002 — store display ratios at full float precision.
-- numeric(6,4) truncated probability / pct_complete / margin_pct at the 4th decimal, so the Supabase
-- round-trip didn't equal the generator's float64. double precision round-trips a JS number exactly.
-- (Folded into 0001_init.sql too, for fresh applies; this migrates an already-applied database.)
alter table pipeline alter column probability  type double precision;
alter table projects alter column pct_complete type double precision;
alter table projects alter column margin_pct   type double precision;
