import { createFileRoute } from "@tanstack/react-router";

import { currentUser } from "@/lib/affiliate/core";
import { bearer } from "@/lib/applications/gateway.server";
import { submitApplication } from "@/lib/applications/submit.server";

/**
 * A public influencer application, written to the VPS.
 *
 * The application form now submits every role through
 * /api/applications/submit. This address keeps working for anything that still
 * posts the influencer-specific shape, and goes through exactly the same path -
 * the same checks and the same database function, called with the applicant's
 * own token - so there is no second, weaker way in.
 *
 *   POST /api/influencer/apply
 */

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export const Route = createFileRoute("/api/influencer/apply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = bearer(request);
        const user = token ? await currentUser(request) : null;
        if (!token || !user)
          return Response.json({ error: "Please sign in to apply" }, { status: 401 });

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }

        const social = object(body.socialProfiles);
        const tax = object(body.taxDetails);
        const result = await submitApplication(
          "influencer",
          {
            fullName: str(body.fullName),
            email: str(body.email),
            phone: str(body.phone),
            country: str(body.country),
            city: str(body.region),
            instagram: str(social.instagram),
            youtube: str(social.youtube),
            linkedin: str(social.linkedin),
            xTwitter: str(social.x),
            rateCard: str(social.rate_card),
            pastBrands: str(social.past_brands),
            followers: str(body.followers),
            engagementRate: str(body.engagementRate),
            niche: str(body.niche),
            idType: str(tax.id_type),
          },
          body.agreementAccepted === true &&
            body.consentAccepted === true &&
            body.termsAccepted === true,
          token,
          user.id,
        );
        if ("error" in result)
          return Response.json({ error: result.error }, { status: result.status });
        return Response.json({
          id: result.id,
          application_number: result.number,
          status: result.status,
          duplicate: result.duplicate,
        });
      },
    },
  },
});
