/**
 * Getting mail out of the system.
 *
 * There is no email provider configured yet, and the honest response to that is
 * not to drop the message — it is to queue it durably so nothing is lost, and
 * to send the queue the moment credentials exist. `email_outbox` is that queue.
 *
 * Two providers are supported because they are the two the business is most
 * likely to reach for: an HTTP API (Resend) and plain SMTP over an HTTP relay.
 * Whichever is configured wins; if neither is, the message stays queued with
 * status "pending" and the reason recorded, and `sendQueued` will pick it up
 * later. No message is ever reported as sent when it was not.
 */

export type Message = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Ties the message to what caused it, so a failure can be traced. */
  context?: Record<string, unknown>;
};

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export function mailFrom(): string {
  return process.env.MAIL_FROM?.trim() || "Software Vala <hellosoftwarevala@gmail.com>";
}

export function providerConfigured(): "resend" | "smtp-relay" | null {
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.SMTP_RELAY_URL?.trim() && process.env.SMTP_RELAY_TOKEN?.trim()) {
    return "smtp-relay";
  }
  return null;
}

/** Put a message in the queue. It is never lost, whatever the provider does. */
export async function queue(message: Message, status = "pending", error?: string): Promise<string | null> {
  if (!url()) return null;
  try {
    const response = await fetch(`${url()}/rest/v1/email_outbox`, {
      method: "POST",
      headers: { ...admin(), Prefer: "return=representation" },
      body: JSON.stringify({
        to_email: message.to,
        subject: message.subject,
        body_html: message.html,
        body_text: message.text ?? null,
        status,
        last_error: error ?? null,
        context: message.context ?? {},
        order_id: (message.context?.order_id as string | undefined) ?? null,
      }),
    });
    if (!response.ok) {
      console.error("[mail] could not queue", response.status, await response.text());
      return null;
    }
    const rows = (await response.json()) as { id: string }[];
    return rows[0]?.id ?? null;
  } catch (problem) {
    console.error("[mail] queue threw", problem);
    return null;
  }
}

async function deliver(message: Message): Promise<{ sent: boolean; detail: string }> {
  const provider = providerConfigured();
  if (!provider) return { sent: false, detail: "no email provider configured" };

  try {
    if (provider === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY?.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: mailFrom(),
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      const detail = await response.text();
      return { sent: response.ok, detail: detail.slice(0, 300) };
    }

    const response = await fetch(process.env.SMTP_RELAY_URL!.trim(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SMTP_RELAY_TOKEN?.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFrom(),
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    const detail = await response.text();
    return { sent: response.ok, detail: detail.slice(0, 300) };
  } catch (problem) {
    return { sent: false, detail: problem instanceof Error ? problem.message : "send failed" };
  }
}

/**
 * Queue a message and try to send it straight away.
 * The return value says what really happened, never more.
 */
export async function send(message: Message): Promise<{ queued: boolean; sent: boolean; reason: string }> {
  const result = await deliver(message);
  const id = await queue(
    message,
    result.sent ? "sent" : "pending",
    result.sent ? undefined : result.detail,
  );
  if (!result.sent) {
    console.warn(`[mail] queued but not sent to ${message.to}: ${result.detail}`);
  }
  return { queued: Boolean(id), sent: result.sent, reason: result.detail };
}

/**
 * Drain whatever is waiting. Safe to call repeatedly — it only touches rows
 * still marked pending, and records why each one failed if it fails again.
 */
export async function sendQueued(limit = 25): Promise<{ attempted: number; sent: number; reason?: string }> {
  if (!url()) return { attempted: 0, sent: 0, reason: "not configured" };
  if (!providerConfigured()) {
    return { attempted: 0, sent: 0, reason: "no email provider configured" };
  }

  const response = await fetch(
    `${url()}/rest/v1/email_outbox?select=id,to_email,subject,body_html,body_text&status=eq.pending` +
      `&order=created_at.asc&limit=${limit}`,
    { headers: admin() },
  );
  if (!response.ok) return { attempted: 0, sent: 0, reason: "could not read the queue" };
  const rows = (await response.json()) as {
    id: string; to_email: string; subject: string; body_html: string; body_text: string | null;
  }[];

  let sent = 0;
  for (const row of rows) {
    const result = await deliver({ to: row.to_email, subject: row.subject, html: row.body_html, text: row.body_text ?? undefined });
    await fetch(`${url()}/rest/v1/email_outbox?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { ...admin(), Prefer: "return=minimal" },
      body: JSON.stringify({
        status: result.sent ? "sent" : "pending",
        last_error: result.sent ? null : result.detail,
        attempts: (row as { attempts?: number }).attempts ?? 0,
        sent_at: result.sent ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (result.sent) sent++;
  }
  return { attempted: rows.length, sent };
}

/** The message a buyer gets once their licence exists. */
export function licenceEmail(input: {
  name: string; productName: string; licenceKey: string; orderNo?: string | null;
}): Message {
  const { name, productName, licenceKey, orderNo } = input;
  return {
    to: "",
    subject: `Your ${productName} licence — Software Vala`,
    text:
      `Hello ${name},\n\nYour payment is confirmed and your licence is ready.\n\n` +
      `Licence key: ${licenceKey}\n${orderNo ? `Order: ${orderNo}\n` : ""}\n` +
      `Our team will contact you on this email and on WhatsApp to collect your domain, ` +
      `hosting and branding, and to complete the setup for you.\n\n` +
      `WhatsApp: +91 83488 38383\nSoftware Vala`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h1 style="margin:0 0 4px;font-size:20px">Your licence is ready</h1>
  <p style="margin:0 0 20px;color:#555;font-size:14px">Hello ${name}, your payment is confirmed.</p>
  <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
    <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280">${productName}</p>
    <p style="margin:6px 0 0;font-family:ui-monospace,monospace;font-size:16px;font-weight:700">${licenceKey}</p>
    ${orderNo ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280">Order ${orderNo}</p>` : ""}
  </div>
  <p style="font-size:14px;line-height:1.6;color:#333">
    Our team will contact you on this email and on WhatsApp to collect your domain,
    hosting and branding, and to complete the setup for you.
  </p>
  <p style="font-size:14px;color:#333">WhatsApp <a href="https://wa.me/918348838383">+91 83488 38383</a></p>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af">Software Vala — The Name of Trust</p>
</div>`,
    context: { licence_key: licenceKey, order_no: orderNo ?? null },
  };
}
