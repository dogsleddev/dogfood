/**
 * scout-rl-check — verify the public-Scout rate limiter (supabase/migrations/0008) against the LIVE DB.
 * Proves the per-IP window allows up to the limit, blocks beyond it with a sane retry_after, and is
 * isolated per IP. Uses throwaway test IPs (fresh uuids) and cleans up its rows afterward; the global
 * tier is exercised with a high cap so the gate never trips (or meaningfully pollutes) the real
 * site-wide counter.
 *
 * Run: npx tsx scripts/scout-rl-check.ts   (needs .env.local Supabase keys)
 */
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const mt = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2];
  }
}

async function call(supabase: SupabaseClient, ip: string, ipLimit: number) {
  const { data, error } = await supabase.rpc("scout_rate_check", {
    p_ip: ip,
    p_ip_limit: ipLimit,
    p_ip_window_secs: 3600,
    p_global_limit: 1_000_000, // effectively unlimited for the test → never trips the real global counter
    p_global_window_secs: 3600,
  });
  if (error) throw new Error(error.message);
  return (data as { allowed: boolean; retry_after: number }[])[0];
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const ip = `testrl-${randomUUID()}`;
  let fail = 0;
  const check = (cond: boolean, msg: string) => {
    console.log(`  ${cond ? "PASS" : "FAIL"}  ${msg}`);
    if (!cond) fail++;
  };

  console.log("\n===== SCOUT-RL-CHECK — live DB =====\n");
  try {
    const LIMIT = 3;
    const r: { allowed: boolean; retry_after: number }[] = [];
    for (let i = 0; i < 5; i++) r.push(await call(supabase, ip, LIMIT));
    check(r.slice(0, 3).every((x) => x.allowed === true), "first 3 requests within the limit → allowed");
    check(r.slice(0, 3).every((x) => x.retry_after === 0), "allowed requests carry retry_after 0");
    check(r.slice(3).every((x) => x.allowed === false), "4th–5th requests over the limit → blocked");
    check(r[3].retry_after > 0 && r[3].retry_after <= 3600, `a blocked request carries retry_after in (0,3600]: ${r[3].retry_after}`);

    const other = await call(supabase, `testrl-${randomUUID()}`, LIMIT);
    check(other.allowed === true, "a different IP starts fresh (per-IP isolation)");
  } finally {
    // clean up only this run's throwaway per-IP buckets
    await supabase.from("scout_rate_limit").delete().like("bucket", "ip:testrl-%");
  }

  console.log(`\n================ SCOUT-RL-CHECK: ${fail === 0 ? "PASS" : `${fail} FAIL`} ================\n`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error("\n✗ scout-rl-check failed:", (e as Error).message, "\n");
  process.exitCode = 1;
});
