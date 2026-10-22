import { useMemo, useState } from "react";
import { Bot, LayoutDashboard, Search, Sparkles, TrendingUp } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopBar } from "@/components/creator/CreatorTopBar";
import { PageShell } from "@/components/creator/PageShell";
import { AiChatPanel } from "@/components/marketplace-manager/AiChatPanel";
import type { NavGroup, NavItem } from "@/components/creator/navigation";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  SEO_MODULE_GROUPS,
  renderSeoModule,
} from "@/components/marketplace-manager/sections/SeoCenter";
import { ExecutiveBanner } from "@/components/manager-suite/ExecutiveBanner";
import ScreenErrorBoundary from "@/components/server-manager/ScreenErrorBoundary";
import { SeoResourceFeedbackNotice, SeoResourceFeedbackProvider } from "./SeoResourceFeedback";

const seoPrimary: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Keyword Center", icon: Search },
  { label: "Google Ranking", icon: TrendingUp },
  { label: "AI Writer", icon: Sparkles },
];

export function SeoWorkspace({ initialModule }: { initialModule?: string } = {}) {
  const { t } = useTranslation();
  const { groups, idByLabel, labelById } = useMemo(() => {
    const map: Record<string, string> = {};
    const g: NavGroup[] = SEO_MODULE_GROUPS.map((group) => ({
      label: group.label,
      items: group.items.map((item) => {
        const label = item.messageKey ? t(item.messageKey) : item.label;
        map[label] = item.id;
        return { label, icon: item.icon };
      }),
    }));
    // Built from the modules themselves rather than by inverting the
    // label->id map. Two modules that happen to share a label collapse to one
    // entry in that map, and the id that lost is then absent here - so
    // ?module=<id> for it silently opened the dashboard instead, which looks
    // exactly like a screen that works.
    const reverse: Record<string, string> = {};
    for (const group of SEO_MODULE_GROUPS) {
      for (const item of group.items) {
        reverse[item.id] = item.messageKey ? t(item.messageKey) : item.label;
      }
    }
    return { groups: g, idByLabel: map, labelById: reverse };
  }, [t]);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState(() =>
    initialModule && labelById[initialModule] ? initialModule : "dashboard",
  );
  const active = labelById[activeId] ?? "Dashboard";
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
          const id = idByLabel[label];
          if (id) setActiveId(id);
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
          <SeoResourceFeedbackProvider>
            <SeoResourceFeedbackNotice />
            <ScreenErrorBoundary screenId={`seo-manager:${activeId}`}>
              {/^(dashboard|overview|console)/i.test(activeId) ? (
                <ExecutiveBanner
                  role="seo"
                  onNavigate={(label) => {
                    const id = idByLabel[label];
                    if (id) setActiveId(id);
                  }}
                />
              ) : null}
              {renderSeoModule(activeId)}
            </ScreenErrorBoundary>
          </SeoResourceFeedbackProvider>
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
