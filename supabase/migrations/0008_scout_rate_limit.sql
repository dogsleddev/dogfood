-- 0008_scout_rate_limit.sql — rate limiting for the public Scout endpoint (CLAUDE.md §10/§17).
--
-- The public /api/scout endpoint runs the agent loop server-side (the Anthropic key never reaches the
-- client) with NO per-user auth, so a traffic spike (a LinkedIn post → the headline AI feature) could
-- run up uncapped API spend and 529 throttling. This table + atomic function back a two-tier
-- FIXED-WINDOW limiter: a per-IP window (stops one abuser/bot) and a GLOBAL window (the hard spend
-- circuit-breaker, shared across every serverless instance — an in-memory limiter can't do this).
-- Limits/windows are passed in from the app (lib/scout/rate-limit.ts) so they tune in TS, no migration.
--
-- An operational table (request-scoped counters, not demo data) — EXCLUDED from the seed-loader's
-- clear array; it self-cleans (the function GCs stale windows). Folded into 0001_init.sql for fresh
-- applies, per the 0003–0007 convention.

create table if not exists scout_rate_limit (
  bucket        text        not null,
  window_start  timestamptz not null,
  count         integer     not null default 0,
  primary key (bucket, window_start)
);

-- Atomic check-and-increment, one round-trip. Increments the per-IP window FIRST; if that trips, the
-- global window is left untouched (so a single blocked abuser can't inflate the global counter and
-- DoS everyone). Then increments the global window. Returns allowed + seconds until the blocking
-- window resets. Occasionally GCs stale windows so the table stays bounded with no cron.
create or replace function scout_rate_check(
  p_ip                  text,
  p_ip_limit            integer,
  p_ip_window_secs      integer,
  p_global_limit        integer,
  p_global_window_secs  integer
) returns table(allowed boolean, retry_after integer)
language plpgsql
as $$
declare
  v_now            timestamptz := now();
  v_ip_window      timestamptz := to_timestamp(floor(extract(epoch from v_now) / p_ip_window_secs) * p_ip_window_secs);
  v_global_window  timestamptz := to_timestamp(floor(extract(epoch from v_now) / p_global_window_secs) * p_global_window_secs);
  v_ip_count       integer;
  v_global_count   integer;
begin
  -- self-clean: drop windows older than 2h ~2% of the time (cheap, keeps the table tiny without a cron)
  if random() < 0.02 then
    delete from scout_rate_limit where window_start < v_now - interval '2 hours';
  end if;

  insert into scout_rate_limit as r (bucket, window_start, count)
    values ('ip:' || p_ip, v_ip_window, 1)
    on conflict (bucket, window_start) do update set count = r.count + 1
    returning r.count into v_ip_count;

  if v_ip_count > p_ip_limit then
    allowed := false;
    retry_after := greatest(1, ceil(extract(epoch from (v_ip_window + make_interval(secs => p_ip_window_secs) - v_now)))::int);
    return next;
    return;
  end if;

  insert into scout_rate_limit as r (bucket, window_start, count)
    values ('global', v_global_window, 1)
    on conflict (bucket, window_start) do update set count = r.count + 1
    returning r.count into v_global_count;

  if v_global_count > p_global_limit then
    allowed := false;
    retry_after := greatest(1, ceil(extract(epoch from (v_global_window + make_interval(secs => p_global_window_secs) - v_now)))::int);
  else
    allowed := true;
    retry_after := 0;
  end if;
  return next;
end;
$$;
