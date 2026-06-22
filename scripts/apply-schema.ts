/**
 * apply-schema — run supabase/migrations/0001_init.sql against the Supabase Postgres directly.
 *
 * DDL can't go through the service-role REST key (PostgREST is data-only), so this connects with the
 * SUPABASE_DB_URL connection string (Supabase → Project Settings → Database → Connection string → URI,
 * which carries the DB password). The value is read from .env.local and NEVER printed. Re-runnable:
 * an "already exists" error is treated as "schema already applied".
 *
 * Run: npx tsx scripts/apply-schema.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const mt = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (mt && !process.env[mt[1]]) process.env[mt[1]] = mt[2];
  }
}

async function main() {
  loadEnvLocal();
  let conn = process.env.SUPABASE_DB_URL;
  if (!conn) {
    throw new Error(
      "SUPABASE_DB_URL is not set. Add it to .env.local:\n" +
        "  SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres\n" +
        "(Supabase → Project Settings → Database → Connection string → URI.)",
    );
  }
  // If the `<ref>` placeholder was left in the host, fill it from the (same-project) public URL.
  const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^https:\/\/([^.]+).*/, "$1");
  if (ref && conn.includes("<ref>")) {
    conn = conn.replaceAll("<ref>", ref);
    console.log(`(filled <ref> → ${ref} from NEXT_PUBLIC_SUPABASE_URL)`);
  }
  // Parse into DISCRETE fields rather than handing pg the raw string: pg v8 runs the connection
  // string through `new URL`, which rejects unescaped special characters in the password. We split
  // on the (single) '@' and the first ':' ourselves, so a raw special-char password works as-is.
  const m = /^postgres(?:ql)?:\/\/([^:@/]+)(?::([^@]*))?@([^:/?]+)(?::(\d+))?(?:\/([^?]+))?/.exec(conn);
  if (!m) {
    throw new Error("could not parse SUPABASE_DB_URL — expected postgresql://user:password@host:port/database");
  }
  // Optional overrides (no .env.local edit needed): the direct host db.<ref>.supabase.co is IPv6-only,
  // so on an IPv4 network point at the Session pooler — keeping the password parsed from SUPABASE_DB_URL.
  // Strip stray placeholder delimiters left wrapping the password (e.g. `<password>` / `[YOUR-PASSWORD]`
  // edited to `<realpw>` — the brackets aren't part of the real password and break auth).
  let password = m[2] ?? "";
  if (/^<.*>$/.test(password) || /^\[.*\]$/.test(password)) password = password.slice(1, -1);
  const cfg = {
    user: process.env.SUPABASE_DB_USER || m[1],
    password,
    host: process.env.SUPABASE_DB_HOST || m[3],
    port: process.env.SUPABASE_DB_PORT ? Number(process.env.SUPABASE_DB_PORT) : m[4] ? Number(m[4]) : 5432,
    database: m[5] || "postgres",
    ssl: { rejectUnauthorized: false } as const,
  };
  const file = process.argv[2] || "supabase/migrations/0001_init.sql";
  const sql = readFileSync(file, "utf8");

  const client = new Client(cfg);
  await client.connect();
  console.log(`\nApplying ${file} → ${cfg.host}:${cfg.port}/${cfg.database} (user ${cfg.user}) …`);
  try {
    await client.query(sql); // simple-query protocol → runs all statements in the file
    console.log("✓ schema applied.\n");
  } catch (e) {
    const msg = (e as Error).message;
    if (/already exists/i.test(msg)) {
      console.log(`• schema already applied (${msg.split("\n")[0]}). Nothing to do.\n`);
    } else {
      throw e;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error("\n✗ apply-schema failed:", (e as Error).message, "\n"); process.exitCode = 1; });
