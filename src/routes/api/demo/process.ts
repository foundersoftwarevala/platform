import { createFileRoute } from "@tanstack/react-router";

import { requireInternalOperator } from "@/lib/auth/internal-guard";
import {
  activateDemo,
  investigateDemo,
  listProcessedDemos,
  searchProducts,
  type Actor,
} from "@/lib/demo/process.server";
import { assertPublicUrl, UnsafeUrlError } from "@/lib/demo/safe-fetch.server";

/**
 * Demo Manager → Add Demo: submit a demo address, investigate it, activate it.
 *
 *   GET  ?products=<name>            products to attach a demo to
 *   GET                              demos processed so far
 *   POST {action:"investigate", productId, url}
 *   POST {action:"activate", id}
 *
 * Operators only (boss, admin, super_admin, owner, developer): the address is
 * fetched from this server, and processing spends AI Manager credit.
 */

async function actorOf(request: Request): Promise<Actor> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization) return { id: null, email: null };
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: authorization } });
    const user = (await r.json()) as { id?: string; email?: string };
    return { id: user.id ?? null, email: user.email ?? null };
  } catch {
    return { id: null, email: null };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refuse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/demo/process")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        try {
          const q = new URL(request.url).searchParams.get("products");
          if (q !== null) return Response.json({ products: await searchProducts(q) });
          return Response.json({ demos: await listProcessedDemos() });
        } catch (error) {
          console.error("[demo-process] list failed", error);
          return refuse("Could not read the demos.", 502);
        }
      },
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return refuse("The request body must be JSON.");
        }
        const actor = await actorOf(request);
        try {
          if (body.action === "investigate") {
            const productId = String(body.productId ?? "");
            if (!UUID.test(productId)) return refuse("Choose the product this demo belongs to.");
            const raw = String(body.url ?? "").trim();
            if (raw.length > 2048) return refuse("That address is too long.");
            const url = assertPublicUrl(raw).toString();
            return Response.json({ demo: await investigateDemo({ productId, url, actor }) });
          }
          if (body.action === "activate") {
            const id = String(body.id ?? "");
            if (!UUID.test(id)) return refuse("Unknown demo.");
            return Response.json({ demo: await activateDemo({ id, actor }) });
          }
          return refuse("Unknown action.");
        } catch (error) {
          if (error instanceof UnsafeUrlError) return refuse(error.message);
          console.error("[demo-process] failed", error);
          return refuse(error instanceof Error ? error.message : "Processing failed.", 502);
        }
      },
    },
  },
});
