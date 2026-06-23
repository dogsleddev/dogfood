import type { ReactNode } from "react";
import { Sidebar } from "@/components/nav/sidebar";
import { ScoutProvider } from "@/components/scout/scout-context";
import { ScoutPanel } from "@/components/scout/scout-panel";
import { ScoutLauncher } from "@/components/scout/scout-launcher";

/** The app frame: Midnight rail + parchment content + the floating Scout launcher + panel (§19, §10). */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ScoutProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
        <ScoutLauncher />
        <ScoutPanel />
      </div>
    </ScoutProvider>
  );
}
