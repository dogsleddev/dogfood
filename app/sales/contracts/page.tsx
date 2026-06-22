import { listContracts, getBookings, getDeferredWaterfall, getContractedRevenue } from "@/lib/queries";
import { month } from "@/lib/types/period";
import { ContractCards } from "@/components/sales/contract-cards";
import { ContractsTable, type StatusFilter } from "@/components/sales/contracts-table";

const PERIOD = month(2026, 6);

const STATUS_VALUES: readonly StatusFilter[] = ["active", "pending", "churned"];

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status: StatusFilter = STATUS_VALUES.includes(rawStatus as StatusFilter)
    ? (rawStatus as StatusFilter)
    : "all";

  const [contracts, bookings, deferred, contracted] = await Promise.all([
    listContracts(),
    getBookings(PERIOD),
    getDeferredWaterfall(PERIOD),
    getContractedRevenue(PERIOD),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Sales · Layer 1</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Contracts</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The 606 / deferred / AR pivot. The signed-agreement register plus three views that read the
          same source: period bookings (ΔARR), the deferred-revenue waterfall, and the contracted-revenue
          (RPO) bridge. Each ties to the subscription schedule and the Balance Sheet by construction.
        </p>
      </header>

      <div className="mb-8">
        <ContractCards bookings={bookings} deferred={deferred} contracted={contracted} />
      </div>

      <ContractsTable contracts={contracts} status={status} />
    </div>
  );
}
