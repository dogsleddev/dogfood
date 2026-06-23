import { getMonthlyPnL } from "@/lib/queries";
import type { Month } from "@/lib/types/period";
import { usd, formatMoney } from "@/lib/types/money";
import { ChartCard, LegendDot } from "@/components/dashboard/charts/chart-card";
import { MonthlyLineChart } from "@/components/dashboard/charts/monthly-line-chart";
import type { BarMonth } from "@/components/dashboard/charts/monthly-bar-chart";
import { CHART } from "@/components/dashboard/charts/palette";

const axisMoney = (n: number) => formatMoney(usd(n), { compact: true });
const axisPct = (n: number) => `${(n * 100).toFixed(0)}%`;
const valuePct = (n: number) => `${(n * 100).toFixed(1)}%`;
const major = (line?: { monthly: readonly { minor: number }[] }) => (line?.monthly ?? []).map((x) => x.minor / 100);

/**
 * Visual band for the Forecasted P&L — the monthly cascade + margins, reading the same monthly P&L
 * query the table does (one source, two callers). Actual → forecast banding matches the table.
 */
export async function PnlCharts({ period }: { period: Month }) {
  const pnl = await getMonthlyPnL(period);
  const months: BarMonth[] = pnl.months.map((c) => ({ label: c.label, status: c.status }));
  const pl = (id: string) => pnl.lines.find((l) => l.id === id);
  const rev = major(pl("total_revenue"));
  const gp = major(pl("gross_profit"));
  const oi = major(pl("operating_income"));
  const ni = major(pl("net_income"));
  const ratio = (num: number[]) => months.map((_, i) => (rev[i] ? num[i] / rev[i] : 0));

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="size-2 rounded-full bg-ember" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-steel">Visualize · FY2026</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Revenue → Gross profit → Net income"
          subtitle="The monthly P&L cascade — actual through May, then forecast"
          legend={
            <>
              <LegendDot color={CHART.ember} label="Revenue" />
              <LegendDot color={CHART.sageDeep} label="Gross profit" />
              <LegendDot color={CHART.emberDeep} label="Net income" />
            </>
          }
          footnote="Each line reads the monthly P&L; Σ months ties to the FY column."
        >
          <MonthlyLineChart
            id="pnl-cascade"
            months={months}
            series={[
              { key: "rev", label: "Revenue", color: CHART.ember, values: rev },
              { key: "gp", label: "Gross profit", color: CHART.sageDeep, values: gp },
              { key: "ni", label: "Net income", color: CHART.emberDeep, values: ni },
            ]}
            height={210}
            formatValue={(n) => formatMoney(usd(n), { compact: true })}
            formatAxis={axisMoney}
          />
        </ChartCard>

        <ChartCard
          title="Margins"
          subtitle="Gross / operating / net margin %, month by month"
          legend={
            <>
              <LegendDot color={CHART.sageDeep} label="Gross" />
              <LegendDot color={CHART.amberDeep} label="Operating" />
              <LegendDot color={CHART.emberDeep} label="Net" />
            </>
          }
          footnote="Margin = the line ÷ revenue each month; widens as subscription scales."
        >
          <MonthlyLineChart
            id="pnl-margins"
            months={months}
            kind="percent"
            series={[
              { key: "gm", label: "Gross margin", color: CHART.sageDeep, values: ratio(gp) },
              { key: "om", label: "Operating margin", color: CHART.amberDeep, values: ratio(oi) },
              { key: "nm", label: "Net margin", color: CHART.emberDeep, values: ratio(ni) },
            ]}
            height={210}
            formatValue={valuePct}
            formatAxis={axisPct}
          />
        </ChartCard>
      </div>
    </section>
  );
}
