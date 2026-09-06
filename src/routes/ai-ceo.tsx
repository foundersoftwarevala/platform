import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  GraduationCap,
  Gauge,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import { RequireRole } from "@/components/auth/RequireRole";
import { CreatorSidebar } from "@/components/creator/CreatorSidebar";
import { CreatorTopBar } from "@/components/creator/CreatorTopBar";
import { AiChatPanel } from "@/components/marketplace-manager/AiChatPanel";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { NavGroup, NavItem } from "@/components/creator/navigation";

/**
 * The AI CEO command centre.
 *
 * The module arrived with its own AppSidebar, TopBar and application shell.
 * Those were dropped: this route mounts the module's ten screens inside
 * Software Vala's existing operator shell — the same CreatorSidebar and
 * CreatorTopBar the SEO, Creator and Marketplace consoles use — so the module
 * sits inside the product rather than beside it, and the sidebar, top bar,
 * theme, routing and sign-in flow all stay exactly as they were.
 *
 * Access is restricted to boss and admin. There is no `ceo` role in the
 * database, and these screens carry platform-wide revenue, risk and customer
 * data, so they must not open for an ordinary signed-in account.
 */

/** Label → route. The sidebar selects by label; navigation is real routing. */
const SECTIONS: Array<{ label: string; icon: NavItem["icon"]; to: string }> = [
  { label: "AI CEO Dashboard", icon: LayoutDashboard, to: "/ai-ceo" },
  { label: "Live Monitor", icon: Activity, to: "/ai-ceo/live-monitor" },
  { label: "Decision Engine", icon: Brain, to: "/ai-ceo/decision-engine" },
  { label: "Approvals", icon: CheckCircle2, to: "/ai-ceo/approvals" },
  { label: "Predictions", icon: TrendingUp, to: "/ai-ceo/predictions" },
  { label: "Risk & Compliance", icon: ShieldAlert, to: "/ai-ceo/risk" },
  { label: "Performance", icon: Gauge, to: "/ai-ceo/performance" },
  { label: "Learning", icon: GraduationCap, to: "/ai-ceo/learning" },
  { label: "Reports", icon: BarChart3, to: "/ai-ceo/reports" },
  { label: "Settings", icon: Settings, to: "/ai-ceo/settings" },
];

const primary: NavItem[] = SECTIONS.slice(0, 4).map(({ label, icon }) => ({ label, icon }));

const groups: NavGroup[] = [
  {
    label: "Command Centre",
    items: SECTIONS.slice(0, 6).map(({ label, icon }) => ({ label, icon })),
  },
  {
    label: "Intelligence",
    items: SECTIONS.slice(6).map(({ label, icon }) => ({ label, icon })),
  },
];

export const Route = createFileRoute("/ai-ceo")({
  head: () => ({
    meta: [
      { title: "AI CEO Command Center — Software Vala" },
      {
        name: "description",
        content:
          "Autonomous AI CEO command center: live action monitoring, decision engine, approvals, risk, performance intelligence and predictive insights.",
      },
      { property: "og:title", content: "AI CEO Command Center — Software Vala" },
      {
        property: "og:description",
        content:
          "Observer and advisor AI CEO: live monitoring, decisions, approvals, risk, performance and predictions.",
      },
      // An executive console has no business in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AICEOLayout,
});

function AICEOLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Longest match wins so /ai-ceo does not claim /ai-ceo/reports.
  const active =
    [...SECTIONS]
      .sort((a, b) => b.to.length - a.to.length)
      .find((s) => pathname === s.to || pathname.startsWith(s.to + "/"))?.label ??
    SECTIONS[0].label;

  return (
    <RequireRole role={["boss", "admin"]}>
      <TooltipProvider delayDuration={120}>
        <div className="creator-theme mm-scope flex min-h-screen w-full">
          <CreatorSidebar
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((v) => !v)}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            active={active}
            onSelect={(label) => {
              const target = SECTIONS.find((s) => s.label === label);
              if (target) void navigate({ to: target.to });
              setMobileOpen(false);
            }}
            primary={primary}
            groups={groups}
            brand="AI CEO"
            brandMark="CEO"
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <CreatorTopBar onOpenMenu={() => setMobileOpen(true)} />

            <main className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </main>
          </div>

          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
          >
            <Brain className="h-4 w-4" aria-hidden="true" /> Vala AI
          </button>
          <AiChatPanel open={aiOpen} onClose={() => setAiOpen(false)} />
          <Toaster />
        </div>
      </TooltipProvider>
    </RequireRole>
  );
}
