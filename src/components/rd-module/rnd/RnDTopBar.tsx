import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Brain, Search, Activity, Sparkles, Zap } from "lucide-react";
import { Input } from "@/components/rd-module/ui/input";
import { Badge } from "@/components/rd-module/ui/badge";
import { rndSections, type RnDSectionId } from "./RnDSidebar";
import { cn } from "@/lib/rd-module/utils";

interface RnDTopBarProps {
  activeTab: string;
  onTabChange: (tab: RnDSectionId) => void;
  search: string;
  onSearchChange: (value: string) => void;
  stats: { ideas: number; prototypes: number; trends: number; decisions: number };
  mobileNav?: ReactNode;
}

export const RnDTopBar = ({
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  stats,
  mobileNav,
}: RnDTopBarProps) => {
  const quickTabs = rndSections.filter((section) =>
    [
      "future-lab",
      "ai-assistant",
      "idea-scorer",
      "tech-radar",
      "pipeline",
      "prototype",
      "trends",
      "decisions",
    ].includes(section.id),
  );

  const counts: Record<string, number> = {
    "future-lab": stats.ideas,
    prototype: stats.prototypes,
    trends: stats.trends,
    decisions: stats.decisions,
  };

  return (
    <header className="border-b border-border bg-surface/70 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        {mobileNav}
        <motion.div
          className="brand-soft hidden items-center gap-3 sm:flex rounded-xl border border-border px-4 py-2"
          animate={{
            boxShadow: ["0 0 0 rgba(0,0,0,0)", "var(--shadow-glow)", "0 0 0 rgba(0,0,0,0)"],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <motion.span
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Brain className="h-6 w-6 text-brand" />
          </motion.span>
          <div>
            <p className="text-xs text-muted-foreground">AI Research Panel</p>
            <p className="font-display text-sm font-semibold text-foreground">
              Active &amp; Learning
            </p>
          </div>
          <motion.span
            className="h-2 w-2 rounded-full bg-success"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>

        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search ideas, trends, prototypes…"
            className="pl-9"
            aria-label="Search R&D records"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 border-info/40 text-info">
            <Activity className="h-3 w-3" /> {stats.prototypes} live prototypes
          </Badge>
          <Badge variant="outline" className="gap-1 border-success/40 text-success">
            <Zap className="h-3 w-3" /> Neural engine
          </Badge>
        </div>
      </div>

      <nav
        aria-label="R&D quick sections"
        className="scroll-slim flex gap-1 overflow-x-auto px-4 pb-3"
      >
        {quickTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "brand-soft border border-border text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden="true" className={cn("h-4 w-4", isActive && "text-brand")} />
              {tab.label}
              {count ? <span className="rounded-full bg-muted px-1.5 text-xs">{count}</span> : null}
              {["ai-assistant", "idea-scorer", "tech-radar"].includes(tab.id) && (
                <Sparkles aria-hidden="true" className="h-3 w-3 text-brand-2" />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
