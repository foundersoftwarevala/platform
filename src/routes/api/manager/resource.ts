import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * The Marketplace Manager's window onto the real marketplace.
 *
 * Almost every section of the manager was drawing hardcoded arrays, so nothing
 * an operator did there reached the storefront. Rather than hand-wire seventy
 * screens, this is one endpoint they can all read and write through.
 *
 * Safety comes from the whitelist below, not from the caller: only the tables
 * named here can be touched, only the columns named here can be read, and only
 * the columns named as editable can be changed. Anything else is refused, so a
 * crafted request cannot reach `api_keys` or rewrite a price.
 *
 *   GET    ?resource=products&search=&limit=&offset=
 *   PATCH  { resource, id, changes }
 */

type Resource = {
  table: string;
  /** Columns returned to the manager. */
  select: string[];
  /** Columns an operator may change from the manager. */
  editable: string[];
  /** Columns a search term is matched against. */
  searchable: string[];
  order: string;
  label: string;
};

const RESOURCES: Record<string, Resource> = {
  products: {
    table: "marketplace_products",
    select: ["id", "name", "slug", "industry_label", "price_label", "rating", "downloads_label",
      "badge", "visible", "is_featured", "is_trending", "is_best_seller", "is_new_release",
      "content_status", "demo_url", "sort_order", "category_id", "updated_at"],
    editable: ["name", "price_label", "badge", "visible", "is_featured", "is_trending",
      "is_best_seller", "is_new_release", "content_status", "sort_order", "industry_label"],
    searchable: ["name", "slug", "industry_label"],
    order: "sort_order.asc",
    label: "Products",
  },
  categories: {
    table: "marketplace_categories",
    select: ["id", "name", "slug", "icon", "sort_order", "is_hidden", "is_featured", "updated_at"],
    editable: ["name", "icon", "sort_order", "is_hidden", "is_featured"],
    searchable: ["name", "slug"],
    order: "sort_order.asc",
    label: "Categories",
  },
  orders: {
    table: "marketplace_orders",
    select: ["id", "order_no", "order_number", "status", "total", "currency", "amount_inr",
      "currency_charged", "txnid", "payu_status", "payment_gateway", "buyer_id", "created_at"],
    // An operator may cancel or reinstate an order, never edit its money.
    editable: ["status"],
    searchable: ["order_no", "order_number", "txnid", "status"],
    order: "created_at.desc",
    label: "Orders",
  },
  licences: {
    table: "licenses",
    select: ["id", "license_key", "order_id", "user_id", "product_id", "status",
      "issued_at", "revoked_at", "revoked_reason", "activation_count"],
    editable: ["status", "revoked_reason"],
    searchable: ["license_key", "status"],
    order: "issued_at.desc",
    label: "Licences",
  },
  payments: {
    table: "payment_logs",
    select: ["id", "order_id", "event_type", "provider", "signature_valid", "payload", "created_at"],
    editable: [],
    searchable: ["event_type", "provider"],
    order: "created_at.desc",
    label: "Payment log",
  },
  invoices: {
    table: "finance_invoices",
    select: ["id", "invoice_no", "client_name", "total", "status", "issue_date",
      "auto_generated", "created_at"],
    editable: ["status", "client_name"],
    searchable: ["invoice_no", "client_name", "status"],
    order: "issue_date.desc",
    label: "Invoices",
  },
  leads: {
    table: "leads",
    select: ["id", "name", "email", "phone", "status", "source", "source_page",
      "cta_action", "requirements", "created_at"],
    editable: ["status"],
    searchable: ["name", "email", "status", "source"],
    order: "created_at.desc",
    label: "Leads",
  },
  mail: {
    table: "email_outbox",
    select: ["id", "to_email", "subject", "status", "attempts", "last_error",
      "order_id", "sent_at", "created_at"],
    editable: ["status"],
    searchable: ["to_email", "subject", "status"],
    order: "created_at.desc",
    label: "Outbound mail",
  },
  keywords: {
    table: "seo_keywords",
    select: ["id", "keyword", "target_url", "country", "industry", "intent",
      "status", "position", "search_volume"],
    editable: ["keyword", "target_url", "country", "industry", "intent", "status"],
    searchable: ["keyword", "country", "industry", "status"],
    order: "search_volume.desc",
    label: "SEO keywords",
  },
};

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/manager/resource")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        const params = new URL(request.url).searchParams;
        const name = (params.get("resource") ?? "").trim();
        const resource = RESOURCES[name];
        if (!resource) {
          return Response.json(
            { error: "Unknown resource", available: Object.keys(RESOURCES) },
            { status: 400 },
          );
        }

        const limit = Math.min(Math.max(Number(params.get("limit") ?? 50) || 50, 1), 200);
        const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);
        const search = (params.get("search") ?? "").trim().slice(0, 120);

        let query =
          `${resource.table}?select=${resource.select.join(",")}` +
          `&order=${resource.order}&limit=${limit}&offset=${offset}`;
        if (search && resource.searchable.length) {
          const term = search.replace(/[(),*]/g, " ").trim();
          const or = resource.searchable.map((c) => `${c}.ilike.*${term}*`).join(",");
          query += `&or=(${encodeURIComponent(or)})`;
        }

        try {
          const response = await fetch(`${url()}/rest/v1/${query}`, {
            headers: { ...admin(), Prefer: "count=exact" },
          });
          if (!response.ok) {
            console.error("[manager] read failed", resource.table, response.status);
            return Response.json({ error: `Could not read ${resource.label}` }, { status: 502 });
          }
          const rows = await response.json();
          const range = response.headers.get("content-range") ?? "";
          return Response.json({
            resource: name,
            label: resource.label,
            columns: resource.select,
            editable: resource.editable,
            rows,
            total: Number(range.split("/")[1]) || (rows as unknown[]).length,
            limit,
            offset,
          });
        } catch (error) {
          console.error("[manager] read threw", error);
          return Response.json({ error: `Could not read ${resource.label}` }, { status: 502 });
        }
      },

      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        if (!url()) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: { resource?: string; id?: string; changes?: Record<string, unknown> };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const resource = RESOURCES[String(body.resource ?? "")];
        if (!resource) return Response.json({ error: "Unknown resource" }, { status: 400 });
        if (!resource.editable.length) {
          return Response.json({ error: `${resource.label} is read only` }, { status: 403 });
        }
        const id = String(body.id ?? "");
        if (!UUID.test(id)) return Response.json({ error: "A row id is required" }, { status: 400 });

        // Only whitelisted columns survive. Anything else is dropped, not an error,
        // so a UI sending an extra field cannot fail the whole save.
        const changes: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(body.changes ?? {})) {
          if (resource.editable.includes(key)) changes[key] = value;
        }
        if (!Object.keys(changes).length) {
          return Response.json(
            { error: "Nothing changeable was sent", editable: resource.editable },
            { status: 400 },
          );
        }

        try {
          const response = await fetch(
            `${url()}/rest/v1/${resource.table}?id=eq.${encodeURIComponent(id)}` +
              `&select=${resource.select.join(",")}`,
            { method: "PATCH", headers: { ...admin(), Prefer: "return=representation" },
              body: JSON.stringify(changes) },
          );
          if (!response.ok) {
            const detail = await response.text();
            console.error("[manager] write failed", resource.table, response.status, detail);
            return Response.json({ error: "That change was not saved" }, { status: 502 });
          }
          const rows = (await response.json()) as Record<string, unknown>[];
          return Response.json({ ok: true, row: rows[0] ?? null, changed: Object.keys(changes) });
        } catch (error) {
          console.error("[manager] write threw", error);
          return Response.json({ error: "That change was not saved" }, { status: 502 });
        }
      },
    },
  },
});
