import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
import { useEffect, useState } from "react";

import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SliderBanner } from "@/components/slider-banner/SliderBanner";
import { BannerThemeControls } from "@/components/slider-banner/BannerThemeControls";


import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Bot,
  Box,
  Brain,
  Building2,
  CheckCircle,
  Cpu,
  DollarSign,
  Eye,
  FileCheck,
  Flag,
  Gauge,
  Globe2,
  HardDrive,
  Headphones,
  Info,
  MemoryStick,
  Percent,
  PiggyBank,
  Rocket,
  Server,
  ShieldCheck,
  Star,
  Target,
  Terminal,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

import ControlPanelSidebar, {
  SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSED_WIDTH,
  type RoleId,
} from "@/components/super-admin-wireframe/ControlPanelSidebar";
import { CommandCenter } from "@/components/command-center/CommandCenter";
import { ExecutiveRotator } from "@/components/command-center/ExecutiveRotator";

import { KPIGrid, KPIBox } from "@/components/boss/KPIGrid";
import { supabase } from "@/integrations/supabase/client";
import { cockpitTiles, relative, type Tile } from "@/lib/control-panel/cockpit";
import { useCockpitFigures } from "@/lib/control-panel/use-cockpit";
import { ValaAiAgent } from "@/components/vala-ai/ValaAiAgent";

