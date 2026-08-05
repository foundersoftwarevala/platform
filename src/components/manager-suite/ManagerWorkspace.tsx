import { useState, type ComponentType } from "react";
import { Bot } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopBar } from "@/components/creator/CreatorTopBar";
import { PageShell } from "@/components/creator/PageShell";
import { AiChatPanel } from "@/components/marketplace-manager/AiChatPanel";
import type { NavGroup, NavItem } from "@/components/creator/navigation";

import { ManagerWall, type WallConfig } from "./wall";
import { ExecutiveBanner } from "./ExecutiveBanner";
import type { ExecRole } from "./executiveFeed";

export type SectionEntry = WallConfig | ComponentType<{ onNavigate?: (id: string) => void }>;

export function ManagerWorkspace({
  primary,
  groups,
  registry,
  brand,
  brandMark,
  initial = "Dashboard",
  role,
}: {
  primary: NavItem[];
  groups: NavGroup[];
  registry: Record<string, SectionEntry>;
  brand: string;
  brandMark: string;
  initial?: string;
  role: ExecRole;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState(initial);
  const [aiOpen, setAiOpen] = useState(false);

  const select = (label: string) => {
    setActive(label);
    setMobileOpen(false);
  };

  const entry = registry[active] ?? registry[initial];
  const isDashboard = /dashboard|console/i.test(active);

  return (
    <div className="creator-theme mm-scope flex min-h-screen w-full">
      <CreatorSidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        active={active}
        onSelect={select}
        primary={primary}
        groups={groups}
        brand={brand}
        brandMark={brandMark}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <CreatorTopBar onOpenMenu={() => setMobileOpen(true)} />
        <PageShell>
          {isDashboard ? <ExecutiveBanner role={role} onNavigate={select} /> : null}
          {entry && typeof entry === "function" ? (
            (() => {
              const Section = entry as ComponentType<{ onNavigate?: (id: string) => void }>;
              return <Section onNavigate={select} />;
            })()
          ) : entry ? (
            <ManagerWall key={(entry as WallConfig).scope} config={entry as WallConfig} />
          ) : null}
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