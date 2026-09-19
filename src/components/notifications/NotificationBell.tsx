import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";

/**
 * The notification bell, on the platform's one notification system.
 *
 * Rows live in user_notifications, written by mm_notify. This reads them with
 * mm_notifications (only the signed-in user's own rows, or ones addressed to a
 * role they hold) and marks them with mm_notification_read. A realtime
 * subscription on the user's own rows refreshes the list the moment one
 * arrives; a slow poll covers a dropped socket.
 */

type BellItem = {
  id: string;
  severity: string | null;
  message: string;
  event: string | null;
  action_url: string | null;
  action_label: string | null;
  read: boolean | null;
  created_at: string;
};

type BellData = { ok: boolean; reason?: string; unread?: number; notifications?: BellItem[] };

const TONE: Record<string, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  priority: "bg-red-500",
  info: "bg-sky-500",
};

/** Only links inside this site are followed from a notification. */
function safeLink(url: string | null): string | null {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

function useSignedInUser(): string | null {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setUserId(data.user?.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return userId;
}

export function NotificationBell({ buttonClassName }: { buttonClassName?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const userId = useSignedInUser();
  const key = ["notification-bell", userId];

  const q = useQuery({
    queryKey: key,
    enabled: Boolean(userId),
    queryFn: async (): Promise<BellData> => {
      const { data, error } = await supabase.rpc(
        "mm_notifications" as never,
        { p_limit: 25 } as never,
      );
      if (error) throw new Error(error.message);
      return data as unknown as BellData;
    },
    refetchInterval: 60_000,
  });

  // New rows for this user refresh the bell straight away.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`bell:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["notification-bell", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const markRead = async (ids: string[]) => {
    for (const id of ids) {
      await supabase.rpc("mm_notification_read" as never, { p_id: id, p_dismiss: false } as never);
    }
    await qc.invalidateQueries({ queryKey: key });
  };

  const items = q.data?.notifications ?? [];
  const unread = Number(q.data?.unread ?? 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("notifications.bell")}
          title={t("notifications.bell")}
          data-notification-bell
          data-unread={unread}
          className={
            buttonClassName ??
            "relative grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
              data-bell-badge
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
        data-notification-panel
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{t("notifications.title")}</p>
          {unread > 0 && (
            <button
              type="button"
              data-mark-all-read
              onClick={() => markRead(items.filter((i) => !i.read).map((i) => i.id))}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {t("notifications.mark_all_read")}
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!userId ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("notifications.sign_in")}
            </p>
          ) : q.isLoading ? (
            <p className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("notifications.loading")}
            </p>
          ) : q.error || q.data?.ok === false ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("notifications.unavailable")}
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </p>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  data-notification={n.id}
                  data-event={n.event ?? ""}
                  data-read={n.read ? "true" : "false"}
                  className={`border-b border-border px-3 py-2.5 last:border-0 ${n.read ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : (TONE[n.severity ?? "info"] ?? TONE.info)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{n.message}</p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                        {safeLink(n.action_url) && (
                          <a
                            href={safeLink(n.action_url) ?? undefined}
                            onClick={() => (n.read ? undefined : markRead([n.id]))}
                            className="text-primary hover:underline"
                          >
                            {n.action_label ?? t("notifications.open")}
                          </a>
                        )}
                        {!n.read && (
                          <button
                            type="button"
                            data-mark-read
                            onClick={() => markRead([n.id])}
                            className="hover:text-foreground"
                          >
                            {t("notifications.mark_read")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
