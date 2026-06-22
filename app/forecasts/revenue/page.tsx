import { getRevenueForecast, getDeferredWaterfall, getContractedRevenue } from "@/lib/queries";
import { month } from "@/lib/types/period";
import { RevenueForecastCards } from "@/components/forecasts/revenue-forecast-cards";
import { RevenueForecastTable } from "@/components/forecasts/revenue-forecast-table";

const PERIOD = month(2026, 6);

export default async function RevenueForecastPage() {
  const [lines, deferred, contracted] = await Promise.all([
    getRevenueForecast(PERIOD),
    getDeferredWaterfall(PERIOD),
    getContractedRevenue(PERIOD),
  ]);

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · P&amp;L drivers · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Revenue Forecast</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The revenue driver that generates the forecast (§8). Subscription = contracted (the signed
          book read from Contracts) + a new-business / retention assumption; services = capacity-driven.
          The contracted-vs-new wedge opens only in the forecast tail — actuals through May are all
          contracted. Each stream Total is the authoritative recognized series, so it reconciles to the
          P&amp;L revenue lines by month, and the deferred waterfall ties to the Balance Sheet.
        </p>
      </header>

      <div className="mb-8">
        <RevenueForecastCards lines={lines} deferred={deferred} contracted={contracted} />
      </div>

      <h2 className="mb-3 font-heading text-xl text-ink">Monthly forecast by stream</h2>
      <RevenueForecastTable lines={lines} />
    </div>
  );
}
