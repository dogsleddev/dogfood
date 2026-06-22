import type { BudgetSnapshot } from "@/lib/types/statements";
import { monthYear, monthIndex } from "@/lib/types/period";
import { resetBudgetAction } from "@/app/statements/pnl/actions";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const monthLabel = (mo: string) => `${MONTH_ABBR[monthIndex(mo as never) - 1]} ${monthYear(mo as never)}`;

/**
 * The Budget status strip on the Forecasted P&L (§8). The Budget column is a FROZEN snapshot of the
 * layer-2 plan — the immutable yardstick for variance, distinct from Base (which keeps moving as
 * actuals close). "Reset to plan" re-freezes the current FY plan (Chris 2026-06-22). Server-rendered;
 * the reset is a <form action> with no client JS.
 */
export function BudgetStatus({ snapshot }: { snapshot: BudgetSnapshot }) {
  const fy = monthYear(snapshot.horizon.start);
  const locked = snapshot.lockedAt ? monthLabel(snapshot.lockedAt) : "—";
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-parchment-line bg-secondary/10 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-ember-deep">
          Budget
        </span>
        <span className="font-medium text-ink">FY{fy} Plan</span>
        <span className="text-steel">
          · the frozen baseline for variance (Base keeps moving) · locked {locked}
        </span>
      </div>
      <form action={resetBudgetAction}>
        <button
          type="submit"
          className="rounded-md border border-parchment-line px-3 py-1 text-xs font-medium text-steel transition hover:border-ember/60 hover:text-ember-deep"
          title="Re-freeze the current FY plan as the Budget"
        >
          Reset to plan
        </button>
      </form>
    </div>
  );
}
