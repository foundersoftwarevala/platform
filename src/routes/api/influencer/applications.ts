import { createFileRoute } from "@tanstack/react-router";

/**
 * The influencer applications queue, read and decided on the VPS.
 *
 * Influencer Manager's queue read influencer_applications and called
 * review_influencer_application through the browser Supabase client, which is
 * built against the hosted project. So an operator was approving applications
 * in one database while the profile, tier, referral code and commission that
 * follow from an approval all live in another. This is the same queue and the
 * same review function, against the VPS.
 *
 * Both calls carry the operator's own token, so review_influencer_application
 * applies its own rules unchanged: staff only, no reviewing your own
 * application, a reason required to reject, and an already-decided application
 * cannot be decided twice.
 *
 *   GET  /api/influencer/applications?filter=open|all
 *   POST /api/influencer/applications  { id, status, note? }
 */

const OPEN = ["pending", "in_review"];

const SELECT =
  "id,application_number,full_name,email,niche,followers,country,status,rejection_reason,created_at";

function gateway(): string {
  return (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
}
function publishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ?? process.env.SUPABASE_ANON_KEY?.trim() ?? ""
  );
}
function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export const Route = createFileRoute("/api/influencer/applications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = bearer(request);
        // i18n-ignore: an API error message; this API answers in English.
        if (!token) return Response.json({ error: "Please sign in" }, { status: 401 });
        const base = gateway();
        // i18n-ignore: an API error message; this API answers in English.
        if (!base) return Response.json({ error: "Not configured" }, { status: 503 });

        const url = new URL(request.url);
        const filter = url.searchParams.get("filter") === "all" ? "all" : "open";
        // Capped high rather than at a round number that would quietly hide
        // applications once the programme grows; the queue is paged by status,
        // and "open" is the working set.
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 500) || 500, 2000);

        let query = `influencer_applications?select=${SELECT}&order=created_at.desc&limit=${limit}`;
        if (filter === "open") query += `&status=in.(${OPEN.join(",")})`;

        const response = await fetch(`${base}/rest/v1/${query}`, {
          headers: { apikey: publishableKey(), Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          const status = response.status === 401 || response.status === 403 ? 403 : 502;
          return Response.json(
            { error: `The queue could not be read: ${detail.slice(0, 160)}` },
            { status },
          );
        }
        return Response.json({ rows: await response.json() });
      },

      POST: async ({ request }) => {
        const token = bearer(request);
        // i18n-ignore: an API error message; this API answers in English.
        if (!token) return Response.json({ error: "Please sign in" }, { status: 401 });
        const base = gateway();
        // i18n-ignore: an API error message; this API answers in English.
        if (!base) return Response.json({ error: "Not configured" }, { status: 503 });

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const id = String(body.id ?? "").trim();
        const status = String(body.status ?? "").trim();
        const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
        // i18n-ignore: an API error message; this API answers in English.
        if (!id) return Response.json({ error: "An application id is required" }, { status: 400 });
        if (!["in_review", "approved", "rejected"].includes(status)) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json(
            { error: "That is not a decision this queue makes" /* i18n-ignore: API error */ },
            { status: 400 },
          );
        }
        // The database refuses this too; saying it here gives the operator the
        // message on the screen instead of a raw failure.
        if (status === "rejected" && !note) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json(
            { error: "Record why the application is rejected" /* i18n-ignore: API error */ },
            { status: 400 },
          );
        }

        const response = await fetch(`${base}/rest/v1/rpc/review_influencer_application`, {
          method: "POST",
          headers: {
            apikey: publishableKey(),
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_application_id: id,
            p_status: status,
            p_rejection_reason: note,
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          // Every refusal the function raises - not staff, your own
          // application, already decided - is the operator's answer.
          let message = detail.slice(0, 200);
          try {
            const parsed = JSON.parse(detail) as { message?: string };
            if (parsed.message) message = parsed.message;
          } catch {
            /* the raw text is the message */
          }
          return Response.json(
            { error: message },
            { status: response.status === 500 ? 400 : response.status },
          );
        }

        return Response.json((await response.json()) as Record<string, unknown>);
      },
    },
  },
});
