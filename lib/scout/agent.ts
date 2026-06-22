/**
 * Scout's agent loop (CLAUDE.md §10). Key-optional:
 *  - ANTHROPIC_API_KEY set  → the live Anthropic tool-use loop (Sonnet 4.6), manual loop so we
 *    capture a RECEIPT per tool call.
 *  - no key                 → the deterministic intent-router fallback (router.ts).
 * Either way the tool execution + receipts + UI are exercised, so the surface is verifiable today.
 */
import Anthropic from "@anthropic-ai/sdk";
import { SCOUT_MODEL, SCOUT_SYSTEM_PROMPT, SCOUT_MAX_TURNS, hasApiKey } from "./config";
import { wiredScoutTools } from "./tools";
import { runDeterministicScout } from "./router";
import { stepLabel } from "./commentary";
import type { ScoutMessage, ScoutReceipt, ScoutResponse, ScoutOnStep } from "./types";

const lastUserText = (messages: readonly ScoutMessage[]): string =>
  [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

/**
 * Run Scout. `onStep` (optional) fires the moment each tool is called, so a streaming caller can
 * narrate the calculations live; non-streaming callers (the eval) just omit it and read the return.
 */
export async function runScout(messages: readonly ScoutMessage[], onStep?: ScoutOnStep): Promise<ScoutResponse> {
  if (!hasApiKey()) return runDeterministicScout(lastUserText(messages), onStep);
  try {
    return await runLiveScout(messages, onStep);
  } catch (err) {
    // A misconfigured/over-loaded key shouldn't dead-end the demo — degrade to the deterministic
    // answer (and log server-side). Honest: the response is tagged mode:"deterministic".
    console.error("[scout] live loop failed; falling back to deterministic:", err);
    return runDeterministicScout(lastUserText(messages), onStep);
  }
}

async function runLiveScout(messages: readonly ScoutMessage[], onStep?: ScoutOnStep): Promise<ScoutResponse> {
  const client = new Anthropic();
  const tools = wiredScoutTools();
  const toolDefs: Anthropic.Tool[] = tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.impl.inputSchema }));
  const implByName = new Map(tools.map((t) => [t.name, t.impl] as const));

  // Prompt caching. The tool list + system prompt are a ~5.5k-token prefix that is byte-identical
  // on every call — every turn of every question. Render order is tools -> system -> messages, so a
  // breakpoint on the last tool caches the tool block and one on the system block caches
  // tools+system together; the volatile conversation stays after the last breakpoint. On a hit that
  // prefix bills at ~0.1x instead of full input price, so a typical question drops from ~$0.04 to
  // ~$0.015. 5-min TTL: back-to-back questions (an eval sweep, a working session) keep reading the
  // same warm prefix. Verify with SCOUT_DEBUG below — cacheRead should be ~5.5k after the first call.
  if (toolDefs.length > 0) {
    toolDefs[toolDefs.length - 1] = { ...toolDefs[toolDefs.length - 1], cache_control: { type: "ephemeral" } };
  }
  const cachedSystem: Anthropic.TextBlockParam[] = [
    { type: "text", text: SCOUT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];

  const convo: Anthropic.MessageParam[] = messages.map((msg) => ({ role: msg.role, content: msg.content }));
  const receipts: ScoutReceipt[] = [];

  for (let turn = 0; turn < SCOUT_MAX_TURNS; turn++) {
    const res = await client.messages.create({
      model: SCOUT_MODEL,
      max_tokens: 2048,
      system: cachedSystem,
      messages: convo,
      tools: toolDefs,
    });
    if (process.env.SCOUT_DEBUG) {
      const u = res.usage;
      console.debug(
        `[scout] turn ${turn} usage: in=${u.input_tokens} cacheRead=${u.cache_read_input_tokens ?? 0} cacheWrite=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`,
      );
    }

    if (res.stop_reason === "tool_use") {
      convo.push({ role: "assistant", content: res.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const input = (block.input ?? {}) as Record<string, unknown>;
        // Narrate the calculation the moment Scout reaches for the tool (before it resolves).
        onStep?.({ tool: block.name, label: stepLabel(block.name, input) });
        const impl = implByName.get(block.name);
        if (!impl) {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `Unknown tool: ${block.name}`, is_error: true });
          continue;
        }
        try {
          const { data, receipt } = await impl.run(input);
          receipts.push(receipt);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(data) });
        } catch (e) {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: `Error: ${(e as Error).message}`, is_error: true });
        }
      }
      convo.push({ role: "user", content: toolResults });
      continue;
    }

    const reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { reply: reply || "(no answer)", receipts, mode: "live" };
  }

  return { reply: "I reached the tool-call limit before finishing — try narrowing the question.", receipts, mode: "live" };
}
