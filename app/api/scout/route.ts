/**
 * Scout's server endpoint. The panel POSTs the conversation; this runs the agent loop server-side
 * (the Anthropic key + the spine never touch the client) and STREAMS the work back as NDJSON: one
 * {type:"step"} per tool call as it fires (so the panel narrates the calculations live), then one
 * {type:"final"} carrying { reply, receipts, mode }.
 */
import { NextResponse } from "next/server";
import { runScout } from "@/lib/scout/agent";
import type { ScoutMessage, ScoutStreamEvent } from "@/lib/scout/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: ScoutMessage[] = raw
    .filter((m): m is ScoutMessage => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20); // bound history

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "expected a non-empty history ending in a user message" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ScoutStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const result = await runScout(messages, (step) => send({ type: "step", ...step }));
        send({ type: "final", ...result });
      } catch (err) {
        console.error("[scout] route error:", err);
        send({ type: "final", reply: "Sorry — I couldn't reach the query spine just now. Try again.", receipts: [], mode: "deterministic" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
