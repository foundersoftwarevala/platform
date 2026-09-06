import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListChecks,
  PlusCircle,
  Activity,
  Clock,
  ShieldAlert,
  CheckCircle2,
  FolderTree,
  TrendingUp,
  Coins,
  Sparkles,
  ScrollText,
  Settings2,
} from "lucide-react";

import { cn } from "@/lib/utils";

type PTNavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

export const PT_NAV: PTNavItem[] = [
  { to: "/promise-tracker", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/promise-tracker/all", label: "All Promises", icon: ListChecks },
  { to: "/promise-tracker/create", label: "Create Promise", icon: PlusCircle },
  { to: "/promise-tracker/active", label: "Active Promises", icon: Activity },
  { to: "/promise-tracker/delayed", label: "Delayed", icon: Clock },
  { to: "/promise-tracker/broken", label: "Broken", icon: ShieldAlert },
  { to: "/promise-tracker/fulfilled", label: "Fulfilled", icon: CheckCircle2 },
  { to: "/promise-tracker/categories", label: "Categories", icon: FolderTree },
  { to: "/promise-tracker/escalations", label: "Escalations", icon: TrendingUp },
  { to: "/promise-tracker/rules", label: "Fine & Tip Rules", icon: Coins },
  { to: "/promise-tracker/insights", label: "AI Insights", icon: Sparkles },
  { to: "/promise-tracker/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/promise-tracker/settings", label: "Settings", icon: Settings2 },
];

export function PTSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <div className="mb-4 flex items-center gap-3 px-2 pt-2">
        <div className="tracker-tile flex size-10 items-center justify-center rounded-xl">
          <ListChecks className="size-5" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold leading-tight">Promise Tracker</p>
          <p className="text-xs text-muted-foreground">Software Vala</p>
        </div>
      </div>

      {PT_NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: item.exact ?? false }}
          onClick={onNavigate}
          className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          activeProps={{
            className: cn(
              "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-[inset_2px_0_0_0_var(--color-primary)]",
            ),
          }}
        >
          <item.icon className="size-4 shrink-0 opacity-80" />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
