"use client";
import { Dog } from "lucide-react";
import { useScout } from "./scout-context";

/**
 * The floating Scout launcher, lower-right (CLAUDE.md §10 — the in-app agent opens lower-right).
 * A small dog FAB in the Scout ember→amber gradient; it tilts its head on hover (playful, but static
 * at rest so it never distracts). Hidden while the panel is open — the panel has its own close button.
 * The bottom-of-rail "Ask Scout" button still works too; this is just a more discoverable entry point.
 */
export function ScoutLauncher() {
  const { open, setOpen } = useScout();
  if (open) return null;

  return (
    <button
      onClick={() => setOpen(true)}
      aria-label="Ask Scout"
      title="Ask Scout"
      className="group fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-ember),var(--color-amber))] text-white shadow-lg shadow-ember/25 ring-1 ring-black/5 transition-transform duration-200 hover:scale-105 active:scale-95"
    >
      <Dog className="size-7 transition-transform duration-300 ease-out group-hover:-rotate-12" />
      {/* a small "available" dot, no animation */}
      <span className="absolute right-0.5 top-0.5 size-3 rounded-full border-2 border-surface bg-sage" aria-hidden />
      {/* hover label — appears only on hover, so it stays out of the way at rest */}
      <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-md bg-ink/90 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        Ask Scout
      </span>
    </button>
  );
}
