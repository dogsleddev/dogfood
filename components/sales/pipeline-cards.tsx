import { formatMoney, formatPercent, sumMoney, type Money } from "@/lib/types/money";
import { cn } from "@/lib/utils";
import type { PipelineOpportunity, PipelineStage } from "@/lib/types/source";

const fmt = (m: Money) => formatMoney(m, { compact: true });

/** Open funnel order (closed stages are not open pipeline and aren't seeded into the register). */
const STAGE_ORDER: readonly PipelineStage[] = ["lead", "qualified", "proposal", "negotiation"];
const STAGE_LABEL: Record<PipelineStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

/**
 * Derived roll-ups over the open-pipeline list (CLAUDE.md §8, layer 1), computed inline from the
 * `listPipeline` result — no new lib/queries function. Three reads of the same source: total open
 * pipeline (count + ARR + weighted ARR), the by-stage funnel, and the top owners by open ARR.
 */
export function PipelineCards({ opportunities }: { opportunities: readonly PipelineOpportunity[] }) {
  const totalArr = sumMoney(opportunities.map((o) => o.arr));
  const weightedArr = sumMoney(opportunities.map((o) => ({ ...o.arr, minor: Math.round(o.arr.minor * o.probability) })));
  const maxArr = Math.max(1, ...opportunities.map((o) => o.arr.minor));

  // By stage
  const byStage = STAGE_ORDER.map((stage) => {
    const rows = opportunities.filter((o) => o.stage === stage);
    return { stage, count: rows.length, arr: sumMoney(rows.map((o) => o.arr)) };
  });

  // By rep (top 5 by open ARR)
  const repMap = new Map<string, { arr: Money; count: number }>();
  for (const o of opportunities) {
    const prev = repMap.get(o.owner);
    if (prev) repMap.set(o.owner, { arr: { ...prev.arr, minor: prev.arr.minor + o.arr.minor }, count: prev.count + 1 });
    else repMap.set(o.owner, { arr: o.arr, count: 1 });
  }
  const byRep = [...repMap.entries()]
    .map(([owner, v]) => ({ owner, ...v }))
    .sort((a, b) => b.arr.minor - a.arr.minor)
    .slice(0, 5);
  const repMaxArr = Math.max(1, ...byRep.map((r) => r.arr.minor));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker="Total open pipeline">
        <div className="mb-1 font-heading text-3xl text-ink tabular-nums">{fmt(totalArr)}</div>
        <div className="text-sm text-steel">
          across <span className="font-medium text-ink">{opportunities.length}</span> open opportunities
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-parchment-line/70 pt-2">
          <span className="text-sm text-steel">Weighted (× win probability)</span>
          <span className="text-sm font-medium text-ink tabular-nums">{fmt(weightedArr)}</span>
        </div>
      </Card>

      <Card kicker="By stage · funnel">
        <div className="space-y-2">
          {byStage.map((s) => (
            <div key={s.stage}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-steel">
                  {STAGE_LABEL[s.stage]} <span className="text-steel/70">· {s.count}</span>
                </span>
                <span className="font-medium text-ink tabular-nums">{fmt(s.arr)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-ember"
                  style={{ width: `${Math.round((s.arr.minor / maxArr) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card kicker="By rep · top owners">
        <div className="space-y-2">
          {byRep.map((r) => (
            <div key={r.owner}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-steel">
                  {r.owner} <span className="text-steel/70">· {r.count}</span>
                </span>
                <span className="font-medium text-ink tabular-nums">{fmt(r.arr)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full bg-sage")}
                  style={{ width: `${Math.round((r.arr.minor / repMaxArr) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {byRep.length === 0 && <div className="text-sm text-steel">No owners.</div>}
      </Card>
    </div>
  );
}

export { STAGE_LABEL, STAGE_ORDER };
export const formatProbability = (o: PipelineOpportunity) => formatPercent(o.probability, 0);
