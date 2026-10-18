import { createFileRoute } from "@tanstack/react-router";

import {
  ATTRIBUTION_WINDOW_DAYS,
  currentUser,
  generateUniqueCode,
  partnerForUser,
  requireAffiliate,
  rest,
} from "@/lib/affiliate/core";
import { bearer } from "@/lib/applications/gateway.server";
import { submitApplication } from "@/lib/applications/submit.server";

/**
 * The affiliate's own account: apply, see status, manage referral links.
 *
 * An affiliate references the existing authenticated user — no second account
 * is created. Applying produces a `pending` partner row; only an operator can
 * approve it, so nobody can enrol themselves into a paying programme.
 *
 *   GET  /api/affiliate/account            -> profile, links, and their totals
 *   POST /api/affiliate/account            -> apply to join
 *   POST /api/affiliate/account {action:"create-link", label?, productId?, campaign?}
 *   POST /api/affiliate/account {action:"toggle-link", linkId, active}
 */

export const Route = createFileRoute("/api/affiliate/account")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const gate = await requireAffiliate(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const partnerId = gate.partner.id;

        const codesResponse = await rest(
          `marketplace_referral_codes?select=id,code,active,created_at` +
            `&affiliate_partner_id=eq.${encodeURIComponent(partnerId)}&order=created_at.desc&limit=200`,
        );
        const codes = codesResponse.ok
          ? ((await codesResponse.json()) as { id: string; code: string; active: boolean }[])
          : [];

        // Per-link performance, counted from the sessions actually recorded.
        const links = await Promise.all(
          codes.map(async (c) => {
            const sessionsResponse = await rest(
              `marketplace_referral_sessions?select=id,metadata,converted_order_id,first_seen_at` +
                `&referral_code_id=eq.${encodeURIComponent(c.id)}&limit=2000`,
            );
            const sessions = sessionsResponse.ok
              ? ((await sessionsResponse.json()) as
                  { metadata: Record<string, unknown> | null; converted_order_id: string | null }[])
              : [];
            const clicks = sessions.reduce((sum, s) => sum + Number(s.metadata?.clicks ?? 1), 0);
            const conversions = sessions.filter((s) => s.converted_order_id).length;
            return {
              ...c,
              url: `/?ref=${c.code}`,
              clicks,
              visitors: sessions.length,
              conversions,
              conversionRate: sessions.length ? Math.round((conversions / sessions.length) * 1000) / 10 : 0,
            };
          }),
        );

        return Response.json({
          partner: {
            id: partnerId,
            display_name: gate.partner.display_name,
            status: gate.partner.status,
            created_at: gate.partner.created_at,
          },
          attributionWindowDays: ATTRIBUTION_WINDOW_DAYS,
          links,
        });
      },

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }
        const action = String(body.action ?? "apply");

        // ------------------------------------------------------------ apply
        /**
         * Applying to join.
         *
         * This used to insert a row with the service key keeping only the
         * display name, so the rest of the affiliate form was thrown away. It
         * now goes through the same path as every other role: the form's
         * fields checked and kept, secrets encrypted, and
         * submit_affiliate_application called as the applicant - which refuses
         * a second application and records and announces the first.
         */
        if (action === "apply") {
          const user = await currentUser(request);
          const token = bearer(request);
          if (!user || !token) return Response.json({ error: "Please sign in" }, { status: 401 });

          const existing = await partnerForUser(user.id);
          if (existing) {
            return Response.json(
              { ok: true, alreadyApplied: true, status: existing.status, partnerId: existing.id },
              { status: 200 },
            );
          }
          const values =
            body.values && typeof body.values === "object" && !Array.isArray(body.values)
              ? (body.values as Record<string, unknown>)
              : { fullName: body.displayName };
          const result = await submitApplication(
            "affiliate",
            values,
            body.termsAccepted === true,
            token,
            user.id,
          );
          if ("error" in result) {
            return Response.json({ error: result.error }, { status: result.status });
          }
          return Response.json(
            { ok: true, applied: true, status: result.status, partnerId: result.id },
            { status: 201 },
          );
        }

        // Everything below needs an approved affiliate.
        const gate = await requireAffiliate(request);
        if (!gate.ok) return gate.response;

        // ------------------------------------------------------ create link
        if (action === "create-link") {
          const countResponse = await rest(
            `marketplace_referral_codes?select=id&affiliate_partner_id=eq.${encodeURIComponent(gate.partner.id)}&limit=200`,
          );
          const count = countResponse.ok ? ((await countResponse.json()) as unknown[]).length : 0;
          if (count >= 50) {
            return Response.json(
              { error: "You already have 50 links. Deactivate one before creating another." },
              { status: 409 },
            );
          }

          const code = await generateUniqueCode("SV");
          if (!code) {
            return Response.json({ error: "Could not allocate a code, please retry" }, { status: 503 });
          }
          const created = await rest("marketplace_referral_codes", {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({
              code,
              affiliate_partner_id: gate.partner.id,
              active: true,
            }),
          });
          if (!created.ok) {
            return Response.json({ error: "Could not create the link" }, { status: 502 });
          }
          const rows = (await created.json()) as { id: string; code: string }[];
          return Response.json({ ok: true, link: { ...rows[0], url: `/?ref=${rows[0].code}` } }, { status: 201 });
        }

        // ------------------------------------------------------ toggle link
        if (action === "toggle-link") {
          const linkId = String(body.linkId ?? "").trim();
          if (!linkId) return Response.json({ error: "linkId is required" }, { status: 400 });

          // Ownership is checked against the database, not taken from the body.
          const owned = await rest(
            `marketplace_referral_codes?select=id&id=eq.${encodeURIComponent(linkId)}` +
              `&affiliate_partner_id=eq.${encodeURIComponent(gate.partner.id)}&limit=1`,
          );
          if (!owned.ok || ((await owned.json()) as unknown[]).length === 0) {
            return Response.json({ error: "That link does not belong to this affiliate" }, { status: 403 });
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
