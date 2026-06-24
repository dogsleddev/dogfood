import type { ReactNode } from "react";
import { Sidebar } from "@/components/nav/sidebar";
import { ScoutProvider } from "@/components/scout/scout-context";
import { ScoutPanel } from "@/components/scout/scout-panel";
import { ScoutLauncher } from "@/components/scout/scout-launcher";
import { MobileHome } from "@/components/shell/mobile-home";

/**
 * The app frame: Midnight rail + parchment content + the floating Scout launcher + panel (§19, §10).
 *
 * The dense, multi-column workspace is desktop-only (rendered `hidden md:flex`); small screens get the
 * mobile home instead — a glanceable read-only KPI snapshot + Scout (Mobile v1). Scout lives OUTSIDE
 * the desktop-only frame so it works on every screen — a FAB + floating panel on desktop, a full-screen
 * sheet on mobile. Conversational AI is the one genuinely mobile-native surface, so phone visitors read
 * the headline numbers and "ask the agent" while the spreadsheet-dense surfaces stay on the laptop.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ScoutProvider>
      {/* Small screens get the mobile home: read-only KPI snapshot + Scout (the desktop frame below is hidden). */}
      <MobileHome />
      <div className="hidden min-h-screen bg-background text-foreground md:flex">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      {/* Scout is available on every screen: FAB (desktop) / mobile-home CTA → floating panel / full-screen sheet. */}
      <ScoutLauncher />
      <ScoutPanel />
    </ScoutProvider>
  );
}
