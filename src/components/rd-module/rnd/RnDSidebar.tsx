import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  Lightbulb,
  Bot,
  Target,
  Radar,
  Rocket,
  Blocks,
  Gauge,
  TrendingUp,
  MessagesSquare,
  Map,
  Wallet,
  Bell,
  Menu,
} from "lucide-react";
import logo from "@/assets/rd-module/software-vala-logo.png";
import { Button } from "@/components/rd-module/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/rd-module/ui/sheet";
import { cn } from "@/lib/rd-module/utils";

export const rndSections = [
  { id: "future-lab", label: "Future Lab", icon: Lightbulb },
  { id: "ai-assistant", label: "AI Assistant", icon: Bot },
  { id: "idea-scorer", label: "Idea Scorer", icon: Target },
  { id: "tech-radar", label: "Tech Radar", icon: Radar },
  { id: "pipeline", label: "Innovation Pipeline", icon: Rocket },
  { id: "prototype", label: "Prototype Builder", icon: Blocks },
  { id: "impact", label: "Impact Analyzer", icon: Gauge },
  { id: "trends", label: "Trend Scanner", icon: TrendingUp },
  { id: "feedback", label: "Feedback Portal", icon: MessagesSquare },
  { id: "decisions", label: "Decision Board", icon: Map },
  { id: "wallet", label: "R&D Budget", icon: Wallet },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

export type RnDSectionId = (typeof rndSections)[number]["id"];

interface NavProps {
  activeTab: string;
  onTabChange: (tab: RnDSectionId) => void;
  unreadCount: number;
}

const RnDNavItems = ({
  activeTab,
  onTabChange,
  unreadCount,
  animate,
}: NavProps & { animate: boolean }) => (
  <>
    {rndSections.map((item, index) => {
      const Icon = item.icon;
      const isActive = activeTab === item.id;
      return (
        <motion.button
          key={item.id}
          type="button"
          onClick={() => onTabChange(item.id)}
          aria-current={isActive ? "page" : undefined}
          initial={animate ? { opacity: 0, x: -16 } : false}
          animate={animate ? { opacity: 1, x: 0 } : false}
          transition={{ delay: index * 0.03 }}
          whileHover={{ x: 4 }}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isActive
              ? "brand-soft border border-border text-foreground shadow-glow"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          )}
        >
          <Icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", isActive && "text-brand")} />
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          {item.id === "notifications" && unreadCount > 0 && (
            <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand">
              {unreadCount}
              <span className="sr-only"> unread notifications</span>
            </span>
          )}
        </motion.button>
      );
    })}
  </>
);

const WorkspaceFooter = () => (
  <div className="border-t border-border p-4">
    <div className="panel flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-xs font-bold text-brand"
      >
        RD
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">R&amp;D Workspace</p>
        <p className="text-xs text-muted-foreground">Live data</p>
      </div>
    </div>
    <Link
      to="/rd-manager/pro-manager"
      className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      Open Pro Manager
    </Link>
    <Link
      to="/rd-manager"
      className="mt-2 flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      Open R&amp;D Manager
    </Link>
  </div>
);

const Brand = () => (
  <div className="flex items-center gap-3">
    <img src={logo} alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
    <div className="min-w-0">
      <p className="font-display text-sm font-semibold text-foreground">Software Vala</p>
      <p className="text-xs text-brand">R&amp;D Department</p>
    </div>
  </div>
);

export const RnDSidebar = (props: NavProps) => (
  <aside
    aria-label="R&D sections"
    className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl lg:flex"
  >
    <div className="border-b border-border px-6 py-5">
      <Brand />
    </div>
    <nav aria-label="R&D primary" className="scroll-slim flex-1 space-y-1 overflow-y-auto p-4">
      <RnDNavItems {...props} animate />
    </nav>
    <WorkspaceFooter />
  </aside>
);

/** Off-canvas navigation for viewports below the `lg` breakpoint. */
export const RnDMobileNav = (props: NavProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open navigation menu"
          className="min-h-11 min-w-11 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 border-border bg-sidebar p-0">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="sr-only">R&amp;D navigation</SheetTitle>
          <Brand />
        </SheetHeader>
        <nav aria-label="R&D primary" className="scroll-slim flex-1 space-y-1 overflow-y-auto p-4">
          <RnDNavItems
            {...props}
            animate={false}
            onTabChange={(tab) => {
              props.onTabChange(tab);
              setOpen(false);
            }}
          />
        </nav>
        <WorkspaceFooter />
      </SheetContent>
    </Sheet>
  );
};
