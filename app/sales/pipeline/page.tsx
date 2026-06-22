import { listPipeline } from "@/lib/queries";
import type { PipelineStage } from "@/lib/types/source";
import { PipelineCards } from "@/components/sales/pipeline-cards";
import { PipelineTable, STAGE_VALUES, type StageFilter } from "@/components/sales/pipeline-table";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; owner?: string }>;
}) {
  const { stage: rawStage, owner: rawOwner } = await searchParams;
  const stage: StageFilter = STAGE_VALUES.includes(rawStage as StageFilter) ? (rawStage as StageFilter) : "all";

  // Full open book (for the summary + derived cards + the owner roster) and the filtered rows.
  const all = await listPipeline();
  const owners = [...new Set(all.map((o) => o.owner))].sort((a, b) => a.localeCompare(b));
  const owner = rawOwner && owners.includes(rawOwner) ? rawOwner : undefined;

  const rows = await listPipeline({
    byStage: stage === "all" ? undefined : (stage as PipelineStage),
    byRep: owner,
  });

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Sales · Layer 1</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Pipeline</h1>
          <span className="text-sm text-steel">FY2026 · as of June 2026</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The open-opportunity register that feeds the Revenue Forecast. Deals by stage and rep, with
          ARR, win probability, and expected close. Owners are the real Sales-function staff, so a deal
          resolves to the same person in the Staff register.
        </p>
      </header>

      <div className="mb-8">
        <PipelineCards opportunities={all} />
      </div>

      <PipelineTable all={all} rows={rows} owners={owners} stage={stage} owner={owner} />
    </div>
  );
}
