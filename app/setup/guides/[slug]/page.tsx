import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { getGuide, GUIDES } from "@/lib/guides/content";
import { GuideBody, headingId } from "@/components/guides/guide-body";

/** The seven User Guides (§14). Served in-app under Setup ▸ User Guides; also the source Scout's
 *  product-knowledge lane reads (one source, two callers). */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  // The h2 sections, for the in-guide table of contents (anchors match GuideBody's heading ids).
  const sections = guide.body
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3))
    .map((text) => ({ text: text.replace(/[*`]/g, ""), id: headingId(text) }));

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <Link href="/setup/guides" className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-steel hover:text-ember-deep">
        <ChevronLeft className="size-3.5" /> All guides
      </Link>
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Setup · User Guides</div>
        <h1 className="font-heading text-3xl text-ink">{guide.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">{guide.summary}</p>
      </header>

      {sections.length > 2 ? (
        <nav className="mb-7 rounded-xl border border-parchment-line bg-surface px-4 py-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel/70">On this page</div>
          <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-ink/80 hover:text-ember-deep hover:underline">
                  {s.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <article>
        <GuideBody body={guide.body} figures={guide.figures} />
      </article>

      {guide.quickRef?.length ? (
        <section className="mt-10">
          <h2 className="mb-3 border-b border-parchment-line pb-1.5 font-heading text-xl text-ink">Quick reference</h2>
          <div className="overflow-hidden rounded-xl border border-parchment-line bg-surface">
            {guide.quickRef.map((r, i) => (
              <Link
                key={r.href + i}
                href={r.href}
                className="flex items-center justify-between gap-4 border-b border-parchment-line/60 px-4 py-3 last:border-b-0 hover:bg-ember-tint/40"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">{r.surface}</div>
                  <div className="truncate text-xs text-steel">{r.purpose}</div>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-ember" />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
