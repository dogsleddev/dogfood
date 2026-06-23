import { getMonthlyCashFlow, getMonthlyBalanceSheet } from "@/lib/queries";
import type { Month } from "@/lib/types/period";
import { usd, formatMoney } from "@/lib/types/money";
import { ChartCard, LegendDot } from "@/components/dashboard/charts/chart-card";
import { MonthlyBarChart, type BarMonth } from "@/components/dashboard/charts/monthly-bar-chart";
import { MonthlyLineChart } from "@/components/dashboard/charts/monthly-line-chart";
import { CHART } from "@/components/dashboard/charts/palette";

const axisMoney = (n: number) => formatMoney(usd(n), { compact: true });
const major = (line?: { monthly: readonly { minor: number }[] }) => (line?.monthly ?? []).map((x) => x.minor / 100);

/**
 * Visual band for the Cash Flow Forecast — the monthly net change in cash (the burn + the Series B
 * raise) and the resulting cash-on-hand trajectory (the runway). Reads the same monthly queries the
 * tables do (one source, two callers); actual → forecast banding matches.
 */
export async function CashFlowCharts({ period }: { period: Month }) {
  const [cf, bs] = await Promise.all([getMonthlyCashFlow(period), getMonthlyBalanceSheet(period)]);
  const months: BarMonth[] = cf.months.map((c) => ({ label: c.label, status: c.status }));
  const netChange = major(cf.lines.find((l) => l.id === "net_change_in_cash"));
  const cash = major(bs.lines.find((l) => l.id === "cash"));

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="size-2 rounded-full bg-ember" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-steel">Visualize · FY2026</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Net change in cash · monthly"
          subtitle="Cash in/out each month — the operating burn, then the Series B raise"
          footnote="Σ months ties to the Cash Flow net-change line; the running total is cash on hand."
        >
          <MonthlyBarChart
            months={months}
            series={[{ key: "net", label: "Net change in cash", color: CHART.sageDeep, values: netChange }]}
            height={210}
            formatValue={(n) => formatMoney(usd(n), { compact: true })}
            formatAxis={axisMoney}
          />
        </ChartCard>

        <ChartCard
          title="Cash on hand"
          subtitle="Month-end cash balance — the runway cushion"
          legend={<LegendDot color={CHART.sageDeep} label="Cash" />}
          footnote="Reads the Balance Sheet cash line; the net change above accumulates to this."
        >
          <MonthlyLineChart
            id="cf-cash"
            months={months}
            series={[{ key: "cash", label: "Cash", color: CHART.sageDeep, values: cash }]}
            area
            height={210}
            formatValue={(n) => formatMoney(usd(n), { compact: true })}
            formatAxis={axisMoney}
          />
        </ChartCard>
      </div>
    </section>
  );
}
