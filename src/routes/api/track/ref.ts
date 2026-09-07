import { createFileRoute } from "@tanstack/react-router";

import {
  REFERRAL_COOKIE,
  newSessionKey,
  readCookie,
  referralCookie,
  resolveCode,
  rest,
} from "@/lib/affiliate/core";

/**
 * Records a visit that arrived on a referral link.
 *
 * This is the step that never existed. A referral link previously did nothing
 * at all: no parameter was read, no visit was stored, and no affiliate could
 * ever be credited for sending someone.
 *
 * The browser calls this once per page when a `ref` parameter is present. The
 * server resolves the code, records or refreshes the session, and sets a
 * first-party HttpOnly cookie so the attribution survives navigation, a
 * refresh, signing in, and coming back days later.
 *
 * What is deliberately NOT stored: no IP address, no user agent string, no
 * personal detail. A session key, the landing path, the product if there is
 * one, and coarse campaign fields are enough to attribute a sale and to spot
 * abuse, and nothing more is anyone's business.
 *
 * POST /api/track/ref  { code, landing, productId?, utm... }
 */

const MAX = (value: unknown, length: number): string | null => {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, length) : null;
};

export const Route = createFileRoute("/api/track/ref")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const code = MAX(body.code, 64);
        if (!code) return Response.json({ tracked: false, reason: "no code" });

        const referral = await resolveCode(code);
        // An unknown or deactivated code is not an error worth telling a
        // visitor about — the page carries on and simply attributes nothing.
        if (!referral) return Response.json({ tracked: false, reason: "unknown code" });

        // Reuse the visitor's existing session key so a second visit on the
        // same link refreshes one session rather than inflating the count.
        const existingKey = readCookie(request, REFERRAL_COOKIE);
        const sessionKey = existingKey ?? newSessionKey();
        const now = new Date().toISOString();

        const landing = MAX(body.landing, 300);
        const productId = MAX(body.productId, 64);
        const campaign = {
          utm_source: MAX(body.utm_source, 80),
          utm_medium: MAX(body.utm_medium, 80),
          utm_campaign: MAX(body.utm_campaign, 120),
          country: MAX(body.country, 8),
          language: MAX(body.language, 12),
          device: MAX(body.device, 16),
        };

        // Is this session already on this code?
        const existing = await rest(
          `marketplace_referral_sessions?select=id,metadata,referral_code_id` +
            `&session_key=eq.${encodeURIComponent(sessionKey)}` +
            `&referral_code_id=eq.${encodeURIComponent(referral.id)}&limit=1`,
        );
        const rows = existing.ok
          ? ((await existing.json()) as { id: string; metadata: Record<string, unknown> | null }[])
          : [];

        if (rows.length) {
          // A returning visitor on the same link. Count the click, move the
          // window forward, and leave the original first_seen_at alone.
          const meta = (rows[0].metadata ?? {}) as Record<string, unknown>;
          const clicks = Number(meta.clicks ?? 1) + 1;
          await rest(`marketplace_referral_sessions?id=eq.${encodeURIComponent(rows[0].id)}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({
              last_seen_at: now,
              metadata: { ...meta, ...campaign, clicks, last_landing: landing },
            }),
          });
          return new Response(
            JSON.stringify({ tracked: true, returning: true, clicks }),
            { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": referralCookie(sessionKey) } },
          );
        }

        const insert = await rest("marketplace_referral_sessions", {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            session_key: sessionKey,
            referral_code_id: referral.id,
            affiliate_partner_id: referral.affiliate_partner_id,
            influencer_profile_id: referral.influencer_profile_id,
            reseller_id: referral.reseller_id,
            landing_url: landing,
            product_id: productId,
            first_seen_at: now,
            last_seen_at: now,
            metadata: { ...campaign, clicks: 1 },
          }),
        });

        if (!insert.ok && insert.status !== 409) {
          console.error("[track/ref] could not record the visit", insert.status);
          return Response.json({ tracked: false, reason: "not recorded" }, { status: 502 });
        }

        return new Response(
          JSON.stringify({ tracked: true, returning: false }),
          { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": referralCookie(sessionKey) } },
        );
      },
    },
  },
});
