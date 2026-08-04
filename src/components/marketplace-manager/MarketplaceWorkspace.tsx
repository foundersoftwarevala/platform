import { useState } from "react";
import { Bot } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopBar } from "@/components/creator/CreatorTopBar";
import { PageShell } from "@/components/creator/PageShell";

import { marketplaceGroups, marketplacePrimary } from "./navigation";
import { navIdToLabel, sectionRegistry } from "./sectionRegistry";
import { DashboardSection as DashboardFallback } from "./sections/DashboardSection";
import { AiChatPanel } from "./AiChatPanel";

export function MarketplaceWorkspace() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [aiOpen, setAiOpen] = useState(false);

  const Section = sectionRegistry[active] ?? DashboardFallback;

  const select = (label: string) => {
    setActive(label);
    setMobileOpen(false);
  };

  return (
    <div className="creator-theme mm-scope flex min-h-screen w-full">
      <CreatorSidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        active={active}
        onSelect={select}
        primary={marketplacePrimary}
        groups={marketplaceGroups}
        brand="Marketplace"
        brandMark="MV"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CreatorTopBar onOpenMenu={() => setMobileOpen(true)} />

        <PageShell>
          <Section onNavigate={(id: string) => select(navIdToLabel[id] ?? id)} />
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
