import * as Lucide from "lucide-react";
import type { LucideProps } from "lucide-react";

type IconComponent = React.ComponentType<LucideProps>;

/**
 * Resolve a lucide icon by name with a safe fallback, so an unknown name degrades to a
 * dot instead of breaking the build. (Phase 0 convenience; can switch to explicit imports
 * for tree-shaking later.)
 */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const registry = Lucide as unknown as Record<string, IconComponent | undefined>;
  const Cmp = registry[name] ?? registry["Circle"];
  if (!Cmp) return null;
  return <Cmp {...props} />;
}
