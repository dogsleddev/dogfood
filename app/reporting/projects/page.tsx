import { listProjects, getUtilization } from "@/lib/queries";
import { month, monthLabel } from "@/lib/types/period";
import { sumMoney } from "@/lib/types/money";
import type { ProjectStatus } from "@/lib/types/source";
import { ProjectsTable, type StatusFilter } from "@/components/reporting/projects-table";
import { ProjectsCards } from "@/components/reporting/projects-cards";

// Utilization reads the services model at the last fully closed month, matching the other registers.
const PERIOD = month(2026, 5);

const STATUS_VALUES: readonly ProjectStatus[] = ["not_started", "in_progress", "complete", "on_hold"];

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status: StatusFilter = STATUS_VALUES.includes(rawStatus as ProjectStatus)
    ? (rawStatus as StatusFilter)
    : "all";

  const [allProjects, util] = await Promise.all([listProjects(), getUtilization(PERIOD)]);

  // Filter for the table; cards roll up the whole book.
  const projects = status === "all" ? allProjects : allProjects.filter((p) => p.status === status);

  // Only show status chips for statuses that actually appear in the data.
  const present = new Set(allProjects.map((p) => p.status));
  const allStatuses = STATUS_VALUES.filter((s) => present.has(s));

  const inProgress = allProjects.filter((p) => p.status === "in_progress").length;
  const complete = allProjects.filter((p) => p.status === "complete").length;
  const totalWip = sumMoney(allProjects.map((p) => p.wip));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Reporting · Layer 1</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Projects</h1>
          <span className="text-sm text-steel">{monthLabel(PERIOD)} · last closed month</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          Services delivery — % complete, WIP / unbilled, and margin per engagement. This is the source
          register the services revenue forecast reads; implementation capacity gates SaaS go-lives, so
          delivery utilization caps how fast new ARR activates.
        </p>
      </header>

      <div className="mb-8">
        <ProjectsCards
          utilization={util.utilization}
          inProgress={inProgress}
          complete={complete}
          totalProjects={allProjects.length}
          totalWip={totalWip}
        />
      </div>

      <ProjectsTable projects={projects} status={status} allStatuses={allStatuses} />
    </div>
  );
}
