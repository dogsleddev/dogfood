import { listRenewals, listCustomers } from "@/lib/queries";
import { RenewalCards } from "@/components/sales/renewal-cards";
import { RenewalsTable, STATUS_VALUES, type StatusFilter } from "@/components/sales/renewals-table";
import type { RenewalStatus } from "@/lib/types/source";

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status: StatusFilter = STATUS_VALUES.includes(rawStatus as RenewalStatus)
    ? (rawStatus as StatusFilter)
    : "all";

  const [renewals, customers] = await Promise.all([listRenewals(), listCustomers()]);
  const customerNames = new Map(customers.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Sales · Layer 1</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Renewals</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The retention motion — the forward worklist that defends the contracted base. Each renewal
          is one contract coming due, with the ARR up for renewal and its outcome (renewed, expanded,
          contracted, or churned). The open book is the work ahead; the resolved book is the gross
          dollar retention that flows into NRR. Customers join to the same accounts the Customers
          register reports.
        </p>
      </header>

      <div className="mb-8">
        <RenewalCards renewals={renewals} />
      </div>

      <RenewalsTable renewals={renewals} customerNames={customerNames} status={status} />
    </div>
  );
}
