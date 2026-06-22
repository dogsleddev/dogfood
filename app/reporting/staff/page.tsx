import { listStaff } from "@/lib/queries";
import { month, monthLabel, monthYear, monthIndex, type Month } from "@/lib/types/period";
import type { StaffMember } from "@/lib/types/source";
import type { CostFunction, DepartmentId } from "@/lib/types/common";
import { SEED_DEPARTMENTS } from "@/lib/target/placeholder";
import { StaffCards } from "@/components/reporting/staff-cards";
import { StaffTable, FUNCTION_ORDER, type DeptFilter, type FnFilter } from "@/components/reporting/staff-table";

// The people register reads as of the last fully closed month — the live roster (CLAUDE.md §11).
const AS_OF: Month = month(2026, 5);

const toIndex = (m: Month): number => (monthYear(m) - 2024) * 12 + (monthIndex(m) - 1);
/** A staff member is on the books in `period` if they've started and not yet left. */
const activeIn = (s: StaffMember, period: Month): boolean => {
  const i = toIndex(period);
  const start = toIndex(s.startMonth);
  const end = s.endMonth ? toIndex(s.endMonth) : Infinity;
  return start <= i && i <= end;
};

const DEPT_IDS = new Set<string>(SEED_DEPARTMENTS.map((d) => d.id as string));
const FN_IDS = new Set<string>(FUNCTION_ORDER);

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ dept?: string; fn?: string }>;
}) {
  const { dept: rawDept, fn: rawFn } = await searchParams;
  const dept: DeptFilter = rawDept && DEPT_IDS.has(rawDept) ? (rawDept as DepartmentId) : "all";
  const fn: FnFilter = rawFn && FN_IDS.has(rawFn) ? (rawFn as CostFunction) : "all";

  const all = await listStaff();
  const active = all.filter((s) => activeIn(s, AS_OF));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Reporting · Layer 1</div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-heading text-3xl text-ink">Staff</h1>
          <span className="text-sm text-steel">{monthLabel(AS_OF)} · current roster</span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-steel">
          The people register — everyone on the books, with their department and function tag (Direct ·
          R&D · S&M · G&A). This is where Personnel and the cost model bottom out: headcount sums FTE
          to the same number getHeadcount reports, and the functional split is the org cut the
          functional metrics reassemble.
        </p>
      </header>

      <div className="mb-8">
        <StaffCards active={active} />
      </div>

      <StaffTable staff={active} dept={dept} fn={fn} periodLabel={monthLabel(AS_OF)} />
    </div>
  );
}
