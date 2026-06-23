/**
 * Full-route smoke test (the pre-Loom / pre-trial gate the data/scenario/Scout gates don't cover).
 * Hits every app route against a RUNNING server and asserts the expected HTTP status + a real render
 * (no error markers, non-trivial body). Catches a route that 500s or renders broken — the worst
 * on-camera / in-front-of-trial-users failure mode.
 *
 *   1. Start the app against the live datastore:  DATASTORE=supabase npm run dev   (or `next start`)
 *   2. In another shell:  npm run smoke           (set SMOKE_BASE_URL to target a deploy)
 *
 * Layer 1 — HTTP status (200 / 404 for the deliberate negatives / 3xx for the `/` redirect).
 * Layer 2 — body scan: fail a 200 route that carries a Next error marker or rendered too little.
 * NOTE: a client-component throw can still return 200 with a broken UI; a headless-browser console
 * scan would catch those too. This fetch gate catches the SERVER failures (the demo-breaking ones);
 * run `npm run build` separately for build/prerender breakage.
 */
const BASE = process.env.SMOKE_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";

type Expect = "ok" | "404" | "redirect";
interface Route {
  readonly url: string;
  readonly expect?: Expect;
}

// The verified route inventory (32 page routes + key query variants + the two deliberate 404s).
const ROUTES: readonly Route[] = [
  { url: "/", expect: "redirect" },
  { url: "/dashboard" },
  { url: "/dashboard?inspect=net_income" },
  { url: "/dashboard?inspect=revenue" },
  { url: "/board-package" },
  { url: "/statements/pnl" },
  { url: "/statements/pnl?view=monthly" },
  { url: "/statements/pnl?inspect=subscription" },
  { url: "/statements/pnl?inspect=gross_profit" },
  { url: "/statements/balance-sheet" },
  { url: "/statements/balance-sheet?view=monthly" },
  { url: "/statements/cash-flow" },
  { url: "/statements/cash-flow?view=monthly" },
  { url: "/reporting/projects" },
  { url: "/reporting/projects?status=active" },
  { url: "/reporting/staff" },
  { url: "/reporting/staff?dept=engineering&fn=rnd" },
  { url: "/reporting/expense-transactions" },
  { url: "/reporting/expense-transactions?period=2026-05" },
  { url: "/sales/pipeline" },
  { url: "/sales/pipeline?stage=proposal" },
  { url: "/sales/contracts" },
  { url: "/sales/contracts?status=active" },
  { url: "/sales/customers" },
  { url: "/sales/customers?status=active" },
  { url: "/sales/renewals" },
  { url: "/forecasts/revenue" },
  { url: "/forecasts/cost-of-revenue" },
  { url: "/forecasts/personnel" },
  { url: "/forecasts/expenses" },
  { url: "/forecasts/expenses/it" },
  { url: "/forecasts/expenses/sales-marketing?month=2026-08" },
  { url: "/forecasts/expenses/nonsense", expect: "404" },
  { url: "/forecasts/ar" },
  { url: "/forecasts/fixed-assets" },
  { url: "/forecasts/prepaids" },
  { url: "/scenarios/manager" },
  { url: "/scenarios/drivers?scenario=preset-25-profit" },
  { url: "/scenarios/pnl?scenario=preset-capacity" },
  { url: "/scenarios/pnl?scenario=preset-breakeven&baseline=budget" },
  { url: "/scenarios/dashboard" },
  { url: "/scenarios/dashboard?ids=preset-25-profit,preset-capacity" },
  { url: "/setup/data-import" },
  { url: "/setup/account-mapping" },
  { url: "/setup/account-mapping?note=6200" },
  { url: "/setup/settings" },
  { url: "/setup/guides" },
  { url: "/setup/guides/getting-started" },
  { url: "/setup/guides/budgets-and-forecasts" },
  { url: "/setup/guides/updating-actuals" },
  { url: "/setup/guides/creating-scenarios" },
  { url: "/setup/guides/reading-the-statements" },
  { url: "/setup/guides/asking-scout" },
  { url: "/setup/guides/creating-a-flux-analysis" },
  { url: "/setup/guides/nonsense", expect: "404" },
  { url: "/admin" },
  { url: "/dev/seed" },
];

