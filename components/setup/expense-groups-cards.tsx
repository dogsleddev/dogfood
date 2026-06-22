import { cn } from "@/lib/utils";
import type { ExpenseGroup } from "@/lib/types/common";
import type { StatementClassification, CostFunction } from "@/lib/types/common";

const CLASS_BADGE: Record<StatementClassification, string> = {
  cost_of_revenue: "bg-amber/15 text-amber-deep",
  operating_expense: "bg-steel/15 text-steel",
};

const CLASS_LABEL: Record<StatementClassification, string> = {
  cost_of_revenue: "Cost of Revenue",
  operating_expense: "Operating Expense",
};

const FUNCTION_LABEL: Record<CostFunction, string> = {
  direct: "Direct",
  rnd: "R&D",
  sm: "S&M",
  ga: "G&A",
};

/**
 * Expense groups — the config-driven group set (CLAUDE.md §7). Membership is owned by Account
 * Mapping; each group carries a typed classification (CoR / OpEx) and a function sub-role so the
 * statement engine, the metrics, and the scenario levers can all reason about it. Read-only:
 * reads `listExpenseGroups` (the live DataStore seam), shown in the Settings display order.
 */
export function ExpenseGroupsCards({ groups }: { groups: readonly ExpenseGroup[] }) {
  const ordered = groups.slice().sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="mb-3 text-sm text-steel">
        <span className="font-medium text-ink">{ordered.length}</span> expense groups · each with a typed
        classification + function sub-role
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((g) => (
          <div key={g.id} className="rounded-xl border border-parchment-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="font-heading text-base text-ink">{g.label}</div>
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                  CLASS_BADGE[g.classification],
                )}
              >
                {CLASS_LABEL[g.classification]}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-steel">
              <span className="rounded bg-secondary px-1.5 py-0.5 font-medium text-steel">
                {FUNCTION_LABEL[g.function]}
              </span>
              <span>function sub-role</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
