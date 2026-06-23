/**
 * Minimal admin gate for the public trial (CLAUDE.md §17 — admin-gated app-wide writes). The site is
 * open (no login to view, add flux notes, build scenarios, or use Scout — all contained), but the
 * "data" writes that move everyone's numbers (CSV import / as-of advance, Account Mapping re-points,
 * Budget lock/reset) and the demo reset are gated to the admin (Chris). Auth is a signed httpOnly
 * cookie keyed on ADMIN_PASSWORD — no separate user store. Server-only (reads next/headers cookies).
 */
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "dogfood_admin";
const TOKEN_MESSAGE = "admin-v1";

/** The cookie token derived from the configured password (HMAC(password, "admin-v1")); null if unset. */
function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHmac("sha256", pw).update(TOKEN_MESSAGE).digest("hex");
}

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

/** True iff the request carries a valid admin cookie. Call from a Server Component / Action / Route. */
export async function isAdmin(): Promise<boolean> {
  const expected = adminToken();
  if (!expected) return false;
  const got = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  return safeEqual(got, expected);
}

/** Verify a submitted password; on success return the cookie token to set, else null. */
export function passwordToToken(password: string): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || !password || !safeEqual(password, pw)) return null;
  return adminToken();
}
