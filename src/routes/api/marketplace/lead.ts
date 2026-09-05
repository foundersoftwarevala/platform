import { createFileRoute } from "@tanstack/react-router";

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
const ALLOWED_ACTIONS = new Set([
  "request_demo", "notify_me", "enquiry", "callback", "buy_intent",
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

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
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
        if (UUID_RE.test(productIdRaw)) row.product_id = productIdRaw;

        try {
          const response = await fetch(`${url}/rest/v1/leads`, {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(row),
          });
          if (!response.ok) {
            console.error("[lead] insert failed", response.status, await response.text());
            return Response.json({ error: "We could not save that. Please try again." }, { status: 502 });
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
