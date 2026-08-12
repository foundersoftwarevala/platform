import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

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
  component: Index,
});

type Status = "healthy" | "warning" | "critical" | "action";
type Urgency = "low" | "medium" | "high" | "critical";

interface Kpi {
  id: string;
  label: string;
  value: string;
  subValues: string[];
  status: Status;
  icon: React.ElementType;
  source: string;
  urgency: Urgency;
  lastUpdate: string;
}

// ===== MERGED 2 × 20 = 40 KPI CARDS (all 14 dashboard boxes folded in) =====
const KPI_BOXES: Kpi[] = [
  // KEY STATS
  { id: "revenue", label: "Total Revenue", value: "₹42.5L", subValues: ["Finance ledger"], status: "healthy", icon: DollarSign, source: "Key Stats", urgency: "low", lastUpdate: "2 min ago" },
  { id: "growth", label: "Growth", value: "+18%", subValues: ["Month over month"], status: "healthy", icon: TrendingUp, source: "Key Stats", urgency: "low", lastUpdate: "2 min ago" },
  { id: "users", label: "Active Users", value: "2,847", subValues: ["Across all products"], status: "healthy", icon: Users, source: "Key Stats", urgency: "low", lastUpdate: "1 min ago" },
  { id: "countries", label: "Countries", value: "12", subValues: ["4 continents"], status: "healthy", icon: Globe2, source: "Key Stats", urgency: "low", lastUpdate: "10 min ago" },
  { id: "franchises", label: "Franchises", value: "24", subValues: ["22 active, 2 pending"], status: "warning", icon: Building2, source: "Key Stats", urgency: "medium", lastUpdate: "8 min ago" },
  // SYSTEM HEALTH
  { id: "server-status", label: "Server Status", value: "ONLINE", subValues: ["All nodes reachable"], status: "healthy", icon: Server, source: "System Health", urgency: "low", lastUpdate: "just now" },
  { id: "uptime", label: "Uptime", value: "99.97%", subValues: ["Last 30 days"], status: "healthy", icon: Activity, source: "System Health", urgency: "low", lastUpdate: "5 min ago" },
  { id: "cpu-load", label: "CPU Load", value: "32%", subValues: ["Cluster average"], status: "healthy", icon: Cpu, source: "System Health", urgency: "low", lastUpdate: "30 sec ago" },
  { id: "ram", label: "RAM Usage", value: "58%", subValues: ["128 GB pool"], status: "warning", icon: MemoryStick, source: "System Health", urgency: "medium", lastUpdate: "30 sec ago" },
  { id: "storage", label: "Storage Used", value: "38%", subValues: ["1.9 TB free"], status: "healthy", icon: HardDrive, source: "Server Mgmt", urgency: "low", lastUpdate: "25 min ago" },
  // LIVE ACTIVITY + APPROVALS
  { id: "live-activity", label: "Live Activity", value: "45", subValues: ["Events in last hour"], status: "action", icon: Zap, source: "Live Activity", urgency: "medium", lastUpdate: "just now" },
  { id: "approvals", label: "Pending Approvals", value: "6", subValues: ["3 role · 2 deploy · 1 legal"], status: "action", icon: FileCheck, source: "Approvals", urgency: "high", lastUpdate: "9 min ago" },
  { id: "role-approvals", label: "Role Approvals", value: "3", subValues: ["Awaiting boss sign-off"], status: "action", icon: BadgeCheck, source: "Approvals", urgency: "high", lastUpdate: "9 min ago" },
  { id: "deploy-approvals", label: "Deployment Requests", value: "2", subValues: ["Build #4521 queued"], status: "warning", icon: Rocket, source: "Approvals", urgency: "medium", lastUpdate: "5 min ago" },
  { id: "completed-today", label: "Completed Today", value: "12", subValues: ["Across all teams"], status: "healthy", icon: CheckCircle, source: "CEO Overview", urgency: "low", lastUpdate: "12 min ago" },
  // CEO OVERVIEW
  { id: "active-tasks", label: "Active Tasks", value: "24", subValues: ["CEO workstream"], status: "action", icon: Target, source: "CEO Overview", urgency: "medium", lastUpdate: "6 min ago" },
  { id: "performance", label: "Performance", value: "92%", subValues: ["On track"], status: "healthy", icon: Gauge, source: "CEO Overview", urgency: "low", lastUpdate: "1 hr ago" },
  // VALA AI
  { id: "ai-jobs", label: "AI Active Jobs", value: "12", subValues: ["Vala AI workers"], status: "action", icon: Brain, source: "Vala AI", urgency: "medium", lastUpdate: "just now" },
  { id: "ai-queue", label: "AI Queue Count", value: "45", subValues: ["Avg wait 42 sec"], status: "warning", icon: Bot, source: "Vala AI", urgency: "high", lastUpdate: "just now" },
  { id: "clone-status", label: "Clone Status", value: "Ready", subValues: ["Last clone 2 min ago"], status: "healthy", icon: Terminal, source: "Vala AI", urgency: "low", lastUpdate: "2 min ago" },
  { id: "deploy-status", label: "Deploy Status", value: "Ready", subValues: ["Pipeline green"], status: "healthy", icon: Rocket, source: "Vala AI", urgency: "low", lastUpdate: "4 min ago" },
  { id: "server-alerts", label: "Server Alerts", value: "0", subValues: ["Health excellent"], status: "healthy", icon: ShieldCheck, source: "Server Mgmt", urgency: "low", lastUpdate: "20 min ago" },
  // CONTINENT / COUNTRY
  { id: "continents", label: "Active Continents", value: "4", subValues: ["Top region: Asia"], status: "healthy", icon: Globe2, source: "Geo Control", urgency: "low", lastUpdate: "40 min ago" },
  { id: "risk", label: "Region Risk Level", value: "Low", subValues: ["No escalations"], status: "healthy", icon: Flag, source: "Geo Control", urgency: "low", lastUpdate: "40 min ago" },
  { id: "compliance", label: "Compliance", value: "100%", subValues: ["12 countries cleared"], status: "healthy", icon: BadgeCheck, source: "Legal", urgency: "low", lastUpdate: "1 day ago" },
  // FRANCHISE
  { id: "franchise-active", label: "Franchise Active", value: "22", subValues: ["2 onboarding"], status: "healthy", icon: Building2, source: "Franchise", urgency: "low", lastUpdate: "50 min ago" },
  { id: "revenue-share", label: "Revenue Share", value: "₹18.2L", subValues: ["+15% growth"], status: "healthy", icon: PiggyBank, source: "Franchise", urgency: "low", lastUpdate: "1 hr ago" },
  // SALES & SUPPORT
  { id: "tickets", label: "Open Tickets", value: "34", subValues: ["28 resolved today"], status: "warning", icon: Headphones, source: "Sales & Support", urgency: "medium", lastUpdate: "3 min ago" },
  { id: "today-revenue", label: "Today Revenue", value: "₹2.4L", subValues: ["SLA on track"], status: "healthy", icon: DollarSign, source: "Sales & Support", urgency: "low", lastUpdate: "7 min ago" },
  { id: "csat", label: "CSAT Score", value: "4.7/5", subValues: ["1,204 ratings"], status: "healthy", icon: Star, source: "Support", urgency: "low", lastUpdate: "15 min ago" },
  // PRODUCT
  { id: "products", label: "Total Products", value: "18", subValues: ["14 live · 4 in dev"], status: "healthy", icon: Box, source: "Product Mgr", urgency: "low", lastUpdate: "35 min ago" },
  { id: "update-requests", label: "Update Requests", value: "6", subValues: ["2 pending review"], status: "action", icon: UserPlus, source: "Product Mgr", urgency: "medium", lastUpdate: "22 min ago" },
  // DEMO / LIVE
  { id: "demos", label: "Active Demos", value: "8", subValues: ["5 scheduled"], status: "action", icon: Terminal, source: "Demo Manager", urgency: "medium", lastUpdate: "18 min ago" },
  { id: "conversion", label: "Demo Conversion", value: "42%", subValues: ["12 demo requests"], status: "healthy", icon: Percent, source: "Demo Manager", urgency: "low", lastUpdate: "18 min ago" },
  { id: "live-software", label: "Live Software", value: "14", subValues: ["All deployments stable"], status: "healthy", icon: Eye, source: "Demo Manager", urgency: "low", lastUpdate: "30 min ago" },
  // FINANCE
  { id: "wallet", label: "Wallet Balance", value: "₹8.5L", subValues: ["Payout processed"], status: "healthy", icon: Wallet, source: "Finance", urgency: "low", lastUpdate: "12 min ago" },
  { id: "inflow", label: "Monthly Inflow", value: "₹24.3L", subValues: ["+9% MoM"], status: "healthy", icon: TrendingUp, source: "Finance", urgency: "low", lastUpdate: "1 hr ago" },
  { id: "outflow", label: "Monthly Outflow", value: "₹12.1L", subValues: ["Within budget"], status: "warning", icon: TrendingDown, source: "Finance", urgency: "medium", lastUpdate: "1 hr ago" },
  { id: "net-profit", label: "Net Profit", value: "+₹12.2L", subValues: ["Margin 50.2%"], status: "healthy", icon: PiggyBank, source: "Finance", urgency: "low", lastUpdate: "1 hr ago" },
  // ALERTS
  { id: "alerts", label: "Alert Summary", value: "10", subValues: ["0 critical · 3 warning · 7 info"], status: "critical", icon: AlertTriangle, source: "Alerts", urgency: "critical", lastUpdate: "just now" },
];

function CockpitBanner() {
  return (
    <section className="flex flex-col gap-3">
      <BannerThemeControls />
      <SliderBanner />
    </section>
  );
}


function Index() {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<RoleId>("boss_owner");
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
              };
              const dashRole = ROLE_DASHBOARD_ROUTES[roleId];
              if (dashRole) {
                void navigate({ to: "/dashboard/$role", params: { role: dashRole } });
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


              toast.success(`Switched to ${roleId.replace(/_/g, " ")}`);
            }}
            onLogout={() => toast.info("Logging out...")}
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
            <KPIGrid>
              {KPI_BOXES.map((kpi) => (
                <KPIBox
                  key={kpi.id}
                  {...kpi}
                  isSelected={selectedKpi === kpi.id}
                  onClick={() => setSelectedKpi(kpi.id === selectedKpi ? null : kpi.id)}
                />
              ))}
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

