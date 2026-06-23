import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A dashboard chart card — same surface language as the KPI tiles (§19). */
export function ChartCard({
  title,
  subtitle,
  legend,
  footnote,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  footnote?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-xl border border-parchment-line bg-surface p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h3 className="font-heading text-base text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-steel">{subtitle}</p>}
        </div>
        {legend && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">{legend}</div>}
      </div>
      <div className="mt-3 min-w-0">{children}</div>
      {footnote && <p className="mt-2 text-[11px] leading-snug text-steel">{footnote}</p>}
    </div>
  );
}

/** A small color-swatch legend entry. `muted` renders the lighter "forecast" treatment. */
export function LegendDot({ color, label, muted }: { color: string; label: string; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-steel">
      <span className="size-2.5 rounded-[3px]" style={{ background: color, opacity: muted ? 0.45 : 1 }} />
      {label}
    </span>
  );
}
