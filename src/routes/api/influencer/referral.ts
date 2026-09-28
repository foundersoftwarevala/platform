import { createFileRoute } from "@tanstack/react-router";

import {
  ATTRIBUTION_WINDOW_DAYS,
  currentUser,
  generateUniqueCode,
  rest,
} from "@/lib/affiliate/core";

/**
 * An influencer's referral links, and what each one has actually brought in.
 *
 * The referral chain was built for affiliates and carries an
 * influencer_profile_id on every table of it - the code, the session, the order
 * attribution - and not one row had ever been written with it. An influencer had
 * no way to get a code, so there was nothing for the tracker to resolve and
 * nothing for checkout to attribute. The links screen is the missing end of a
 * chain that otherwise works: it has attributed four real orders to affiliates.
 *
 * Nothing new is introduced here. Codes are allocated by the same
 * generateUniqueCode() that allocates an affiliate's, written to the same
 * marketplace_referral_codes table, and resolved by the same /api/track/ref.
 *
 *   GET  /api/influencer/referral   -> the influencer's links, with real counts
 *   POST /api/influencer/referral   {action:"create-link", productId?}
 *   POST /api/influencer/referral   {action:"toggle-link", linkId, active}
 *
 * Every count below is read from the sessions and attributions that were
 * recorded. A link that has brought nobody reads zero.
 */

type Profile = { id: string; user_id: string | null; full_name: string | null; status: string };

async function profileForUser(userId: string): Promise<Profile | null> {
  const response = await rest(
    `influencer_profiles?select=id,user_id,full_name,status` +
      `&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Profile[];
  return rows[0] ?? null;
}

type Gate =
  | { ok: true; profile: Profile; userId: string }
  | { ok: false; response: Response };

async function requireInfluencer(request: Request): Promise<Gate> {
  const user = await currentUser(request);
  if (!user) return { ok: false, response: Response.json({ error: "Please sign in" }, { status: 401 }) };

  const profile = await profileForUser(user.id);
  if (!profile) {
    return {
      ok: false,
      response: Response.json({ error: "This account is not enrolled as an influencer" }, { status: 403 }),
    };
  }
  // A suspended or rejected influencer keeps their history and earns nothing
  // further; they cannot mint new links either.
  if (profile.status !== "active") {
    return {
      ok: false,
      response: Response.json({ error: `This influencer account is ${profile.status}` }, { status: 403 }),
    };
  }
  return { ok: true, profile, userId: user.id };
}

const MAX_LINKS = 50;

export const Route = createFileRoute("/api/influencer/referral")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireInfluencer(request);
        if (!gate.ok) return gate.response;

        const codesResponse = await rest(
          `marketplace_referral_codes?select=id,code,active,created_at` +
            `&influencer_profile_id=eq.${encodeURIComponent(gate.profile.id)}` +
            `&order=created_at.desc&limit=${MAX_LINKS * 4}`,
        );
        const codes = codesResponse.ok
          ? ((await codesResponse.json()) as { id: string; code: string; active: boolean; created_at: string }[])
          : [];

        const links = await Promise.all(
          codes.map(async (c) => {
            const sessionsResponse = await rest(
              `marketplace_referral_sessions?select=id,metadata,converted_order_id` +
                `&referral_code_id=eq.${encodeURIComponent(c.id)}&limit=2000`,
            );
            const sessions = sessionsResponse.ok
              ? ((await sessionsResponse.json()) as
                  { metadata: Record<string, unknown> | null; converted_order_id: string | null }[])
              : [];
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
              conversionRate: sessions.length ? Math.round((conversions / sessions.length) * 1000) / 10 : 0,
            };
          }),
        );

        // What the links have earned, from the canonical partner ledger. A
        // reversal is a negative row in the same ledger, so summing it gives the
        // net rather than a total that quietly ignores cancelled sales.
        const ledgerResponse = await rest(
          `partner_commissions?select=commission_amount,currency,status` +
            `&partner_kind=eq.influencer&partner_id=eq.${encodeURIComponent(gate.profile.id)}&limit=5000`,
        );
        const ledger = ledgerResponse.ok
          ? ((await ledgerResponse.json()) as { commission_amount: string | number; status: string }[])
          : [];
        const sum = (rows: typeof ledger) =>
          Math.round(rows.reduce((s, r) => s + (Number(r.commission_amount) || 0), 0) * 100) / 100;

        return Response.json({
          profile: {
            id: gate.profile.id,
            full_name: gate.profile.full_name,
            status: gate.profile.status,
          },
          attributionWindowDays: ATTRIBUTION_WINDOW_DAYS,
          links,
          commissions: {
            pending: sum(ledger.filter((r) => r.status === "pending")),
            approved: sum(ledger.filter((r) => r.status === "approved")),
            paid: sum(ledger.filter((r) => r.status === "paid")),
            reversed: sum(ledger.filter((r) => r.status === "reversed")),
            lines: ledger.length,
          },
        });
      },

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }
        const action = String(body.action ?? "").trim();

        const gate = await requireInfluencer(request);
        if (!gate.ok) return gate.response;

        if (action === "create-link") {
          const countResponse = await rest(
            `marketplace_referral_codes?select=id` +
              `&influencer_profile_id=eq.${encodeURIComponent(gate.profile.id)}&limit=${MAX_LINKS}`,
          );
          const count = countResponse.ok ? ((await countResponse.json()) as unknown[]).length : 0;
          if (count >= MAX_LINKS) {
            return Response.json(
              { error: `You already have ${MAX_LINKS} links. Deactivate one before creating another.` },
              { status: 409 },
            );
          }

          // The same alphabet and the same uniqueness check as an affiliate's
          // code, with a prefix that says which programme it belongs to.
          const code = await generateUniqueCode("SVI");
          if (!code) {
            return Response.json({ error: "Could not allocate a code, please retry" }, { status: 503 });
          }

          const created = await rest("marketplace_referral_codes", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              code,
              influencer_profile_id: gate.profile.id,
              active: true,
            }),
          });
          if (!created.ok) {
            return Response.json({ error: "Could not create the link" }, { status: 502 });
          }
          const rows = (await created.json()) as { id: string; code: string }[];
          return Response.json(
            { ok: true, link: { ...rows[0], url: `/?ref=${rows[0].code}`, active: true, clicks: 0, visitors: 0, conversions: 0, conversionRate: 0 } },
            { status: 201 },
          );
        }

        if (action === "toggle-link") {
          const linkId = String(body.linkId ?? "").trim();
          if (!linkId) return Response.json({ error: "linkId is required" }, { status: 400 });

          // Ownership is checked against the database, never taken from the body:
          // otherwise one influencer could deactivate another's link.
          const owned = await rest(
            `marketplace_referral_codes?select=id&id=eq.${encodeURIComponent(linkId)}` +
              `&influencer_profile_id=eq.${encodeURIComponent(gate.profile.id)}&limit=1`,
          );
          if (!owned.ok || ((await owned.json()) as unknown[]).length === 0) {
            return Response.json({ error: "That link does not belong to this influencer" }, { status: 403 });
          }
          const patched = await rest(`marketplace_referral_codes?id=eq.${encodeURIComponent(linkId)}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ active: body.active === true }),
          });
          if (!patched.ok) return Response.json({ error: "Could not update the link" }, { status: 502 });
          return Response.json({ ok: true, linkId, active: body.active === true });
        }

        return Response.json({ error: "Unknown action" }, { status: 400 });
      },
    },
  },
});
