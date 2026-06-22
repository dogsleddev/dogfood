import type { ReactNode } from "react";
import { Sidebar } from "@/components/nav/sidebar";
import { ScoutProvider } from "@/components/scout/scout-context";
import { ScoutPanel } from "@/components/scout/scout-panel";

/** The app frame: Midnight rail + parchment content + the floating Scout panel (§19, §10). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ScoutProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
        <ScoutPanel />
      </div>
    </ScoutProvider>
  );
}
