import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Bell, BellOff, CheckCheck, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const TABS = ["All", "Mentions", "Approvals", "Payouts", "System"] as const;
type TabName = (typeof TABS)[number];

export type AffiliateNotification = {
  id: string;
  tab: Exclude<TabName, "All">;
  title: string;
  detail?: string;
  unread?: boolean;
};

export function NotificationCenter({
  trigger,
  notifications = [],
}: {
  trigger: ReactNode;
  notifications?: AffiliateNotification[];
}) {
  const [tab, setTab] = useState<TabName>("All");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState("");

  const listRef = useRef<HTMLUListElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () =>
      notifications.filter((n) => !dismissed.includes(n.id) && (tab === "All" || n.tab === tab)),
    [notifications, dismissed, tab],
  );

  useEffect(() => {
    if (activeIndex > items.length - 1) setActiveIndex(Math.max(0, items.length - 1));
  }, [items.length, activeIndex]);

  const focusItem = useCallback((index: number) => {
    const node = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[index];
    node?.focus();
  }, []);

  const dismiss = useCallback(
    (id: string, title: string) => {
      setDismissed((d) => [...d, id]);
      setStatus(`Dismissed notification: ${title}`);
      requestAnimationFrame(() => {
        const remaining = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
        if (remaining && remaining.length > 0) {
          const next = Math.min(activeIndex, remaining.length - 1);
          setActiveIndex(next);
          remaining[next]?.focus();
        } else {
          listRef.current?.focus();
        }
      });
    },
    [activeIndex],
  );

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (items.length === 0) return;
    let next = activeIndex;
    if (e.key === "ArrowDown") next = Math.min(items.length - 1, activeIndex + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, activeIndex - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const target = items[activeIndex];
      if (target) dismiss(target.id, target.title);
      return;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const target = items[activeIndex];
      if (target) {
        setRead((r) => (r.includes(target.id) ? r : [...r, target.id]));
        setStatus(`Marked as read: ${target.title}`);
      }
      return;
    } else return;

    e.preventDefault();
    setActiveIndex(next);
    focusItem(next);
  };

  const onTabsKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.indexOf(tab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next]!);
    setActiveIndex(0);
    tabsRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) setActiveIndex(0);
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-surface">
        <SheetHeader className="border-b border-border px-4 py-3 space-y-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-base" id="notification-center-title">
              Notifications
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Mark all notifications as read"
                onClick={() => {
                  setRead(notifications.map((n) => n.id));
                  setStatus("All notifications marked as read");
                }}
              >
                <CheckCheck className="size-4" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Notification settings">
                <Settings2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Notification categories"
          onKeyDown={onTabsKeyDown}
          className="no-scrollbar flex items-center overflow-x-auto border-b border-border bg-surface px-4"
        >
          {TABS.map((t) => {
            const isActive = t === tab;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                id={`notif-tab-${t}`}
                aria-selected={isActive}
                aria-controls="notif-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => {
                  setTab(t);
                  setActiveIndex(0);
                }}
                className={[
                  "relative whitespace-nowrap px-3 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {t}
                {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        <div id="notif-panel" role="tabpanel" aria-labelledby={`notif-tab-${tab}`} className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="grid h-full place-items-center px-6 py-12 text-center">
              <div>
                <div className="mx-auto mb-3 grid size-11 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <BellOff className="size-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-sm font-semibold">You're all caught up</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                  Approvals, payouts, risk alerts and system events will surface here in realtime.
                </p>
              </div>
            </div>
          ) : (
            <ul
              ref={listRef}
              role="listbox"
              aria-label="Notifications"
              aria-activedescendant={items[activeIndex] ? `notif-${items[activeIndex]!.id}` : undefined}
              tabIndex={0}
              onKeyDown={onListKeyDown}
              className="divide-y divide-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              {items.map((n, i) => {
                const isRead = read.includes(n.id) || !n.unread;
                return (
                  <li
                    key={n.id}
                    id={`notif-${n.id}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    tabIndex={i === activeIndex ? 0 : -1}
                    onFocus={() => setActiveIndex(i)}
                    onClick={() => setActiveIndex(i)}
                    className={[
                      "flex items-start gap-3 px-4 py-3 outline-none",
                      i === activeIndex ? "bg-muted/60" : "hover:bg-muted/40",
                      "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    ].join(" ")}
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" data-read={isRead} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      {n.detail && <p className="mt-0.5 text-xs text-muted-foreground">{n.detail}</p>}
                      <span className="sr-only">
                        {isRead ? "Read" : "Unread"} · {n.tab}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`Dismiss notification: ${n.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(n.id, n.title);
                      }}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {status}
        </p>

        <div className="border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Bell className="size-3.5" aria-hidden="true" /> Realtime sync active
        </div>
      </SheetContent>
    </Sheet>
  );
}
