import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal Markdown renderer for the User Guides (CLAUDE.md §14). The corpus is a controlled internal
 * subset — ## / ### headings, "- " bullet lists, **bold**, `inline code`, and paragraphs — so a small
 * renderer beats pulling in a full markdown dependency. Used by the guides route + the help surface.
 */

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

export function GuideBody({ body, className }: { body: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
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

  body.split("\n").forEach((raw, idx) => {
    const line = raw.trimEnd();
    const k = String(idx);
    if (line.startsWith("### ")) {
      flushPara(k); flushList(k);
      blocks.push(<h3 key={`h3-${k}`} className="mt-6 font-heading text-base font-semibold text-ink">{inline(line.slice(4), `h3-${k}`)}</h3>);
    } else if (line.startsWith("## ")) {
      flushPara(k); flushList(k);
      blocks.push(<h2 key={`h2-${k}`} className="mt-8 border-b border-parchment-line pb-1.5 font-heading text-xl text-ink">{inline(line.slice(3), `h2-${k}`)}</h2>);
    } else if (line.startsWith("- ")) {
      flushPara(k); list.push(line.slice(2));
    } else if (line.trim() === "") {
      flushPara(k); flushList(k);
    } else {
      flushList(k); para.push(line);
    }
  });
  flushPara("end"); flushList("end");

  return <div className={cn("space-y-3.5", className)}>{blocks}</div>;
}
