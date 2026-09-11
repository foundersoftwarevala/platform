import { createFileRoute } from "@tanstack/react-router";

import {
  leadAcknowledgementEmail,
  leadNotificationEmail,
  operatorRecipients,
  send as sendMail,
} from "@/lib/commerce/mailer";

/**
 * Marketplace lead capture — demo requests, enquiries, notify-me and callbacks.
 *
 * Runs on the server so the insert uses the service role key. Row level
 * security correctly refuses anonymous writes shaped like this, so the browser
 * posts here rather than writing to the database itself.
 *
 * A general enquiry or callback is not about one product and so does not have
 * to name one; every other action does.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The lead sources section 1 lists. Anything outside this set still becomes
// a lead - it is recorded as a generic enquiry rather than refused - but each
// of these keeps its own identity, so the source analytics in section 44 can
// tell a WhatsApp lead from a brochure download.
const ALLOWED_ACTIONS = new Set([
  "request_demo", "notify_me", "enquiry", "callback", "buy_intent",
  "whatsapp", "email_lead", "contact_sales", "brochure",
  "meeting", "live_demo", "consultation", "enterprise",
]);

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
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
 * Which product this lead is about.
 *
 * Tried in order of certainty: the id if the caller sent one, then the slug in
 * the page the visitor was on - /marketplace/product/<slug> is the canonical
 * product URL so it is exact - then the name, but only when it matches exactly
 * one product. A name matching two products resolves to neither, because
 * attributing the lead to whichever row came back first is worse than leaving
 * it unattributed and saying so.
 */
