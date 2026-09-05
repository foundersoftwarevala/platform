import { useState } from "react";
import { useLanguage } from "@/lib/language-catalog";
import { Bell, Bot, Menu, Search, ChevronRight } from "lucide-react";
import { AiChatPanel } from "./AiChatPanel";
import { SECTIONS, type SectionId } from "./TopBar";
import { markAllRead, useUnreadCount } from "./notifications";
import { BrandMark } from "./BrandMark";
import { CommandPalette } from "./CommandPalette";

const ICON_BTN =
  "icon3d relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground " +
  "transition-[transform,box-shadow,color,background-color] duration-200 " +
  "hover:text-foreground hover:shadow-[0_8px_24px_-12px_oklch(0.62_0.19_255/0.9)] active:scale-[0.96] focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AppHeader({
  active,
  onOpenMenu,
  onNavigate,
}: {
  active: SectionId;
  onOpenMenu: () => void;
  onNavigate?: (id: SectionId) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const unread = useUnreadCount();
  const { translate: t } = useLanguage();
  const section = SECTIONS.find((s) => s.id === active);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-1.5 px-3 lg:px-5">
          <button className={`${ICON_BTN} lg:hidden`} onClick={onOpenMenu} aria-label="Open menu">
            <Menu className="h-[18px] w-[18px]" />
          </button>

          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{t(section?.groupLabel ?? "Marketplace")}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 sm:inline" />
            <span className="truncate font-medium text-foreground">{t(section?.label ?? "Dashboard")}</span>
          </div>

          <div className="flex-1" />

          <nav className="flex items-center gap-1.5" aria-label="Global actions">
            <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald" />
              {t("Live")}
            </span>
            <button className={ICON_BTN} aria-label={t("Search modules")} onClick={() => setSearchOpen(true)}>
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button
              className={ICON_BTN}
              aria-label={unread > 0 ? t("Notifications") + ` (${unread} unread)` : t("Notifications")}
              onClick={() => {
                markAllRead();
                onNavigate?.("notifications" as SectionId);
              }}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-[0_0_14px_oklch(0.62_0.19_255/0.9)] ring-2 ring-background">
                  {unread}
                </span>
              )}
            </button>
            <button
              onClick={() => setChatOpen(true)}
              className="btn-premium btn-glow relative inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-primary-foreground"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">{t("AI Chat")}</span>
            </button>
            <BrandMark size={36} className="ml-1" />
          </nav>
        </div>
      </header>

      <AiChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={(id) => onNavigate?.(id)}
      />
    </>
  );
}
