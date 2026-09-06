import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronDown,
  Code2,
  FileCode,
  FileText,
  Gauge,
  Globe,
  Layers,
  LayoutDashboard,
  Link2,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  MousePointerClick,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Video,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { seoQueries } from "@/lib/seo-queries";
import { cn } from "@/lib/utils";

/**
 * `to` is where the entry opens. `search` carries the SEO Manager module id
 * when the destination is a section of that console. `pending` marks an entry
 * that has no module anywhere in the project yet: it stays visible and keeps
 * its place in the menu, but it is rendered as disabled rather than as a link
 * to a page that does not exist.
 */
type NavItem = {
  to?: string;
  search?: { module: string };
  pending?: boolean;
  label: string;
  icon: typeof Search;
};

// Every destination below was checked against the generated route tree. An
// entry marked `pending` has no module anywhere in the project — not in the SEO
// Manager, not in Marketing, not in Lead Manager — so it is shown as disabled
// instead of linking to a 404.
const SEO_MANAGER = "/seo-manager";

const primary: NavItem[] = [
  { to: SEO_MANAGER, search: { module: "dashboard" }, label: "Overview", icon: LayoutDashboard },
];

export const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Optimization",
    items: [
      // "/" used to send an SEO operator to the public marketplace home page.
      { to: SEO_MANAGER, search: { module: "dashboard" }, label: "Overview", icon: LayoutDashboard },
      { to: "/pages", label: "Pages", icon: FileText },
      { to: "/keywords", label: "Keywords", icon: Search },
      { to: SEO_MANAGER, search: { module: "meta" }, label: "Meta Rules", icon: Code2 },
      { to: SEO_MANAGER, search: { module: "robots" }, label: "Indexing & Crawl", icon: Globe },
      { to: SEO_MANAGER, search: { module: "health" }, label: "Performance", icon: TrendingUp },
      { to: SEO_MANAGER, search: { module: "canonical" }, label: "Technical SEO", icon: Gauge },
      { to: SEO_MANAGER, search: { module: "health" }, label: "Issues & Fixes", icon: AlertTriangle },
      { to: SEO_MANAGER, search: { module: "reports" }, label: "Audit", icon: Shield },
      { to: SEO_MANAGER, search: { module: "reports" }, label: "Reports", icon: BarChart3 },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { to: SEO_MANAGER, search: { module: "aiwriter" }, label: "AI SEO Assistant", icon: Sparkles },
      { to: SEO_MANAGER, search: { module: "competitor" }, label: "Competitors", icon: Users },
      { to: SEO_MANAGER, search: { module: "backlinks" }, label: "Backlinks", icon: Link2 },
      { to: SEO_MANAGER, search: { module: "intl" }, label: "Regional Modes", icon: Globe },
      { pending: true, label: "Heatmap & Behavior", icon: MousePointerClick },
      { pending: true, label: "Spam Guard", icon: ShieldAlert },
      { to: SEO_MANAGER, search: { module: "product" }, label: "Product SEO Library", icon: Package },
    ],
  },
  {
    title: "Growth",
    items: [
      { to: "/marketing/content", label: "Content Generator", icon: FileCode },
      { to: "/marketing/creatives", label: "AI Reels Creator", icon: Video },
      { to: "/lead-manager", label: "Lead Intelligence", icon: Target },
      { to: "/marketing/campaigns", label: "Ads Automation", icon: Megaphone },
      { pending: true, label: "Email Automation", icon: Mail },
      { pending: true, label: "Social Auto-Post", icon: Share2 },
      { pending: true, label: "Comments & Inbox", icon: MessageSquare },
      { to: "/marketing/ai-automation", label: "Automation Flows", icon: Workflow },
      { to: "/marketing/schedules", label: "Automation Scheduler", icon: Calendar },
    ],
  },
];

const bottomItems: NavItem[] = [
  { pending: true, label: "Alerts", icon: Zap },
  { to: SEO_MANAGER, search: { module: "health" }, label: "Diagnostics", icon: Activity },
  { to: SEO_MANAGER, search: { module: "settings" }, label: "Settings & Integrations", icon: Plug },
];

const sidebarGroups = navGroups.map((g) =>
  g.title === "Optimization"
    ? { ...g, items: g.items.filter((i) => i.label !== "Overview") }
    : g,
);

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

