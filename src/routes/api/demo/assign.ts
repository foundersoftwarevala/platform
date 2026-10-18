import { createFileRoute } from "@tanstack/react-router";

import {
  assignDemoUrls,
  commitBatch,
  previewIntakeFile,
  resolveDemoAssignment,
  type AssignReport,
} from "@/lib/demo/assign.server";
import {
  batchProgress,
  BatchRefused,
  BatchSizeExceeded,
  listBatches,
  MAX_BATCH_ROWS,
  setBatchStatus,
} from "@/lib/demo/batch.server";
import { requireInternalOperator } from "@/lib/auth/internal-guard";
import type { Actor } from "@/lib/demo/process.server";

/**
 * Taking demo addresses in, one or twelve thousand, and deciding which product
 * each belongs to.
 *
 *   POST { action: "preview", rows: [{url, product?, name?}] }
 *   POST { action: "commit",  rows: [...] }
 *
 * Preview writes nothing and returns the same decisions, so an operator can see
 * what would happen before it does - which matters most for the rows that would
 * NOT be assigned, since those are the ones a careless import would guess at.
 *
 * Operator-only, by the same guard the rest of the demo pipeline uses: taking a
 * demo in is the first step of putting third-party software on the storefront.
 */

/**
 * Who is acting, resolved from the caller's own token. The same shape the demo
 * pipeline uses, so an assignment and an activation name the person the same way.
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

function refuse(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * A batch that is too large, answered as its own thing.
 *
 * Not a generic 400 with prose in it: the operator's screen has to be able to
 * say "you sent 812, the maximum is 500" and the test has to be able to check
 * that without reading English, so the code and both numbers are fields.
 */
function refuseSize(error: BatchSizeExceeded) {
  return Response.json(
    {
      // i18n-ignore: an API error message; this API answers in English.
      error: "BATCH_SIZE_EXCEEDED",
      message: error.message,
      received: error.received,
      maximum: error.maximum,
    },
    { status: 413 },
  );
}

/** A refusal the operator has to act on: not a fault, so not a 5xx. */
function refuseBatch(error: BatchRefused) {
  return Response.json({ error: error.code, message: error.message }, { status: 409 });
}

