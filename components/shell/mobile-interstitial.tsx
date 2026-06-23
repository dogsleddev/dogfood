"use client";
import { Dog } from "lucide-react";
import { useScout } from "@/components/scout/scout-context";

/**
 * Mobile interstitial. Dogfood is a dense, multi-column FP&A workspace built around the
 * Midnight rail; the working surfaces (5-column statements, 12-month board views) are
 * desktop-only by design, so on a phone the layout would crush to ~100px and read as
 * broken. Small screens are gated behind a branded "open on a larger screen" panel —
 * `md:hidden`, so it is SSR-safe with no hydration flash; the desktop app is rendered
 * `hidden md:flex` alongside and is untouched.
 *
 * But Scout IS mobile-native, so the interstitial carries a prominent "Ask Scout" CTA:
 * phone visitors can't drive the spreadsheet, but they can ask the agent (which opens as
 * a full-screen sheet). This is the on-strategy mobile play — "ask the agent," not
 * "shrink the spreadsheet."
 */
function TrailMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline points="3,17 7,14 3,11" stroke="var(--color-frost)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9,15 13,12 9,9" stroke="var(--color-steel)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15,13 19,10 15,7" stroke="var(--color-ember)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileInterstitial() {
  const { setOpen } = useScout();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center text-sidebar-foreground md:hidden"
      style={{ background: "linear-gradient(180deg, var(--color-midnight), var(--color-midnight-2))" }}
    >
      <div className="flex max-w-sm flex-col items-center gap-5">
        <div className="flex items-center gap-2.5">
          <TrailMark />
          <span className="font-heading text-2xl text-parchment">
            dogfood<span className="text-steel">.cafe</span>
          </span>
        </div>

        <h1 className="font-heading text-xl text-parchment">
          Dogfood is a desktop FP&amp;A workspace
        </h1>

        <p className="text-sm leading-relaxed text-steel">
          The platform packs statements, forecasts, and scenarios into a dense,
          multi-column cockpit best driven on a laptop or desktop.
        </p>

        {/* Scout is mobile-native — the one surface phone visitors can use right now. */}
        <div className="mt-1 flex flex-col items-center gap-2.5">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--color-ember),var(--color-amber))] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-ember/25 ring-1 ring-black/5 transition-transform active:scale-95"
          >
            <Dog className="size-4" />
            Ask Scout anything
          </button>
          <p className="text-xs text-steel">
            Our AI analyst works great on mobile — try &ldquo;What&apos;s our runway?&rdquo;
          </p>
        </div>

        <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-steel">
          Open the full workspace at <span className="font-medium text-parchment">1024px</span> or wider
        </div>
      </div>
    </div>
  );
}
