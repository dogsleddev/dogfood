import { notFound } from "next/navigation";
import { getExpenseForecast } from "@/lib/queries";
import { month, monthIndex, type Month } from "@/lib/types/period";
import { SEED_EXPENSE_GROUPS, PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import type { ExpenseGroupId } from "@/lib/types/common";
import { cn } from "@/lib/utils";
import { ExpenseGroupCards } from "@/components/forecasts/expense-group-cards";
import { ExpenseAccountTable } from "@/components/forecasts/expense-account-table";
import { ExpenseVendorBreakdown } from "@/components/forecasts/expense-vendor-breakdown";

const PERIOD = month(2026, 6);
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function ExpenseGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ month?: string; account?: string }>;
}) {
  const { group } = await params;
  const { month: monthParam, account: accountParam } = await searchParams;
  const def = SEED_EXPENSE_GROUPS.find((g) => g.id === group);
  // Validate the group id against the locked OpEx group set (Account Mapping owns membership).
  if (!def) notFound();

  const [groupLines, accountLines, vendorLines] = await Promise.all([
    getExpenseForecast(PERIOD, { groupId: group as ExpenseGroupId }),
    getExpenseForecast(PERIOD, { groupId: group as ExpenseGroupId, breakdown: "account" }),
    getExpenseForecast(PERIOD, { groupId: group as ExpenseGroupId, breakdown: "vendor" }),
  ]);

  const months: Month[] = Array.from(new Set(accountLines.map((l) => l.period))).sort() as Month[];
  // Focus month for the vendor breakdown: ?month= when valid, else the first true FORECAST month (the
  // month after the in-close month, so the default lands on the forward plan — e.g. Jul, not in-close Jun).
  const closeThrough = PLACEHOLDER_SETTINGS.closeThrough;
  const forecastFrom = PLACEHOLDER_SETTINGS.inCloseMonth ?? closeThrough;
  const firstForecast = months.find((m) => m > forecastFrom) ?? months[months.length - 1] ?? PERIOD;
  const focusMonth: Month = monthParam && months.includes(monthParam as Month) ? (monthParam as Month) : firstForecast;
  const focusVendorLines = vendorLines.filter((l) => l.period === focusMonth);
  const isClosed = focusMonth <= closeThrough;

  const functionLabel: Record<string, string> = {
    direct: "Direct (Cost of Revenue)",
    rnd: "R&D",
    sm: "Sales & Marketing",
    ga: "G&A",
  };
  const qp = (m: Month) => `?month=${m}${accountParam ? `&account=${accountParam}` : ""}`;

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Forecasts · P&amp;L drivers · Expense Forecast · Layer 2
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">{def.label}</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          A non-payroll operating-expense group (§8), drilled to its GL sub-accounts and the vendors
          under each. Membership and classification are owned by Account Mapping ({def.classification === "cost_of_revenue" ? "Cost of Revenue" : "Operating Expense"} ·{" "}
          {functionLabel[def.function] ?? def.function} function). Forecast months show recurring vendors
          at a stable run-rate plus an &ldquo;Other&rdquo; line; closed months show the real bills. Every
          level sums into the group total and reconciles to the P&amp;L non-payroll OpEx line by construction.
        </p>
      </header>

      <div className="mb-8">
        <ExpenseGroupCards lines={groupLines} label={def.label} currentPeriod={PERIOD} />
      </div>

      <h2 className="mb-3 font-heading text-xl text-ink">Monthly forecast by GL account</h2>
      <div className="mb-8">
        <ExpenseAccountTable lines={accountLines} groupId={group} focusMonth={focusMonth} />
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-xl text-ink">Vendor breakdown</h2>
        <div className="flex flex-wrap gap-1">
          {months.map((m) => (
            <a
              key={m}
              href={qp(m)}
              className={cn(
                "rounded-md px-2 py-1 text-xs tabular-nums transition",
                m === focusMonth
                  ? "bg-ember text-white"
                  : "border border-parchment-line text-steel hover:border-ember/60 hover:text-ember-deep",
              )}
            >
              {MONTH_ABBR[monthIndex(m) - 1]}
            </a>
          ))}
        </div>
      </div>
      <ExpenseVendorBreakdown
        lines={focusVendorLines}
        focusMonth={focusMonth}
        isClosed={isClosed}
        focusAccountId={accountParam}
      />
    </div>
  );
}
