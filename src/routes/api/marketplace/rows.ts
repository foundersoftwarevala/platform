import { createFileRoute } from "@tanstack/react-router";
import { requireInternalOperator } from "@/lib/auth/internal-guard";

/**
 * The home page's category rows, as the marketplace actually has them.
 *
 * The row manager used to show a hardcoded list that had nothing to do with the
 * storefront, so reordering it changed nothing. This serves the real rows from
 * `marketplace_categories` and writes changes back, which is what makes the
 * Marketplace Manager the control point for the home page.
 *
 *   GET    list every row with its order, visibility and product count
 *   PATCH  { id, sort_order?, is_hidden?, is_featured? }  change one row
 *   PUT    { order: [id, id, ...] }  renumber the whole list in one go
 *
 * Reads are open because the row list is public information — it is the same
 * thing a visitor sees on the home page. Writes require an operator.
 */

function url() {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function admin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/marketplace/rows")({
  server: {
    handlers: {
      GET: async () => {
        if (!url() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return Response.json({ rows: [], error: "Not configured" }, { status: 503 });
        }
        try {
          const categoryResponse = await fetch(
            `${url()}/rest/v1/marketplace_categories` +
              `?select=id,name,slug,icon,sort_order,is_hidden,is_featured&order=sort_order.asc&limit=200`,
            { headers: admin() },
          );
          if (!categoryResponse.ok) {
            return Response.json({ rows: [], error: "Could not load rows" }, { status: 502 });
          }
          const categories = (await categoryResponse.json()) as Record<string, unknown>[];

          // One pass over the catalogue rather than a count query per row.
          const counts = new Map<string, number>();
          for (let offset = 0; offset < 8000; offset += 1000) {
            const productResponse = await fetch(
              `${url()}/rest/v1/marketplace_products?select=category_id&visible=eq.true` +
                `&limit=1000&offset=${offset}`,
              { headers: admin() },
            );
            if (!productResponse.ok) break;
            const page = (await productResponse.json()) as { category_id: string | null }[];
            for (const row of page) {
              if (row.category_id) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
            }
            if (page.length < 1000) break;
          }

          const rows = categories.map((category, index) => ({
            id: String(category.id),
            position: index + 1,
            sort_order: Number(category.sort_order ?? index),
            title: String(category.name ?? ""),
            slug: String(category.slug ?? ""),
            icon: category.icon ?? null,
            products: counts.get(String(category.id)) ?? 0,
            hidden: Boolean(category.is_hidden),
            featured: Boolean(category.is_featured),
            href: `/marketplace/category/${String(category.slug ?? "")}`,
          }));

          return Response.json({
            rows,
            total: rows.length,
            live: rows.filter((r) => !r.hidden).length,
          });
        } catch (error) {
          console.error("[rows] read failed", error);
          return Response.json({ rows: [], error: "Could not load rows" }, { status: 502 });
        }
      },

      PATCH: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { id?: string; sort_order?: number; is_hidden?: boolean; is_featured?: boolean };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const id = String(body.id ?? "");
        if (!UUID.test(id)) return Response.json({ error: "A row id is required" }, { status: 400 });

        const patch: Record<string, unknown> = {};
        if (typeof body.sort_order === "number") patch.sort_order = Math.trunc(body.sort_order);
        if (typeof body.is_hidden === "boolean") patch.is_hidden = body.is_hidden;
        if (typeof body.is_featured === "boolean") patch.is_featured = body.is_featured;
        if (!Object.keys(patch).length) {
          return Response.json({ error: "Nothing to change" }, { status: 400 });
        }

        const response = await fetch(
          `${url()}/rest/v1/marketplace_categories?id=eq.${encodeURIComponent(id)}`,
          { method: "PATCH", headers: { ...admin(), Prefer: "return=representation" }, body: JSON.stringify(patch) },
        );
        if (!response.ok) {
          console.error("[rows] patch failed", response.status, await response.text());
          return Response.json({ error: "Could not save that change" }, { status: 502 });
        }
        const rows = (await response.json()) as Record<string, unknown>[];
        return Response.json({ ok: true, row: rows[0] ?? null });
      },

      PUT: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: { order?: string[] };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const order = (body.order ?? []).filter((id) => UUID.test(id));
        if (!order.length) return Response.json({ error: "An order is required" }, { status: 400 });

        // Renumbered from 1 so the stored order always matches what is shown.
        let saved = 0;
        for (let index = 0; index < order.length; index++) {
          const response = await fetch(
            `${url()}/rest/v1/marketplace_categories?id=eq.${encodeURIComponent(order[index])}`,
            {
              method: "PATCH",
              headers: { ...admin(), Prefer: "return=minimal" },
              body: JSON.stringify({ sort_order: index + 1 }),
            },
          );
          if (response.ok) saved++;
        }
        return Response.json({ ok: saved === order.length, saved, of: order.length });
      },
    },
  },
});
