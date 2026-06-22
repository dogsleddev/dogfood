"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, type NavGroup, type NavEntry, type NavLeaf, type NavParent } from "./nav-config";
import { Icon } from "./icon";
import { useScout } from "@/components/scout/scout-context";
import { PLACEHOLDER_FIRM, PLACEHOLDER_PERIOD_LABEL } from "@/lib/target/placeholder";

const midnight = {
  background: "linear-gradient(180deg, var(--color-midnight), var(--color-midnight-2))",
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function TrailMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline points="3,17 7,14 3,11" stroke="var(--color-frost)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9,15 13,12 9,9" stroke="var(--color-steel)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15,13 19,10 15,7" stroke="var(--color-ember)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LeafRow({ leaf, nested }: { leaf: NavLeaf; nested?: boolean }) {
  const pathname = usePathname();
  const active = isActive(pathname, leaf.href);
  return (
    <Link
      href={leaf.href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md py-1.5 pr-2 text-sm transition-colors",
        nested ? "pl-9" : "pl-3",
        active
          ? "bg-ember/12 font-medium text-parchment"
          : "text-sidebar-foreground hover:bg-white/5 hover:text-parchment",
      )}
    >
      {active && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-ember" />}
      {leaf.icon && (
        <Icon name={leaf.icon} className={cn("size-4 shrink-0", active ? "text-ember" : "text-steel")} />
      )}
      <span className="truncate">{leaf.label}</span>
    </Link>
  );
}

function ParentRow({ parent }: { parent: NavParent }) {
  const pathname = usePathname();
  const [overrides, setOverrides] = useState<boolean | null>(null);
  const autoOpen = pathname.startsWith(parent.basePath);
  const open = overrides ?? autoOpen;
  const active = isActive(pathname, parent.basePath);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOverrides(!open)}
        className={cn(
          "relative flex w-full items-center gap-2.5 rounded-md py-1.5 pl-3 pr-2 text-sm transition-colors",
          active ? "text-parchment" : "text-sidebar-foreground hover:bg-white/5 hover:text-parchment",
        )}
      >
        <Icon name={parent.icon} className={cn("size-4 shrink-0", active ? "text-ember" : "text-steel")} />
        <span className="flex-1 truncate text-left font-medium">{parent.label}</span>
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-steel" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-steel" />
        )}
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {parent.children.map((child) => (
            <LeafRow key={child.href} leaf={child} nested />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry }: { entry: NavEntry }) {
  return entry.kind === "parent" ? <ParentRow parent={entry} /> : <LeafRow leaf={entry} />;
}

function GroupView({ group }: { group: NavGroup }) {
  return (
    <div>
      <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-steel/80">
        {group.label}
      </div>
      <div className="space-y-0.5">
        {group.items?.map((entry) => <EntryRow key={entry.label} entry={entry} />)}
        {group.subGroups?.map((sub) => (
          <div key={sub.label} className="mt-1">
            <div className="border-l border-white/10 pl-3">
              <div className="pb-1 text-[10px] font-medium uppercase tracking-wide text-steel/70">
                {sub.label}
              </div>
              <div className="space-y-0.5">
                {sub.items.map((entry) => <EntryRow key={entry.label} entry={entry} />)}
              </div>
            </div>
          </div>
        ))}
      </div>
      {group.dividerAfter && <div className="my-3 border-t border-dashed border-white/10" />}
    </div>
  );
}

function CompanyChip() {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left transition-colors hover:bg-white/10"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--color-ember),var(--color-amber))] text-xs font-semibold text-white">
        {PLACEHOLDER_FIRM.shortCode}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-parchment">{PLACEHOLDER_FIRM.name}</span>
        <span className="block truncate text-xs text-steel">{PLACEHOLDER_PERIOD_LABEL}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-steel" />
    </button>
  );
}

function ScoutLauncher() {
  const { toggle } = useScout();
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-2.5 rounded-lg border border-ember/40 bg-[linear-gradient(135deg,rgba(236,109,63,0.9),rgba(70,201,154,0.55))] px-3 py-2.5 text-left text-white shadow-sm transition-opacity hover:opacity-95"
    >
      <Sparkles className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">Ask Scout</span>
        <span className="block text-[11px] leading-tight text-white/80">opens lower-right</span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-white/90" />
    </button>
  );
}

export function Sidebar() {
  return (
    <aside
      style={midnight}
      className="sticky top-0 flex h-screen w-72 shrink-0 flex-col text-sidebar-foreground"
    >
      {/* header */}
      <div className="space-y-3 px-3 pb-2 pt-4">
        <div className="flex items-center gap-2 px-1">
          <TrailMark />
          <span className="font-heading text-lg text-parchment">
            dogfood<span className="text-steel">.cafe</span>
          </span>
        </div>
        <CompanyChip />
      </div>

      {/* nav */}
      <nav className="nav-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {NAV.map((group) => <GroupView key={group.label} group={group} />)}
      </nav>

      {/* footer */}
      <div className="space-y-3 border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 px-1">
          <span className="flex size-8 items-center justify-center rounded-full bg-[#16273a] text-sm font-medium text-parchment">
            C
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-parchment">Chris</span>
            <span className="block truncate text-xs text-steel">CFO</span>
          </span>
        </div>
        <ScoutLauncher />
      </div>
    </aside>
  );
}