export const Route = createFileRoute("/api/demo/assign")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gate = await requireInternalOperator(request);
        if (!gate.ok) return gate.response;

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return refuse("The request body must be JSON.");
        }

        const action = String(body.action ?? "preview");

        /**
         * An operator giving a product to a row the matcher would not place.
         * The only path that assigns an AMBIGUOUS or UNMATCHED row, and it
         * records whose decision it was.
         */
        /**
         * The owner's file, read and decided without being written.
         *
         * Header names are detected from what such an export actually uses, and
         * a file with no address column is refused with a schema error naming
         * what was found - never imported as zero rows.
         */
        if (action === "parse" || action === "file-preview") {
          const text = typeof body.text === "string" ? body.text : "";
          if (!text.trim()) return refuse("Send the file contents as `text`.");
          if (text.length > 4_000_000) {
            return refuse("That file is larger than 4 MB; split it into parts.");
          }
          try {
            return Response.json(
              await previewIntakeFile(text, {
                filename: typeof body.filename === "string" ? body.filename : null,
                actor: await actorOf(request),
                // A preview an operator is only looking at need not be kept.
                register: body.register !== false,
              }),
            );
          } catch (error) {
            if (error instanceof BatchSizeExceeded) return refuseSize(error);
            const message = error instanceof Error ? error.message : String(error);
            return Response.json(
              { error: message },
              { status: message.startsWith("SCHEMA_ERROR") ? 422 : 502 },
            );
          }
        }

        /** The batches, newest first, with each one's progress counted now. */
        if (action === "batches") {
          const limit = Number(body.limit ?? 25);
          return Response.json(await listBatches(Number.isFinite(limit) ? limit : 25));
        }

        /** One batch: where it has got to, and every row of it. */
        if (action === "batch") {
          const batchId = String(body.batchId ?? "").trim();
          if (!/^[0-9a-f-]{36}$/i.test(batchId)) return refuse("A batch id is required.");
          try {
            return Response.json(await batchProgress(batchId));
          } catch (error) {
            if (error instanceof BatchRefused) return refuseBatch(error);
            throw error;
          }
        }

        /**
         * A batch the operator has decided not to commit.
         *
         * Cancelling is about the upload, not about anything on the storefront:
         * it closes a preview that will never be committed so it stops sitting
         * in the history as if it were still coming. No demo row is touched.
         */
        if (action === "cancel") {
          const batchId = String(body.batchId ?? "").trim();
          if (!/^[0-9a-f-]{36}$/i.test(batchId)) return refuse("A batch id is required.");
          try {
            await setBatchStatus(batchId, "CANCELLED", {
              notes: `cancelled by ${(await actorOf(request)).email ?? "an operator"}`,
            });
            return Response.json({ ok: true, batchId, status: "CANCELLED" });
          } catch (error) {
            if (error instanceof BatchRefused) return refuseBatch(error);
            throw error;
          }
        }

        if (action === "resolve") {
          const demoUrlId = String(body.demoUrlId ?? "").trim();
          const product = String(body.product ?? "").trim();
          if (!/^[0-9a-f-]{36}$/i.test(demoUrlId)) return refuse("A demo id is required.");
          if (!product) return refuse("Choose the product this demo belongs to.");
          const outcome = await resolveDemoAssignment({
            demoUrlId,
            product,
            actor: await actorOf(request),
          });
          return outcome.ok
            ? Response.json(outcome)
            : Response.json({ error: outcome.reason }, { status: 409 });
        }

        if (action !== "preview" && action !== "commit") {
          return refuse(
            'action must be "preview", "commit", "resolve", "batch", "batches" or "cancel".',
          );
        }

        const raw = Array.isArray(body.rows) ? body.rows : null;
        if (!raw || raw.length === 0) return refuse("Send at least one address.");
        if (raw.length > MAX_BATCH_ROWS) {
          // Not a limit on how much can be imported - a limit on one batch, so
          // that twelve thousand addresses arrive as batches that each finish,
          // and so that no part of a larger file is silently dropped.
          return refuseSize(new BatchSizeExceeded(raw.length, MAX_BATCH_ROWS));
        }

        const rows = raw.map((r) => {
          const row = (r ?? {}) as Record<string, unknown>;
          return {
            url: String(row.url ?? "").trim(),
            product: row.product == null ? null : String(row.product).trim(),
            name: row.name == null ? null : String(row.name).trim(),
          };
        });

        // Who decided, resolved the same way the rest of the pipeline resolves
        // it, so the assignment record names a person rather than a role.
        const actor = await actorOf(request);

        const batchId = String(body.batchId ?? "").trim();

        try {
          /**
           * A commit that names the batch it previewed goes through the batch
           * rules - it exists, it has not been committed, and these are the
           * addresses that were shown. A commit without one is still allowed,
           * for a single address typed into Add Demo, and gets its own batch id.
           */
          if (action === "commit" && batchId) {
            if (!/^[0-9a-f-]{36}$/i.test(batchId)) return refuse("That is not a batch id.");
            return Response.json(await commitBatch({ batchId, rows, actor }));
          }

          const report: AssignReport = await assignDemoUrls({
            rows,
            commit: action === "commit",
            actor,
          });
          return Response.json(report);
        } catch (error) {
          if (error instanceof BatchSizeExceeded) return refuseSize(error);
          if (error instanceof BatchRefused) return refuseBatch(error);
          console.error("[demo-assign] failed", error);
          return refuse(
            error instanceof Error ? error.message : "The batch could not be processed.",
            502,
          );
        }
      },
    },
  },
});
