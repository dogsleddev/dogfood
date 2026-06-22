import { getPrepaidsForecast } from "@/lib/queries";
import { month } from "@/lib/types/period";
import { PrepaidsForecastCards } from "@/components/forecasts/prepaids-forecast-cards";
import { PrepaidsForecastTable } from "@/components/forecasts/prepaids-forecast-table";

const PERIOD = month(2026, 6);

export default async function PrepaidsBudgetPage() {
  const lines = await getPrepaidsForecast(PERIOD);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · Balance sheet drivers · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Prepaids Budget</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          Prepaid amortization (§8). The closing balance is the seed&apos;s prepaid series, so it reads
          the same source as the Balance Sheet Prepaid Expenses line; amortization is the straight-line
          run-off of the prior balance and additions are backed out as the plug, so balance = prior +
          additions − amortization ties exactly by construction. A deep drill target, not a dashboard tile.
        </p>
      </header>

      <div className="mb-8">
        <PrepaidsForecastCards lines={lines} currentPeriod={PERIOD} />
      </div>

      <h2 className="mb-3 font-heading text-xl text-ink">Monthly prepaids schedule</h2>
      <PrepaidsForecastTable lines={lines} currentPeriod={PERIOD} />
    </div>
  );
}
