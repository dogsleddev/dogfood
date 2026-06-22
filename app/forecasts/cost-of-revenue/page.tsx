import { getCostOfRevenue, getRevenueForecast } from "@/lib/queries";
import { month } from "@/lib/types/period";
import { CostOfRevenueCards } from "@/components/forecasts/cost-of-revenue-cards";
import { CostOfRevenueTable } from "@/components/forecasts/cost-of-revenue-table";

const PERIOD = month(2026, 6);

export default async function CostOfRevenuePage() {
  const [lines, subLines, svcLines, revLines] = await Promise.all([
    getCostOfRevenue(PERIOD),
    getCostOfRevenue(PERIOD, { stream: "subscription" }),
    getCostOfRevenue(PERIOD, { stream: "services" }),
    getRevenueForecast(PERIOD),
  ]);

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · P&amp;L drivers · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Cost of Revenue</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          An <span className="font-medium text-ink">assembled</span> coupled driver (§8), not a standalone
          input. Cost of Revenue = Direct Payroll (read from Personnel&apos;s Direct-function departments) +
          the non-employee cost-to-serve, a rate × revenue per stream (subscription hosting / infra,
          services pass-through). The rate is the only new input here — what the Direct cost scenario lever
          perturbs. Direct Payroll + Non-employee === the seed Total Cost of Revenue, so this reconciles to
          the P&amp;L Total Cost of Revenue line and the Gross Margin % tile by construction.
        </p>
      </header>

      <div className="mb-8">
        <CostOfRevenueCards lines={lines} subLines={subLines} svcLines={svcLines} revLines={revLines} />
      </div>

      <h2 className="mb-3 font-heading text-xl text-ink">Monthly cost of revenue &amp; gross margin</h2>
      <CostOfRevenueTable lines={lines} subLines={subLines} svcLines={svcLines} revLines={revLines} />
    </div>
  );
}
