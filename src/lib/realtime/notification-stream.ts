import { supabase } from "@/integrations/supabase/client";

/**
 * One live notification stream per browser tab, shared by everything that
 * wants it (the bell, the recognition detector).
 *
 * It reads /api/notifications/stream, which the app server feeds from the
 * database's own announcements. Each event carries only identifiers; readers
 * fetch what they need under the person's permissions.
 *
 * Events for subscribers:
 *   { type: "open" }        - connected, or reconnected. Anything announced
 *                             while disconnected was missed; catch up now.
 *   { type: "notification", id, event, ledger_id }
 *   { type: "unavailable" } - this server cannot stream; poll instead.
 */

export type StreamEvent =
  | { type: "open" }
  | { type: "unavailable" }
  | { type: "notification"; id: string | null; event: string | null; ledger_id: string | null; conversation_id: string | null; sender_id: string | null };

type Listener = (e: StreamEvent) => void;

const listeners = new Set<Listener>();
let controller: AbortController | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
let token: string | null = null;
let userId: string | null = null;
let authWatch: { unsubscribe: () => void } | null = null;
/** When the open stream last delivered anything, heartbeats included. */
let lastData = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;

/**
 * The server sends a heartbeat every 25 seconds. A stream silent for longer
 * than this is dead even though nothing has errored - a dropped network can
 * leave the socket looking open - so it is replaced, and the reconnect's
 * "open" makes every subscriber catch up on what it missed.
 */
const STALE_MS = 60_000;

function reconnectNow() {
  stop();
  attempt = 0;
  void connect();
}

function installWatchdog() {
  if (watchdog || typeof window === "undefined") return;
  watchdog = setInterval(() => {
    if (controller && lastData && Date.now() - lastData > STALE_MS) reconnectNow();
  }, 10_000);
  // Back online: whatever the socket looks like, start a fresh one.
  window.addEventListener("online", () => {
    if (listeners.size > 0 && token) reconnectNow();
  });
}

function emit(e: StreamEvent) {
  for (const fn of listeners) {
    try {
      fn(e);
    } catch {
      /* a failing subscriber never stops the others */
    }
  }
}

function stop() {
  controller?.abort();
  controller = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function scheduleRetry(ms: number) {
  if (retryTimer || listeners.size === 0 || !token) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connect();
  }, ms);
}

async function connect() {
  if (controller || listeners.size === 0 || !token || typeof window === "undefined") return;
  const ac = new AbortController();
  controller = ac;
  try {
    const res = await fetch("/api/notifications/stream", {
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
      signal: ac.signal,
      cache: "no-store",
    });
    if (res.status === 503 || res.status === 404) {
      controller = null;
      emit({ type: "unavailable" });
      scheduleRetry(5 * 60_000);
      return;
    }
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);

    attempt = 0;
    lastData = Date.now();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      lastData = Date.now();
      buffer += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, at);
        buffer = buffer.slice(at + 2);
        let name = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) name = line.slice(6).trim();
          else if (line.startsWith("data:")) data += line.slice(5).trim();
        }
        if (name === "ready") emit({ type: "open" });
        else if (name === "notification") {
          try {
            const d = JSON.parse(data) as { id: string | null; event: string | null; ledger_id?: string | null; conversation_id?: string | null; sender_id?: string | null };
            emit({ type: "notification", id: d.id, event: d.event, ledger_id: d.ledger_id ?? null, conversation_id: d.conversation_id ?? null, sender_id: d.sender_id ?? null });
          } catch {
            /* a malformed event is skipped */
          }
        }
      }
    }
    throw new Error("stream ended");
  } catch {
    if (ac.signal.aborted) return;
    controller = null;
    // 1s, 2s, 4s ... up to 30s between attempts.
    attempt += 1;
    scheduleRetry(Math.min(30_000, 1000 * 2 ** Math.min(attempt - 1, 5)));
  }
}

function watchAuth() {
  if (authWatch || typeof window === "undefined") return;
  void supabase.auth.getSession().then(({ data }) => {
    token = data.session?.access_token ?? null;
    userId = data.session?.user?.id ?? null;
    if (token) void connect();
  });
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const nextUser = session?.user?.id ?? null;
    const changedUser = nextUser !== userId;
    token = session?.access_token ?? null;
    userId = nextUser;
    if (!token) {
      stop();
    } else if (changedUser || !controller) {
      // Someone else signed in, or a fresh token for a stream that dropped:
      // a stream only ever carries the person it was opened for.
      stop();
      void connect();
    }
  });
  authWatch = data.subscription;
}

/** Receive stream events until the returned function runs. */
export function subscribeNotificationStream(fn: Listener): () => void {
  listeners.add(fn);
  watchAuth();
  installWatchdog();
  if (token) void connect();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) stop();
  };
}
