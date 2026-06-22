import { getArForecast } from "@/lib/queries";
import { month } from "@/lib/types/period";
import { ArForecastCards } from "@/components/forecasts/ar-forecast-cards";
import { ArForecastTable } from "@/components/forecasts/ar-forecast-table";

const PERIOD = month(2026, 6);

export default async function ArForecastPage() {
  const lines = await getArForecast(PERIOD);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">AR Forecast</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          DSO-driven receivables. The balance is the seed&apos;s AR series (DSO ÷ 365 × trailing
          billings) spread across the fiscal year, so it reads the same source as the Balance Sheet AR
          line and the month-over-month change equals the cash-flow change-in-AR by construction.
        </p>
      </header>

      <div className="mb-8">
        <ArForecastCards lines={lines} currentPeriod={PERIOD} />
      </div>

      <ArForecastTable lines={lines} currentPeriod={PERIOD} />
    </div>
  );
}
