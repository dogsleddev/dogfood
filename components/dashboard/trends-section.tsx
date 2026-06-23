import { getMonthlyPnL, getMonthlyBalanceSheet, getMonthlyCashFlow } from "@/lib/queries";
import type { Month } from "@/lib/types/period";
import { usd, formatMoney } from "@/lib/types/money";
import { ChartCard, LegendDot } from "./charts/chart-card";
import { MonthlyBarChart, type BarMonth } from "./charts/monthly-bar-chart";
import { MonthlyLineChart } from "./charts/monthly-line-chart";
import { CHART } from "./charts/palette";

const axisMoney = (n: number) => formatMoney(usd(n), { compact: true });
const axisPct = (n: number) => `${(n * 100).toFixed(0)}%`;
const valuePct = (n: number) => `${(n * 100).toFixed(1)}%`;
const major = (line?: { monthly: readonly { minor: number }[] }) => (line?.monthly ?? []).map((x) => x.minor / 100);

/**
 * Dashboard "Trends" band (CLAUDE.md §5 layer-5 cockpit) — month-across charts of the financials,
 * each reading the same monthly statement queries the statements do (one source, two callers), so
 * every figure ties out. The actual → forecast split is banded on every chart (Dogfood's living
 * forecast): solid through May, the in-close month dashed, forecast lightened.
 */
export async function TrendsSection({ period }: { period: Month }) {
  const [pnl, bs, cf] = await Promise.all([
    getMonthlyPnL(period),
    getMonthlyBalanceSheet(period),
    getMonthlyCashFlow(period),
  ]);

  const months: BarMonth[] = pnl.months.map((c) => ({ label: c.label, status: c.status }));
  const pl = (id: string) => pnl.lines.find((l) => l.id === id);
  const sub = pl("subscription");
  const svc = pl("services");
  const rev = pl("total_revenue");
  const gp = pl("gross_profit");
  const ni = pl("net_income");
  const cash = bs.lines.find((l) => l.id === "cash");
  const ocf = cf.lines.find((l) => l.id === "operating_cash_flow");

  const revM = major(rev);
  const gpM = major(gp);
  const grossMargin = months.map((_, i) => (revM[i] ? gpM[i] / revM[i] : 0));

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="size-2 rounded-full bg-ember" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-steel">Trends · FY2026</h2>
      </div>

      <div className="space-y-3">
        {/* Hero — revenue by stream */}
        <ChartCard
          title="Revenue by stream"
          subtitle="Subscription + Services, recognized monthly — actual through May, then forecast"
          legend={
            <>
              <LegendDot color={CHART.ember} label="Subscription" />
              <LegendDot color={CHART.amber} label="Services" />
              <LegendDot color={CHART.steel} label="forecast (lighter)" muted />
            </>
          }
          footnote="Monthly recognized revenue ties to the Forecasted P&L by construction."
        >
          <MonthlyBarChart
            months={months}
            series={[
              { key: "sub", label: "Subscription", color: CHART.ember, values: major(sub) },
              { key: "svc", label: "Services", color: CHART.amber, values: major(svc) },
            ]}
            height={240}
            formatValue={(n) => formatMoney(usd(n), { compact: true })}
            formatAxis={axisMoney}
          />
        </ChartCard>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Net income */}
          <ChartCard
            title="Net income · monthly"
            subtitle="GAAP net income per month (a planned, capital-efficient loss)"
            footnote="Σ months ties to the P&L Net Income line."
          >
            <MonthlyBarChart
              months={months}
              series={[{ key: "ni", label: "Net income", color: CHART.emberDeep, values: major(ni) }]}
              height={188}
              formatValue={(n) => formatMoney(usd(n), { compact: true })}
              formatAxis={axisMoney}
            />
          </ChartCard>

          {/* Cash on hand */}
          <ChartCard
            title="Cash on hand"
            subtitle="Month-end cash balance — the Series B raise, then ~49 months of runway"
            legend={<LegendDot color={CHART.sageDeep} label="Cash" />}
            footnote="Reads the Balance Sheet cash line each month."
          >
            <MonthlyLineChart
              id="cash"
              months={months}
              series={[{ key: "cash", label: "Cash", color: CHART.sageDeep, values: major(cash) }]}
              area
              height={188}
              formatValue={(n) => formatMoney(usd(n), { compact: true })}
              formatAxis={axisMoney}
            />
          </ChartCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* Gross margin % */}
          <ChartCard
            title="Gross margin %"
            subtitle="Gross profit ÷ revenue, widening as subscription scales"
            legend={<LegendDot color={CHART.emberDeep} label="Gross margin" />}
            footnote="Gross profit and revenue both read the monthly P&L."
          >
            <MonthlyLineChart
              id="gm"
              months={months}
              series={[{ key: "gm", label: "Gross margin", color: CHART.emberDeep, values: grossMargin }]}
              kind="percent"
              height={188}
              formatValue={valuePct}
              formatAxis={axisPct}
            />
          </ChartCard>

          {/* Operating cash flow */}
          <ChartCard
            title="Operating cash flow · monthly"
            subtitle="Annual-prepay billings generate cash as the book grows"
            footnote="Reads the monthly Cash Flow operating subtotal."
          >
            <MonthlyBarChart
              months={months}
              series={[{ key: "ocf", label: "Operating cash flow", color: CHART.sageDeep, values: major(ocf) }]}
              height={188}
              formatValue={(n) => formatMoney(usd(n), { compact: true })}
              formatAxis={axisMoney}
            />
          </ChartCard>
        </div>
      </div>
    </section>
  );
}
