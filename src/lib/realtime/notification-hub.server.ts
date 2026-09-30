import type { Sql } from "postgres";
import { deploymentSetting } from "@/lib/seo/seo-store.server";

/**
 * Live delivery of new notifications, from this database to the app server.
 *
 * The browser's /realtime/v1 socket is routed to the hosted Supabase project,
 * which never sees a write made to the VPS database, so a subscription there
 * never fires for anything in user_notifications. The database announces each
 * new row itself (pg_notify 'sv_user_notification', from the trigger in
 * 20261107T100000_ams_recognition_events.sql); this module holds one LISTEN
 * connection per server process and hands each announcement to the streams
 * open for the person it belongs to.
 *
 * Only identifiers travel: the notification id, its event type and, for a
 * recognition, its ledger line. What the notification says is read by the
 * browser under the person's own permissions.
 */

export type Announcement = {
  id: string;
  user_id: string | null;
  event: string | null;
  ledger_id: string | null;
};

type Listener = (a: Announcement) => void;

const listeners = new Map<string, Set<Listener>>();
let connection: Sql | null = null;
let starting: Promise<boolean> | null = null;

function deliver(raw: string) {
  let a: Announcement;
  try {
    a = JSON.parse(raw) as Announcement;
  } catch {
    return;
  }
  if (!a?.user_id) return;
  for (const fn of listeners.get(a.user_id) ?? []) {
    try {
      fn(a);
    } catch {
      /* one broken stream never stops the others */
    }
  }
}

/**
 * Start listening, once per process. False when this server has no database
 * connection configured, and the browser falls back to asking periodically.
 */
export function ensureListening(): Promise<boolean> {
  if (connection) return Promise.resolve(true);
  if (starting) return starting;
  const url = deploymentSetting("VPS_DATABASE_URL");
  if (!url) return Promise.resolve(false);

  starting = (async () => {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 1, idle_timeout: 0, connect_timeout: 10, onnotice: () => {} });
    // The driver re-establishes LISTEN by itself when the connection drops.
    await sql.listen("sv_user_notification", deliver);
    connection = sql;
    return true;
  })().catch((error) => {
    console.error("[notification-hub] could not listen:", error instanceof Error ? error.message : error);
    return false;
  }).finally(() => {
    starting = null;
  });
  return starting;
}

/** Receive the announcements for one person until the returned function runs. */
export function subscribe(userId: string, fn: Listener): () => void {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  set.add(fn);
  return () => {
    const s = listeners.get(userId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) listeners.delete(userId);
  };
}
