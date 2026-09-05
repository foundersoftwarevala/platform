import { useEffect, useMemo, useState } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "@/lib/lead-manager/nav";

const COLLAPSE_KEY = "sv:sidebar:collapsed";

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

export function AppSidebar({
  section,
  onSelectSection,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  section: string;
  onSelectSection: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return NAV_SECTIONS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const groupHasActive = (items: (typeof NAV_SECTIONS)[number]["items"]) =>
    items.some((i) => i.id === section || i.children?.some((c) => c.id === section));

  const select = (id: string) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const ItemLink = ({
    item,
  }: {
    item: (typeof NAV_SECTIONS)[number]["items"][number];
  }) => {
    const active = item.id === section;
    const childActive = item.children?.some((c) => c.id === section);
    return (
      <div>
        <button
          onClick={() => select(item.id)}
          title={item.label}
          className={cn(
            "group/item relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-all duration-150",
            collapsed && "justify-center px-0",
            active || childActive
              ? "bg-gradient-brand text-brand-foreground shadow-glow font-medium"
              : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
          )}
        >
          {(active || childActive) && (
            <span className="absolute left-0 bottom-1.5 top-1.5 w-[2px] rounded-full bg-primary" />
          )}
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </button>
        {!collapsed && item.children && (active || childActive) ? (
          <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border pl-2">
            {item.children.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={cn(
                  "block w-full truncate rounded-lg px-2 py-1 text-left text-xs transition-colors",
                  section === c.id
                    ? "bg-white/10 text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const content = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">
            SV
          </span>
          {!collapsed && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold tracking-tight">Software Vala</span>
              <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Lead Manager
              </span>
            </span>
          )}
        </div>
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
          className="mx-auto mt-3 hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground lg:grid"
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

      <nav aria-label="Lead manager navigation" className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        {(filtered ?? NAV_SECTIONS).map((group) => {
          const open = filtered ? true : openGroups[group.label] ?? groupHasActive(group.items) ?? true;
          if (collapsed) {
            return (
              <div key={group.label} className="space-y-0.5 border-t border-border/60 pt-2">
                {group.items.map((item) => (
                  <ItemLink key={item.id} item={item} />
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
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
                />
              </button>
              {open && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => (
                    <ItemLink key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-3 text-[11px] text-muted-foreground">
        {!collapsed ? (
          <span className="flex items-center gap-2">
            <span className="status-dot text-success" /> Lead Manager · live
          </span>
        ) : (
          <span className="status-dot mx-auto block text-success" />
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-background/80 backdrop-blur-xl transition-[width] duration-200 lg:flex",
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
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-sidebar-border bg-background shadow-2xl">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