export const Route = createFileRoute("/control-panel")({
  head: () => ({
    meta: [
      { title: "Control Panel — Boss Cockpit" },
      {
        name: "description",
        content:
          "Boss/Owner master control panel: premium electric-blue cockpit with live sidebar and a unified 2x20 grid of 40 KPI cards.",
      },
      { property: "og:title", content: "Control Panel — Boss Cockpit" },
      {
        property: "og:description",
        content:
          "Unified 40-card control cockpit: revenue, servers, AI, franchise, finance and alerts in one 2x20 grid.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // The Control Panel is the operator entry point for every manager. It used
  // to render in full, sidebar and all, to anonymous visitors.
  component: GuardedIndex,
});

/**
 * The cockpit's forty tiles: what each one is and which module it belongs to.
 * Their values used to be typed in here - "₹42.5L", "2,847", "99.97%" - and
 * never changed. They now come from /api/control-panel/cockpit, counted from
 * the tables each Manager reads (see src/lib/control-panel/cockpit.ts).
 */
interface Kpi {
  id: string;
  label: string;
  icon: React.ElementType;
  source: string;
}

// ===== MERGED 2 × 20 = 40 KPI CARDS (all 14 dashboard boxes folded in) =====
const KPI_BOXES: Kpi[] = [
  // KEY STATS
  { id: "revenue", label: "Total Revenue", icon: DollarSign, source: "Key Stats" },
  { id: "growth", label: "Growth", icon: TrendingUp, source: "Key Stats" },
  { id: "users", label: "Active Users", icon: Users, source: "Key Stats" },
  { id: "countries", label: "Countries", icon: Globe2, source: "Key Stats" },
  { id: "franchises", label: "Franchises", icon: Building2, source: "Key Stats" },
  // SYSTEM HEALTH
  { id: "server-status", label: "Server Status", icon: Server, source: "System Health" },
  { id: "uptime", label: "Uptime", icon: Activity, source: "System Health" },
  { id: "cpu-load", label: "CPU Load", icon: Cpu, source: "System Health" },
  { id: "ram", label: "RAM Usage", icon: MemoryStick, source: "System Health" },
  { id: "storage", label: "Storage Used", icon: HardDrive, source: "Server Mgmt" },
  // LIVE ACTIVITY + APPROVALS
  { id: "live-activity", label: "Live Activity", icon: Zap, source: "Live Activity" },
  { id: "approvals", label: "Pending Approvals", icon: FileCheck, source: "Approvals" },
  { id: "role-approvals", label: "Role Approvals", icon: BadgeCheck, source: "Approvals" },
  { id: "deploy-approvals", label: "Deployment Requests", icon: Rocket, source: "Approvals" },
  { id: "completed-today", label: "Completed Today", icon: CheckCircle, source: "CEO Overview" },
  // CEO OVERVIEW
  { id: "active-tasks", label: "Active Tasks", icon: Target, source: "CEO Overview" },
  { id: "performance", label: "Performance", icon: Gauge, source: "CEO Overview" },
  // VALA AI
  { id: "ai-jobs", label: "AI Active Jobs", icon: Brain, source: "Vala AI" },
  { id: "ai-queue", label: "AI Queue Count", icon: Bot, source: "Vala AI" },
  { id: "clone-status", label: "Clone Status", icon: Terminal, source: "Vala AI" },
  { id: "deploy-status", label: "Deploy Status", icon: Rocket, source: "Vala AI" },
  { id: "server-alerts", label: "Server Alerts", icon: ShieldCheck, source: "Server Mgmt" },
  // CONTINENT / COUNTRY
  { id: "continents", label: "Active Continents", icon: Globe2, source: "Geo Control" },
  { id: "risk", label: "Region Risk Level", icon: Flag, source: "Geo Control" },
  { id: "compliance", label: "Compliance", icon: BadgeCheck, source: "Legal" },
  // FRANCHISE
  { id: "franchise-active", label: "Franchise Active", icon: Building2, source: "Franchise" },
  { id: "revenue-share", label: "Revenue Share", icon: PiggyBank, source: "Franchise" },
  // SALES & SUPPORT
  { id: "tickets", label: "Open Tickets", icon: Headphones, source: "Sales & Support" },
  { id: "today-revenue", label: "Today Revenue", icon: DollarSign, source: "Sales & Support" },
  { id: "csat", label: "CSAT Score", icon: Star, source: "Support" },
  // PRODUCT
  { id: "products", label: "Total Products", icon: Box, source: "Product Mgr" },
  { id: "update-requests", label: "Update Requests", icon: UserPlus, source: "Product Mgr" },
  // DEMO / LIVE
  { id: "demos", label: "Active Demos", icon: Terminal, source: "Demo Manager" },
  { id: "conversion", label: "Demo Conversion", icon: Percent, source: "Demo Manager" },
  { id: "live-software", label: "Live Software", icon: Eye, source: "Demo Manager" },
  // FINANCE
  { id: "wallet", label: "Wallet Balance", icon: Wallet, source: "Finance" },
  { id: "inflow", label: "Monthly Inflow", icon: TrendingUp, source: "Finance" },
  { id: "outflow", label: "Monthly Outflow", icon: TrendingDown, source: "Finance" },
  { id: "net-profit", label: "Net Profit", icon: PiggyBank, source: "Finance" },
  // ALERTS
  { id: "alerts", label: "Alert Summary", icon: AlertTriangle, source: "Alerts" },
];

function CockpitBanner() {
  return (
    <section className="flex flex-col gap-3">
      <BannerThemeControls />
      <SliderBanner />
    </section>
  );
}


function GuardedIndex() {
  return (
    <RequireRole role={["developer", "finance", "support", "sales_support_manager"]}>
      <Index />
    </RequireRole>
  );
}

function Index() {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<RoleId>("boss_owner");
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // On a phone the full 244px sidebar left the cockpit 146px, so every panel
  // was squeezed and the page scrolled sideways. Below the md breakpoint it
  // starts collapsed to its icons; it still opens on toggle or hover, so
  // nothing is hidden.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) setSidebarCollapsed(true);
  }, []);
  const cockpit = useCockpitFigures();
  const tiles: Record<string, Tile> | null = cockpit.data ? cockpitTiles(cockpit.data) : null;
  const updated = cockpit.data ? relative(cockpit.data.computed_at) : null;

  return (
    <TooltipProvider>
      <div className="dark flex min-h-screen w-full" style={{ background: "radial-gradient(1200px 700px at 18% -10%, #163a72 0%, transparent 60%), radial-gradient(900px 600px at 100% 0%, #0f3a5c 0%, transparent 55%), #070f22" }}>
        <div
          className="flex-shrink-0 transition-[width] duration-300 ease-out"
          style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        >
          <ControlPanelSidebar
            activeRole={activeRole}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
            onRoleSelect={(roleId) => {
              setActiveRole(roleId);
              // ===== ROLE DASHBOARDS → /dashboard/$role (source-repo UI) =====
              const ROLE_DASHBOARD_ROUTES: Partial<Record<RoleId, string>> = {
                rd_author: "author",
                rd_vendor: "vendor",
                rd_reseller: "reseller",
                rd_affiliate: "affiliate",
                rd_franchise: "franchise",
                rd_admin: "admin",
                developer_dashboard: "developer",
                influencer_dashboard: "influencer",
                // Both are real RoleKeys with their own dashboard; neither was
                // reachable from the sidebar that offers them.

              };
              const dashRole = ROLE_DASHBOARD_ROUTES[roleId];
              if (dashRole) {
                void navigate({ to: "/dashboard/$role", params: { role: dashRole } });
                return;
              }
              if (roleId === "legal_manager") {
                void navigate({ to: "/legal-manager" });
                return;
              }
              if (roleId === "assist_manager") {
                void navigate({ to: "/assist-manager" });
                return;
              }
              if (roleId === "promise_tracker_manager") {
                void navigate({ to: "/promise-tracker" });
                return;
              }
              if (roleId === "chat_manager") {
                void navigate({ to: "/chat-manager" });
                return;
              }
              if (roleId === "marketplace_manager") {
                void navigate({ to: "/marketplace-manager" });
                return;
              }
              if (roleId === "creator_manager") {
                void navigate({ to: "/creator-manager" });
                return;
              }
              if (roleId === "reseller_manager") {
                void navigate({ to: "/reseller-manager" });
                return;
              }
              if (roleId === "influencer_manager") {
                void navigate({ to: "/influencer-manager" });
                return;
              }
              if (roleId === "franchise_manager") {
                void navigate({ to: "/franchise-manager" });
                return;
              }


              // Every sidebar entry that has a route of its own. Entries handled
              // by the cases above keep their existing behaviour; this only
              // catches the ones that used to fall through to a toast.
              const MODULE_ROUTES: Record<string, string> = {
                  // AMS Manager is one module: the whole AMS experience with its
                  // own sidebar, mounted at /ams. The older /ams-manager panel is
                  // left in place and still works; this entry opens the module.
                  ams_manager: "/ams",
                  // The Developer Manager control tower. The entry used to open the
                  // generic role dashboard because no module existed behind it.
                  developer_management: "/dev-manager",
                  // The central task control tower. This entry used to report
                  // that nothing was built behind it, which was true.
                  task_management: "/task-manager",
                  chat_manager: "/chat-manager",
                  creator_manager: "/creator-manager",
                  demo_manager: "/demo-manager",
                  finance_manager: "/finance-manager",
                  franchise_manager: "/franchise-manager",
                  influencer_manager: "/influencer-manager",
                  lead_manager: "/lead-manager",
                  marketplace_manager: "/marketplace-manager",
                  reseller_manager: "/reseller-manager",
                  vendor_manager: "/vendor-manager",
                  application_manager: "/application-manager",
                  affiliate_manager: "/affiliate-manager",
                  sales_support_manager: "/sales-support-manager",
                  seo_manager: "/seo-manager",
                  // Each of these was falling through to a success toast while
                  // its module sat at a working address. Verified by request.
                  boss_owner: "/boss",
                  vala_ai_management: "/vala-ai",
                  api_ai_manager: "/ai-api-manager",
                  marketing_management: "/marketing",
                  customer_support_management: "/support",
                  product_manager: "/product-demo-manager",
                  // The button existed; it pointed at the API usage monitor because
                  // no Server Manager module existed to open. It does now.
                  server_manager: "/server-manager",
                  security: "/manager/security",
                  settings: "/manager/settings",
                  home: "/",
                  // The AI CEO command centre. This entry used to report
                  // that nothing was built behind it, which was true.
                  ceo: "/ai-ceo",
              };
              const modulePath = MODULE_ROUTES[roleId];
              if (modulePath) {
                void navigate({ to: modulePath });
                return;
              }

              // Nothing is built behind these yet. Saying "switched" implied
              // something had opened, which is what made the whole sidebar feel
              // broken. Name the gap instead.
              const NOT_BUILT: Record<string, string> = {
                continent_super_admin: "Continent Admin",
                country_head: "Country Admin",
                pro_manager: "Pro Manager",
                pro_user_dashboard: "Pro User Dashboard",
                basic_user_dashboard: "Basic User Dashboard",
                rd_pro: "Pro Dashboard",
              };
              const pending = NOT_BUILT[roleId];
              if (pending) {
                toast.info(`${pending} has not been built yet`, {
                  description: "There is no module behind this entry. It is on the list.",
                });
                return;
              }
              toast.info(`No module is wired to "${roleId.replace(/_/g, " ")}" yet`);
            }}
            onLogout={async () => {
              // This only ever showed "Logging out..." - the session stayed.
              const { error } = await supabase.auth.signOut();
              if (error) {
                toast.error(error.message);
                return;
              }
              void navigate({ to: "/login" });
            }}
          />
        </div>


        <main className="flex min-w-0 flex-1 flex-col gap-6 p-5">
          <CockpitBanner />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/70">
                Master KPI Grid — 2 × 20 (40 Cards)
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                LIVE
              </span>
            </div>
            {cockpit.isError && (
              <div
                role="alert"
                className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
              >
                <span>{(cockpit.error as Error).message}</span>
                <button
                  type="button"
                  onClick={() => void cockpit.refetch()}
                  className="rounded-md border border-red-400/40 px-2 py-1 font-semibold hover:bg-red-500/20"
                >
                  Retry
                </button>
              </div>
            )}
            <KPIGrid>
              {KPI_BOXES.map((kpi) => {
                const tile = tiles?.[kpi.id];
                return (
                  <KPIBox
                    key={kpi.id}
                    {...kpi}
                    value={tile?.value ?? "—"}
                    subValues={tile?.subValues ?? [cockpit.isError ? "Could not be read" : "Loading…"]}
                    status={tile?.status ?? "untracked"}
                    series={tile?.series}
                    trend={tile?.trend}
                    urgency={tile?.status === "critical" ? "critical" : tile?.status === "warning" ? "medium" : "low"}
                    lastUpdate={updated ?? undefined}
                    activity={
                      !tile
                        ? cockpit.isError
                          ? "Not available"
                          : "Loading…"
                        : tile.status === "untracked"
                          ? "Not recorded anywhere yet"
                          : `Updated ${updated}`
                    }
                    isSelected={selectedKpi === kpi.id}
                    onClick={() => setSelectedKpi(kpi.id === selectedKpi ? null : kpi.id)}
                  />
                );
              })}
            </KPIGrid>
          </section>
        </main>

        <aside
          className="hidden w-[300px] flex-shrink-0 xl:block"
          style={{ borderLeft: "2px solid rgba(88,160,255,0.34)" }}
        >
          <div
            className="sticky top-0 flex h-screen flex-col overflow-y-auto"
            style={{ background: "linear-gradient(180deg, #10254a 0%, #0b1a35 55%, #060d1d 100%)" }}
          >
            <div
              className="flex items-center justify-between gap-2 px-3 py-2.5"
              style={{ borderBottom: "2px solid rgba(88,160,255,0.34)" }}
            >
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-foreground">
                Command Center
              </h2>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                LIVE
              </span>
            </div>
            <div className="px-2.5 pt-2.5">
              <ExecutiveRotator />
            </div>

            <CommandCenter />

          </div>
        </aside>
      </div>
      <ValaAiAgent />
      <Toaster />
    </TooltipProvider>
  );
}

