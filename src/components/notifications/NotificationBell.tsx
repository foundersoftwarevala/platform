import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { subscribeNotificationStream } from "@/lib/realtime/notification-stream";
import { useTranslation } from "@/lib/i18n/use-translation";
import { getHeldRoles } from "@/lib/auth-bridge";
import { bannersForRoles, fetchCentralBanners } from "@/lib/central-banners";

/**
 * The notification bell, on the platform's one notification system.
 *
 * Rows live in user_notifications, written by mm_notify. This reads them with
 * mm_notifications (only the signed-in user's own rows, or ones addressed to a
 * role they hold) and marks them with mm_notification_read. The live
 * notification stream (lib/realtime/notification-stream) refreshes the list the
 * moment one arrives; a slow poll covers a dropped stream.
 *
 * It used to subscribe to /realtime/v1 postgres_changes, but that socket is
 * routed to the hosted project, which never sees a write to this database, so
 * the subscription never fired.
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
type SiteNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link_url: string | null;
  published_at: string;
};

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

  const siteNotifications = useQuery({
    queryKey: ["site_notifications"],
    queryFn: async (): Promise<SiteNotification[]> => {
      const { data, error } = await supabase
        .from("site_notifications")
        .select("id,title,body,kind,link_url,published_at")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
  const centralNotices = useQuery({
    queryKey: ["central-banner-notices", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const heldRoles = await getHeldRoles();
      const roles = [...heldRoles];
      if (
        ["boss", "boss_owner", "admin", "super_admin", "founder", "owner"].some((r) =>
          heldRoles.has(r),
        )
      ) {
        roles.push("admin");
      }
      return bannersForRoles(await fetchCentralBanners(["festival_wish", "officer_notice"]), roles);
    },
    staleTime: 60_000,
  });

  // New rows for this user refresh the bell straight away; a reconnect
  // refreshes too, for anything that arrived while the stream was down.
  useEffect(() => {
    if (!userId) return;
    return subscribeNotificationStream((e) => {
      // Chat traffic travels the same stream; it is not a notification.
      if ((e.type === "notification" && !e.event?.startsWith("chat.")) || e.type === "open") {
        void qc.invalidateQueries({ queryKey: ["notification-bell", userId] });
      }
    });
  }, [userId, qc]);

  const markRead = async (ids: string[]) => {
    for (const id of ids) {
      await supabase.rpc("mm_notification_read" as never, { p_id: id, p_dismiss: false } as never);
    }
    await qc.invalidateQueries({ queryKey: key });
  };

  const items = q.data?.notifications ?? [];
  const publicItems = siteNotifications.data ?? [];
  const roleNotices = centralNotices.data ?? [];
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
          ) : null}
          {items.length > 0 && (
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
          {siteNotifications.isLoading && (
            <p className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("notifications.loading")}
            </p>
          )}
          {siteNotifications.error && (
            <p className="px-3 py-3 text-center text-sm text-muted-foreground">
              {t("notifications.announcements_unavailable")}
            </p>
          )}
          {publicItems.length > 0 && (
            <section aria-label={t("notifications.announcements")}>
              <h3 className="border-y border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                {t("notifications.announcements")}
              </h3>
              <ul>
                {publicItems.map((n) => (
                  <li
                    key={`site-${n.id}`}
                    data-site-notification={n.id}
                    data-kind={n.kind}
                    className="border-b border-border px-3 py-2.5 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE[n.kind] ?? TONE.info}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{n.title}</p>
                        {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>{new Date(n.published_at).toLocaleString()}</span>
                          {safeLink(n.link_url) && (
                            <a
                              href={safeLink(n.link_url) ?? undefined}
                              className="text-primary hover:underline"
                            >
                              {t("notifications.open")}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {centralNotices.isLoading && userId && (
            <p className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("notifications.loading")}
            </p>
          )}
          {centralNotices.error && (
            <p className="px-3 py-3 text-center text-sm text-muted-foreground">
              {t("notifications.central_unavailable")}
            </p>
          )}
          {roleNotices.length > 0 && (
            <section aria-label={t("notifications.role_announcements")}>
              <h3 className="border-y border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
                {t("notifications.role_announcements")}
              </h3>
              <ul>
                {roleNotices.map((banner) => (
                  <li
                    key={`central-${banner.id}`}
                    data-central-banner={banner.id}
                    data-banner-type={banner.banner_type}
                    className="border-b border-border px-3 py-2.5 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          banner.banner_type === "officer_notice" ? TONE.warning : TONE.info
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{banner.title}</p>
                        {banner.subtitle && (
                          <p className="mt-1 text-xs text-muted-foreground">{banner.subtitle}</p>
                        )}
                        {safeLink(banner.cta_link) && (
                          <a
                            href={safeLink(banner.cta_link) ?? undefined}
                            className="mt-1 inline-flex text-xs text-primary hover:underline"
                          >
                            {banner.cta_primary || t("notifications.open")}
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {userId &&
            !q.isLoading &&
            !q.error &&
            items.length === 0 &&
            !siteNotifications.isLoading &&
            !siteNotifications.error &&
            publicItems.length === 0 &&
            !centralNotices.isLoading &&
            !centralNotices.error &&
            roleNotices.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("notifications.empty")}
              </p>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
