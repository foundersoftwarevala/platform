import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bug, ChevronDown, Cpu, FileText, FolderOpen, History, Lock, PanelLeftClose, PanelLeftOpen, RotateCcw, Search, Settings as SettingsIcon, Terminal, Wallet, X } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";

export type ValaAISection = "command-center" | "active-project" | "prompt-history" | "execution-logs" | "error-detection" | "rollback" | "lock-status" | "models" | "credits" | "settings";

export const VALA_AI_SECTIONS = [
  { id: "command-center", path: "/vala-ai/", label: "Command Center", icon: Terminal, badge: "CORE" },
  { id: "active-project", path: "/vala-ai/projects", label: "Active Project", icon: FolderOpen },
  { id: "prompt-history", path: "/vala-ai/prompts", label: "Prompt History", icon: History, badge: "Read-Only" },
  { id: "execution-logs", path: "/vala-ai/logs", label: "Execution Logs", icon: FileText },
  { id: "error-detection", path: "/vala-ai/errors", label: "Error Detection", icon: Bug },
  { id: "rollback", path: "/vala-ai/rollback", label: "Rollback Trigger", icon: RotateCcw },
  { id: "lock-status", path: "/vala-ai/lock", label: "Lock Status", icon: Lock },
  { id: "models", path: "/vala-ai/models", label: "AI Models", icon: Cpu },
  { id: "credits", path: "/vala-ai/credits", label: "Credits", icon: Wallet },
  { id: "settings", path: "/vala-ai/settings", label: "Settings", icon: SettingsIcon, badge: "Limited" },
] as const;

export function useActiveValaSection(): (typeof VALA_AI_SECTIONS)[number] {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return VALA_AI_SECTIONS.find((s) => s.path !== "/vala-ai/" && pathname.startsWith(s.path)) ?? VALA_AI_SECTIONS[0];
}

const PRIMARY_IDS: ValaAISection[] = ["command-center", "active-project"];
const NAV_GROUPS = [ { label: "Operations", ids: ["prompt-history", "execution-logs", "error-detection", "rollback"] }, { label: "Platform", ids: ["lock-status", "models", "credits"] } ];
const BOTTOM_IDS: ValaAISection[] = ["settings"];

const pick = (ids: ValaAISection[]) => ids.map((id) => VALA_AI_SECTIONS.find((s) => s.id === id)).filter((s): s is (typeof VALA_AI_SECTIONS)[number] => Boolean(s));

const COLLAPSE_KEY = "vala:sidebar:collapsed";

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch {} }, []);
  const toggleCollapsed = () => setCollapsed((v) => { const next = !v; try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch {} return next; });
  return { collapsed, toggleCollapsed, mobileOpen, setMobileOpen };
}

export function ValaAISidebar({ onNavigate, collapsed = false, onToggleCollapsed }: { onNavigate?: () => void; collapsed?: boolean; onToggleCollapsed?: () => void; }) {
  const { translate: t } = useLanguage();
  const active = useActiveValaSection();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const primary = pick(PRIMARY_IDS);
  const bottom = pick(BOTTOM_IDS);
  const groups = NAV_GROUPS.map((g) => ({ label: g.label, items: pick(g.ids) }));

  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return null; return groups.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) })).filter((g) => g.items.length > 0); }, [query]);

  const groupOpen = (label: string) => openGroups[label] ?? true;

  const ItemLink = ({ item }: { item: (typeof VALA_AI_SECTIONS)[number] }) => { const isActive = active.id === item.id; return (
    <Link to={item.path} onClick={onNavigate} title={t(item.label)} aria-current={isActive ? "page" : undefined} className={cn("group/item relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", collapsed && "justify-center px-0", isActive ? "bg-primary/18 font-medium text-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground")}>
      {isActive ? <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-primary" /> : null}
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{t(item.label)}</span>}
      {!collapsed && 'badge' in item && item.badge ? <span className="ml-auto rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{t(item.badge)}</span> : null}
    </Link>
  ); };

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center gap-2 border-b border-border px-3", collapsed && "justify-center px-0") }>
        <Link to="/" className="flex min-w-0 items-center gap-2" onClick={onNavigate}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">SV</span>
          {!collapsed && <span className="truncate text-sm font-semibold tracking-tight">{t("Software Vala")}</span>}
        </Link>
        {!collapsed && onToggleCollapsed ? <button onClick={onToggleCollapsed} className="ml-auto hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground lg:grid" aria-label={t("Collapse sidebar")}><PanelLeftClose className="h-4 w-4" /></button> : null}
        {onNavigate ? <button onClick={onNavigate} className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden" aria-label={t("Close menu")}><X className="h-4 w-4" /></button> : null}
      </div>

      {collapsed && onToggleCollapsed ? <button onClick={onToggleCollapsed} className="mx-auto mt-3 hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground lg:grid" aria-label={t("Expand sidebar")}><PanelLeftOpen className="h-4 w-4" /></button> : null}

      {!collapsed && (
        <div className="shrink-0 px-3 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Find a module…")} aria-label={t("Find a module")} className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">{primary.map((item) => <ItemLink key={item.id} item={item} />)}</div>
        {(filtered ?? groups).map((group) => { const open = filtered ? true : groupOpen(group.label); if (collapsed) { return (<div key={group.label} className="space-y-0.5 border-t border-border/60 pt-2">{group.items.map((item) => <ItemLink key={item.id} item={item} />)}</div>); } return (<div key={group.label}><button onClick={() => setOpenGroups((s) => ({ ...s, [group.label]: !open }))} className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">{t(group.label)}<ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} /></button>{open ? (<div className="mt-0.5 space-y-0.5">{group.items.map((item) => <ItemLink key={item.id} item={item} />)}</div>) : null}</div>); })}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t border-border px-2 py-2">{bottom.map((item) => <ItemLink key={item.id} item={item} />)}</div>
    </div>
  );
}

export default ValaAISidebar;
