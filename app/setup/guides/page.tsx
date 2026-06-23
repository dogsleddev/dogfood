import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GUIDES } from "@/lib/guides/content";

/**
 * Setup ▸ User Guides — the guide gallery (CLAUDE.md §14). The nav parent + Scout's product-knowledge
 * receipts (getProductMap / describeModule) link here, so this index must exist (it 404'd before).
 * One card per guide, in learning order; each opens the full guide.
 */
export default function GuidesIndexPage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Setup · User Guides</div>
        <h1 className="font-heading text-3xl text-ink">User Guides</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">
          How Dogfood works, end to end — start with Getting started, then dig into the area you need.
          These are the same guides Scout reads to answer how-to questions, so the app and the agent
          never disagree.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {GUIDES.map((g, i) => (
          <Link
            key={g.slug}
            href={`/setup/guides/${g.slug}`}
            className="group flex flex-col rounded-xl border border-parchment-line bg-surface p-5 transition-colors hover:border-ember/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-heading text-base text-ink">
                <span className="mr-2 text-sm tabular-nums text-steel/60">{String(i + 1).padStart(2, "0")}</span>
                {g.title}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-steel transition-colors group-hover:text-ember" />
            </div>
            <p className="mt-2 text-sm leading-6 text-steel">{g.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
