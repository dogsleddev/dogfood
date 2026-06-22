import { getBalanceSheet } from "@/lib/queries";
import { month } from "@/lib/types/period";
import type { BalanceSheetLineId } from "@/lib/types/statements";
import { BalanceSheetTable } from "@/components/statements/balance-sheet-table";
import { StatementInspectPane } from "@/components/statements/statement-inspect-pane";
import { BS_DRILL, BS_NOTE } from "@/components/statements/bs-cf-drill";
import { addLineFluxNoteAction, resolveBsFluxNoteAction, deleteBsFluxNoteAction } from "./actions";

const ACTUAL_LABEL = "Actual · close";
const FORECAST_LABEL = "Forecast · FY26";

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ inspect?: string }>;
}) {
  const { inspect } = await searchParams;
  const bs = await getBalanceSheet(month(2026, 6));
  const inspectId = (inspect && bs.lines.some((l) => l.id === inspect) ? inspect : undefined) as
    | BalanceSheetLineId
    | undefined;
  const line = inspectId ? bs.lines.find((l) => l.id === inspectId) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Financial Statements · Layer 3
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Balance Sheet</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-steel">
          Point-in-time at the close (actual) and at the fiscal-year end (forecast). Tap any number to
          peek its lineage in the pane — actual months open the register, forecast months open the
          driver (§6). Reads the seed; assets equal liabilities plus equity by construction.
        </p>
      </header>

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
    </div>
  );
}
