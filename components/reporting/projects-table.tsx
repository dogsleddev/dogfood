import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMoney, type Money, type Percent } from "@/lib/types/money";
import type { Project, ProjectStatus } from "@/lib/types/source";

const fmt = (m: Money) => formatMoney(m, { compact: true });
const pct = (p: Percent) => `${Math.round((p as number) * 100)}%`;

export type StatusFilter = "all" | ProjectStatus;

const STATUS_LABEL: Record<ProjectStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  on_hold: "On hold",
};

const STATUS_BADGE: Record<ProjectStatus, string> = {
  in_progress: "bg-amber/15 text-amber-deep",
  complete: "bg-sage/15 text-sage-deep",
  not_started: "bg-secondary text-steel",
  on_hold: "bg-ember-tint text-ember-deep",
};

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

function StatusChips({ statuses, active }: { statuses: readonly ProjectStatus[]; active: StatusFilter }) {
  const href = (s: StatusFilter) =>
    s === "all" ? "/reporting/projects" : `/reporting/projects?status=${s}`;
  const chip = (s: StatusFilter, label: string) => (
    <Link
      key={s}
      href={href(s)}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs transition-colors",
        active === s ? "bg-surface font-medium text-ink shadow-sm" : "text-steel hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-parchment-line bg-secondary/40 p-0.5">
      {chip("all", "All")}
      {statuses.map((s) => chip(s, STATUS_LABEL[s]))}
    </div>
  );
}

/**
 * The Projects register (CLAUDE.md §8, layer 1) — services delivery: % complete, WIP / unbilled,
 * margin. Reads `listProjects` (the live services sub-ledger); implementation capacity gates SaaS
 * go-lives. The status chips filter the register; each row is one engagement.
 */
export function ProjectsTable({
  projects,
  status,
  allStatuses,
}: {
  projects: readonly Project[];
  status: StatusFilter;
  allStatuses: readonly ProjectStatus[];
}) {
  const rows = [...projects].sort((a, b) => b.contractValue.minor - a.contractValue.minor);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-steel">
          <span className="font-medium text-ink">{rows.length}</span>{" "}
          {status === "all" ? "projects" : STATUS_LABEL[status].toLowerCase()}
        </div>
        <StatusChips statuses={allStatuses} active={status} />
      </div>

      <div className="max-h-[600px] overflow-y-auto rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Project</TH>
              <TH>Status</TH>
              <TH right>% Complete</TH>
              <TH right>Contract value</TH>
              <TH right>WIP / unbilled</TH>
              <TH right>Margin</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-parchment-line/60 hover:bg-ember-tint/40">
                <td className="px-3 py-1.5 text-ink">{p.name}</td>
                <td className="px-3 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", STATUS_BADGE[p.status])}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">{pct(p.pctComplete)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fmt(p.contractValue)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-steel">{fmt(p.wip)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{pct(p.marginPct)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-steel">
                  No projects for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
