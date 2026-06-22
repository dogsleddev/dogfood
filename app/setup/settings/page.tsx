import { getDataStore } from "@/lib/datastore";
import type { CostFunction } from "@/lib/types/common";
import { FirmCards, FunctionPill, FUNCTION_LABELS } from "@/components/setup/settings-cards";

// Display order for the function tags, so the department roster reads CoR → R&D → S&M → G&A
// (CLAUDE.md §8: Direct rolls into Cost of Revenue, the rest into the P&L).
const FUNCTION_ORDER: readonly CostFunction[] = ["direct", "rnd", "sm", "ga"];

const CLASSIFICATION_LABELS: Record<string, string> = {
  cost_of_revenue: "Cost of Revenue",
  operating_expense: "Operating Expense",
};

export default async function SettingsPage() {
  const store = getDataStore();
  const [firm, settings, departments, expenseGroups] = await Promise.all([
    store.getFirm(),
    store.getSettings(),
    store.listDepartments(),
    store.listExpenseGroups(),
  ]);

  // Group the department roster by function tag for a readable roll-up.
  const deptsByFunction = FUNCTION_ORDER.map((fn) => ({
    fn,
    rows: departments.filter((d) => d.function === fn),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Setup · Config</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Settings</h1>
          <span className="text-sm text-steel">{firm.name} · {settings.currency}</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          Firm and period configuration. Settings owns the close boundary, the department list with its
          function tags, and the expense-group set — the structure the statement engine, the metrics, and
          every drill-down read. This is the read-only view of that config.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-lg text-ink">Firm &amp; period</h2>
        <FirmCards firm={firm} settings={settings} />
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg text-ink">Departments</h2>
          <span className="text-sm text-steel">{departments.length} departments</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-parchment-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-parchment-line bg-surface-2 text-left text-xs uppercase tracking-wide text-steel">
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 font-medium">Function tag</th>
              </tr>
            </thead>
            <tbody>
              {deptsByFunction.map((group) =>
                group.rows.map((d, i) => (
                  <tr key={d.id} className="border-b border-parchment-line/60 last:border-0 bg-surface">
                    <td className="px-4 py-2.5 text-ink">{d.name}</td>
                    <td className="px-4 py-2.5">
                      {i === 0 ? (
                        <FunctionPill fn={d.function} />
                      ) : (
                        <span className="text-xs text-steel">{FUNCTION_LABELS[d.function]}</span>
                      )}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-steel">
          Direct departments roll into Cost of Revenue; the rest into the P&amp;L&apos;s single Indirect
          Payroll line (CLAUDE.md §8).
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-lg text-ink">Expense groups</h2>
          <span className="text-sm text-steel">{expenseGroups.length} groups</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-parchment-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-parchment-line bg-surface-2 text-left text-xs uppercase tracking-wide text-steel">
                <th className="px-4 py-2.5 font-medium tabular-nums">#</th>
                <th className="px-4 py-2.5 font-medium">Group</th>
                <th className="px-4 py-2.5 font-medium">Classification</th>
                <th className="px-4 py-2.5 font-medium">Function</th>
              </tr>
            </thead>
            <tbody>
              {expenseGroups.map((g) => (
                <tr key={g.id} className="border-b border-parchment-line/60 last:border-0 bg-surface">
                  <td className="px-4 py-2.5 text-steel tabular-nums">{g.order}</td>
                  <td className="px-4 py-2.5 text-ink">{g.label}</td>
                  <td className="px-4 py-2.5 text-steel">{CLASSIFICATION_LABELS[g.classification] ?? g.classification}</td>
                  <td className="px-4 py-2.5">
                    <FunctionPill fn={g.function} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-steel">
          Membership comes from Account Mapping; Settings owns the group set, labels, and order. The typed
          classification (CoR vs OpEx) drives how the statement engine places each group (CLAUDE.md §7).
        </p>
      </section>
    </div>
  );
}
