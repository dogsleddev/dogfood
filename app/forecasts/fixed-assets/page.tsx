import { getFixedAssetForecast } from "@/lib/queries";
import { month } from "@/lib/types/period";
import { FixedAssetsCards } from "@/components/forecasts/fixed-assets-cards";
import { FixedAssetsTable } from "@/components/forecasts/fixed-assets-table";

const PERIOD = month(2026, 6);

export default async function FixedAssetBudgetPage() {
  const lines = await getFixedAssetForecast(PERIOD);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · Balance sheet drivers · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Fixed Asset Budget</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The capex + depreciation schedule (§8). Each month adds capital expenditure to gross PP&amp;E and
          runs off straight-line depreciation; net book value is gross less accumulated depreciation. The
          net book value reads the seed&apos;s fixed-asset series, so it equals the Balance Sheet Fixed
          Assets line, and the monthly depreciation equals the P&amp;L Depreciation &amp; Amortization line
          by construction.
        </p>
      </header>

      <div className="mb-8">
        <FixedAssetsCards lines={lines} currentPeriod={PERIOD} />
      </div>

      <h2 className="mb-3 font-heading text-xl text-ink">Monthly capex &amp; depreciation schedule</h2>
      <FixedAssetsTable lines={lines} currentPeriod={PERIOD} />
    </div>
  );
}
