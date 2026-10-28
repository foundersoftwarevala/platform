import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  callMarketplaceManagerFunctionFromRequest,
  callVpsUserFunctionFromRequest,
  withVpsPublicDatabase,
} from "@/lib/marketplace-manager/vps-rpc.server";

export type SiteNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link_url: string | null;
  published_at: string;
};

export type UserNotification = {
  id: string;
  severity: string;
  message: string;
  event: string | null;
  action_url: string | null;
  action_label: string | null;
  buzzer: boolean;
  read: boolean | null;
  created_at: string;
};

export type UserNotificationSnapshot = {
  ok: boolean;
  unread?: number;
  notifications?: UserNotification[];
  reason?: string;
};

export type NotificationChannelSnapshot = {
  ok: boolean;
  channels?: {
    channel: string;
    label: string;
    configured: boolean;
    delivered: number;
    unread?: number;
    last_delivery?: string | null;
    note: string;
  }[];
  templates?: number;
  rules?: number;
  reason?: string;
};

export const getNotificationChannelSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<NotificationChannelSnapshot> =>
    callMarketplaceManagerFunctionFromRequest<NotificationChannelSnapshot>(
      "mm_notification_channels",
      {},
    ),
);

export const listSiteNotifications = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteNotification[]> =>
    withVpsPublicDatabase((tx) =>
      tx<SiteNotification[]>`
        select id, title, body, kind, link_url, published_at
          from public.site_notifications
         where is_published is true
         order by sort_order asc, published_at desc nulls last, id
         limit 100
      `,
    ),
);

export const listUserNotifications = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(25) }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<UserNotificationSnapshot> =>
    callVpsUserFunctionFromRequest("mm_notifications", { p_limit: data.limit }),
  );

export const markUserNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), dismiss: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> =>
    callVpsUserFunctionFromRequest("mm_notification_read", {
      p_id: data.id,
      p_dismiss: data.dismiss,
    }),
  );
