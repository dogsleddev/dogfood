/**
 * scout-live-sample — run a representative sample of the generated question bank through the REAL Scout
 * loop (Sonnet 4.6, key required) and record routing + answer behavior, to validate the classification
 * in scout-question-bank.md. Reads scout-sample.json (built by the audit), writes scout-live-results.json.
 *
 * Run: npx tsx scripts/scout-live-sample.ts   (metered; needs ANTHROPIC_API_KEY in .env.local)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { runScout } from "@/lib/scout/agent";

function loadEnvLocal() {
  if (process.env.ANTHROPIC_API_KEY || !existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

interface S { category: string; answerable: string; expectedTool: string; q: string }
const sample: S[] = JSON.parse(readFileSync("scout-sample.json", "utf8").replace(/^﻿/, ""));

// auto-judge: NOW = routed to the expected wired tool (or correctly used no tool for product-knowledge);
// DECLINE = called no data tool (redirected); GAP/AMBIGUOUS = recorded, not strictly scored.
function judge(expected: string, toolNames: string[], answerable: string): boolean {
  const e = expected.toLowerCase();
  const noTool = toolNames.length === 0;
  if (answerable === "decline") return noTool;
  if (answerable === "now") {
    if (e.includes("product-knowledge") || e.includes("decline") || e.includes("no tool")) return noTool;
    return toolNames.some((t) => e.includes(t.toLowerCase()));
  }
  return true; // gap / ambiguous: record for eyeball
}

async function main() {
  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < sample.length; i++) {
    const s = sample[i];
    try {
      const res = await runScout([{ role: "user", content: s.q }]);
      const toolNames = res.receipts.map((r) => r.tool);
      const tools = res.receipts.map((r) => r.tool + (r.args?.metricId ? `(${r.args.metricId})` : ""));
      const pass = judge(s.expectedTool, toolNames, s.answerable);
      results.push({ ...s, mode: res.mode, tools, reply: res.reply.slice(0, 500), pass });
      console.log(`${i + 1}/${sample.length} [${s.answerable}] ${s.q.slice(0, 58)} -> ${tools.join(", ") || "(no tool)"} [${res.mode}]${pass ? "" : "  <-- check"}`);
    } catch (e) {
      results.push({ ...s, mode: "error", tools: [], reply: (e as Error).message, pass: false });
      console.log(`${i + 1}/${sample.length} ERROR ${s.q.slice(0, 48)}: ${(e as Error).message}`);
    }
  }
  writeFileSync("scout-live-results.json", JSON.stringify(results, null, 2));

  const byMode: Record<string, number> = {};
  results.forEach((r) => { byMode[r.mode as string] = (byMode[r.mode as string] || 0) + 1; });
  const grp = (a: string) => results.filter((r) => r.answerable === a);
  const passes = (a: string) => grp(a).filter((r) => r.pass).length;
  console.log("\n================ LIVE SAMPLE SUMMARY ================");
  console.log("modes:", JSON.stringify(byMode));
  console.log(`NOW routed to expected tool: ${passes("now")}/${grp("now").length}`);
  console.log(`DECLINE redirected (no data tool): ${passes("decline")}/${grp("decline").length}`);
  console.log(`AMBIGUOUS (recorded): ${grp("ambiguous").length}  ·  GAP (recorded): ${grp("gap").length}`);
  console.log("Full trace + replies: scout-live-results.json");
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
