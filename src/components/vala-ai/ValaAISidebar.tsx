import { Link } from "@tanstack/react-router";
import { Bot, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { cn } from "@/lib/utils";
import { GROUPS, VALA_AI_SECTIONS, useActiveValaSection } from "./nav";

export function ValaAISidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { translate: t } = useLanguage();
  const active = useActiveValaSection();

  const item = (s: (typeof VALA_AI_SECTIONS)[number]) => {
    const isActive = active.id === s.id;
    return (
      <Link
        key={s.id}
        to={s.path}
        onClick={onNavigate}
        title={t(s.label)}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-primary/15 font-medium text-foreground"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )}
      >
        {isActive ? (
          <span className="absolute bottom-1.5 left-0 top-1.5 w-[2px] rounded-full bg-primary" />
        ) : null}
        <s.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{t(s.label)}</span>}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2 border-b border-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <Link to="/vala-ai" className="flex min-w-0 items-center gap-2" onClick={onNavigate}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Bot className="h-4 w-4" />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold tracking-tight">{t("Vala AI")}</span>
          )}
        </Link>
        {!collapsed && onToggleCollapsed ? (
          <button
            onClick={onToggleCollapsed}
            className="ml-auto hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground lg:grid"
            aria-label={t("Collapse sidebar")}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : null}
        {onNavigate ? (
          <button
            onClick={onNavigate}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground lg:hidden"
            aria-label={t("Close menu")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {collapsed && onToggleCollapsed ? (
        <button
          onClick={onToggleCollapsed}
          className="mx-auto mt-3 hidden h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground lg:grid"
          aria-label={t("Expand sidebar")}
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      ) : null}
      <nav
        className="flex-1 space-y-4 overflow-y-auto px-2 py-3"
        aria-label={t("Vala AI sections")}
      >
        {GROUPS.map((g) => (
          <div key={g.id} className="space-y-0.5">
            {g.label && !collapsed ? (
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(g.label)}
              </p>
            ) : null}
            {VALA_AI_SECTIONS.filter((s) => s.group === g.id).map(item)}
          </div>
        ))}
      </nav>
      <div className="shrink-0 space-y-0.5 border-t border-border px-2 pb-16 pt-2">
        {VALA_AI_SECTIONS.filter((s) => s.group === "bottom").map(item)}
      </div>
    </div>
  );
}

export default ValaAISidebar;
