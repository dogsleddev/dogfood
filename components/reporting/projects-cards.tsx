import { formatMoney, type Money, type Percent } from "@/lib/types/money";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const pct = (p: Percent) => `${Math.round((p as number) * 100)}%`;

function Card({ kicker, value, sub }: { kicker: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      <div className="font-heading text-2xl text-ink tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-steel">{sub}</div>
    </div>
  );
}

/**
 * Derived roll-ups for the Projects register (CLAUDE.md §8, layer 1): delivery capacity (utilization),
 * the in-progress vs complete split, and total WIP / unbilled across the book. Each is computed from
 * the live `listProjects` / `getUtilization` reads, not a separate data path.
 */
export function ProjectsCards({
  utilization,
  inProgress,
  complete,
  totalProjects,
  totalWip,
}: {
  utilization: Percent;
  inProgress: number;
  complete: number;
  totalProjects: number;
  totalWip: Money;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
      <Card
        kicker="Utilization · last closed month"
        value={pct(utilization)}
        sub="Billable delivery capacity in use"
      />
      <Card
        kicker="In progress vs complete"
        value={`${inProgress} / ${complete}`}
        sub={`${totalProjects} projects in the book`}
      />
      <Card
        kicker="Total WIP / unbilled"
        value={fmt(totalWip)}
        sub="Contract assets across all projects"
      />
    </div>
  );
}
