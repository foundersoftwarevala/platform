import { useEffect, useState } from "react";
import { Bot } from "lucide-react";

import { Toaster } from "@/components/ui/sonner";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopBar } from "@/components/creator/CreatorTopBar";
import { PageShell } from "@/components/creator/PageShell";

import { marketplaceGroups, marketplacePrimary } from "./navigation";
import { navIdToLabel, sectionRegistry } from "./sectionRegistry";
import { DashboardSection as DashboardFallback } from "./sections/DashboardSection";
import { AiChatPanel } from "./AiChatPanel";
import { ExecutiveBanner } from "@/components/manager-suite/ExecutiveBanner";

export function MarketplaceWorkspace() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState("Dashboard");
  const [aiOpen, setAiOpen] = useState(false);

  // A section can ask for the assistant that is already mounted here,
  // rather than each screen carrying a panel of its own. A screen may also
  // send the question it wants asked, carrying its own figures, so the
  // assistant opens knowing what was on screen instead of starting blank.
  const [aiSeed, setAiSeed] = useState<string | null>(null);
  useEffect(() => {
    const open = (event: Event) => {
      const seed = (event as CustomEvent<{ seed?: string }>).detail?.seed;
      setAiSeed(typeof seed === "string" && seed.trim() ? seed : null);
      setAiOpen(true);
    };
    window.addEventListener("sv:open-vala-ai", open);
    return () => window.removeEventListener("sv:open-vala-ai", open);
  }, []);

  /**
   * Opening the workspace on the screen the link asked for.
   *
   * The control room's queues link to `?section=catalog&status=draft` and the
   * like — destinations that name the records they counted. Nothing read them,
   * so every "Review" landed on the Dashboard and the reader had to go and
   * find the queue by hand. The section is now honoured.
   *
   * The narrower parameters beside it (`status`, `missing`, `moderation`,
   * `range`) are carried in the URL and left there deliberately: the target
   * sections do not filter from the URL yet, so applying them here would mean
   * pretending to a filter that had not happened. The link opens the right
   * screen; narrowing it to the exact rows is the next piece of work, and is
   * reported as outstanding rather than faked.
   */
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("section");
    if (!requested) return;
    const label = navIdToLabel[requested] ?? requested;
    if (sectionRegistry[label]) setActive(label);
  }, []);

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
          {/^(dashboard|overview|console)/i.test(active) ? (
            <ExecutiveBanner role="marketplace" onNavigate={select} />
          ) : null}
          <Section onNavigate={(id: string) => select(navIdToLabel[id] ?? id)} />
        </PageShell>
      </div>

      <button
        onClick={() => setAiOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <Bot className="h-4 w-4" /> Vala AI
      </button>
      <AiChatPanel open={aiOpen} seed={aiSeed} onClose={() => setAiOpen(false)} />
      <Toaster />
    </div>
  );
}
