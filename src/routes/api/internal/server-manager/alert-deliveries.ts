import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "node:crypto";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import { queue } from "@/lib/commerce/mailer";

type ClaimedDelivery = {
  delivery_id: string;
  alert_id: string;
  owner_id: string | null;
  channel: "email" | "webhook";
  attempt: number;
  recipient_email: string | null;
  alert_type: string;
  severity: string;
  message: string;
  created_at: string;
  server_name: string | null;
};

function apiConfig() {
  return {
    url: (process.env.SUPABASE_URL ?? "").trim().replace(/\/+$/, ""),
    key: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
  };
}

function adminHeaders(key: string) {
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

async function patchDelivery(
  url: string,
  key: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(
    `${url}/rest/v1/server_alert_deliveries?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...adminHeaders(key), Prefer: "return=minimal" },
      body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) throw new Error(`Delivery record update failed (${response.status})`);
}

async function deliverWebhook(
  delivery: ClaimedDelivery,
): Promise<{ sent: true } | { sent: false; detail: string }> {
  const target = process.env.SERVER_ALERT_WEBHOOK_URL?.trim();
  const secret = process.env.SERVER_ALERT_WEBHOOK_SECRET?.trim();
  if (!target || !secret)
    return { sent: false, detail: "webhook destination or signing secret is not configured" };

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return { sent: false, detail: "webhook URL is invalid" };
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return { sent: false, detail: "webhook must use HTTPS without embedded credentials" };
  }

  const payload = JSON.stringify({
    event: "server.alert",
    delivery_id: delivery.delivery_id,
    alert_id: delivery.alert_id,
    alert_type: delivery.alert_type,
    severity: delivery.severity,
    message: delivery.message,
    server_name: delivery.server_name,
    created_at: delivery.created_at,
  });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  try {
    const response = await fetch(parsed, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "X-SoftwareVala-Signature": `sha256=${signature}`,
        "X-SoftwareVala-Event": "server.alert",
        "Idempotency-Key": delivery.delivery_id,
      },
      body: payload,
    });
    return response.ok
      ? { sent: true }
      : { sent: false, detail: `webhook returned HTTP ${response.status}` };
  } catch (error) {
    console.warn("[server-manager/alerts] webhook request failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { sent: false, detail: "webhook request failed" };
  }
}

export const Route = createFileRoute("/api/internal/server-manager/alert-deliveries")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        const { url, key } = apiConfig();
        if (!url || !key) {
          return Response.json(
            { error: "Alert delivery database configuration is unavailable" },
            { status: 503 },
          );
        }

        try {
          const claimResponse = await fetch(`${url}/rest/v1/rpc/server_claim_alert_deliveries`, {
            method: "POST",
            headers: adminHeaders(key),
            body: JSON.stringify({ p_limit: 25 }),
          });
          if (!claimResponse.ok) {
            console.error("[server-manager/alerts] delivery claim failed", claimResponse.status);
            return Response.json({ error: "Could not claim alert deliveries" }, { status: 502 });
          }

          const claimed: unknown = await claimResponse.json();
          if (!Array.isArray(claimed)) {
            return Response.json(
              { error: "Alert delivery claim returned an invalid response" },
              { status: 502 },
            );
          }
          const deliveries = claimed as ClaimedDelivery[];
          let queued = 0;
          let sent = 0;
          let skipped = 0;
          let retrying = 0;
          let failed = 0;

          for (const delivery of deliveries) {
            if (
              typeof delivery.delivery_id !== "string" ||
              typeof delivery.alert_id !== "string" ||
              (delivery.channel !== "email" && delivery.channel !== "webhook") ||
              typeof delivery.attempt !== "number"
            ) {
              throw new Error("Alert delivery claim contains an invalid row");
            }

            if (delivery.channel === "email") {
              const severity = delivery.severity.replace(/[\r\n]/g, " ").slice(0, 32);
              if (!delivery.recipient_email) {
                await patchDelivery(url, key, delivery.delivery_id, {
                  status: "skipped",
                  claimed_until: null,
                  last_error: "No email address is available for the server owner",
                });
                skipped++;
                continue;
              }
              const queuedId = await queue({
                idempotencyKey: delivery.delivery_id,
                to: delivery.recipient_email,
                subject: `[Software Vala] ${severity} server alert`,
                html: `<div><h2>${escapeHtml(delivery.alert_type)}</h2><p>${escapeHtml(delivery.message)}</p><p>Server: ${escapeHtml(delivery.server_name ?? "Unknown")}</p><p>Alert ID: ${escapeHtml(delivery.alert_id)}</p></div>`,
                text: `${severity} server alert: ${delivery.alert_type}\n${delivery.message}\nServer: ${delivery.server_name ?? "Unknown"}\nAlert ID: ${delivery.alert_id}`,
                context: {
                  server_alert_id: delivery.alert_id,
                  server_alert_delivery_id: delivery.delivery_id,
                },
              });
              if (!queuedId) {
                await patchDelivery(url, key, delivery.delivery_id, {
                  status: delivery.attempt >= 8 ? "failed" : "pending",
                  claimed_until: null,
                  next_attempt_at: new Date(
                    Date.now() + Math.min(360, 2 ** delivery.attempt) * 60_000,
                  ).toISOString(),
                  last_error: "Could not queue the alert email",
                });
                if (delivery.attempt >= 8) failed++;
                else retrying++;
                continue;
              }
              await patchDelivery(url, key, delivery.delivery_id, {
                status: "queued",
                email_outbox_id: queuedId,
                claimed_until: null,
                last_error: null,
              });
              queued++;
              continue;
            }

            const result = await deliverWebhook(delivery);
            if (result.sent) {
              await patchDelivery(url, key, delivery.delivery_id, {
                status: "sent",
                sent_at: new Date().toISOString(),
                claimed_until: null,
                last_error: null,
              });
              sent++;
            } else if (
              !process.env.SERVER_ALERT_WEBHOOK_URL?.trim() ||
              !process.env.SERVER_ALERT_WEBHOOK_SECRET?.trim()
            ) {
              await patchDelivery(url, key, delivery.delivery_id, {
                status: "skipped",
                claimed_until: null,
                last_error: result.detail,
              });
              skipped++;
            } else {
              const exhausted = delivery.attempt >= 8;
              await patchDelivery(url, key, delivery.delivery_id, {
                status: exhausted ? "failed" : "pending",
                next_attempt_at: new Date(
                  Date.now() + Math.min(360, 2 ** delivery.attempt) * 60_000,
                ).toISOString(),
                claimed_until: null,
                last_error: result.detail,
              });
              if (exhausted) failed++;
              else retrying++;
            }
          }

          const queuedResponse = await fetch(
            `${url}/rest/v1/server_alert_deliveries?select=id,email_outbox_id&status=eq.queued&limit=100`,
            { headers: adminHeaders(key) },
          );
          if (!queuedResponse.ok)
            throw new Error("Could not reconcile queued alert email delivery states");
          const emailDeliveries = (await queuedResponse.json()) as Array<{
            id: string;
            email_outbox_id: string | null;
          }>;
          for (const delivery of emailDeliveries) {
            if (!delivery.email_outbox_id) {
              await patchDelivery(url, key, delivery.id, {
                status: "failed",
                last_error: "Queued email outbox record no longer exists",
              });
              failed++;
              continue;
            }
            const emailResponse = await fetch(
              `${url}/rest/v1/email_outbox?select=status,sent_at,last_error&id=eq.${encodeURIComponent(delivery.email_outbox_id)}&limit=1`,
              { headers: adminHeaders(key) },
            );
            if (!emailResponse.ok) throw new Error("Could not read the email outbox status");
            const [email] = (await emailResponse.json()) as Array<{
              status: string;
              sent_at: string | null;
              last_error: string | null;
            }>;
            if (email?.status === "sent") {
              await patchDelivery(url, key, delivery.id, {
                status: "sent",
                sent_at: email.sent_at,
                last_error: null,
              });
              sent++;
            } else if (email?.status === "failed") {
              await patchDelivery(url, key, delivery.id, {
                status: "failed",
                last_error: email.last_error ?? "Email delivery failed",
              });
              failed++;
            }
          }

          return Response.json({
            claimed: deliveries.length,
            queued,
            sent,
            skipped,
            retrying,
            failed,
          });
        } catch (error) {
          console.error("[server-manager/alerts] delivery processing failed", error);
          return Response.json({ error: "Alert delivery processing failed" }, { status: 502 });
        }
      },
    },
  },
});