const ERROR_MARKERS = [/Application error/i, /Internal Server Error/i, /Unhandled Runtime Error/i];

interface Result {
  url: string;
  status: number | string;
  pass: boolean;
  reason: string;
}

async function hit(route: Route): Promise<Result> {
  const expect = route.expect ?? "ok";
  try {
    const res = await fetch(BASE + route.url, { redirect: "manual", headers: { "user-agent": "route-smoke" } });
    const status = res.status;
    if (expect === "redirect") {
      const ok = status >= 300 && status < 400;
      return { url: route.url, status, pass: ok, reason: ok ? "redirect" : `expected 3xx, got ${status}` };
    }
    if (expect === "404") {
      const ok = status === 404;
      return { url: route.url, status, pass: ok, reason: ok ? "notFound (guard works)" : `expected 404, got ${status}` };
    }
    // expect "ok"
    if (status !== 200) return { url: route.url, status, pass: false, reason: `expected 200, got ${status}` };
    const body = await res.text();
    const marker = ERROR_MARKERS.find((m) => m.test(body));
    if (marker) return { url: route.url, status, pass: false, reason: `error marker: ${marker}` };
    if (body.length < 800) return { url: route.url, status, pass: false, reason: `body too small (${body.length}B) — likely a broken render` };
    return { url: route.url, status, pass: true, reason: `ok (${(body.length / 1024).toFixed(0)}KB)` };
  } catch (e) {
    return { url: route.url, status: "ERR", pass: false, reason: (e as Error).message };
  }
}

/** Soft check: Scout's API streams NDJSON. Key-optional (deterministic router works with no key). */
async function scoutApi(): Promise<{ pass: boolean; reason: string }> {
  try {
    const res = await fetch(BASE + "/api/scout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "what is FY26 revenue?" }] }),
    });
    if (res.status !== 200) return { pass: false, reason: `status ${res.status}` };
    const text = await res.text();
    const ok = text.includes('"type":"final"') || text.includes('"type":"step"');
    return { pass: ok, reason: ok ? "streamed NDJSON" : "no NDJSON event in body" };
  } catch (e) {
    return { pass: false, reason: (e as Error).message };
  }
}

async function main() {
  // pre-flight: server reachable?
  try {
    await fetch(BASE + "/dashboard", { redirect: "manual" });
  } catch {
    console.error(`\n✗ Cannot reach ${BASE}. Start the server first:  DATASTORE=supabase npm run dev\n`);
    process.exit(2);
  }

  console.log(`\nRoute smoke against ${BASE}\n${"-".repeat(72)}`);
  const results: Result[] = [];
  for (const route of ROUTES) {
    const r = await hit(route); // sequential — keeps server logs attributable per route
    results.push(r);
    console.log(`${r.pass ? "✓" : "✗"}  ${String(r.status).padEnd(4)} ${route.url}${r.pass ? "" : `   ← ${r.reason}`}`);
  }

  const scout = await scoutApi();
  console.log(`${scout.pass ? "✓" : "•"}  POST /api/scout   ${scout.reason}${scout.pass ? "" : "  (soft — LLM availability is external)"}`);

  const failed = results.filter((r) => !r.pass);
  console.log("-".repeat(72));
  console.log(`${results.length - failed.length}/${results.length} routes passed${failed.length ? ` · ${failed.length} FAILED` : ""}.`);
  if (failed.length) {
    console.log("\nFAILURES:");
    for (const f of failed) console.log(`  ✗ ${f.url} — ${f.reason}`);
    process.exit(1);
  }
  console.log("All routes healthy. ✓\n");
}

void main();
