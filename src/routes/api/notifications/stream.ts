import { createFileRoute } from "@tanstack/react-router";
import {
  ensureListening,
  subscribe,
  subscribeChatManager,
  type Announcement,
} from "@/lib/realtime/notification-hub.server";

/**
 * The signed-in person's notifications, live, as server-sent events.
 *
 * Each event is only the identifiers of a new notification of theirs; the page
 * reads the rest with its own permissions. The page reads this with fetch (an
 * EventSource cannot carry the Authorization header), and reconnects by itself.
 * 503 when this server has no database connection to listen on: the page then
 * falls back to asking periodically.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

async function currentUser(request: Request) {
  const publishable =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization");
  if (!url() || !publishable || !authorization) return null;
  try {
    const response = await fetch(`${url()}/auth/v1/user`, {
      headers: { apikey: publishable, Authorization: authorization },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string };
    return user?.id ? { id: user.id } : null;
  } catch {
    return null;
  }
}

const HEARTBEAT_MS = 25_000;
const MANAGER_PERMISSION_RECHECK_MS = 60_000;

async function hasChatManagerAccess(userId: string): Promise<boolean> {
  const { withChatPlatformDatabase } = await import("@/lib/chat/manager-db.server");
  return withChatPlatformDatabase(async (tx) => {
    const [row] = await tx<{ allowed: boolean }[]>`
      select public.has_permission(${userId}::uuid, 'chat.manage') as allowed
    `;
    return row?.allowed === true;
  });
}

export const Route = createFileRoute("/api/notifications/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Sign in to receive notifications" }, { status: 401 });
        }
        if (!(await ensureListening())) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Live notifications are not available" }, { status: 503 });
        }

        // A Chat manager also follows every Chat change (the live queue), not
        // only the conversations they are part of. Access is checked here and
        // rechecked periodically and before each manager event.
        let manager = false;
        try {
          manager = await hasChatManagerAccess(user.id);
        } catch (error) {
          console.error(
            "[notifications/stream] Chat manager check failed:",
            error instanceof Error ? error.message : error,
          );
        }
        const encoder = new TextEncoder();
        let cleanup = () => {};
        let closed = false;
        let permissionCheck: Promise<boolean> | null = null;
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (text: string) => {
              try {
                controller.enqueue(encoder.encode(text));
              } catch {
                cleanup();
              }
            };
            send(`event: ready\ndata: {}\n\n`);
            const forward = (a: Announcement) => {
              if (a.event === "__reconnect__") {
                send(`event: ready\ndata: {}\n\n`);
                return;
              }
              send(
                `event: notification\ndata: ${JSON.stringify({ id: a.id, event: a.event, ledger_id: a.ledger_id ?? null, conversation_id: a.conversation_id ?? null, sender_id: a.sender_id ?? null })}\n\n`,
              );
            };
            const checkManagerAccess = () => {
              if (!permissionCheck) {
                permissionCheck = hasChatManagerAccess(user.id).finally(() => {
                  permissionCheck = null;
                });
              }
              return permissionCheck;
            };
            const forwardManager = (a: Announcement) => {
              void checkManagerAccess()
                .then((allowed) => {
                  if (closed) return;
                  if (!allowed) {
                    cleanup();
                    return;
                  }
                  forward(a);
                })
                .catch((error) => {
                  console.error(
                    "[notifications/stream] Chat Manager permission recheck failed:",
                    error instanceof Error ? error.message : error,
                  );
                  cleanup();
                });
            };
            const unsubscribe = subscribe(user.id, forward);
            let unsubscribeManager = () => {};
            if (manager) {
              void subscribeChatManager(forwardManager).then((stop) => {
                if (closed) stop();
                else unsubscribeManager = stop;
              });
            }
            const permissionRecheck = manager
              ? setInterval(() => {
                  void checkManagerAccess()
                    .then((allowed) => {
                      if (!allowed) cleanup();
                    })
                    .catch((error) => {
                      console.error(
                        "[notifications/stream] Chat Manager permission recheck failed:",
                        error instanceof Error ? error.message : error,
                      );
                      cleanup();
                    });
                }, MANAGER_PERMISSION_RECHECK_MS)
              : null;
            // A comment line every so often keeps proxies from closing an idle stream.
            const beat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);
            cleanup = () => {
              if (closed) return;
              closed = true;
              clearInterval(beat);
              if (permissionRecheck) clearInterval(permissionRecheck);
              unsubscribe();
              unsubscribeManager();
              try {
                controller.close();
              } catch {
                /* already closed */
              }
            };
            request.signal.addEventListener("abort", cleanup);
          },
          cancel() {
            cleanup();
          },
        });

        return new Response(body, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            // nginx buffers responses by default; a stream must pass straight through.
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
