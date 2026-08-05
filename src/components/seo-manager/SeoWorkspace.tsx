import { useMemo, useState } from "react";
import { Bot, LayoutDashboard, Search, Sparkles, TrendingUp } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopBar } from "@/components/creator/CreatorTopBar";
import { PageShell } from "@/components/creator/PageShell";
import { AiChatPanel } from "@/components/marketplace-manager/AiChatPanel";
import type { NavGroup, NavItem } from "@/components/creator/navigation";
import { SEO_MODULE_GROUPS, renderSeoModule } from "@/components/marketplace-manager/sections/SeoCenter";
import { ExecutiveBanner } from "@/components/manager-suite/ExecutiveBanner";

const seoPrimary: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Keyword Center", icon: Search },
  { label: "Google Ranking", icon: TrendingUp },
  { label: "AI Writer", icon: Sparkles },
];

export function SeoWorkspace() {
  const { groups, idByLabel } = useMemo(() => {
    const map: Record<string, string> = {};
    const g: NavGroup[] = SEO_MODULE_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.map((item) => {
        map[item.label] = item.id;
        return { label: item.label, icon: item.icon };
      }),
    }));
    return { groups: g, idByLabel: map };
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div className="creator-theme mm-scope flex min-h-screen w-full">
      <CreatorSidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        active={active}
        onSelect={(label) => {
          setActive(label);
          setMobileOpen(false);
        }}
        primary={seoPrimary}
        groups={groups}
        brand="SEO Manager"
        brandMark="SEO"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CreatorTopBar onOpenMenu={() => setMobileOpen(true)} />
        <PageShell>
          {/^(dashboard|overview|console)/i.test(active) ? (
            <ExecutiveBanner
              role="seo"
              onNavigate={(label) => {
                if (idByLabel[label]) setActive(label);
              }}
            />
          ) : null}
          {renderSeoModule(idByLabel[active] ?? "dashboard")}
        </PageShell>
      </div>

      <button
        onClick={() => setAiOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <Bot className="h-4 w-4" /> Vala AI
      </button>
      <AiChatPanel open={aiOpen} onClose={() => setAiOpen(false)} />
      <Toaster />
    </div>
  );
}