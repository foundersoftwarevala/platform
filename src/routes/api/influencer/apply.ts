import { createFileRoute } from "@tanstack/react-router";

/**
 * A public influencer application, written to the VPS.
 *
 * /apply/influencer called submit_influencer_application through the browser
 * Supabase client, and that client is built with VITE_SUPABASE_URL pointing at
 * the hosted project - so an application landed in hosted Supabase while
 * Influencer Manager's tiers, referral codes and commissions all live on the
 * VPS. A person approved through that path had no profile on the side that
 * issues referral links, so they could never be paid.
 *
 * This is the same database function with the same arguments, called
 * server-side against the VPS, carrying the applicant's own token so the
 * function sees the right auth.uid() and records them as the applicant. The
 * form's fields, validation, duplicate protection and the agreement it presents
 * are all unchanged; only where the row lands has changed.
 *
 *   POST /api/influencer/apply
 */

type Applied = {
  id: string;
  application_number: string;
  status: string;
  duplicate?: boolean;
  created_at?: string;
};

const text = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
const number = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export const Route = createFileRoute("/api/influencer/apply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
        // The form already sends the applicant to sign in first; this is the
        // server saying the same thing rather than trusting that it happened.
        if (!token) return Response.json({ error: "Please sign in to apply" }, { status: 401 });

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const fullName = text(body.fullName, 200);
        const email = text(body.email, 320);
        if (!fullName) return Response.json({ error: "Please enter your name." }, { status: 400 });
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.json({ error: "Please enter a valid email address." }, { status: 400 });
        }

        const base = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
        const publishable =
          process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
          process.env.SUPABASE_ANON_KEY?.trim() ??
          "";
        if (!base) {
          return Response.json({ error: "The application service is not configured." }, { status: 503 });
        }

        const response = await fetch(`${base}/rest/v1/rpc/submit_influencer_application`, {
          method: "POST",
          headers: {
            apikey: publishable,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_full_name: fullName,
            p_email: email,
            p_phone: text(body.phone, 80),
            p_country: text(body.country, 120),
            p_region: text(body.region, 200),
            p_social_profiles: object(body.socialProfiles),
            p_followers: number(body.followers) ?? 0,
            p_niche: text(body.niche, 200) ?? "",
            p_content_types: Array.isArray(body.contentTypes) ? body.contentTypes : null,
            p_engagement_rate: number(body.engagementRate),
            p_payment_details: object(body.paymentDetails),
            p_tax_details: object(body.taxDetails),
            // The form will not submit without the agreement ticked; these
            // record that it was, they do not assume it.
            p_agreement_accepted: body.agreementAccepted === true,
            p_consent_accepted: body.consentAccepted === true,
            p_terms_accepted: body.termsAccepted === true,
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          // The function's own refusals - already applied, agreement not
          // accepted - are the applicant's answer, not a server fault.
          const status = response.status === 400 || response.status === 409 ? 400 : 502;
          return Response.json(
            { error: `The application could not be submitted: ${detail.slice(0, 200)}` },
            { status },
          );
        }

        return Response.json((await response.json()) as Applied);
      },
    },
  },
});
