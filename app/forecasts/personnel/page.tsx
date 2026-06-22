import { getPersonnelForecast } from "@/lib/queries";
import { month } from "@/lib/types/period";
import type { CostFunction } from "@/lib/types/common";
import { SEED_DEPARTMENTS } from "@/lib/target/placeholder";
import { PersonnelForecastCards } from "@/components/forecasts/personnel-forecast-cards";
import {
  PersonnelForecastTable,
  type PersonnelDept,
} from "@/components/forecasts/personnel-forecast-table";

const PERIOD = month(2026, 6);
const FUNCTIONS: CostFunction[] = ["direct", "rnd", "sm", "ga"];

export default async function PersonnelPage() {
  const [total, byFunctionLines, deptLines] = await Promise.all([
    getPersonnelForecast(PERIOD),
    Promise.all(FUNCTIONS.map((fn) => getPersonnelForecast(PERIOD, { function: fn }))),
    Promise.all(
      SEED_DEPARTMENTS.map((d) => getPersonnelForecast(PERIOD, { departmentId: d.id })),
    ),
  ]);

  const byFunction = FUNCTIONS.map((fn, i) => ({ function: fn, lines: byFunctionLines[i] }));

  const departments: PersonnelDept[] = SEED_DEPARTMENTS.map((d, i) => ({
    id: d.id,
    name: d.name,
    function: d.function,
    lines: deptLines[i],
  }));

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · P&amp;L drivers · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Personnel</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The payroll driver (§8) — base comp by department and function tag (Direct / R&amp;D /
          S&amp;M / G&amp;A). You input by nature and department; you present and measure by function.
          Direct-function departments roll into Cost of Revenue; the rest land in the P&amp;L&apos;s
          single Indirect Payroll line. Comp here is base only — the burden (payroll taxes, medical,
          benefits) lives in the Employee Expenses OpEx group, so the function totals reconcile to the
          payroll lines on the statements by construction.
        </p>
      </header>

      <div className="mb-8">
        <PersonnelForecastCards total={total} byFunction={byFunction} currentPeriod={PERIOD} />
      </div>

      <h2 className="mb-3 font-heading text-xl text-ink">Monthly base comp by department</h2>
      <PersonnelForecastTable departments={departments} />
    </div>
  );
}
