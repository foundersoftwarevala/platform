import { createFileRoute } from "@tanstack/react-router";
import { translateApiMessage } from "@/lib/i18n/server-translate.server";

import {
  currentUser,
  generateUniqueCode,
  partnerForUser,
  requireAffiliate,
  rest,
} from "@/lib/affiliate/core";
import { bearer } from "@/lib/applications/gateway.server";
import { getAffiliateDashboard, requestAffiliatePayout } from "@/lib/affiliate/core.server";
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
        const translateText = translateApiMessage.bind(null, request);
        const gate = await requireAffiliate(request, { allowPending: true });
        if (!gate.ok) return gate.response;
        const token = bearer(request);
        if (!token) return Response.json({ error: await translateText("affiliate.api_please_sign_in_74d04a6") }, { status: 401 });
        try {
          return Response.json(await getAffiliateDashboard(token));
        } catch (error) {
          console.error("[affiliate/account] dashboard read failed", error);
          return Response.json(
            { error: error instanceof Error ? error.message : "Could not load affiliate records" },
            { status: 502 },
          );
        }
      },

      POST: async ({ request }) => {
        const translateText = translateApiMessage.bind(null, request);
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: await translateText("affiliate.api_expected_a_json_body_0c4a10f") }, { status: 400 });
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
          if (!user || !token) return Response.json({ error: await translateText("affiliate.api_please_sign_in_74d04a6") }, { status: 401 });

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

        if (action === "request-payout") {
          const token = bearer(request);
          const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
          const currency = typeof body.currency === "string" ? body.currency : "";
          if (!token || !Number.isFinite(amount) || amount <= 0 || !currency) {
            return Response.json({ error: await translateText("affiliate.api_a_positive_amount_and_currency_are_require_1dee912") }, { status: 400 });
          }
          try {
            const payout = await requestAffiliatePayout(token, amount, currency);
            return Response.json({ ok: true, payout }, { status: 201 });
          } catch (error) {
            console.error("[affiliate/account] payout request failed", error);
            return Response.json(
              { error: error instanceof Error ? error.message : "Could not request payout" },
              { status: 400 },
            );
          }
        }

        // ------------------------------------------------------ create link
        if (action === "create-link") {
          const countResponse = await rest(
            `marketplace_referral_codes?select=id&affiliate_partner_id=eq.${encodeURIComponent(gate.partner.id)}&limit=200`,
          );
          if (!countResponse.ok) {
            return Response.json({ error: await translateText("affiliate.api_could_not_check_your_referral_link_limit_a149140") }, { status: 502 });
          }
          const countRows: unknown = await countResponse.json();
          if (!Array.isArray(countRows)) {
            return Response.json({ error: await translateText("affiliate.api_referral_link_count_response_was_invalid_2f79313") }, { status: 502 });
          }
          const count = countRows.length;
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
          const rows: unknown = await created.json();
          const firstRow: unknown = Array.isArray(rows) ? rows[0] : null;
          if (
            typeof firstRow !== "object" ||
            firstRow === null ||
            !("id" in firstRow) ||
            !("code" in firstRow) ||
            typeof firstRow.id !== "string" ||
            typeof firstRow.code !== "string"
          ) {
            return Response.json({ error: "Referral-link creation returned an invalid record" }, { status: 502 });
          }
          return Response.json(
            { ok: true, link: { id: firstRow.id, code: firstRow.code, url: `/?ref=${firstRow.code}` } },
            { status: 201 },
          );
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
          if (!owned.ok) {
            return Response.json({ error: "Could not verify referral-link ownership" }, { status: 502 });
          }
          const ownedRows: unknown = await owned.json();
          if (!Array.isArray(ownedRows) || ownedRows.length === 0) {
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
