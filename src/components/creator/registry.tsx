// Shared registry builder so every manager module gets the SAME shell:
// one dashboard section + a working wall for every other sidebar label.
import { ModuleDashboard, type ModuleConfig } from "@/components/creator/ModuleDashboard";
import { makeWall } from "@/components/manager-suite/makeWall";
import type { SectionEntry } from "@/components/manager-suite/ManagerWorkspace";
import type { NavGroup } from "@/components/creator/navigation";

export function buildModuleRegistry(config: ModuleConfig, groups: NavGroup[]) {
  const Dashboard = ({ onNavigate }: { onNavigate?: (id: string) => void }) => (
    <ModuleDashboard config={config} onNavigate={onNavigate} />
  );

  const out: Record<string, SectionEntry> = {
    Dashboard,
    [config.defaultModule]: Dashboard,
  };

  for (const group of groups) {
    for (const item of group.items) {
      if (out[item.label]) continue;
      out[item.label] = makeWall({
        scope: `${config.id}-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        entity: "record",
        eyebrow: group.label,
        title: item.label,
        subtitle: `${item.label} operations for ${config.title} — create, filter, act and export.`,
        icon: item.icon,
      });
    }
  }

  return out;
}