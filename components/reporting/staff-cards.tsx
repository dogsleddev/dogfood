import type { StaffMember } from "@/lib/types/source";
import type { CostFunction, DepartmentId } from "@/lib/types/common";
import { DEPT_LABEL, FUNCTION_LABEL, FUNCTION_ORDER } from "./staff-table";

function Card({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-parchment-line bg-surface p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>
      {children}
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "muted" | "total" }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${tone === "total" ? "border-t border-parchment-line/70 mt-1 pt-2" : ""}`}>
      <span className={`text-sm ${tone === "total" ? "font-medium text-ink" : "text-steel"}`}>{label}</span>
      <span className={`text-sm tabular-nums ${tone === "total" ? "font-semibold text-ink" : tone === "muted" ? "text-steel" : "text-ink"}`}>{value}</span>
    </div>
  );
}

/** Format an FTE total cleanly (whole if integer, else one decimal). */
const fte = (n: number): string => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

/**
 * Three summary views over the Staff register (CLAUDE.md §8, layer 1), derived purely from the
 * `listStaff` records that are active in `period` (no extra query): total headcount, the org by
 * department, and the functional split (Direct/CoR · R&D · S&M · G&A) that drives the cost model.
 * Headcount sums FTE so it matches `getHeadcount(period)` by construction.
 */
export function StaffCards({ active }: { active: readonly StaffMember[] }) {
  const totalHeads = active.reduce((n, s) => n + s.fte, 0);

  const byDept = new Map<DepartmentId, number>();
  for (const s of active) byDept.set(s.departmentId, (byDept.get(s.departmentId) ?? 0) + s.fte);
  const deptRows = [...byDept.entries()]
    .map(([id, heads]) => ({ id, heads }))
    .sort((a, b) => b.heads - a.heads);

  const byFn = new Map<CostFunction, number>();
  for (const s of active) byFn.set(s.function, (byFn.get(s.function) ?? 0) + s.fte);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card kicker="Headcount">
        <div className="font-heading text-2xl text-ink tabular-nums">{fte(totalHeads)}</div>
        <div className="mb-2 text-[11px] leading-snug text-steel">
          Active FTE on the books this period. Ties to getHeadcount by construction.
        </div>
        <Line label="Departments" value={deptRows.length.toString()} tone="muted" />
        <Line label="Functions" value={FUNCTION_ORDER.filter((f) => (byFn.get(f) ?? 0) > 0).length.toString()} tone="total" />
      </Card>

      <Card kicker="Org · by department">
        {deptRows.map((d) => (
          <Line key={d.id} label={DEPT_LABEL[d.id] ?? (d.id as string)} value={fte(d.heads)} />
        ))}
        <Line label="All departments" value={fte(totalHeads)} tone="total" />
      </Card>

      <Card kicker="Org · by function">
        {FUNCTION_ORDER.map((f) => (
          <Line key={f} label={FUNCTION_LABEL[f]} value={fte(byFn.get(f) ?? 0)} />
        ))}
        <Line label="All functions" value={fte(totalHeads)} tone="total" />
      </Card>
    </div>
  );
}
