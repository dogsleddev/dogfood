"use client";
import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { Dog, X, Send, ExternalLink, PawPrint } from "lucide-react";
import { useScout } from "./scout-context";
import type { ScoutReceipt, ScoutResponse, ScoutStreamEvent } from "@/lib/scout/types";

/**
 * Scout — the floating panel (CLAUDE.md §10; diagrams/scout-dock.svg).
 * Wired to /api/scout (tool-use over the query spine). Every answer carries RECEIPTS — a chip per
 * tool call linking to the exact surface — so the numbers are auditable. Falls back to a
 * deterministic lookup when no model key is configured (the answer is tagged accordingly).
 *
 * Responsive: a floating card lower-right on desktop, a full-screen sheet on mobile (where it is the
 * one usable surface — see the interstitial). On mobile it behaves like a modal dialog: body scroll is
 * locked, Escape closes it, focus is trapped, and it tracks the visual viewport so the on-screen
 * keyboard never covers the composer.
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
  // On the mobile full-screen sheet, height tracks the visual viewport so the keyboard never overlaps
  // the composer; null on desktop (the md: classes own the size there).
  const [mobileHeight, setMobileHeight] = useState<number | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, busy, steps]);

  // Modal behavior while open: lock the page behind, close on Escape, and size the mobile sheet to the
  // visual viewport (so the on-screen keyboard pushes the composer up instead of hiding it).
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const vv = window.visualViewport;
    const phone = window.matchMedia("(max-width: 767px)");
    const syncHeight = () => setMobileHeight(phone.matches && vv ? vv.height : null);
    syncHeight();
    vv?.addEventListener("resize", syncHeight);
    phone.addEventListener("change", syncHeight);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);

    // Focus the composer when opening on desktop; on mobile we hold off so the keyboard doesn't pop
    // before the user has read the welcome.
    if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      vv?.removeEventListener("resize", syncHeight);
      phone.removeEventListener("change", syncHeight);
      document.removeEventListener("keydown", onKey);
      setMobileHeight(null);
    };
  }, [open, setOpen]);

  // Trap Tab within the panel while it is open (full-screen modal on mobile).
  function onPanelKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute("disabled"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

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
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Scout"
      onKeyDown={onPanelKeyDown}
      style={mobileHeight ? { height: mobileHeight } : undefined}
      className="fixed inset-x-0 top-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-surface shadow-2xl md:inset-auto md:bottom-5 md:right-5 md:h-[560px] md:w-[400px] md:rounded-2xl md:border md:border-parchment-line"
    >
      {/* header */}
      <div className="flex items-center gap-3 border-b border-parchment-line px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-ember),var(--color-amber))] text-white">
          <Dog className="size-4" />
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
            ref={inputRef}
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
