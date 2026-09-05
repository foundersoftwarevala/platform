import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bell, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { useState } from "react";

import { marketingNav } from "@/components/marketing/nav";
import { StatusBadge } from "@/components/marketing/kit";
import { Toaster } from "@/components/ui/sonner";
import { tableQuery } from "@/lib/marketing/api";
import { cn } from "@/lib/utils";
import { RequireRole } from "@/components/auth/RequireRole";

export const Route = createFileRoute("/marketing")({
  component: MarketingLayout,
});

function MarketingLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const alerts = useQuery(tableQuery("marketing_alerts", { column: "created_at" }));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  const openAlerts = (alerts.data ?? []).filter((a) => a.status === "open");
  const critical = openAlerts.some((a) => a.severity === "critical");
  const health = critical ? "critical" : openAlerts.length > 0 ? "warning" : "active";
  const active = marketingNav.find((item) => item.to === pathname) ?? marketingNav[0];
  const filteredNav = marketingNav.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <RequireRole role="marketing">
      <div className="flex min-h-screen bg-background text-foreground">
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen shrink-0 flex-col border-r border-sidebar-border bg-background/95 shadow-glow backdrop-blur-xl transition-[width,transform] duration-200 md:sticky md:z-30 md:flex",
        collapsed ? "w-[72px]" : "w-[264px]",
        mobileOpen ? "flex w-[264px] translate-x-0" : "hidden -translate-x-full md:flex md:translate-x-0",
      )}>
        <div className={cn("flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3", collapsed && "justify-center px-0")}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">SV</span>
            {!collapsed && <span className="min-w-0 leading-tight"><span className="block truncate text-sm font-semibold tracking-tight">Software Vala</span><span className="mt-1 block truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Marketing Manager</span></span>}
          </div>
          {!collapsed && <button onClick={() => setCollapsed(true)} className="ml-auto hidden h-8 w-8 place-items-center rounded-lg border border-sidebar-border text-muted-foreground transition-colors hover:text-foreground md:grid" aria-label="Collapse sidebar"><PanelLeftClose className="h-4 w-4" /></button>}
          <button onClick={() => setMobileOpen(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-sidebar-border text-muted-foreground md:hidden" aria-label="Close menu"><X className="h-4 w-4" /></button>
        </div>
        {collapsed && <button onClick={() => setCollapsed(false)} className="mx-auto mt-3 hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground md:grid" aria-label="Expand sidebar"><PanelLeftOpen className="h-4 w-4" /></button>}
        {!collapsed && <div className="shrink-0 px-3 pt-3"><div className="focus-glow flex items-center gap-2 rounded-lg border border-sidebar-border bg-surface px-2.5 py-1.5"><Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a module…" aria-label="Find a module" className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground" /></div></div>}

        <nav aria-label="Marketing manager navigation" className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {filteredNav.map((item) => {
            const isActive = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                title={item.label}
                className={cn(
                  "group/item relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-150",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-gradient-brand font-medium text-brand-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {isActive && <span className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-primary" />}
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-sidebar-border px-3 py-3 text-[11px] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Campaign health
            </span>
            <StatusBadge value={health} />
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-xl lg:px-5">
          <button onClick={() => setMobileOpen(true)} className="icon3d grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:text-foreground md:hidden" aria-label="Open menu"><Menu className="h-[18px] w-[18px]" /></button>
          <div className="hidden min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-surface/80 px-3 py-2 sm:flex sm:max-w-md">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Marketing workspace</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-muted-foreground">Marketing Manager</p>
              <p className="truncate text-sm font-semibold">{active?.label}</p>
            </div>
            <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground">
              <Bell className="h-4 w-4" />
              {openAlerts.length > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {openAlerts.length}
                </span>
              ) : null}
            </span>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-border/60 px-4 py-2 md:hidden">
          {marketingNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium",
                pathname === item.to
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <Outlet />
        </main>
      </div>

      <Toaster />
      </div>
    </RequireRole>
  );
}
