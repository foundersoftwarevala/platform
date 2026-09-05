import { useEffect, useMemo, useState } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search, X } from "lucide-react";
import { SECTION_GROUPS, type SectionId } from "./TopBar";
import { BrandLockup } from "./BrandMark";

const COLLAPSE_KEY = "sv:mm:sidebar:collapsed";

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

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Item = { id: string; label: string; icon: React.ComponentType<{ className?: string }> };

export function AppSidebar({
  active,
  onChange,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  active: SectionId;
  onChange: (id: SectionId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const groups = SECTION_GROUPS as unknown as Array<{ id: string; label: string; items: readonly Item[] }>;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query, groups]);

  const groupOpen = (label: string, items: readonly Item[]) =>
    openGroups[label] ?? items.some((i) => i.id === active);

  const ItemLink = ({ item }: { item: Item }) => {
    const isActive = item.id === active;
    return (
      <button
        type="button"
        title={item.label}
        onClick={() => {
          onChange(item.id as SectionId);
          onCloseMobile();
        }}
        className={cn(
          "group/item relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors duration-150",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-primary/18 text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />
        )}
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
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
        <button
          type="button"
          onClick={() => {
            onChange("dashboard" as SectionId);
            onCloseMobile();
          }}
          className="flex min-w-0 items-center gap-2"
        >
          <BrandLockup collapsed={collapsed} />
        </button>
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
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a module…"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        {(filtered ?? groups).map((group) => {
          const open = filtered ? true : groupOpen(group.label, group.items);
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
