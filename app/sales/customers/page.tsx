import { listCustomers } from "@/lib/queries";
import { CustomerCards } from "@/components/sales/customer-cards";
import { CustomersTable, type StatusFilter } from "@/components/sales/customers-table";

const STATUS_VALUES: readonly StatusFilter[] = ["active", "churned"];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status: StatusFilter = STATUS_VALUES.includes(rawStatus as StatusFilter)
    ? (rawStatus as StatusFilter)
    : "all";

  const customers = await listCustomers();

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Sales · Layer 1</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Customers</h1>
          <span className="text-sm text-steel">FY2026 · run-rate book</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The accounts behind the ARR. The customer register plus the book of business: run-rate ARR
          and logo counts, the active book by segment, and the new-logo acquisition ramp by cohort.
          Run-rate ARR sums the active book to the exit run-rate by construction, the same book the
          Contracts register and subscription schedule report. The Dashboard ARR tile shows the
          point-in-time June balance.
        </p>
      </header>

      <div className="mb-8">
        <CustomerCards customers={customers} />
      </div>

      <CustomersTable customers={customers} status={status} />
    </div>
  );
}
