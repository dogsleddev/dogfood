import { getPnL, getMonthlyPnL, getMetricSet, getBudget } from "@/lib/queries";
import { month } from "@/lib/types/period";
import type { PnLLineId } from "@/lib/types/statements";
import type { MetricId } from "@/lib/types/common";
import type { MetricValue } from "@/lib/types/metrics";
import { cn } from "@/lib/utils";
import { PnlTable } from "@/components/statements/pnl-table";
import { InspectPane } from "@/components/statements/inspect-pane";
import { MonthlyPnlTable } from "@/components/statements/monthly-pnl-table";
import { StatementViewToggle } from "@/components/statements/view-toggle";
import { BudgetStatus } from "@/components/statements/budget-status";
import { PnlCharts } from "@/components/statements/pnl-charts";

const PERIOD = month(2026, 6);

/** Headline KPIs shown under the monthly board view (catalog order preserved). */
const FOOTER_KPIS: readonly MetricId[] = [
  "revenue",
  "growth_rate",
  "gross_margin_pct",
  "net_margin_pct",
  "nrr",
  "rule_of_40",
  "magic_number",
  "runway",
].map((s) => s as MetricId);

export default async function ForecastedPnlPage({
  searchParams,
}: {
  searchParams: Promise<{ inspect?: string; view?: string }>;
}) {
  const { inspect, view } = await searchParams;
  const monthly = view === "monthly";

  return (
    <div className={cn("mx-auto px-8 py-8", monthly ? "max-w-[1400px]" : "max-w-6xl")}>
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Financial Statements · Layer 3
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Forecasted P&amp;L</h1>
          <div className="flex items-center gap-4">
            <StatementViewToggle base="/statements/pnl" monthly={monthly} />
            <span className="text-sm text-steel">FY2026 · as of June 2026</span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-steel">
          {monthly
            ? "Every P&L line spread across the months of FY2026 — actuals through May, June in close, Jul–Dec forecast. Each line's Total reconciles to the Forecasted P&L (leaf lines to the cent, subtotals within rounding); KPIs below read the metric set."
            : "Budget · Actual · Variance · Forecast. Tap any number to peek its lineage in the pane — actual months open the register, forecast months open the driver (§6). Reads the seed; subtotals foot and net income ties to the cash flow by construction."}
        </p>
      </header>

      <PnlCharts period={PERIOD} />

      {monthly ? (
        <MonthlyView />
      ) : (
        <FyView inspect={inspect} />
      )}
    </div>
  );
}

async function MonthlyView() {
  const [pnl, metrics] = await Promise.all([getMonthlyPnL(PERIOD), getMetricSet(PERIOD)]);
  const byId = new Map(metrics.map((m) => [m.id, m] as const));
  const kpis = FOOTER_KPIS.map((id) => byId.get(id)).filter((v): v is MetricValue => v !== undefined);
  return <MonthlyPnlTable pnl={pnl} kpis={kpis} />;
}

async function FyView({ inspect }: { inspect?: string }) {
  const [pnl, budget] = await Promise.all([getPnL(PERIOD), getBudget(PERIOD)]);
  const inspectId = (inspect && pnl.lines.some((l) => l.id === inspect) ? inspect : undefined) as
    | PnLLineId
    | undefined;
  return (
    <div>
      <BudgetStatus snapshot={budget} />
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <PnlTable pnl={pnl} inspect={inspectId} />
        </div>
        {inspectId && <InspectPane pnl={pnl} lineId={inspectId} />}
      </div>
    </div>
  );
}
