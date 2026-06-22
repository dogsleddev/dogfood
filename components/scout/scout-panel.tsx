"use client";
import { useState, useRef, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { Sparkles, X, Send, ExternalLink, PawPrint } from "lucide-react";
import { useScout } from "./scout-context";
import type { ScoutReceipt, ScoutResponse, ScoutStreamEvent } from "@/lib/scout/types";

/**
 * Scout — the floating panel, lower-right (CLAUDE.md §10; diagrams/scout-dock.svg).
 * Wired to /api/scout (tool-use over the query spine). Every answer carries RECEIPTS — a chip per
 * tool call linking to the exact surface — so the numbers are auditable. Falls back to a
 * deterministic lookup when no model key is configured (the answer is tagged accordingly).
 */
interface UiMessage {
  role: "user" | "assistant";
  content: string;
  receipts?: readonly ScoutReceipt[];
  mode?: ScoutResponse["mode"];
}

const SUGGESTIONS = ["What's our runway?", "How did net income do this year?", "How many contracts do we have?", "What's our NRR?"];

export function ScoutPanel() {
  const { open, setOpen } = useScout();
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // The calculations Scout is running right now (narrated live as each tool fires).
  const [steps, setSteps] = useState<string[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, busy, steps]);

  if (!open) return null;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: UiMessage[] = [...messages, { role: "user", content: q }];
    setMessages(history);
    setInput("");
    setBusy(true);
    setSteps([]);
    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // Read the NDJSON stream: {type:"step"} lines narrate the work live; {type:"final"} lands the answer.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: UiMessage | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          const evt = JSON.parse(line) as ScoutStreamEvent;
          if (evt.type === "step") {
            setSteps((s) => [...s, evt.label]);
          } else {
            final = { role: "assistant", content: evt.reply, receipts: evt.receipts, mode: evt.mode };
          }
        }
      }
      setMessages([...history, final ?? { role: "assistant", content: "Sorry — I lost the scent. Try again." }]);
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry — I couldn't reach the query spine just now. Try again." }]);
    } finally {
      setBusy(false);
      setSteps([]);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex h-[560px] w-[400px] flex-col overflow-hidden rounded-2xl border border-parchment-line bg-surface shadow-2xl">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-parchment-line px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-ember),var(--color-amber))] text-white">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-heading text-base leading-tight text-ink">Scout</div>
          <div className="flex items-center gap-1.5 text-xs text-steel">
            <span className="size-1.5 rounded-full bg-sage" />
            online · finance analyst
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-steel transition-colors hover:bg-secondary hover:text-ink"
          aria-label="Close Scout"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* thread */}
      <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-ink">
              Ask me about Bearing&apos;s numbers — I read the same query spine the app does and show a receipt for every figure.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void ask(s)}
                  className="rounded-full border border-parchment-line bg-secondary/50 px-2.5 py-1 text-xs text-steel transition-colors hover:bg-ember-tint hover:text-ember-deep"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-lg bg-ember-tint px-3 py-2 text-sm text-ink" : "w-full"}>
              {m.role === "assistant" ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-ink whitespace-pre-wrap">{m.content}</div>
                  {m.receipts && m.receipts.length > 0 && <Receipts receipts={m.receipts} />}
                  {m.mode === "deterministic" && (
                    <div className="px-1 text-[11px] italic text-steel/80">Deterministic lookup — set ANTHROPIC_API_KEY for conversational Scout.</div>
                  )}
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="space-y-1 px-1">
            {(steps.length ? steps : ["Scout is on the scent…"]).map((label, i) => {
              const active = i === (steps.length ? steps.length - 1 : 0);
              return (
                <div key={i} className="flex items-center gap-1.5 text-xs text-steel">
                  <PawPrint className={`size-3.5 shrink-0 ${active ? "animate-pulse text-ember" : "text-sage"}`} />
                  <span>{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* composer */}
      <form onSubmit={onSubmit} className="border-t border-parchment-line p-3">
        <div className="flex items-center gap-2 rounded-full border border-parchment-line bg-secondary/60 px-3 py-2 focus-within:border-ember/60">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            placeholder="Ask Scout about the numbers…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-steel/70 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex size-7 items-center justify-center rounded-full bg-ember text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

function Receipts({ receipts }: { receipts: readonly ScoutReceipt[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {receipts.map((r, i) => (
        <Link
          key={i}
          href={r.href}
          className="group inline-flex items-center gap-1.5 rounded-md border border-parchment-line bg-surface px-2 py-1 text-[11px] text-steel transition-colors hover:border-ember/40 hover:text-ember-deep"
          title={`${r.tool}(${Object.entries(r.args).map(([k, v]) => `${k}: ${v}`).join(", ")})`}
        >
          <span className="size-1.5 rounded-full bg-ember/70" />
          <span className="font-medium text-ink group-hover:text-ember-deep">{r.label}</span>
          <ExternalLink className="size-3 opacity-60" />
        </Link>
      ))}
    </div>
  );
}
