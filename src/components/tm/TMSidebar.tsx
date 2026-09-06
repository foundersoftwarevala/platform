import { useEffect, useMemo, useState, type ElementType } from "react";
import {
  ArrowUpCircle,
  BarChart3,
  Bell,
  Bot,
  Calendar,
  CheckCircle,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Columns3,
  FileText,
  GitBranch,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  PlusCircle,
  Search,
  Settings,
  UserCheck,
  Wallet,
  X,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type TMScreen =
  | "task_dashboard"
  | "task_inbox"
  | "task_pipeline"
  | "task_creation"
  | "ai_task_generator"
  | "task_assignment"
  | "task_execution"
  | "task_gantt"
  | "task_dependency"
  | "task_approval"
  | "task_review"
  | "task_sla_tracker"
  | "task_escalation"
  | "task_buzzer"
  | "task_chat"
  | "task_wallet"
  | "task_automation"
  | "task_history"
  | "task_analytics"
  | "task_audit_log"
  | "task_settings";

interface SidebarItem {
  id: TMScreen;
  label: string;
  icon: ElementType;
}

export const TM_NAV: SidebarItem[] = [
  { id: "task_dashboard", label: "Task Dashboard", icon: LayoutDashboard },
  { id: "task_inbox", label: "Task Inbox", icon: Inbox },
  { id: "task_pipeline", label: "Task Pipeline", icon: Columns3 },
  { id: "task_creation", label: "Task Creation", icon: PlusCircle },
  { id: "ai_task_generator", label: "AI Task Generator", icon: Bot },
  { id: "task_assignment", label: "Task Assignment", icon: UserCheck },
  { id: "task_execution", label: "Task Execution", icon: Play },
  { id: "task_gantt", label: "Timeline & Gantt", icon: Calendar },
  { id: "task_dependency", label: "Task Dependency", icon: GitBranch },
  { id: "task_approval", label: "Task Approval", icon: CheckCircle },
  { id: "task_review", label: "Task Review", icon: ClipboardCheck },
  { id: "task_sla_tracker", label: "Task SLA Tracker", icon: Clock },
  { id: "task_escalation", label: "Task Escalation", icon: ArrowUpCircle },
  { id: "task_buzzer", label: "Buzzer Alerts", icon: Bell },
  { id: "task_chat", label: "Task Chat", icon: MessageSquare },
  { id: "task_wallet", label: "Task Wallet", icon: Wallet },
  { id: "task_automation", label: "Task Automation", icon: Zap },
  { id: "task_history", label: "Task History", icon: History },
  { id: "task_analytics", label: "Task Analytics", icon: BarChart3 },
  { id: "task_audit_log", label: "Task Audit Log", icon: FileText },
  { id: "task_settings", label: "Task Settings", icon: Settings },
];

const byId = (id: TMScreen): SidebarItem => TM_NAV.find((i) => i.id === id)!;

/** Primary destinations, always pinned to the top of the rail. */
const PRIMARY: SidebarItem[] = [
  byId("task_dashboard"),
  byId("task_inbox"),
  byId("task_pipeline"),
  byId("task_gantt"),
];

const GROUPS: { label: string; items: SidebarItem[] }[] = [
  { label: "Intake", items: [byId("task_creation"), byId("ai_task_generator"), byId("task_assignment"), byId("task_dependency")] },
  { label: "Delivery", items: [byId("task_execution"), byId("task_approval"), byId("task_review"), byId("task_chat")] },
  { label: "Assurance", items: [byId("task_sla_tracker"), byId("task_escalation"), byId("task_buzzer")] },
  { label: "Insights", items: [byId("task_analytics"), byId("task_wallet"), byId("task_history"), byId("task_audit_log")] },
];

const BOTTOM: SidebarItem[] = [byId("task_automation"), byId("task_settings")];

const COLLAPSE_KEY = "sv:tm:sidebar:collapsed";

export function useTMSidebarState() {
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

export function TMSidebar({
  activeScreen,
  onScreenChange,
  collapsed,
  onToggleCollapse,
  badges,
  mobileOpen = false,
  onCloseMobile,
}: {
  activeScreen: TMScreen;
  onScreenChange: (screen: TMScreen) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  badges: Partial<Record<TMScreen, number>>;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) })).filter(
      (g) => g.items.length > 0,
    );
  }, [query]);

  const groupOpen = (label: string, items: SidebarItem[]) =>
    openGroups[label] ?? items.some((i) => i.id === activeScreen);

  const ItemLink = ({ item }: { item: SidebarItem }) => {
    const active = activeScreen === item.id;
    const badge = badges[item.id];
    return (
      <button
        type="button"
        title={item.label}
        onClick={() => {
          onScreenChange(item.id);
          onCloseMobile?.();
        }}
        className={cn(
          "group/item relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors duration-150",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary/18 font-medium text-foreground"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )}
      >
        {active && <span className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-primary" />}
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {badge ? (
              <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                {badge}
              </span>
            ) : null}
          </>
        )}
        {collapsed && badge ? (
          <span className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-primary" />
        ) : null}
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
            onScreenChange("task_dashboard");
            onCloseMobile?.();
          }}
          className="flex min-w-0 items-center gap-2"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <ListChecks className="h-5 w-5" />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">Software Vala</span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
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
          onClick={onToggleCollapse}
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
              aria-label="Find a screen"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      )}

      <nav className="scrollbar-slim flex-1 space-y-3 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {PRIMARY.map((item) => (
            <ItemLink key={item.id} item={item} />
          ))}
        </div>

        {(filtered ?? GROUPS).map((group) => {
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
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
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
        {BOTTOM.map((item) => (
          <ItemLink key={item.id} item={item} />
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
