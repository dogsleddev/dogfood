/**
 * Demo reset endpoint (CLAUDE.md §17). Hit by the Vercel cron (daily) to self-heal the shared trial
 * sandbox. Protected by CRON_SECRET: Vercel automatically sends `Authorization: Bearer ${CRON_SECRET}`
 * on cron invocations when that env var is set, so a random visitor can't trigger a reset. The admin
 * "Reset demo" button calls resetDemo() directly via a Server Action (not this route).
 */
import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  try {
    const cleared = await resetDemo();
    return NextResponse.json({ ok: true, cleared });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export const GET = handle; // Vercel cron triggers GET
export const POST = handle;