async function resolveProduct(
  base: string,
  headers: Record<string, string>,
  opts: { id: string; sourcePage: string; name: string },
): Promise<{ id: string | null; category: string | null; how: string }> {
  const one = async (query: string) => {
    try {
      const response = await fetch(`${base}/rest/v1/marketplace_products?${query}`, { headers });
      if (!response.ok) return [];
      return (await response.json()) as { id: string; category_id: string | null; industry_label: string | null }[];
    } catch {
      return [];
    }
  };

  if (UUID_RE.test(opts.id)) {
    const rows = await one(
      `select=id,category_id,industry_label&id=eq.${encodeURIComponent(opts.id)}&limit=1`,
    );
    if (rows[0]) return { id: rows[0].id, category: rows[0].industry_label ?? null, how: "id" };
  }

  const slug = opts.sourcePage.match(/\/marketplace\/product\/([A-Za-z0-9-]{1,200})/)?.[1];
  if (slug) {
    const rows = await one(
      `select=id,category_id,industry_label&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    );
    if (rows[0]) return { id: rows[0].id, category: rows[0].industry_label ?? null, how: "slug" };
  }

  if (opts.name) {
    // Two rows back means the name is ambiguous, so nothing is linked.
    const exact = await one(
      `select=id,category_id,industry_label&name=eq.${encodeURIComponent(opts.name)}&limit=2`,
    );
    if (exact.length === 1) {
      return { id: exact[0].id, category: exact[0].industry_label ?? null, how: "name" };
    }
    if (exact.length === 0) {
      const loose = await one(
        `select=id,category_id,industry_label&name=ilike.${encodeURIComponent(opts.name)}&limit=2`,
      );
      if (loose.length === 1) {
        return { id: loose[0].id, category: loose[0].industry_label ?? null, how: "name_ci" };
      }
      if (loose.length > 1) return { id: null, category: null, how: "ambiguous_name" };
    } else {
      return { id: null, category: null, how: "ambiguous_name" };
    }
  }

  return { id: null, category: null, how: opts.name ? "no_match" : "no_product_given" };
}

export const Route = createFileRoute("/api/marketplace/lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env.SUPABASE_URL?.trim();
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!url || !serviceKey) {
          return Response.json({ error: "Lead service is not configured" }, { status: 503 });
        }

        const sourceIp =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "unknown";
        if (rateLimited(sourceIp)) {
          return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
        }

        // The footer's newsletter form is a plain HTML form: it posts
        // form-encoded data with an email and nothing else. This endpoint read
        // only JSON and required a name, so every subscription answered 400.
        // A form post is accepted as a newsletter sign-up (the name is taken
        // from the address), and the visitor is sent back to the page they
        // were on rather than left looking at a JSON response.
        const contentType = request.headers.get("content-type") ?? "";
        const isFormPost =
          contentType.includes("application/x-www-form-urlencoded") ||
          contentType.includes("multipart/form-data");
        let body: Record<string, unknown>;
        try {
          if (isFormPost) {
            const form = await request.formData();
            const formEmail = String(form.get("email") ?? "").trim();
            body = {
              name: String(form.get("name") ?? "").trim() || formEmail.split("@")[0] || "",
              email: formEmail,
              phone: String(form.get("phone") ?? "").trim(),
              ctaAction: String(form.get("ctaAction") ?? "email_lead"),
              sourcePage: String(form.get("sourcePage") ?? "footer_newsletter"),
              requirements: String(form.get("requirements") ?? "Newsletter sign-up"),
            };
          } else {
            body = (await request.json()) as Record<string, unknown>;
          }
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const name = String(body.name ?? "").trim();
        const email = String(body.email ?? "").trim().toLowerCase();
        const phone = String(body.phone ?? "").trim();
        const productName = String(body.productName ?? "").trim();
        const productIdRaw = String(body.productId ?? "").trim();
        const sourcePage = String(body.sourcePage ?? "").trim();
        const requirements = String(body.requirements ?? "").trim();
        const ctaActionRaw = String(body.ctaAction ?? "request_demo").trim();
        const ctaAction = ALLOWED_ACTIONS.has(ctaActionRaw) ? ctaActionRaw : "enquiry";

        if (name.length < 2 || name.length > 200) {
          return Response.json({ error: "Please enter your name." }, { status: 400 });
        }
        if (!EMAIL_RE.test(email) || email.length > 320) {
          return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
        }
        if (phone.length > 80) {
          return Response.json({ error: "Phone number is too long." }, { status: 400 });
        }
        // A general enquiry or callback is not about one product.
        const needsProduct = ctaAction !== "enquiry" && ctaAction !== "callback";
        if (productName.length > 200 || (needsProduct && !productName)) {
          return Response.json({ error: "Product could not be identified." }, { status: 400 });
        }

        // `phone` is NOT NULL on this table, so an empty string is sent rather
        // than null when the visitor did not give one.
        const row: Record<string, unknown> = {
          name,
          email,
          phone: phone || "",
          requirements: [productName && `Product: ${productName}`, requirements]
            .filter(Boolean)
            .join("\n")
            .slice(0, 4000),
          source: "marketplace",
          sub_source: sourcePage || "home",
          source_page: sourcePage || null,
          cta_action: ctaAction,
          status: "new",
          ip_address: sourceIp === "unknown" ? null : sourceIp,
        };
        const resolved = await resolveProduct(url, {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        }, {
          id: productIdRaw,
          sourcePage,
          name: productName,
        });
        if (resolved.id) {
          row.product_id = resolved.id;
          // The product's own category is not copied here. `leads.category`
          // holds what kind of enquiry this is - enterprise_client, franchise,
          // product_buyer - and the product's category is one join away
          // through product_id. Writing one into the other loses both.
        } else if (needsProduct) {
          // Visible rather than silent: an operator can see which leads could
          // not be attributed and why, instead of finding a null and guessing.
          row.requirements = [row.requirements, `[unlinked: ${resolved.how}]`]
            .filter(Boolean)
            .join("\n")
            .slice(0, 4000);
        }

        try {
          const response = await fetch(`${url}/rest/v1/leads`, {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify(row),
          });
          if (!response.ok) {
            console.error("[lead] insert failed", response.status, await response.text());
            return Response.json({ error: "We could not save that. Please try again." }, { status: 502 });
          }

          const saved = (await response.json().catch(() => [])) as { id?: string }[];
          const leadId = saved[0]?.id ?? null;

          // Section 8: capture is only the first step. Deduplicate, score,
          // route, assign and set the first-contact SLA - all on the server,
          // all against the tables Lead Manager already owns. Every stage is
          // independent and best-effort: a lead is never lost because a later
          // stage failed, and nothing here can turn a saved lead into an error
          // the visitor sees.
          if (leadId) {
            try {
              const { runLeadIntake } = await import("@/lib/marketplace/lead-intake");
              await runLeadIntake(
                url,
                { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
                { ...row, id: leadId },
              );
            } catch (error) {
              console.error("[lead] intake failed", error);
            }
          }

          // The lead is saved. Neither message below may change that, so a mail
          // problem is logged and swallowed rather than being reported to the
          // visitor as a failure to record their request.
          try {
            await sendMail({
              ...leadAcknowledgementEmail({ name, productName: productName || null, action: ctaAction }),
              to: email,
              context: { kind: "lead_acknowledgement", lead_id: leadId, action: ctaAction },
            });

            const operators = await operatorRecipients();
            if (operators.length === 0) {
              console.warn(
                "[lead] no operator notified: LEADS_NOTIFY_EMAIL is unset and no boss account has an email",
              );
            }
            for (const operator of operators) {
              await sendMail({
                ...leadNotificationEmail({
                  name, email, phone, productName: productName || null,
                  action: ctaAction, sourcePage: sourcePage || null,
                  requirements: String(row.requirements ?? ""), leadId,
                }),
                to: operator,
                context: { kind: "lead_notification", lead_id: leadId },
              });
            }
          } catch (problem) {
            console.error("[lead] saved, but the notifications could not be queued", problem);
          }

          if (isFormPost) {
            // Back to the same-site page the form was on, marked as done.
            const back = (() => {
              try {
                const referer = new URL(request.headers.get("referer") ?? "");
                const here = new URL(request.url);
                if (referer.host !== here.host) return "/";
                referer.searchParams.set("subscribed", "1");
                return referer.pathname + referer.search + referer.hash;
              } catch {
                return "/";
              }
            })();
            return new Response(null, { status: 303, headers: { Location: back } });
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("[lead] threw", error);
          return Response.json({ error: "We could not reach the server." }, { status: 502 });
        }
      },
    },
  },
});
