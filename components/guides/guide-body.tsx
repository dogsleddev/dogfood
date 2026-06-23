import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { GuideFigure } from "@/lib/guides/content";

/**
 * Minimal Markdown renderer for the User Guides (CLAUDE.md §14). The corpus is a controlled internal
 * subset — ## / ### headings, "- " bullet lists, **bold**, `inline code`, and paragraphs — so a small
 * renderer beats pulling in a full markdown dependency. Used by the guides route + the help surface.
 *
 * Figures (diagrams) are NOT in the body string (Scout reads the body verbatim); they are passed
 * separately and interleaved after the h2 whose text they name (figure.afterHeading), so the agent's
 * corpus stays text-only while the rendered guide shows the diagram in place.
 */

/** Stable anchor id for an h2 — shared with the in-guide TOC so its links resolve. */
export function headingId(text: string): string {
  return text
    .replace(/[*`]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={key} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={key} className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em] text-ember-deep">{p.slice(1, -1)}</code>;
    }
    return <Fragment key={key}>{p}</Fragment>;
  });
}

/** One diagram card — the inline SVG (authored, trusted) with a title band + caption. */
function FigureBlock({ fig }: { fig: GuideFigure }) {
  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-parchment-line bg-surface">
      <figcaption className="border-b border-parchment-line px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ember-deep">
        {fig.title}
      </figcaption>
      <div className="overflow-x-auto px-4 py-4 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: fig.svg }} />
      {fig.alt ? <div className="border-t border-parchment-line/60 px-4 py-2 text-xs text-steel">{fig.alt}</div> : null}
    </figure>
  );
}

export function GuideBody({
  body,
  figures = [],
  className,
}: {
  body: string;
  figures?: readonly GuideFigure[];
  className?: string;
}) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const placed = new Set<string>();
  const flushPara = (k: string) => {
    if (para.length) {
      blocks.push(<p key={`p-${k}`} className="text-[15px] leading-7 text-ink/90">{inline(para.join(" "), `p-${k}`)}</p>);
      para = [];
    }
  };
  const flushList = (k: string) => {
    if (list.length) {
      blocks.push(
        <ul key={`u-${k}`} className="ml-1 space-y-1.5 text-[15px] leading-7 text-ink/90">
          {list.map((li, i) => (
            <li key={`u-${k}-${i}`} className="flex gap-2.5">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ember/70" />
              <span>{inline(li, `u-${k}-${i}`)}</span>
            </li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  /** Inject any figure(s) anchored to this heading text, right after the heading renders. */
  const flushFigures = (headingText: string) => {
    const want = headingId(headingText);
    for (const fig of figures) {
      if (!placed.has(fig.id) && headingId(fig.afterHeading) === want) {
        placed.add(fig.id);
        blocks.push(<FigureBlock key={`fig-${fig.id}`} fig={fig} />);
      }
    }
  };

  body.split("\n").forEach((raw, idx) => {
    const line = raw.trimEnd();
    const k = String(idx);
    if (line.startsWith("### ")) {
      flushPara(k); flushList(k);
      blocks.push(<h3 key={`h3-${k}`} className="mt-6 font-heading text-base font-semibold text-ink">{inline(line.slice(4), `h3-${k}`)}</h3>);
    } else if (line.startsWith("## ")) {
      flushPara(k); flushList(k);
      const text = line.slice(3);
      blocks.push(
        <h2 key={`h2-${k}`} id={headingId(text)} className="mt-8 scroll-mt-24 border-b border-parchment-line pb-1.5 font-heading text-xl text-ink">
          {inline(text, `h2-${k}`)}
        </h2>,
      );
      flushFigures(text);
    } else if (line.startsWith("- ")) {
      flushPara(k); list.push(line.slice(2));
    } else if (line.trim() === "") {
      flushPara(k); flushList(k);
    } else {
      flushList(k); para.push(line);
    }
  });
  flushPara("end"); flushList("end");

  // Any figure whose anchor heading wasn't found — append at the end so it's never silently dropped.
  for (const fig of figures) {
    if (!placed.has(fig.id)) blocks.push(<FigureBlock key={`fig-${fig.id}`} fig={fig} />);
  }

  return <div className={cn("space-y-3.5", className)}>{blocks}</div>;
}
