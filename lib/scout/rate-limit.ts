/**
 * Rate limit for the public Scout endpoint (CLAUDE.md §10/§17). /api/scout runs the agent loop
 * server-side (the Anthropic key never reaches the client) with NO per-user auth, so a traffic spike
 * on the headline AI feature could run up uncapped API spend + 529 throttling. This is a two-tier
 * FIXED-WINDOW limiter backed by a Supabase atomic function (supabase/migrations/0008):
 *
 *   • per-IP window  — stops one abuser/bot hammering the endpoint.
 *   • GLOBAL window  — the real spend circuit-breaker, shared across every serverless instance. An
 *                      in-process counter can't do this (Vercel spawns many lambdas under load), which
 *                      is why this is DB-backed rather than in-memory.
 *
 * Design choices:
 *   • FAIL-OPEN — any backend/config error returns allowed. A limiter bug must never take down Scout;
 *     the global window is the spend backstop only while the DB is reachable (it almost always is).
 *   • Admin (Chris) is EXEMPT, so his own testing / the Loom recording is never throttled.
 *   • The client IP is hashed before it leaves this process — we never store a raw IP.
 *   • A determined attacker rotating spoofed IPs evades the per-IP tier, but the GLOBAL window still
 *     caps total spend regardless of IP games — that's the point of the second tier.
 *
 * Limits live here (not in SQL) so they tune in TS without a migration.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { isAdmin } from "@/lib/auth/admin";

const IP_LIMIT = 30; // requests …
const IP_WINDOW_SECS = 5 * 60; // … per 5 minutes per IP — the real abuse control (stops one bot/script hammering)
// The GLOBAL window is a CATASTROPHE / runaway breaker (a botnet or far-beyond-expected virality), NOT
// a tight per-hour budget — set generously so organic launch traffic never trips it (the per-IP tier
// already throttles any single source). At ~6 Anthropic calls/question this caps worst-case spend to a
// bounded low-hundreds $/hr. Tune DOWN if you want a harder spend ceiling, UP if a launch gets blocked.
const GLOBAL_LIMIT = 3000; // requests …
const GLOBAL_WINDOW_SECS = 60 * 60; // … per hour across ALL serverless instances
const RPC_TIMEOUT_MS = 1500; // a hung DB must fail FAST into fail-open, never pin the lambda for the platform timeout

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // no backend (local dev without keys) → fail open
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Best-effort client IP, hashed + salted so a raw IP is never stored. */
function clientIpHash(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const ip = req.headers.get("x-real-ip") || (xff ? xff.split(",")[0]!.trim() : "") || "unknown";
  return createHash("sha256").update(`${ip}|scout-rl`).digest("hex").slice(0, 24);
}

export interface RateDecision {
  allowed: boolean;
  /** Seconds until the blocking window resets (0 when allowed). */
  retryAfter: number;
}

/** Gate a Scout request. Fail-open on any error; admin exempt. */
export async function checkScoutRateLimit(req: Request): Promise<RateDecision> {
  try {
    if (await isAdmin()) return { allowed: true, retryAfter: 0 };
  } catch {
    /* cookies() unavailable in this context → treat as non-admin */
  }

  const supabase = getClient();
  if (!supabase) return { allowed: true, retryAfter: 0 }; // no backend → fail open

  try {
    const { data, error } = await supabase
      .rpc("scout_rate_check", {
        p_ip: clientIpHash(req),
        p_ip_limit: IP_LIMIT,
        p_ip_window_secs: IP_WINDOW_SECS,
        p_global_limit: GLOBAL_LIMIT,
        p_global_window_secs: GLOBAL_WINDOW_SECS,
      })
      .abortSignal(AbortSignal.timeout(RPC_TIMEOUT_MS)); // hung DB → AbortError → caught below → fail open (fast)
    const row = Array.isArray(data) ? (data[0] as { allowed?: boolean; retry_after?: number } | undefined) : undefined;
    if (error || !row) {
      console.warn("[scout] rate-limit check failed (fail-open):", error?.message ?? "no row");
      return { allowed: true, retryAfter: 0 };
    }
    return { allowed: row.allowed !== false, retryAfter: row.retry_after ?? 0 };
  } catch (e) {
    console.warn("[scout] rate-limit check threw (fail-open):", (e as Error).message);
    return { allowed: true, retryAfter: 0 };
  }
}
