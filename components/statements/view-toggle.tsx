import Link from "next/link";
import { cn } from "@/lib/utils";

/** FY-columns vs Monthly toggle for the statement reading surfaces. `base` is the route without query
 *  (e.g. /statements/balance-sheet); the monthly tab adds ?view=monthly. */
export function StatementViewToggle({ base, monthly }: { base: string; monthly: boolean }) {
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1 text-sm transition-colors",
        active ? "bg-surface font-medium text-ink shadow-sm" : "text-steel hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-parchment-line bg-secondary/40 p-0.5">
      {tab(base, "FY columns", !monthly)}
      {tab(`${base}?view=monthly`, "Monthly", monthly)}
    </div>
  );
}
