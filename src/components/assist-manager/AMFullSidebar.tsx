/**
 * ASSIST MANAGER FULL SIDEBAR
 * VALA CONNECT - UltraViewer Style Remote Assist
 * Style: Reseller/Product Manager
 */

import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  MonitorPlay,
  PlusCircle,
  Inbox,
  Clock,
  Radio,
  Monitor,
  FileUp,
  MessageSquare,
  Shield,
  Laptop,
  FileText,
  Brain,
  AlertOctagon,
  Settings,
  ShieldCheck,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  X,
} from 'lucide-react';

export type AMSection =
  | 'assist_dashboard'
  | 'active_sessions'
  | 'create_assist'
  | 'session_requests'
  | 'pending_approval'
  | 'live_assist'
  | 'screen_control'
  | 'file_transfer'
  | 'chat_voice'
  | 'privacy_controls'
  | 'device_access'
  | 'session_logs'
  | 'ai_assist_layer'
  | 'emergency_stop'
  | 'settings';

interface AMFullSidebarProps {
  activeSection: AMSection;
  onSectionChange: (section: AMSection) => void;
  counts?: Partial<Record<AMSection, number>>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

type AMItem = { id: AMSection; label: string; icon: React.ElementType };

const PRIMARY_ITEMS: AMItem[] = [
  { id: 'assist_dashboard', label: 'Assist Dashboard', icon: LayoutDashboard },
  { id: 'active_sessions', label: 'Active Sessions', icon: MonitorPlay },
  { id: 'create_assist', label: 'Create New Assist', icon: PlusCircle },
];

const GROUPS: { label: string; items: AMItem[] }[] = [
  {
    label: 'Approvals',
    items: [
      { id: 'session_requests', label: 'Session Requests', icon: Inbox },
      { id: 'pending_approval', label: 'Pending Approval', icon: Clock },
    ],
  },
  {
    label: 'Live Tools',
    items: [
      { id: 'live_assist', label: 'Live Assist', icon: Radio },
      { id: 'screen_control', label: 'Screen Control', icon: Monitor },
      { id: 'file_transfer', label: 'File Transfer', icon: FileUp },
      { id: 'chat_voice', label: 'Chat & Voice', icon: MessageSquare },
    ],
  },
  {
    label: 'Governance',
    items: [
      { id: 'privacy_controls', label: 'Privacy Controls', icon: Shield },
      { id: 'device_access', label: 'Device Access', icon: Laptop },
      { id: 'session_logs', label: 'Session Logs', icon: FileText },
      { id: 'ai_assist_layer', label: 'AI Assist Layer', icon: Brain },
    ],
  },
];

const BOTTOM_ITEMS: AMItem[] = [
  { id: 'emergency_stop', label: 'Emergency Stop', icon: AlertOctagon },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const COLLAPSE_KEY = 'sv:am:sidebar:collapsed';

export function useAMSidebarState() {
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

export function AMFullSidebar({
  activeSection,
  onSectionChange,
  counts,
  collapsed = false,
  onToggleCollapsed,
  mobileOpen = false,
  onCloseMobile,
}: AMFullSidebarProps) {
  const [query, setQuery] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const groupOpen = (label: string) => openGroups[label] ?? true;

  const ItemLink = ({ item }: { item: AMItem }) => {
    const active = activeSection === item.id;
    const danger = item.id === 'emergency_stop';
    const count = counts?.[item.id];
    return (
      <button
        onClick={() => {
          onSectionChange(item.id);
          onCloseMobile?.();
        }}
        title={item.label}
        aria-current={active ? 'page' : undefined}
        aria-label={count ? `${item.label}, ${count} pending` : item.label}
        className={cn(
          'group/item relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          collapsed && 'justify-center px-0',
          active
            ? 'bg-primary/18 font-medium text-foreground'
            : danger
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
        )}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" />
        )}
        <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
        {!collapsed && count ? (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              active ? 'bg-primary/25 text-foreground' : 'bg-primary/15 text-primary',
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
    );
  };

  const content = (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-2 border-b border-border px-3',
          collapsed && 'justify-center px-0',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">Assist Manager</span>
          )}
        </div>
        {!collapsed && onToggleCollapsed && (
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

      {collapsed && onToggleCollapsed && (
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
              placeholder="Find a screen…"
              aria-label="Search Assist Manager screens"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <nav aria-label="Assist Manager sections" className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {PRIMARY_ITEMS.filter(
            (i) => !query.trim() || i.label.toLowerCase().includes(query.trim().toLowerCase()),
          ).map((item) => (
            <ItemLink key={item.id} item={item} />
          ))}
        </div>

        {(filtered ?? GROUPS).map((group) => {
          const open = filtered ? true : groupOpen(group.label);
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
                aria-expanded={open}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {group.label}
                <ChevronDown
                  aria-hidden="true"
                  className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
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

      <div className="shrink-0 space-y-0.5 border-t border-border px-2 py-2">
        {BOTTOM_ITEMS.map((item) => (
          <ItemLink key={item.id} item={item} />
        ))}
        {!collapsed && (
          <div className="flex items-center gap-2 px-2.5 py-2 text-xs">
            <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
            <span className="text-muted-foreground">System Secure</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background/80 backdrop-blur-xl transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[72px]' : 'w-[264px]',
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

export default AMFullSidebar;
