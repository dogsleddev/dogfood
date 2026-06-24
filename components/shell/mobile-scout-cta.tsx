"use client";
import { Dog } from "lucide-react";
import { useScout } from "@/components/scout/scout-context";

/**
 * The mobile entry point into Scout. Scout is the one genuinely mobile-native surface, so the mobile
 * home leads with it: a compact button in the top bar (always reachable) and a hero CTA in the body.
 * Both just open the existing Scout panel (full-screen sheet on phones) — Scout itself is untouched.
 */
export function MobileScoutCta({ variant = "hero" }: { variant?: "hero" | "compact" }) {
  const { setOpen } = useScout();

  if (variant === "compact") {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Scout"
        className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,var(--color-ember),var(--color-amber))] px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-ember/25 ring-1 ring-black/5 transition-transform active:scale-95"
      >
        <Dog className="size-3.5" />
        Ask Scout
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-ember/20 bg-ember-tint/40 px-4 py-4 text-center">
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--color-ember),var(--color-amber))] px-6 py-3 text-sm font-medium text-white shadow-lg shadow-ember/25 ring-1 ring-black/5 transition-transform active:scale-95"
      >
        <Dog className="size-4" />
        Ask Scout anything
      </button>
      <p className="text-xs text-steel">
        Our AI analyst reads the same numbers the app does — try &ldquo;What&apos;s our runway?&rdquo;
      </p>
    </div>
  );
}
