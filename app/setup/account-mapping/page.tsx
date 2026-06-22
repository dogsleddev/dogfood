import { getAccountMap, listExpenseGroups, listFluxNotes, repointTargetsFor, listAccountOverrides } from "@/lib/queries";
import { CHART_OF_ACCOUNTS } from "@/lib/seed/gl";
import { PLACEHOLDER_SETTINGS } from "@/lib/target/placeholder";
import { AccountMappingTable } from "@/components/setup/account-mapping-table";
import { AccountFluxPanel } from "@/components/setup/account-flux-panel";
import { AccountEditPanel } from "@/components/setup/account-edit-panel";
import { ExpenseGroupsCards } from "@/components/setup/expense-groups-cards";

export default async function AccountMappingPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; edit?: string }>;
}) {
  const { note: rawNote, edit: rawEdit } = await searchParams;
  const [accounts, groups, overrides] = await Promise.all([
    getAccountMap(),
    listExpenseGroups(),
    listAccountOverrides(),
  ]);

  // Flux notes anchor to the last CLOSED month (where flux happens), like the statement panes.
  const period = PLACEHOLDER_SETTINGS.closeThrough;
  const periodNotes = await listFluxNotes({ period });
  const notedCodes = new Set(periodNotes.map((n) => n.accountCode).filter((x): x is string => !!x));
  const editedCodes = new Set(overrides.map((o) => o.code));

  // The edit panel and the flux note card share the right-hand slot and are mutually exclusive; edit wins.
  const editAccount = rawEdit ? accounts.find((a) => a.code === rawEdit) : undefined;
  const baseAccount = editAccount ? CHART_OF_ACCOUNTS.find((a) => a.code === editAccount.code) : undefined;
  const targets = editAccount ? await repointTargetsFor(editAccount.code) : [];
  const selectedNote = !editAccount && rawNote ? accounts.find((a) => a.code === rawNote) : undefined;
  const asideOpen = !!(editAccount && baseAccount) || !!selectedNote;

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">
          Setup · Config
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Account Mapping</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The load-bearing account → statement-line map, read by the statement engine and every
          drill-down. Each GL account maps to one statement line; expense accounts also carry the typed
          classification (CoR / OpEx) and function sub-role that the metrics and scenario levers reason
          about. Re-point a mapping and the statement Actual columns move.
        </p>
      </header>

      <section className="mb-10">
        <div className={asideOpen ? "grid items-start gap-6 lg:grid-cols-[1fr_22rem]" : ""}>
          <AccountMappingTable
            accounts={accounts}
            notedCodes={notedCodes}
            editedCodes={editedCodes}
            selectedCode={editAccount?.code ?? selectedNote?.code}
          />
          {editAccount && baseAccount && (
            <AccountEditPanel account={editAccount} baseAccount={baseAccount} targets={targets} closeHref="/setup/account-mapping" />
          )}
          {selectedNote && <AccountFluxPanel account={selectedNote} closeHref="/setup/account-mapping" />}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-xl text-ink">Expense groups</h2>
        <p className="mb-4 max-w-3xl text-sm text-steel">
          The config-driven group set. Membership comes from Account Mapping above; Settings owns the
          group set, labels, and order. Each group carries a typed classification and function sub-role.
        </p>
        <ExpenseGroupsCards groups={groups} />
      </section>
    </div>
  );
}
