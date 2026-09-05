import { Link, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  ChevronDown,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";

import { MANAGER_NAV, findGroup, type NavGroup } from "@/lib/manager-nav";
import { inr, num } from "@/components/manager/primitives";
import { useManyRecords } from "@/lib/manager-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manager")({
  component: ManagerLayout,
});

const COLLAPSE_KEY = "sv:sidebar:collapsed";

function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  return { collapsed, toggleCollapsed, mobileOpen, setMobileOpen };
}

function SidebarContent({
  collapsed,
  onToggleCollapsed,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}) {
  const location = useLocation();
  const activeSection = location.pathname.split("/")[2] ?? "dashboard";
  const activeView = (location.search as { view?: string })?.view;
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const filtered = useMemo<NavGroup[] | null>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return MANAGER_NAV.map((g) => ({
      ...g,
      children: g.label.toLowerCase().includes(q)
        ? g.children
        : g.children.filter((c) => c.label.toLowerCase().includes(q)),
    })).filter((g) => g.children.length > 0 || g.label.toLowerCase().includes(q));
  }, [query]);

  const groupOpen = (group: NavGroup) => openGroups[group.id] ?? group.id === activeSection;

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          to="/manager/$section"
          params={{ section: "dashboard" }}
          className="flex min-w-0 items-center gap-2"
          onClick={onCloseMobile}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-sm font-bold text-primary-foreground">
            SV
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold tracking-tight">Software Vala</span>
              <span className="block truncate text-[11px] text-muted-foreground">AI API Manager</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={onToggleCollapsed}
            className="ml-auto hidden h-8 w-8 place-items-center rounded-lg border border-sidebar-border text-muted-foreground transition-colors hover:text-foreground lg:grid"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onCloseMobile}
          className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-sidebar-border text-muted-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {collapsed && (
        <button
          onClick={onToggleCollapsed}
          className="mx-auto mt-3 hidden h-8 w-8 place-items-center rounded-lg border border-sidebar-border text-muted-foreground hover:text-foreground lg:grid"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {!collapsed && (
        <div className="shrink-0 px-3 pt-3">
          <div className="focus-glow flex items-center gap-2 rounded-lg border border-sidebar-border bg-surface px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a module…"
              aria-label="Find a module"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-3">
        {(filtered ?? MANAGER_NAV).map((group) => {
          const Icon = group.icon;
          const isActive = activeSection === group.id;
          const open = filtered ? true : groupOpen(group);
          return (
            <div key={group.id}>
              <div className={cn("flex items-center gap-1", collapsed && "justify-center")}>
                <Link
                  to="/manager/$section"
                  params={{ section: group.id }}
                  onClick={onCloseMobile}
                  title={group.label}
                  className={cn(
                    "group/item relative flex flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors duration-150",
                    collapsed && "flex-none justify-center px-0",
                    isActive
                      ? "bg-primary/18 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{group.label}</span>}
                </Link>
                {!collapsed && (
                  <button
                    type="button"
                    aria-label={`Toggle ${group.label}`}
                    aria-expanded={open}
                    onClick={() => setOpenGroups((s) => ({ ...s, [group.id]: !open }))}
                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
                    />
                  </button>
                )}
              </div>

              {!collapsed && open ? (
                <div className="mt-0.5 ml-4 space-y-0.5 border-l border-sidebar-border pl-2">
                  {group.children.map((child) => {
                    const ChildIcon = child.icon;
                    const childActive = isActive && activeView === child.id;
                    return (
                      <Link
                        key={child.id}
                        to="/manager/$section"
                        params={{ section: group.id }}
                        search={{ view: child.id }}
                        onClick={onCloseMobile}
                        className={cn(
                          "relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                          childActive
                            ? "bg-primary/15 font-medium text-foreground"
                            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                        )}
                      >
                        <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
        {filtered && filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No modules match “{query}”.</p>
        ) : null}
      </nav>
    </div>
  );
}

function TopBar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const location = useLocation();
  const group = findGroup(location.pathname.split("/")[2] ?? "dashboard");
  const { data } = useManyRecords([
    { table: "api_services", select: "id,status" },
    { table: "wallets", select: "id,name,balance,status" },
    { table: "security_alerts", select: "id,status", filters: [{ column: "status", value: "open" }] },
    { table: "emergency_controls", select: "id,engaged" },
  ]);

  const stats = useMemo(() => {
    const [services = [], wallets = [], alerts = [], controls = []] = data ?? [];
    const online = services.filter((s) => s['status'] === "active" || s['status'] === "healthy").length;
    const primary = wallets[0];
    return {
      online,
      total: services.length,
      balance: Number(primary?.['balance'] ?? 0),
      alerts: alerts.length,
      frozen: controls.some((c) => c['engaged']),
    };
  }, [data]);

  const pill =
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <button
        onClick={onOpenMobile}
        className="icon3d grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:text-foreground lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <p className="truncate text-sm font-semibold tracking-tight">{group?.label ?? "AI API Manager"}</p>

      <div className="ml-auto flex items-center gap-2">
        <span className={cn(pill, "hidden border-status-success/40 text-status-success sm:inline-flex")}>
          <Activity className="h-3.5 w-3.5" /> {num(stats.online)}/{num(stats.total)} online
        </span>
        <span className={cn(pill, "hidden border-primary/40 text-primary-glow md:inline-flex")}>
          <Wallet className="h-3.5 w-3.5" /> {inr(stats.balance)}
        </span>
        <span
          className={cn(
            pill,
            stats.alerts > 0
              ? "border-status-error/40 text-status-error"
              : "border-border text-muted-foreground",
          )}
        >
          <Bell className="h-3.5 w-3.5" /> {num(stats.alerts)}
        </span>
        {stats.frozen ? (
          <span className={cn(pill, "border-status-error/40 text-status-error")}>
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Controls engaged</span>
          </span>
        ) : null}
      </div>
    </header>
  );
}

function ManagerLayout() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();
  const location = useLocation();
  const isFinanceRoute = location.pathname === "/manager/finance";

  return (
    <div className="creator-theme mm-scope flex min-h-screen w-full bg-background text-foreground">
      {!isFinanceRoute ? (
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-background/80 backdrop-blur-xl transition-[width] duration-200 lg:flex",
            collapsed ? "w-[72px]" : "w-[264px]",
          )}
        >
          <SidebarContent
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
            onCloseMobile={() => setMobileOpen(false)}
          />
        </aside>
      ) : null}

      {!isFinanceRoute && mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu overlay"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-sidebar-border bg-background shadow-2xl">
            <SidebarContent
              collapsed={false}
              onToggleCollapsed={toggleCollapsed}
              onCloseMobile={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {!isFinanceRoute ? <TopBar onOpenMobile={() => setMobileOpen(true)} /> : null}
        <main className={cn(
          "mx-auto w-full flex-1",
          isFinanceRoute ? "p-0" : "max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10",
        )}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
