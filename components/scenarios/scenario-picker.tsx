import Link from "next/link";
import type { ScenarioListItem } from "@/lib/queries/scenarios";

/**
 * The scenario picker for the Scenario Drivers board (read-only). Links across Base + the seed
 * presets (and any user scenarios), switching the `?scenario=` param. No save-state machinery —
 * the Scenarios group is contained (CLAUDE.md §9); this is navigation, not editing.
 */
export function ScenarioPicker({
  scenarios,
  selectedId,
}: {
  scenarios: readonly ScenarioListItem[];
  selectedId: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {scenarios.map((s) => {
        const active = s.id === selectedId;
        return (
          <Link
            key={s.id}
            href={`/scenarios/drivers?scenario=${encodeURIComponent(s.id)}`}
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors",
              active
                ? "border-ember bg-ember/10 text-ember-deep"
                : "border-parchment-line bg-surface text-steel hover:border-ember/50 hover:text-ink",
            ].join(" ")}
          >
            <span className={active ? "font-semibold" : "font-medium"}>{s.name}</span>
            {s.isBase ? (
              <span className="rounded-full bg-frost/30 px-2 py-0.5 text-xs text-steel">Base</span>
            ) : (
              <span className={`text-xs tabular-nums ${active ? "text-ember-deep/70" : "text-steel/70"}`}>
                {s.adjustmentCount} {s.adjustmentCount === 1 ? "lever" : "levers"}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
