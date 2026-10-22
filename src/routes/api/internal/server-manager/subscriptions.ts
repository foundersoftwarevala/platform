import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { queue } from "@/lib/commerce/mailer";

type ClaimedNotification = {
  notification_id: string;
  subscription_id: string;
  user_id: string;
  email: string | null;
  event_key: string;
  plan: string;
  expires_at: string;
  server_name: string;
};

function config() {
  return {
    url: process.env.SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "",
    key: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
  };
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

async function updateNotification(
  url: string,
  key: string,
  id: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(
    `${url}/rest/v1/server_subscription_notifications?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...headers(key), Prefer: "return=minimal" },
      body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) throw new Error(`Subscription notification update failed (${response.status})`);
}

export const Route = createFileRoute("/api/internal/server-manager/subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const { url, key } = config();
        if (!url || !key) {
          return Response.json(
            { error: "Subscription lifecycle configuration is unavailable" },
            { status: 503 },
          );
        }

        try {
          const response = await fetch(`${url}/rest/v1/rpc/server_sweep_subscription_lifecycle`, {
            method: "POST",
            headers: headers(key),
            body: JSON.stringify({}),
          });
          if (!response.ok) {
            console.error("[server-manager/subscriptions] lifecycle sweep failed", response.status);
            return Response.json({ error: "Subscription lifecycle sweep failed" }, { status: 502 });
          }

          const result: unknown = await response.json();
          if (!Array.isArray(result)) {
            return Response.json(
              { error: "Subscription lifecycle returned an invalid response" },
              { status: 502 },
            );
          }

          let queued = 0;
          let skipped = 0;
          let failed = 0;
          for (const item of result as ClaimedNotification[]) {
            if (typeof item.notification_id !== "string" || typeof item.user_id !== "string") {
              throw new Error("Subscription lifecycle claim contains an invalid row");
            }
            if (!item.email) {
              await updateNotification(url, key, item.notification_id, {
                status: "skipped",
                claimed_until: null,
                last_error: "No verified account email is available",
              });
              skipped++;
              continue;
            }

            const eventText: Record<string, string> = {
              expiry_7d: "Your Server Manager subscription expires within 7 days.",
              expiry_3d: "Your Server Manager subscription expires within 3 days.",
              expiry_1d: "Your Server Manager subscription expires within 1 day.",
              suspended:
                "Your Server Manager subscription expired. Monitoring is suspended during the grace period.",
              cancelled:
                "Your Server Manager subscription grace period ended and the subscription was cancelled.",
            };
            const subjectText = eventText[item.event_key];
            if (!subjectText)
              throw new Error("Subscription lifecycle returned an unknown notification type");

            const mailId = await queue({
              idempotencyKey: item.notification_id,
              to: item.email,
              subject: `[Software Vala] Subscription ${item.event_key.replace(/_/g, " ")}`,
              html: `<div><h2>${escapeHtml(subjectText)}</h2><p>Server: ${escapeHtml(item.server_name)}</p><p>Plan: ${escapeHtml(item.plan)}</p><p>Expires: ${escapeHtml(new Date(item.expires_at).toUTCString())}</p></div>`,
              text: `${subjectText}\nServer: ${item.server_name}\nPlan: ${item.plan}\nExpires: ${new Date(item.expires_at).toUTCString()}`,
              context: {
                server_subscription_id: item.subscription_id,
                lifecycle_event: item.event_key,
              },
            });
            if (!mailId) {
              await updateNotification(url, key, item.notification_id, {
                status: "pending",
                claimed_until: null,
                next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
                last_error: "Could not queue lifecycle email",
              });
              failed++;
              continue;
            }
            await updateNotification(url, key, item.notification_id, {
              status: "queued",
              email_outbox_id: mailId,
              claimed_until: null,
              last_error: null,
            });
            queued++;
          }

          const reconcile = await fetch(
            `${url}/rest/v1/server_subscription_notifications?select=id,email_outbox_id&status=eq.queued&limit=200`,
            { headers: headers(key) },
          );
          if (!reconcile.ok) throw new Error("Could not reconcile lifecycle email delivery states");
          const notifications = (await reconcile.json()) as Array<{
            id: string;
            email_outbox_id: string | null;
          }>;
          let sent = 0;
          for (const notification of notifications) {
            if (!notification.email_outbox_id) {
              await updateNotification(url, key, notification.id, {
                status: "failed",
                last_error: "Queued email outbox record no longer exists",
              });
              failed++;
              continue;
            }
            const mail = await fetch(
              `${url}/rest/v1/email_outbox?select=status,sent_at,last_error&id=eq.${encodeURIComponent(notification.email_outbox_id)}&limit=1`,
              { headers: headers(key) },
            );
            if (!mail.ok) throw new Error("Could not read lifecycle email state");
            const [mailState] = (await mail.json()) as Array<{
              status: string;
              sent_at: string | null;
              last_error: string | null;
            }>;
            if (mailState?.status === "sent") {
              await updateNotification(url, key, notification.id, {
                status: "sent",
                sent_at: mailState.sent_at,
                last_error: null,
              });
              sent++;
            } else if (mailState?.status === "failed") {
              await updateNotification(url, key, notification.id, {
                status: "failed",
                last_error: mailState.last_error ?? "Lifecycle email delivery failed",
              });
              failed++;
            }
          }

          return Response.json({ claimed: result.length, queued, sent, skipped, failed });
        } catch (error) {
          console.error("[server-manager/subscriptions] lifecycle processing failed", error);
          return Response.json(
            { error: "Subscription lifecycle processing failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
