import { getBalanceSheet, getMonthlyBalanceSheet } from "@/lib/queries";
import { month } from "@/lib/types/period";
import type { BalanceSheetLineId } from "@/lib/types/statements";
import { cn } from "@/lib/utils";
import { BalanceSheetTable } from "@/components/statements/balance-sheet-table";
import { MonthlyBalanceSheetTable } from "@/components/statements/monthly-balance-sheet-table";
import { StatementInspectPane } from "@/components/statements/statement-inspect-pane";
import { StatementViewToggle } from "@/components/statements/view-toggle";
import { BS_DRILL, BS_NOTE } from "@/components/statements/bs-cf-drill";
import { addLineFluxNoteAction, resolveBsFluxNoteAction, deleteBsFluxNoteAction } from "./actions";

const PERIOD = month(2026, 6);
const ACTUAL_LABEL = "Actual · close";
const FORECAST_LABEL = "Forecast · FY26";

export default async function BalanceSheetPage({
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
          <h1 className="font-heading text-3xl text-ink">Balance Sheet</h1>
          <div className="flex items-center gap-4">
            <StatementViewToggle base="/statements/balance-sheet" monthly={monthly} />
            <span className="text-sm text-steel">FY2026 · as of June 2026</span>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-steel">
          {monthly
            ? "Every balance-sheet line at each month-end of FY2026 — actuals through May, June in close, Jul–Dec forecast. Section subtotals foot from the leaves and each line's Total is the fiscal-year-end balance; assets equal liabilities plus equity every month by construction."
            : "Point-in-time at the close (actual) and at the fiscal-year end (forecast). Tap any number to peek its lineage in the pane — actual months open the register, forecast months open the driver (§6). Reads the seed; assets equal liabilities plus equity by construction."}
        </p>
      </header>

      {monthly ? <MonthlyView /> : <FyView inspect={inspect} />}
    </div>
  );
}

async function MonthlyView() {
  const bs = await getMonthlyBalanceSheet(PERIOD);
  return <MonthlyBalanceSheetTable bs={bs} />;
}

async function FyView({ inspect }: { inspect?: string }) {
  const bs = await getBalanceSheet(PERIOD);
  const inspectId = (inspect && bs.lines.some((l) => l.id === inspect) ? inspect : undefined) as
    | BalanceSheetLineId
    | undefined;
  const line = inspectId ? bs.lines.find((l) => l.id === inspectId) : undefined;
  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1">
        <BalanceSheetTable bs={bs} inspect={inspectId} actualLabel={ACTUAL_LABEL} forecastLabel={FORECAST_LABEL} />
      </div>
      {line && (
        <StatementInspectPane
          lineId={line.id}
          label={line.label}
          actualLabel={ACTUAL_LABEL}
          forecastLabel={FORECAST_LABEL}
          actual={line.values.actual}
          forecast={line.values.forecast}
          drill={BS_DRILL[line.id]}
          note={BS_NOTE[line.id]}
          closeHref="/statements/balance-sheet"
          fluxActions={{ add: addLineFluxNoteAction, resolve: resolveBsFluxNoteAction, remove: deleteBsFluxNoteAction }}
        />
      )}
    </div>
  );
}