function HealthPill() {
  const { data: issues } = useQuery(seoQueries.issues());
  const open = (issues ?? []).filter((i) => i.status !== "resolved");
  const critical = open.filter((i) => i.severity === "high").length;
  const label = critical > 2 ? "Critical" : critical > 0 ? "Warning" : "Good";
  const tone =
    label === "Critical"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : label === "Warning"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-success/15 text-success border-success/30";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
        tone,
      )}
    >
      <Activity className="h-3.5 w-3.5" aria-hidden="true" />
      SEO Health: {label}
    </div>
  );
}

function AppSidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return sidebarGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  const groupOpen = (title: string, items: NavItem[]) =>
    openGroups[title] ?? items.some((i) => (i.to ? isActive(i.to) : false));

  const ItemLink = ({ item }: { item: NavItem }) => {
    const base =
      "group/item relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors duration-150";

    // No module exists for this one anywhere yet. It keeps its place in the
    // menu, but it does not pretend to be a link.
    if (item.pending || !item.to) {
      return (
        <div
          aria-disabled="true"
          title={`${item.label} — not built yet`}
          className={cn(base, "cursor-not-allowed text-muted-foreground/45", collapsed && "justify-center px-0")}
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed && (
            <>
              <span className="truncate">{item.label}</span>
              <span className="ml-auto shrink-0 rounded-md border border-border/60 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider">
                Soon
              </span>
            </>
          )}
        </div>
      );
    }

    const active = isActive(item.to);
    return (
      <Link
        to={item.to}
        search={item.search}
        onClick={onCloseMobile}
        title={item.label}
        className={cn(
          base,
          collapsed && "justify-center px-0",
          active
            ? "bg-primary/18 font-medium text-foreground"
            : "text-muted-foreground hover:bg-primary/10 hover:text-foreground",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />
        )}
        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const content = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2 border-b border-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <Link to="/" className="flex min-w-0 items-center gap-2" onClick={onCloseMobile}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">
            SV
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight">
                Software Vala
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">SEO Manager</span>
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
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
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

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {primary.map((item) => (
            <ItemLink key={item.label} item={item} />
          ))}
        </div>

        {(filtered ?? sidebarGroups).map((group) => {
          const open = filtered ? true : groupOpen(group.title, group.items);
          if (collapsed) {
            return (
              <div key={group.title} className="space-y-0.5 border-t border-border/60 pt-2">
                {group.items.map((item) => (
                  <ItemLink key={item.label} item={item} />
                ))}
              </div>
            );
          }
          return (
            <div key={group.title}>
              <button
                onClick={() => setOpenGroups((s) => ({ ...s, [group.title]: !open }))}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                {group.title}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
                />
              </button>
              {open && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <ItemLink key={item.label} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-border px-2 py-2">
        {bottomItems.map((item) => (
          <ItemLink key={item.label} item={item} />
        ))}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background/80 backdrop-blur-xl transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-[264px]",
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
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-border bg-background shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      {children}
    </div>
  );
}

export function SeoShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string | undefined;
  actions?: ReactNode | undefined;
  children: ReactNode;
}) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current =
    navGroups.flatMap((g) => g.items).find((i) => i.to === pathname) ??
    bottomItems.find((i) => i.to === pathname);
  const HeroIcon = current?.icon ?? Layers;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 px-3 lg:px-5">
            <button
              className="icon3d grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>

            <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{title}</p>

            <div className="flex-1" />

            <div className="flex items-center gap-2">
              {actions}
              <HealthPill />
            </div>
          </div>
        </header>

        <main className="flex-1">
          <PageShell>
            <section className="hero-surface relative overflow-hidden p-5 sm:p-7 lg:p-9">
              <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-pink/40 blur-3xl" />

              <div className="relative min-w-0">
                <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary-foreground/25 bg-primary-foreground/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
                  <HeroIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">Software Vala · SEO Manager</span>
                </div>
                <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1.5 max-w-2xl text-sm text-primary-foreground/80 sm:text-[15px]">
                    {description}
                  </p>
                ) : null}
              </div>
            </section>

            <div className="animate-in fade-in space-y-6 duration-300">{children}</div>
          </PageShell>
        </main>
      </div>
    </div>
  );
}
