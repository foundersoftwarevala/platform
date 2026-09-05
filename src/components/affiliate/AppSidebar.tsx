import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, BarChart3, Bot, Boxes, ChevronDown, ClipboardList, Coins, Download, FileText,
  Gauge, Gift, LayoutDashboard, LifeBuoy, Link2, Mail, Megaphone, Network, PanelLeftClose,
  PanelLeftOpen, Receipt, ScrollText, Search, Settings, ShieldCheck, ShoppingBag, ShoppingCart,
  Store, Tag, Target, Upload, UserPlus, Users, Wallet, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { AFFILIATE_NAV, type WallNav } from "@/lib/affiliate-nav";

const COLLAPSE_KEY = "sv:affiliate:sidebar:collapsed";

const GROUP_LABELS: Record<WallNav["group"], string> = {
  overview: "Overview",
  network: "Network",
  growth: "Growth",
  commerce: "Commerce",
  finance: "Finance",
  ops: "Operations",
  system: "System",
};

const GROUP_ORDER: WallNav["group"][] = [
  "overview", "network", "growth", "commerce", "finance", "ops", "system",
];

const ICONS: Record<string, LucideIcon> = {
  "/affiliate-manager": LayoutDashboard,
  "/affiliate-manager/applications": UserPlus,
  "/affiliate-manager/affiliates": Users,
  "/affiliate-manager/referral-network": Network,
  "/affiliate-manager/affiliate-links": Link2,
  "/affiliate-manager/referral-codes": Tag,
  "/affiliate-manager/campaigns": Megaphone,
  "/affiliate-manager/leads": Target,
  "/affiliate-manager/customers": Users,
  "/affiliate-manager/products": Boxes,
  "/affiliate-manager/marketplace": Store,
  "/affiliate-manager/coupons": Gift,
  "/affiliate-manager/sales": ShoppingBag,
  "/affiliate-manager/orders": ShoppingCart,
  "/affiliate-manager/commissions": Coins,
  "/affiliate-manager/wallet": Wallet,
  "/affiliate-manager/payouts": Receipt,
  "/affiliate-manager/performance": Gauge,
  "/affiliate-manager/marketing": Zap,
  "/affiliate-manager/communication": Mail,
  "/affiliate-manager/support": LifeBuoy,
  "/affiliate-manager/compliance": ShieldCheck,
  "/affiliate-manager/documents": FileText,
  "/affiliate-manager/analytics": BarChart3,
  "/affiliate-manager/reports": ClipboardList,
  "/affiliate-manager/audit-log": ScrollText,
  "/affiliate-manager/bulk-actions": Bot,
  "/affiliate-manager/import": Upload,
  "/affiliate-manager/export": Download,
  "/affiliate-manager/settings": Settings,
  "/affiliate-manager/realtime-test": Activity,
};

export function useSidebarState() {
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

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapsed, mobileOpen, onCloseMobile }: AppSidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const primary = useMemo(() => AFFILIATE_NAV.filter((i) => i.group === "overview"), []);
  const groups = useMemo(
    () =>
      GROUP_ORDER.filter((g) => g !== "overview").map((g) => ({
        label: GROUP_LABELS[g],
        items: AFFILIATE_NAV.filter((i) => i.group === g),
      })).filter((g) => g.items.length > 0),
    [],
  );

  const isActive = (to: string) =>
    to === "/affiliate-manager"
      ? pathname === "/affiliate-manager" || pathname === "/affiliate-manager/"
      : pathname.startsWith(to);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query, groups]);

  const groupOpen = (label: string, items: WallNav[]) =>
    openGroups[label] ?? items.some((i) => isActive(i.to));

  const ItemLink = ({ item }: { item: WallNav }) => {
    const active = isActive(item.to);
    const Icon = ICONS[item.to] ?? LayoutDashboard;
    return (
      <Link
        to={item.to}
        onClick={onCloseMobile}
        title={item.label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group/item relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors duration-150",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary/18 text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-foreground/4",
        )}
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const content = (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2 border-b border-border px-3 shrink-0", collapsed && "justify-center px-0")}>
        <Link to="/affiliate-manager" className="flex min-w-0 items-center gap-2" onClick={onCloseMobile}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-linear-to-br from-primary to-primary-glow text-primary-foreground font-bold">
            SV
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-sm font-semibold tracking-tight">Software Vala</span>
              <span className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Affiliate Manager
              </span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={onToggleCollapsed}
            className="ml-auto hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground lg:grid"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onCloseMobile}
          className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {collapsed && (
        <button
          onClick={onToggleCollapsed}
          className="mx-auto mt-3 hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground lg:grid"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {!collapsed && (
        <div className="shrink-0 px-3 pt-3">
          <div className="focus-glow flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
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

      <nav aria-label="Affiliate manager workspaces" className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {primary.map((item) => (
            <ItemLink key={item.to} item={item} />
          ))}
        </div>

        {(filtered ?? groups).map((group) => {
          const open = filtered ? true : groupOpen(group.label, group.items);
          if (collapsed) {
            return (
              <div key={group.label} className="space-y-0.5 border-t border-border/60 pt-2">
                {group.items.map((item) => (
                  <ItemLink key={item.to} item={item} />
                ))}
              </div>
            );
          }
          return (
            <div key={group.label}>
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [group.label]: !open }))}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                {group.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
              </button>
              {open && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <ItemLink key={item.to} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-border px-2 py-2">
        <ItemLink item={{ to: "/affiliate-manager/settings", label: "Settings", group: "system" }} />
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background/80 backdrop-blur-xl transition-[width] duration-200 lg:flex",
          collapsed ? "w-18" : "w-66",
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-label="Close menu overlay"
          />
          <div className="absolute inset-y-0 left-0 w-70 max-w-[85vw] border-r border-border bg-background shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
