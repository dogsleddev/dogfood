import { getExpenseForecast, listExpenseGroups } from "@/lib/queries";
import { month } from "@/lib/types/period";
import { ExpenseForecastCards } from "@/components/forecasts/expense-forecast-cards";
import { ExpenseForecastTable } from "@/components/forecasts/expense-forecast-table";

const PERIOD = month(2026, 6);

export default async function ExpenseForecastPage() {
  const [lines, groups] = await Promise.all([getExpenseForecast(PERIOD), listExpenseGroups()]);

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · P&amp;L drivers · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Expense Forecast</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          Non-payroll OpEx only, by group (§8). The group set is config-driven — membership (GL account
          → group) is owned by Account Mapping, the label and order by Settings — so a group defined
          upstream simply appears here. Payroll and Cost of Revenue live in their own drivers; the sum
          of these groups per month equals the P&amp;L non-payroll OpEx lines by construction. Open any
          group for its detail.
        </p>
      </header>

      <div className="mb-8">
        <ExpenseForecastCards lines={lines} groups={groups} />
      </div>

      <h2 className="mb-3 font-heading text-xl text-ink">Monthly forecast by group</h2>
      <ExpenseForecastTable lines={lines} groups={groups} />
    </div>
  );
}
