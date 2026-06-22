import { notFound } from "next/navigation";
import { getExpenseForecast } from "@/lib/queries";
import { month } from "@/lib/types/period";
import { SEED_EXPENSE_GROUPS } from "@/lib/target/placeholder";
import type { ExpenseGroupId } from "@/lib/types/common";
import { ExpenseGroupCards } from "@/components/forecasts/expense-group-cards";
import { ExpenseGroupTable } from "@/components/forecasts/expense-group-table";

const PERIOD = month(2026, 6);

export default async function ExpenseGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const def = SEED_EXPENSE_GROUPS.find((g) => g.id === group);
  // Validate the group id against the locked OpEx group set (Account Mapping owns membership).
  if (!def) notFound();

  const lines = await getExpenseForecast(PERIOD, { groupId: group as ExpenseGroupId });

  const functionLabel: Record<string, string> = {
    direct: "Direct (Cost of Revenue)",
    rnd: "R&D",
    sm: "Sales & Marketing",
    ga: "G&A",
  };

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · P&amp;L drivers · Expense Forecast · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">{def.label}</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          A non-payroll operating-expense group (§8). Membership (GL account → group) is owned by
          Account Mapping; the group label and order by Settings; the classification is typed
          ({def.classification === "cost_of_revenue" ? "Cost of Revenue" : "Operating Expense"} ·
          {" "}
          {functionLabel[def.function] ?? def.function} function). This is the only group&apos;s
          slice; each monthly amount is read from the live Expense Forecast series, so it sums into the
          all-groups OpEx total and reconciles to the P&amp;L non-payroll OpEx lines by construction.
        </p>
      </header>

      <div className="mb-8">
        <ExpenseGroupCards lines={lines} label={def.label} currentPeriod={PERIOD} />
      </div>

      <h2 className="mb-3 font-heading text-xl text-ink">Monthly forecast</h2>
      <ExpenseGroupTable lines={lines} currentPeriod={PERIOD} />
    </div>
  );
}
