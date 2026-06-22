import { NextRequest, NextResponse } from "next/server";

/**
 * Edge access gate (Handoff next-steps #2). Dogfood is a single-tenant production prototype with a
 * server-side service-role key, so a bare Vercel deploy would put every financial surface AND the
 * write paths on the open internet. RLS does not help here — the service-role key bypasses it — so the
 * protection has to live at the edge. This is HTTP Basic Auth in front of everything.
 *
 * Posture:
 *  - Local development (`next dev`) is NEVER gated, so the dev server, preview, and gates stay frictionless.
 *  - On a deployed/production build it enforces Basic Auth against BASIC_AUTH_USER / BASIC_AUTH_PASSWORD.
 *  - FAIL CLOSED: a production build with no credentials configured returns 503, never a public page —
 *    a misconfigured deploy is locked, not silently exposed.
 *
 * Set BASIC_AUTH_USER / BASIC_AUTH_PASSWORD in the Vercel project env (see .env.example).
 */

const USER = process.env.BASIC_AUTH_USER;
const PASS = process.env.BASIC_AUTH_PASSWORD;
const ENFORCE = process.env.NODE_ENV === "production";

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Dogfood", charset="UTF-8"' },
  });
}

export function middleware(req: NextRequest): NextResponse {
  if (!ENFORCE) return NextResponse.next();

  // Deployed but no credentials set: lock the door rather than serve a public app.
  if (!USER || !PASS) {
    return new NextResponse("Access is not configured. Set BASIC_AUTH_USER and BASIC_AUTH_PASSWORD.", {
      status: 503,
    });
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice("Basic ".length));
    } catch {
      return unauthorized();
    }
    const sep = decoded.indexOf(":");
    if (sep !== -1) {
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (user === USER && pass === PASS) return NextResponse.next();
    }
  }
  return unauthorized();
}

export const config = {
  // Gate every route except Next internals and the favicon (assets that leak nothing on their own).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
