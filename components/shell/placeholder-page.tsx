import type { ReactNode } from "react";

interface PlaceholderPageProps {
  readonly title: string;
  /** small group/layer kicker above the title */
  readonly kicker?: string;
  readonly layer?: string;
  readonly description?: string;
  /** the lib/queries functions that will back this surface (the spine seam) */
  readonly queries?: readonly string[];
  readonly children?: ReactNode;
}

/**
 * Phase 0 route scaffold (no business numbers). Each surface renders an on-brand shell
 * naming what it is, its data layer, and the spine queries that back it — so the IA is
 * navigable and self-documenting before the modules are built in the Run.
 */
export function PlaceholderPage({ title, kicker, layer, description, queries, children }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <header className="mb-6">
        {kicker && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">{kicker}</div>}
        <h1 className="font-heading text-3xl text-ink">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-steel">{description}</p>}
      </header>

      <div className="rounded-xl border border-parchment-line bg-surface p-6">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-amber" />
          <span className="text-sm font-medium text-ink">Scaffold</span>
          {layer && <span className="text-xs text-steel">· {layer}</span>}
        </div>
        <p className="mt-2 text-sm text-steel">
          This surface is scaffolded on the query spine. It is built for real in the Run; Phase 0
          ships structure, not numbers.
        </p>
        {queries && queries.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-steel/80">
              Backing spine queries
            </div>
            <ul className="flex flex-wrap gap-2">
              {queries.map((q) => (
                <li key={q} className="rounded-md bg-secondary px-2 py-1 font-mono text-xs text-ink">
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
