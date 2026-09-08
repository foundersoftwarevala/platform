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
export async function queue(
  message: Message,
  status = "pending",
  error?: string,
  attempts = 0,
): Promise<string | null> {
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
        attempts,
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
    // A first attempt that failed is still an attempt. Recording it here is
    // what lets the retry cap mean something later.
    result.sent ? 0 : 1,
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
/**
 * How long a message waits before it is tried again. Doubling from a minute,
 * capped at six hours, so a provider outage does not turn into a hot loop and a
 * recovered provider is not made to wait a day.
 */
function backoffMinutes(attempts: number): number {
  return Math.min(60 * 6, Math.max(1, 2 ** Math.max(0, attempts - 1)));
}

/** After this many failures a message stops being retried and is marked failed. */
export const MAX_ATTEMPTS = 8;

/**
 * Drain whatever is waiting. Safe to call repeatedly - it only touches rows
 * still marked pending whose backoff has elapsed, counts every attempt, and
 * records why each failure happened.
 *
 * A message that reaches MAX_ATTEMPTS becomes `failed` rather than being tried
 * for ever. It is kept, with its last error, so it can be inspected and
 * requeued by hand.
 */
export async function sendQueued(limit = 25): Promise<{
  attempted: number; sent: number; retrying: number; failed: number; reason?: string;
}> {
  if (!url()) return { attempted: 0, sent: 0, retrying: 0, failed: 0, reason: "not configured" };
  if (!providerConfigured()) {
    return { attempted: 0, sent: 0, retrying: 0, failed: 0, reason: "no email provider configured" };
  }

  // attempts and updated_at were not selected before, which is why the counter
  // could never move and the backoff could not exist.
  const response = await fetch(
    `${url()}/rest/v1/email_outbox` +
      `?select=id,to_email,subject,body_html,body_text,attempts,updated_at,created_at` +
      `&status=eq.pending&order=created_at.asc&limit=${limit * 4}`,
    { headers: admin() },
  );
  if (!response.ok) {
    return { attempted: 0, sent: 0, retrying: 0, failed: 0, reason: "could not read the queue" };
  }
  const rows = (await response.json()) as {
    id: string; to_email: string; subject: string; body_html: string;
    body_text: string | null; attempts: number | null;
    updated_at: string | null; created_at: string;
  }[];

  const now = Date.now();
  const due = rows
    .filter((row) => {
      const attempts = row.attempts ?? 0;
      if (attempts === 0) return true;
      const last = Date.parse(row.updated_at ?? row.created_at);
      if (Number.isNaN(last)) return true;
      return now - last >= backoffMinutes(attempts) * 60_000;
    })
    .slice(0, limit);

  let sent = 0;
  let failed = 0;
  let retrying = 0;

  for (const row of due) {
    const result = await deliver({
      to: row.to_email,
      subject: row.subject,
      html: row.body_html,
      text: row.body_text ?? undefined,
    });
    const attempts = (row.attempts ?? 0) + 1;
    const exhausted = !result.sent && attempts >= MAX_ATTEMPTS;
    const status = result.sent ? "sent" : exhausted ? "failed" : "pending";

    await fetch(`${url()}/rest/v1/email_outbox?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { ...admin(), Prefer: "return=minimal" },
      body: JSON.stringify({
        status,
        attempts,
        last_error: result.sent
          ? null
          : exhausted
            ? `gave up after ${attempts} attempts: ${result.detail}`
            : result.detail,
        sent_at: result.sent ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }),
    });

    if (result.sent) sent++;
    else if (exhausted) {
      failed++;
      console.error(`[mail] giving up on ${row.id} after ${attempts} attempts: ${result.detail}`);
    } else retrying++;
  }

  return { attempted: due.length, sent, retrying, failed };
}

/**
 * Put a failed message back in the queue so it will be tried again. Used when
 * the reason for failure has been dealt with - a provider finally configured,
 * a bad address corrected.
 */
export async function requeueFailed(limit = 100): Promise<{ requeued: number }> {
  if (!url()) return { requeued: 0 };
  const response = await fetch(
    `${url()}/rest/v1/email_outbox?status=eq.failed&limit=${limit}`,
    {
      method: "PATCH",
      headers: { ...admin(), Prefer: "return=representation" },
      body: JSON.stringify({ status: "pending", attempts: 0, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) return { requeued: 0 };
  return { requeued: ((await response.json()) as unknown[]).length };
}

/**
 * Who should hear about a new lead. LEADS_NOTIFY_EMAIL wins if it is set;
 * otherwise the people who actually hold the boss role. An empty list is a
 * real answer and is reported as one.
 */
export async function operatorRecipients(): Promise<string[]> {
  const configured = process.env.LEADS_NOTIFY_EMAIL?.trim();
  if (configured) {
    return configured.split(",").map((address) => address.trim()).filter(Boolean);
  }
  if (!url()) return [];
  try {
    const roles = await fetch(
      `${url()}/rest/v1/user_roles?select=user_id&role=eq.boss`,
      { headers: admin() },
    );
    if (!roles.ok) return [];
    const ids = ((await roles.json()) as { user_id: string }[])
      .map((row) => row.user_id)
      .filter(Boolean);
    if (ids.length === 0) return [];
    const profiles = await fetch(
      `${url()}/rest/v1/profiles?select=email&id=in.(${ids.join(",")})`,
      { headers: admin() },
    );
    if (!profiles.ok) return [];
    return ((await profiles.json()) as { email: string | null }[])
      .map((row) => String(row.email ?? "").trim())
      .filter(Boolean);
  } catch (problem) {
    console.error("[mail] could not resolve operator recipients", problem);
    return [];
  }
}

const ACTION_WORDS: Record<string, string> = {
  request_demo: "a demo",
  notify_me: "an update when it is available",
  enquiry: "more information",
  callback: "a call back",
  buy_intent: "to buy",
};

/** What the visitor gets, so an enquiry is never met with silence. */
export function leadAcknowledgementEmail(input: {
  name: string; productName: string | null; action: string;
}): Message {
  const { name, productName, action } = input;
  const asked = ACTION_WORDS[action] ?? "more information";
  const about = productName ? ` about ${productName}` : "";
  return {
    to: "",
    subject: productName
      ? `We have your request — ${productName}`
      : "We have your request — Software Vala",
    text:
      `Hello ${name},\n\nThank you for asking for ${asked}${about}.\n\n` +
      `Our team has your request and will come back to you on this email and on ` +
      `WhatsApp. If it is urgent, message us directly on WhatsApp +91 83488 38383.\n\n` +
      `Software Vala`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h1 style="margin:0 0 4px;font-size:20px">We have your request</h1>
  <p style="margin:0 0 20px;color:#555;font-size:14px">Hello ${name}, thank you for asking for ${asked}${about}.</p>
  <p style="font-size:14px;line-height:1.6;color:#333">
    Our team has your request and will come back to you on this email and on WhatsApp.
  </p>
  <p style="font-size:14px;color:#333">WhatsApp <a href="https://wa.me/918348838383">+91 83488 38383</a></p>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af">Software Vala — The Name of Trust</p>
</div>`,
    context: { kind: "lead_acknowledgement", action },
  };
}

/** What an operator gets, so a lead is not left sitting unseen in a table. */
export function leadNotificationEmail(input: {
  name: string; email: string; phone: string; productName: string | null;
  action: string; sourcePage: string | null; requirements: string; leadId: string | null;
}): Message {
  const { name, email, phone, productName, action, sourcePage, requirements, leadId } = input;
  const rows: [string, string][] = [
    ["Name", name],
    ["Email", email],
    ["Phone", phone || "not given"],
    ["Wants", ACTION_WORDS[action] ?? action],
    ["Product", productName ?? "not tied to one product"],
    ["Page", sourcePage ?? "unknown"],
  ];
  return {
    to: "",
    subject: `New lead: ${name}${productName ? ` — ${productName}` : ""}`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
      (requirements ? `\n\n${requirements}` : ""),
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <h1 style="margin:0 0 16px;font-size:18px">New lead</h1>
  <table style="border-collapse:collapse;font-size:14px">
    ${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${k}</td><td style="padding:4px 0"><strong>${v}</strong></td></tr>`).join("")}
  </table>
  ${requirements ? `<p style="margin-top:16px;font-size:14px;white-space:pre-wrap;color:#333">${requirements}</p>` : ""}
  <p style="margin-top:20px;font-size:12px;color:#9ca3af">Lead Manager — Software Vala</p>
</div>`,
    context: { kind: "lead_notification", action, lead_id: leadId },
  };
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
