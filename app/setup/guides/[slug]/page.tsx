import { notFound } from "next/navigation";
import { getGuide, GUIDES } from "@/lib/guides/content";
import { GuideBody } from "@/components/guides/guide-body";

/** The six User Guides (§14). Served in-app under Setup ▸ User Guides; also the source Scout's
 *  product-knowledge lane reads (one source, two callers). */
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <header className="mb-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember-deep">Setup · User Guides</div>
        <h1 className="font-heading text-3xl text-ink">{guide.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">{guide.summary}</p>
      </header>
      <article>
        <GuideBody body={guide.body} />
      </article>
    </div>
  );
}
