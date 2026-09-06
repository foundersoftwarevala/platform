import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown, PanelLeftClose, PanelLeftOpen, Search, X, Server,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewType } from './views';
import { primaryItems, navGroups } from './views';

const COLLAPSE_KEY = 'sv:sm:sidebar:collapsed';

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });

  return { collapsed, toggleCollapsed, mobileOpen, setMobileOpen };
}

interface SMSidebarProps {
  activeView: ViewType;
  onSelect: (view: ViewType) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  alertBadge: number;
}

type Item = { id: ViewType; label: string; icon: LucideIcon };

export function SMSidebar({
  activeView, onSelect, collapsed, onToggleCollapsed, mobileOpen, onCloseMobile, alertBadge,
}: SMSidebarProps) {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isActive = (id: ViewType) => activeView === id;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return navGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query]);

  const groupOpen = (label: string, items: Item[]) =>
    openGroups[label] ?? items.some((i) => isActive(i.id));

  const ItemLink = ({ item }: { item: Item }) => {
    const active = isActive(item.id);
    return (
      <button
        type="button"
        title={item.label}
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          onSelect(item.id);
          onCloseMobile();
        }}
        className={cn(
          'group/item relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed && 'justify-center px-0',
          active
            ? 'bg-primary/18 text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
        )}
      >
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />}
        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed && <span className="truncate text-left flex-1">{item.label}</span>}
        {!collapsed && item.id === 'alerts' && alertBadge > 0 && (
          <span className="rounded-md bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
            {alertBadge}
          </span>
        )}
      </button>
    );
  };

  const content = (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center gap-2 border-b border-border px-3 shrink-0', collapsed && 'justify-center px-0')}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Server className="h-4 w-4" aria-hidden="true" />
          </span>
          {!collapsed && <span className="truncate text-sm font-semibold tracking-tight">Server Manager</span>}
        </div>
        {!collapsed && (
          <button
            onClick={onToggleCollapsed}
            className="ml-auto hidden lg:grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onCloseMobile}
          className="ml-auto lg:hidden grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {collapsed && (
        <button
          onClick={onToggleCollapsed}
          className="mx-auto mt-3 hidden lg:grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      )}

      {!collapsed && (
        <div className="px-3 pt-3 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 focus-glow">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a screen…"
              aria-label="Find a screen"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-3" aria-label="Server Manager sections">
        <div className="space-y-0.5">
          {primaryItems.map((item) => (
            <ItemLink key={item.id} item={item} />
          ))}
        </div>

        {(filtered ?? navGroups).map((group) => {
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
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {group.label}
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')} />
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

      {!collapsed && (
        <div className="shrink-0 border-t border-border p-3">
          <div className="rounded-xl border border-border bg-surface/60 px-3 py-2.5">
            <p className="text-[11px] font-medium text-foreground">IP Locked · Audited</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Infrastructure scope only</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden lg:flex flex-col shrink-0 border-r border-border bg-background/80 backdrop-blur-xl h-dvh transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-[264px]',
        )}
      >
        {content}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
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
