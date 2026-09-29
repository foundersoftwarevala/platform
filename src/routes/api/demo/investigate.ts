import { createFileRoute } from "@tanstack/react-router";

import { investigateBatch, investigateOne } from "@/lib/demo/investigate.server";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import type { Actor } from "@/lib/demo/process.server";

/**
 * Investigating the addresses the matcher would not place.
 *
 *   POST { action: "preview", limit }                 read pages, decide, write nothing
 *   POST { action: "commit",  limit, retryFailed? }   the same, and assign what is certain
 *   POST { action: "one", demoUrlId, commit }          a single address, for a rerun
 *
 * Preview leaves the canonical mapping untouched. Commit assigns only where the
 * matcher says MATCHED on the page's own title, and never publishes: a row it
 * assigns stays inactive and unprocessed.
 *
 * Operator-only, by the guard the rest of the pipeline uses.
 */

async function actorOf(request: Request): Promise<Actor> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim();
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization) return { id: null, email: null };
  try {
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: authorization },
    });
    const user = (await r.json()) as { id?: string; email?: string };
    return { id: user.id ?? null, email: user.email ?? null };
  } catch {
    return { id: null, email: null };
  }
}

export const Route = createFileRoute("/api/demo/investigate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "The request body must be JSON." }, { status: 400 });
        }

        const action = String(body.action ?? "preview");
        const actor = await actorOf(request);
        // An operator can ask for the evidence without the AI, which is what to
        // do when the agent is misconfigured and the page still needs reading.
        const withAi = body.withAi !== false;

        try {
          if (action === "one") {
            const demoUrlId = String(body.demoUrlId ?? "").trim();
            if (!/^[0-9a-f-]{36}$/i.test(demoUrlId)) {
              return Response.json({ error: "A demo id is required." }, { status: 400 });
            }
            const store = await fetch(
              `${(process.env.SUPABASE_URL ?? "").replace(/\/+$/, "")}/rest/v1/product_demo_urls` +
                `?select=id,url&id=eq.${encodeURIComponent(demoUrlId)}&limit=1`,
              {
                headers: {
                  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
                  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? ""}`,
                },
              },
            );
            const rows = store.ok ? ((await store.json()) as { id: string; url: string }[]) : [];
            if (!rows[0]) return Response.json({ error: "That demo is not there." }, { status: 404 });
            return Response.json({
              row: await investigateOne({
                demoUrlId: rows[0].id,
                url: rows[0].url,
                commit: body.commit === true,
                actor,
                withAi,
              }),
            });
          }

          if (action !== "preview" && action !== "commit") {
            return Response.json(
              { error: 'action must be "preview", "commit" or "one".' },
              { status: 400 },
            );
          }

          const batchId = String(body.batchId ?? "").trim();
          if (batchId && !/^[0-9a-f-]{36}$/i.test(batchId)) {
            return Response.json({ error: "That is not a batch id." }, { status: 400 });
          }

          const report = await investigateBatch({
            limit: Number(body.limit ?? 25),
            commit: action === "commit",
            retryFailed: body.retryFailed === true,
            actor,
            withAi,
            // One batch at a time when the operator is working through an
            // upload; everything unresolved when they are not.
            batchId: batchId || null,
          });
          return Response.json(report);
        } catch (error) {
          console.error("[demo-investigate] failed", error);
          const message = error instanceof Error ? error.message : String(error);
          // A configuration problem is reported as one, not as a server fault.
          const status = message.startsWith("AI_CONFIGURATION_ERROR") ? 409 : 502;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
