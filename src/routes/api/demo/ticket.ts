import { createFileRoute } from "@tanstack/react-router";
import { issueDemoTicket } from "@/lib/demo/ticket";

/**
 * The door to a demo.
 *
 * A visitor who wants to see a product working signs in and confirms their
 * address first. That is what stops the catalogue being walked and copied, and
 * it is also where the business gets its customer: the address attached to the
 * lead this raises is one the person has already proved they can read.
 *
 * Nothing here reveals where a demo is hosted. The reply is a short-lived pass
 * that the proxy accepts; the address itself never leaves the server.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function anonKey() {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ""
  );
}

type Visitor = {
  id: string;
  email?: string;
  phone?: string;
  email_confirmed_at?: string | null;
  phone_confirmed_at?: string | null;
  confirmed_at?: string | null;
  app_metadata?: { provider?: string };
  user_metadata?: { full_name?: string; name?: string };
};

/**
 * A social sign-in is already a verified identity; an address signed up with
 * directly is only verified once the person has confirmed it. Both are
 * accepted, an unconfirmed address on its own is not.
 */
function isVerified(visitor: Visitor): boolean {
  if (visitor.email_confirmed_at || visitor.phone_confirmed_at || visitor.confirmed_at) return true;
  const provider = visitor.app_metadata?.provider ?? "";
  return provider !== "" && provider !== "email";
}

/** Raise the lead, unless this person already produced one for this product. */
async function recordLead(
  visitor: Visitor,
  product: { id: string; name: string; slug: string; category: string | null },
) {
  const email = visitor.email?.trim();
  if (!email) return;
  try {
    const existing = await fetch(
      `${url()}/rest/v1/leads?select=id&email=eq.${encodeURIComponent(email)}` +
        `&product_id=eq.${product.id}&cta_action=eq.demo_open&limit=1`,
      { headers: admin() },
    );
    if (existing.ok && ((await existing.json()) as unknown[]).length > 0) return;

    // `phone` and `category` carry defaults and refuse an explicit null, so a
    // field we do not know is left out rather than sent empty. Sending null
    // failed the whole insert and the lead was lost while the demo still
    // opened - the gate protected the catalogue but the business got nothing.
    const lead: Record<string, unknown> = {
      name:
        visitor.user_metadata?.full_name?.trim() ||
        visitor.user_metadata?.name?.trim() ||
        email.split("@")[0],
      email,
      source: "marketplace",
      sub_source: "demo_gateway",
      status: "new",
      priority: "medium",
      temperature: "warm",
      product_id: product.id,
      cta_action: "demo_open",
      source_page: `/demo/${product.slug}`,
      requirements: `Opened the live demo of ${product.name}.`,
    };
    if (visitor.phone) lead.phone = visitor.phone;
    if (product.category) lead.category = product.category;

    const insert = await fetch(`${url()}/rest/v1/leads`, {
      method: "POST",
      headers: { ...admin(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(lead),
    });
    if (!insert.ok) {
      console.error("[demo ticket] lead refused", insert.status, await insert.text());
    }
  } catch (error) {
    // A lead that could not be raised must never stop the demo opening.
    console.error("[demo ticket] lead not recorded", error);
  }
}

export const Route = createFileRoute("/api/demo/ticket")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY || !anonKey()) {
          return Response.json({ error: "Demos are not available right now." }, { status: 503 });
        }

        const authorization = request.headers.get("authorization");
        if (!authorization) {
          return Response.json(
            { error: "Sign in to open this demo.", reason: "sign_in_required" },
            { status: 401 },
          );
        }

        let slug = "";
        try {
          slug = String(((await request.json()) as { slug?: string })?.slug ?? "").trim();
        } catch {
          slug = "";
        }
        if (!slug) return Response.json({ error: "Which demo?" }, { status: 400 });

        // Who is asking.
        const userResponse = await fetch(`${url()}/auth/v1/user`, {
          headers: { apikey: anonKey(), Authorization: authorization },
        });
        if (!userResponse.ok) {
          return Response.json(
            { error: "Sign in to open this demo.", reason: "sign_in_required" },
            { status: 401 },
          );
        }
        const visitor = (await userResponse.json()) as Visitor;
        if (!visitor?.id) {
          return Response.json(
            { error: "Sign in to open this demo.", reason: "sign_in_required" },
            { status: 401 },
          );
        }
        if (!isVerified(visitor)) {
          return Response.json(
            {
              error: "Confirm your email address, then the demo will open.",
              reason: "verification_required",
            },
            { status: 403 },
          );
        }

        // The product must be on sale and must actually have a live demo.
        const productResponse = await fetch(
          `${url()}/rest/v1/marketplace_products?select=id,name,category_id` +
            `&slug=eq.${encodeURIComponent(slug)}&visible=eq.true&limit=1`,
          { headers: admin() },
        );
        const products = productResponse.ok
          ? ((await productResponse.json()) as { id: string; name: string; category_id: string | null }[])
          : [];
        const product = products[0];
        if (!product) return Response.json({ error: "No such product." }, { status: 404 });

        const demoResponse = await fetch(
          `${url()}/rest/v1/product_demo_urls?select=id&product_id=eq.${product.id}` +
            `&status=eq.active&limit=1`,
          { headers: admin() },
        );
        const demos = demoResponse.ok ? ((await demoResponse.json()) as { id: string }[]) : [];
        if (demos.length === 0) {
          return Response.json({ error: "This product has no live demo yet." }, { status: 404 });
        }

        const ticket = issueDemoTicket(slug, visitor.id);
        if (!ticket) {
          return Response.json({ error: "Demos are not available right now." }, { status: 503 });
        }

        await recordLead(visitor, { id: product.id, name: product.name, slug, category: null });

        return Response.json({ ticket, demoId: demos[0].id });
      },
    },
  },
});
