import { Info } from "lucide-react";

/**
 * Shared-sandbox notice for the contained-write surfaces (Scenarios, Flux notes). The public demo is
 * single-tenant: every anonymous visitor shares ONE set of scenarios/flux notes, cleared nightly by the
 * self-heal cron (CLAUDE.md §17). Without this note, seeing a scenario or note someone else created reads
 * as a bug; this sets the expectation. (Base + the actuals are never touched — those edits are contained.)
 */
export function DemoSandboxNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3.5 py-2.5 text-xs text-ink/80 ${className}`}
    >
      <Info className="mt-0.5 size-3.5 shrink-0 text-amber-deep" />
      <span>
        <span className="font-medium text-ink">Shared demo sandbox.</span> Scenarios and flux notes added
        here are visible to everyone trying the demo and reset nightly. Your edits never touch Base or the
        actuals.
      </span>
    </div>
  );
}
