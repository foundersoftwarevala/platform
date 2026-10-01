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
  id: string | null;
  user_id: string | null;
  event: string | null;
  /** For an AMS recognition: its ledger line. */
  ledger_id?: string | null;
  /** For a chat change ("chat.message", "chat.receipt", ...): its conversation. */
  conversation_id?: string | null;
  /** For a new chat message: who sent it. */
  sender_id?: string | null;
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
 * The platform database - the one PostgREST serves and user_notifications
 * lives in, sv_platform. A NOTIFY is only heard on the database it was sent in.
 *
 * SV_PLATFORM_DATABASE_URL when it is set. Otherwise the server's existing
 * VPS_DATABASE_URL connection (same server, same user) pointed at sv_platform:
 * that setting names the SEO store's database, softwarevala, and used as it is
 * would listen where nothing is ever announced. Either way ensureListening()
 * checks at runtime that the database reached is the one that announces.
 */
const PLATFORM_DATABASE = "sv_platform";

function platformDatabaseUrl(): string {
  const explicit = deploymentSetting("SV_PLATFORM_DATABASE_URL");
  if (explicit) return explicit;
  const vps = deploymentSetting("VPS_DATABASE_URL");
  if (!vps) return "";
  try {
    const u = new URL(vps);
    u.pathname = `/${PLATFORM_DATABASE}`;
    return u.toString();
  } catch {
    return "";
  }
}

/**
 * Start listening, once per process. False when this server has no database
 * connection configured, and the browser falls back to asking periodically.
 */
export function ensureListening(): Promise<boolean> {
  if (connection) return Promise.resolve(true);
  if (starting) return starting;
  const url = platformDatabaseUrl();
  if (!url) return Promise.resolve(false);

  starting = (async () => {
    const { default: postgres } = await import("postgres");
    const sql = postgres(url, { max: 1, idle_timeout: 0, connect_timeout: 10, onnotice: () => {} });
    // Listening to a database that never announces would look healthy and
    // deliver nothing, so the database must be the one with the announcer.
    const [{ announces, db }] = await sql<{ announces: boolean; db: string }[]>`
      select to_regproc('public.sv_announce_user_notification') is not null as announces,
             current_database() as db`;
    if (!announces) {
      await sql.end({ timeout: 1 });
      throw new Error(`SV_PLATFORM_DATABASE_URL reaches ${db}, which does not announce notifications`);
    }
    // The driver re-establishes LISTEN by itself when the connection drops.
    await sql.listen("sv_user_notification", deliver);
    console.info(`[notification-hub] listening: current_database=${db}`);
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
