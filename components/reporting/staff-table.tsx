import Link from "next/link";
import { cn } from "@/lib/utils";
import { monthLabel } from "@/lib/types/period";
import type { StaffMember } from "@/lib/types/source";
import type { CostFunction, DepartmentId } from "@/lib/types/common";
import { SEED_DEPARTMENTS } from "@/lib/target/placeholder";

// Department display names, keyed by id (the slug the StaffMember carries). Sourced from the
// locked seed department set (CLAUDE.md §8) so the labels match Personnel / the cost model.
export const DEPT_LABEL: Record<string, string> = Object.fromEntries(
  SEED_DEPARTMENTS.map((d) => [d.id as string, d.name]),
);

// The four cost functions (Direct/CoR · R&D · S&M · G&A — §8 two-axis cost model).
export const FUNCTION_ORDER: readonly CostFunction[] = ["direct", "rnd", "sm", "ga"];
export const FUNCTION_LABEL: Record<CostFunction, string> = {
  direct: "Direct · CoR",
  rnd: "R&D",
  sm: "S&M",
  ga: "G&A",
};

const FUNCTION_BADGE: Record<CostFunction, string> = {
  direct: "bg-ember-tint text-ember-deep",
  rnd: "bg-amber/15 text-amber-deep",
  sm: "bg-sage/15 text-sage-deep",
  ga: "bg-steel/15 text-steel",
};

export type DeptFilter = "all" | DepartmentId;
export type FnFilter = "all" | CostFunction;

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>
);

const fte = (n: number): string => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

/** Build a /reporting/staff href that preserves the other axis of the filter. */
const hrefWith = (dept: DeptFilter, fn: FnFilter): string => {
  const params = new URLSearchParams();
  if (dept !== "all") params.set("dept", dept as string);
  if (fn !== "all") params.set("fn", fn);
  const qs = params.toString();
  return qs ? `/reporting/staff?${qs}` : "/reporting/staff";
};

function Chips<T extends string>({
  options,
  active,
  hrefFor,
}: {
  options: readonly { value: T; label: string }[];
  active: T;
  hrefFor: (value: T) => string;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-parchment-line bg-secondary/40 p-0.5">
      {options.map((o) => (
        <Link
          key={o.value}
          href={hrefFor(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            active === o.value ? "bg-surface font-medium text-ink shadow-sm" : "text-steel hover:text-ink",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * The Staff register (CLAUDE.md §8, layer 1) — the people on the books: name, department, function
 * tag, title, and start month. Reads the `listStaff` records (the live DataStore seam), filtered to
 * those active in the page's period upstream. The department and function chips narrow the rows; the
 * count line reflects the filtered view.
 */
export function StaffTable({
  staff,
  dept,
  fn,
  periodLabel,
}: {
  staff: readonly StaffMember[];
  dept: DeptFilter;
  fn: FnFilter;
  periodLabel: string;
}) {
  const rows = staff
    .filter((s) => (dept === "all" ? true : s.departmentId === dept) && (fn === "all" ? true : s.function === fn))
    .slice()
    .sort((a, b) => DEPT_LABEL[a.departmentId as string]?.localeCompare(DEPT_LABEL[b.departmentId as string] ?? "") || a.name.localeCompare(b.name));

  const heads = rows.reduce((n, s) => n + s.fte, 0);

  const deptOptions: { value: DeptFilter; label: string }[] = [
    { value: "all", label: "All depts" },
    ...SEED_DEPARTMENTS.map((d) => ({ value: d.id as DeptFilter, label: d.name })),
  ];
  const fnOptions: { value: FnFilter; label: string }[] = [
    { value: "all", label: "All functions" },
    ...FUNCTION_ORDER.map((f) => ({ value: f as FnFilter, label: FUNCTION_LABEL[f] })),
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-steel">
          <span className="font-medium text-ink">{rows.length}</span> people ·{" "}
          <span className="font-medium text-ink tabular-nums">{fte(heads)}</span> FTE · {periodLabel}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chips options={fnOptions} active={fn} hrefFor={(v) => hrefWith(dept, v)} />
          <Chips options={deptOptions} active={dept} hrefFor={(v) => hrefWith(v, fn)} />
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto rounded-xl border border-parchment-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-parchment-line bg-secondary text-xs uppercase tracking-wide text-steel">
              <TH>Name</TH>
              <TH>Title</TH>
              <TH>Department</TH>
              <TH>Function</TH>
              <TH>Started</TH>
              <TH right>FTE</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-parchment-line/60 hover:bg-ember-tint/40">
                <td className="px-3 py-1.5 text-ink">{s.name}</td>
                <td className="px-3 py-1.5 text-steel">{s.title}</td>
                <td className="px-3 py-1.5 text-ink">{DEPT_LABEL[s.departmentId as string] ?? (s.departmentId as string)}</td>
                <td className="px-3 py-1.5">
                  <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium", FUNCTION_BADGE[s.function])}>
                    {FUNCTION_LABEL[s.function]}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-steel">{monthLabel(s.startMonth)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-ink">{fte(s.fte)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-steel">
                  No staff match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
