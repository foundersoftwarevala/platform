import { createFileRoute } from "@tanstack/react-router";

import {
  ATTRIBUTION_WINDOW_DAYS,
  currentUser,
  generateUniqueCode,
  rest,
} from "@/lib/affiliate/core";

/**
 * A reseller's referral links, and what each one has brought in.
 *
 * The referral chain already carries a reseller_id at every step - the code,
 * the session, the order attribution, and the reseller's own commission ledger
 * - but no reseller had any way to get a code, so not one had ever been
 * written. This is that missing end, built exactly as the influencer's is:
 * codes come from the same generateUniqueCode(), live in the same
 * marketplace_referral_codes table and resolve through the same /api/track/ref.
 *
 *   GET  /api/reseller/referral   -> the reseller's links, with real counts
 *   POST /api/reseller/referral   {action:"create-link"}
 *   POST /api/reseller/referral   {action:"toggle-link", linkId, active}
 *
 * Every count is read from the sessions that were recorded; a link that has
 * brought nobody reads zero.
 */

type Reseller = { id: string; name: string | null; status: string };
type ReferralLink = {
  id: string;
  code: string;
  active: boolean;
  created_at: string;
  url: string;
  clicks: number;
  visitors: number;
  conversions: number;
};

async function resellerForUser(userId: string): Promise<Reseller | null> {
  const response = await rest(
    `resellers?select=id,name,status&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) {
    throw new Error(`Reseller lookup failed (${response.status})`);
  }
  return ((await response.json()) as Reseller[])[0] ?? null;
}

type Gate = { ok: true; reseller: Reseller } | { ok: false; response: Response };

async function requireReseller(request: Request): Promise<Gate> {
  const user = await currentUser(request);
  // i18n-ignore: an API error message; this API answers in English.
  if (!user)
    return { ok: false, response: Response.json({ error: "Please sign in" }, { status: 401 }) };
  let reseller: Reseller | null;
  try {
    reseller = await resellerForUser(user.id);
  } catch (error) {
    console.error("[reseller referral] reseller lookup failed", error);
    return {
      ok: false,
      response: Response.json(
        { error: "Your reseller account could not be checked" },
        { status: 502 },
      ),
    };
  }
  if (!reseller) {
    return {
      ok: false,
      // i18n-ignore: an API error message; this API answers in English.
      response: Response.json({ error: "This account is not a reseller" }, { status: 403 }),
    };
  }
  // A reseller who is not active keeps their history but cannot mint links.
  if (reseller.status !== "active") {
    return {
      ok: false,
      response: Response.json(
        // i18n-ignore: an API error message; this API answers in English.
        { error: `This reseller account is ${reseller.status}` },
        { status: 403 },
      ),
    };
  }
  return { ok: true, reseller };
}

const MAX_LINKS = 50;

export const Route = createFileRoute("/api/reseller/referral")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireReseller(request);
        if (!gate.ok) return gate.response;

        const codesResponse = await rest(
          `marketplace_referral_codes?select=id,code,active,created_at` +
            `&reseller_id=eq.${encodeURIComponent(gate.reseller.id)}` +
            `&order=created_at.desc&limit=${MAX_LINKS * 4}`,
        );
        if (!codesResponse.ok) {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Your links could not be read" }, { status: 502 });
        }
        const codes = (await codesResponse.json()) as {
          id: string;
          code: string;
          active: boolean;
          created_at: string;
        }[];

        let links: ReferralLink[];
        try {
          links = await Promise.all(
            codes.map(async (c) => {
              const sessionsResponse = await rest(
                `marketplace_referral_sessions?select=id,metadata,converted_order_id` +
                  `&referral_code_id=eq.${encodeURIComponent(c.id)}&limit=2000`,
              );
              if (!sessionsResponse.ok) {
                throw new Error(`Referral-session lookup failed (${sessionsResponse.status})`);
              }
              const sessions = (await sessionsResponse.json()) as {
                metadata: Record<string, unknown> | null;
                converted_order_id: string | null;
              }[];
              const clicks = sessions.reduce((sum, s) => sum + Number(s.metadata?.clicks ?? 1), 0);
              const conversions = sessions.filter((s) => s.converted_order_id).length;
              return {
                id: c.id,
                code: c.code,
                active: c.active,
                created_at: c.created_at,
                url: `/?ref=${c.code}`,
                clicks,
                visitors: sessions.length,
                conversions,
              };
            }),
          );
        } catch (error) {
          console.error("[reseller referral] session metrics lookup failed", error);
          return Response.json({ error: "Referral activity could not be read" }, { status: 502 });
        }

        return Response.json({ attributionWindowDays: ATTRIBUTION_WINDOW_DAYS, links });
      },

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          // i18n-ignore: an API error message; this API answers in English.
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }
        const action = String(body.action ?? "").trim();

        const gate = await requireReseller(request);
        if (!gate.ok) return gate.response;

        if (action === "create-link") {
          const countResponse = await rest(
            // Active links only: the message below tells the reseller to
            // deactivate one, which only helps if inactive links do not count.
            `marketplace_referral_codes?select=id&active=is.true` +
              `&reseller_id=eq.${encodeURIComponent(gate.reseller.id)}&limit=${MAX_LINKS}`,
          );
          if (!countResponse.ok) {
            console.error("[reseller referral] active-link count failed", countResponse.status);
            return Response.json(
              { error: "Your existing links could not be checked" },
              { status: 502 },
            );
          }
          const count = ((await countResponse.json()) as unknown[]).length;
          if (count >= MAX_LINKS) {
            return Response.json(
              // i18n-ignore: an API error message; this API answers in English.
              {
                error: `You already have ${MAX_LINKS} links. Deactivate one before creating another.`,
              },
              { status: 409 },
            );
          }
          // The same alphabet and uniqueness check as every other programme's
          // code, with a prefix that says it is a reseller's.
          const code = await generateUniqueCode("SVR");
          if (!code) {
            // i18n-ignore: an API error message; this API answers in English.
            return Response.json(
              { error: "Could not allocate a code, please retry" },
              { status: 503 },
            );
          }
          const created = await rest("marketplace_referral_codes", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ code, reseller_id: gate.reseller.id, active: true }),
          });
          if (!created.ok) {
            // i18n-ignore: an API error message; this API answers in English.
            return Response.json({ error: "Could not create the link" }, { status: 502 });
          }
          const rows = (await created.json()) as { id: string; code: string; created_at: string }[];
          return Response.json(
            {
              ok: true,
              link: {
                ...rows[0],
                url: `/?ref=${rows[0].code}`,
                active: true,
                clicks: 0,
                visitors: 0,
                conversions: 0,
              },
            },
            { status: 201 },
          );
        }

        if (action === "toggle-link") {
          const linkId = String(body.linkId ?? "").trim();
          // i18n-ignore: an API error message; this API answers in English.
          if (!linkId) return Response.json({ error: "linkId is required" }, { status: 400 });
          // Ownership is checked in the database, never taken from the body.
          const patched = await rest(
            `marketplace_referral_codes?id=eq.${encodeURIComponent(linkId)}` +
              `&reseller_id=eq.${encodeURIComponent(gate.reseller.id)}`,
            {
              method: "PATCH",
              headers: { Prefer: "return=representation" },
              body: JSON.stringify({ active: body.active === true }),
            },
          );
          // i18n-ignore: an API error message; this API answers in English.
          if (!patched.ok)
            return Response.json({ error: "Could not update the link" }, { status: 502 });
          if (((await patched.json()) as unknown[]).length === 0) {
            // i18n-ignore: an API error message; this API answers in English.
            return Response.json(
              { error: "That link does not belong to this reseller" },
              { status: 403 },
            );
          }
          return Response.json({ ok: true, linkId, active: body.active === true });
        }

        // i18n-ignore: an API error message; this API answers in English.
        return Response.json({ error: "Unknown action" }, { status: 400 });
      },
    },
  },
});
