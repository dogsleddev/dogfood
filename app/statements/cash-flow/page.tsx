import { getCashFlow, getMonthlyCashFlow, getRunway } from "@/lib/queries";
import { month, monthIndex, monthYear } from "@/lib/types/period";
import { formatMoney } from "@/lib/types/money";
import type { CashFlowLineId, Runway } from "@/lib/types/statements";
import { cn } from "@/lib/utils";
import { CashFlowTable } from "@/components/statements/cash-flow-table";
import { MonthlyCashFlowTable } from "@/components/statements/monthly-cash-flow-table";
import { StatementInspectPane } from "@/components/statements/statement-inspect-pane";
import { StatementViewToggle } from "@/components/statements/view-toggle";
import { CF_DRILL, CF_NOTE } from "@/components/statements/bs-cf-drill";
import { addLineFluxNoteAction, resolveCfFluxNoteAction, deleteCfFluxNoteAction } from "./actions";

const PERIOD = month(2026, 6);
const ACTUAL_LABEL = "Actual YTD";
const FORECAST_LABEL = "Forecast FY26";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function RunwayStrip({ runway }: { runway: Runway }) {
  // Runway reads cash as-of the current (in-close) month to match the dashboard tile; label it so it
  // reconciles with the Balance Sheet's "Actual · close" cash, which is the last CLOSED month.
  const asOf = `${MONTH_ABBR[monthIndex(runway.asOf) - 1]} ${monthYear(runway.asOf)}`;
  const stats: readonly { label: string; value: string; tone?: string }[] = [
    { label: `Cash on hand · ${asOf}`, value: formatMoney(runway.cash, { compact: true }) },
    { label: "Net burn / mo (TTM)", value: formatMoney(runway.netBurn, { compact: true }), tone: "text-ember-deep" },
    {
      label: "Runway",
      value: runway.months === null ? "Cash-flow positive" : `${Math.round(runway.months)} months`,
      tone: "text-sage-deep",
    },
  ];
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-parchment-line bg-surface px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-steel">{s.label}</div>
          <div className={`mt-1 font-heading text-2xl tabular-nums ${s.tone ?? "text-ink"}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ inspect?: string; view?: string }>;
}) {
  const { inspect, view } = await searchParams;
  const monthly = view === "monthly";
  const runway = await getRunway(PERIOD);

  return (
    <div className={cn("mx-auto px-8 py-8", monthly ? "max-w-[1400px]" : "max-w-6xl")}>
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Financial Statements · Layer 3
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Cash Flow Forecast</h1>
          <div className="flex items-center gap-4">
            <StatementViewToggle base="/statements/cash-flow" monthly={monthly} />
            <span className="text-sm text-steel">FY2026 · as of June 2026</span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-steel">
          {monthly
            ? "Indirect method spread across the months of FY2026 — actuals through May, June in close, Jul–Dec forecast. Each line's Total reconciles to the Cash Flow Forecast (flows sum, working-capital deltas telescope); the net change ties to the Balance Sheet cash line by construction."
            : "Indirect method, from Net income through the working-capital deltas to the net change in cash. Tap any number to peek its driver in the pane (§6). Reads the seed; net income ties to the P&L and the net change ties to the Balance Sheet cash line by construction."}
        </p>
      </header>

      <RunwayStrip runway={runway} />

      {monthly ? <MonthlyView /> : <FyView inspect={inspect} />}
    </div>
  );
}

async function MonthlyView() {
  const cf = await getMonthlyCashFlow(PERIOD);
  return <MonthlyCashFlowTable cf={cf} />;
}

async function FyView({ inspect }: { inspect?: string }) {
  const cf = await getCashFlow(PERIOD);
  const inspectId = (inspect && cf.lines.some((l) => l.id === inspect) ? inspect : undefined) as
    | CashFlowLineId
    | undefined;
  const line = inspectId ? cf.lines.find((l) => l.id === inspectId) : undefined;
  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1">
        <CashFlowTable cf={cf} inspect={inspectId} actualLabel={ACTUAL_LABEL} forecastLabel={FORECAST_LABEL} />
      </div>
      {line && (
        <StatementInspectPane
          lineId={line.id}
          label={line.label}
          actualLabel={ACTUAL_LABEL}
          forecastLabel={FORECAST_LABEL}
          actual={line.values.actual}
          forecast={line.values.forecast}
          drill={CF_DRILL[line.id]}
          note={CF_NOTE[line.id]}
          closeHref="/statements/cash-flow"
          fluxActions={{ add: addLineFluxNoteAction, resolve: resolveCfFluxNoteAction, remove: deleteCfFluxNoteAction }}
        />
      )}
    </div>
  );
}
