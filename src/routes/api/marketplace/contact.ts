import { createFileRoute } from "@tanstack/react-router";

import {
  operatorRecipients,
  send as sendMail,
  supportAcknowledgementEmail,
  supportNotificationEmail,
} from "@/lib/commerce/mailer";

/**
 * Where a customer's message from /contact becomes a support record.
 *
 * It writes to `support_tickets` — the table the Support Operations Center
 * already reads — rather than to anything new. The console has columns for
 * exactly this shape of message (reference, subject, description, customer
 * name, channel, category, priority, SLA) and was only ever missing a way for
 * a customer to put a row in it: every one of the eleven rows that existed
 * arrived by email or chat and was typed in by hand.
 *
 * `ams_tickets` is deliberately not the target. That is the internal work
 * queue — department, team, assignee, product — and is owned by AMS. A message
 * from the public site is an inbound support request, which is what
 * support_tickets is for, so nothing is duplicated and no second support
 * system is created.
 *
 * Runs on the server so the insert uses the service role key: row level
 * security correctly refuses an anonymous write, so the browser posts here
 * instead of writing to the database itself.
 *
 * The reply is honest about the email. A message is always recorded, and the
 * response says separately whether the acknowledgement could actually be sent
 * — with no provider configured the mailer queues it durably in `email_outbox`
 * and says so, and this endpoint never reports a send that did not happen.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The categories the Support Desk already groups tickets by. */
const CATEGORIES = new Set([
  "general",
  "billing",
  "technical",
  "order",
  "licence",
  "demo",
  "partnership",
]);

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 4;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

/**
 * A human-readable reference, the shape the existing rows already use.
 * Random rather than sequential so one customer cannot read another's volume.
 */
function reference(): string {
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const tail = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SV-${day}-${tail}`;
}

const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export const Route = createFileRoute("/api/marketplace/contact")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL?.trim();
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!url || !serviceKey) {
          return Response.json({ error: "Support is not configured" }, { status: 503 });
        }

        const sourceIp =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "unknown";
        if (rateLimited(sourceIp)) {
          return Response.json(
            { error: "Too many messages from this address. Please try again in a minute." },
            { status: 429 },
          );
        }

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Could not read the form" }, { status: 400 });
        }

        const name = text(body.name, 120);
        const email = text(body.email, 200);
        const phone = text(body.phone, 40);
        const subject = text(body.subject, 200);
        const description = text(body.message, 5000);
        const rawCategory = text(body.category, 40).toLowerCase();
        const category = CATEGORIES.has(rawCategory) ? rawCategory : "general";
        const sourcePage = text(body.sourcePage, 300) || null;

        if (!name) return Response.json({ error: "Please tell us your name" }, { status: 400 });
        if (!EMAIL_RE.test(email)) {
          return Response.json({ error: "Please give an email address we can reply to" }, { status: 400 });
        }
        if (description.length < 10) {
          return Response.json({ error: "Please describe what you need help with" }, { status: 400 });
        }

        const admin = {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        };

        const ref = reference();
        const insert = await fetch(`${url}/rest/v1/support_tickets`, {
          method: "POST",
          headers: admin,
          body: JSON.stringify({
            reference: ref,
            subject: subject || `${category} enquiry`,
            description: sourcePage ? `${description}\n\n— sent from ${sourcePage}` : description,
            customer_name: name,
            channel: "web",
            category,
            priority: "medium",
            status: "new",
          }),
        });

        if (!insert.ok) {
          // The message is not silently dropped and the customer is not told it
          // arrived when it did not.
          console.error("[contact] could not record", insert.status, await insert.text());
          return Response.json(
            { error: "We could not record your message. Please WhatsApp us on +91 83488 38383." },
            { status: 502 },
          );
        }

        const row = ((await insert.json()) as { id?: string }[])[0] ?? {};

        // The customer's copy, then the operators'. Neither failing loses the
        // ticket, which is already written.
        let acknowledged = false;
        let mailReason = "not attempted";
        try {
          const result = await sendMail({
            ...supportAcknowledgementEmail({ name, reference: ref, subject: subject || category }),
            to: email,
          });
          acknowledged = result.sent;
          mailReason = result.reason;
        } catch (problem) {
          mailReason = problem instanceof Error ? problem.message : "send failed";
        }

        try {
          const operators = await operatorRecipients();
          for (const operator of operators) {
            await sendMail({
              ...supportNotificationEmail({
                name,
                email,
                phone,
                category,
                subject: subject || `${category} enquiry`,
                description,
                reference: ref,
                sourcePage,
              }),
              to: operator,
            });
          }
        } catch (problem) {
          console.error("[contact] operator notification", problem);
        }

        return Response.json({
          ok: true,
          reference: ref,
          ticketId: row.id ?? null,
          // Said plainly, so the page can tell the truth rather than claim an
          // email that is only queued.
          emailSent: acknowledged,
          emailDetail: mailReason,
        });
      },
    },
  },
});
