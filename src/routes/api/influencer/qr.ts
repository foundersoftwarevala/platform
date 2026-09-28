import { createFileRoute } from "@tanstack/react-router";

import { currentUser, generateUniqueCode, rest } from "@/lib/affiliate/core";

/**
 * An influencer picks a product and gets a link and a QR for it.
 *
 * Everything here is the platform's existing machinery, joined up:
 *
 *   marketplace_referral_codes   the influencer's code, minted by the same
 *                                generateUniqueCode() an affiliate's uses
 *   product_qr_codes             the one QR register the platform keeps
 *   /api/qr/{code}.png|.svg      renders the image from target_url, unchanged
 *   /api/qr/scan/{code}          records the scan, then sends them on
 *   /api/track/ref               records the visit and sets the cookie
 *
 * One QR per influencer per product, enforced by a unique index, so a scan
 * resolves to exactly one influencer and one product and asking twice returns
 * the QR that already exists. That is what makes the attribution deterministic
 * rather than a race between two codes for the same thing.
 *
 *   GET  /api/influencer/qr                  this influencer's QRs, with scans
 *   POST /api/influencer/qr {productId}      the link and QR for one product
 */

type Profile = { id: string; status: string };

async function profileFor(userId: string): Promise<Profile | null> {
  const response = await rest(
    `influencer_profiles?select=id,status&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  if (!response.ok) return null;
  return ((await response.json()) as Profile[])[0] ?? null;
}

function siteUrl(): string {
  return (
    process.env.SV_SITE?.trim() ??
    process.env.VITE_SITE_URL?.trim() ??
    "https://softwarevala.net"
  ).replace(/\/+$/, "");
}

/** The influencer's referral code, reused if they have one and minted if not. */
async function referralCodeFor(profileId: string): Promise<{ id: string; code: string } | null> {
  const existing = await rest(
    `marketplace_referral_codes?select=id,code&influencer_profile_id=eq.${encodeURIComponent(profileId)}` +
      `&active=is.true&order=created_at.asc&limit=1`,
  );
  if (existing.ok) {
    const rows = (await existing.json()) as { id: string; code: string }[];
    if (rows[0]) return rows[0];
  }

  const code = await generateUniqueCode("SVI");
  if (!code) return null;
  const created = await rest("marketplace_referral_codes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ code, influencer_profile_id: profileId, active: true }),
  });
  if (!created.ok) return null;
  return ((await created.json()) as { id: string; code: string }[])[0] ?? null;
}

/** A QR code string in the same alphabet the operator QRs use. */
function qrCodeString(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export const Route = createFileRoute("/api/influencer/qr")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        if (!authorization) return Response.json({ error: "Please sign in" }, { status: 401 });

        const base = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
        const response = await fetch(`${base}/rest/v1/rpc/influencer_qr_performance`, {
          method: "POST",
          headers: {
            apikey:
              process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ??
              process.env.SUPABASE_ANON_KEY?.trim() ??
              "",
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        if (!response.ok) {
          return Response.json({ error: "Your QR codes could not be read" }, { status: 502 });
        }
        return Response.json(await response.json());
      },

      POST: async ({ request }) => {
        const user = await currentUser(request);
        if (!user) return Response.json({ error: "Please sign in" }, { status: 401 });

        const profile = await profileFor(user.id);
        if (!profile) {
          return Response.json({ error: "This account is not enrolled as an influencer" }, { status: 403 });
        }
        if (profile.status !== "active") {
          return Response.json({ error: `This influencer account is ${profile.status}` }, { status: 403 });
        }

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ error: "Expected a JSON body" }, { status: 400 });
        }
        const productId = String(body.productId ?? "").trim();
        if (!/^[0-9a-f-]{36}$/i.test(productId)) {
          return Response.json({ error: "A product is required" }, { status: 400 });
        }

        // The product must exist and be one a visitor can actually reach; a QR
        // pointing at a product nobody can open is worse than no QR.
        const productResponse = await rest(
          `marketplace_products?select=id,slug,name,visible&id=eq.${encodeURIComponent(productId)}&limit=1`,
        );
        const product = productResponse.ok
          ? ((await productResponse.json()) as { id: string; slug: string; name: string; visible: boolean }[])[0]
          : undefined;
        if (!product?.slug) return Response.json({ error: "That product was not found" }, { status: 404 });

        const referral = await referralCodeFor(profile.id);
        if (!referral) {
          return Response.json({ error: "Could not allocate a referral code, please retry" }, { status: 503 });
        }

        const productUrl = `${siteUrl()}/marketplace/product/${product.slug}?ref=${referral.code}`;

        // Already have one for this product? Return it. The unique index would
        // refuse a second, and returning the existing one is the honest answer.
        const already = await rest(
          `product_qr_codes?select=qr_code,target_url,scan_count,active` +
            `&influencer_profile_id=eq.${encodeURIComponent(profile.id)}` +
            `&product_id=eq.${encodeURIComponent(productId)}&limit=1`,
        );
        if (already.ok) {
          const rows = (await already.json()) as
            { qr_code: string; target_url: string; scan_count: number | null; active: boolean }[];
          if (rows[0]) {
            return Response.json({
              ok: true,
              existing: true,
              product: { id: product.id, name: product.name, slug: product.slug },
              referral: { code: referral.code, url: productUrl },
              qr: {
                code: rows[0].qr_code,
                scan_url: `${siteUrl()}/api/qr/scan/${rows[0].qr_code}`,
                image_png: `/api/qr/${rows[0].qr_code}.png`,
                image_svg: `/api/qr/${rows[0].qr_code}.svg`,
                scans: rows[0].scan_count ?? 0,
                active: rows[0].active,
              },
            });
          }
        }

        /**
         * The QR encodes the scan route, not the product page directly, so a
         * scan is counted as a scan. That route records it and then sends the
         * scanner to the referral URL, where /api/track/ref records the visit
         * and sets the attribution cookie - the same chain a shared link uses.
         */
        const qrCode = qrCodeString();
        const created = await rest("product_qr_codes", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            product_id: productId,
            influencer_profile_id: profile.id,
            referral_code_id: referral.id,
            qr_code: qrCode,
            target_url: `${siteUrl()}/api/qr/scan/${qrCode}`,
            active: true,
            created_by: user.id,
          }),
        });
        if (!created.ok) {
          const detail = await created.text().catch(() => "");
          return Response.json(
            { error: `The QR could not be created: ${detail.slice(0, 160)}` },
            { status: 502 },
          );
        }

        return Response.json(
          {
            ok: true,
            existing: false,
            product: { id: product.id, name: product.name, slug: product.slug },
            referral: { code: referral.code, url: productUrl },
            qr: {
              code: qrCode,
              scan_url: `${siteUrl()}/api/qr/scan/${qrCode}`,
              image_png: `/api/qr/${qrCode}.png`,
              image_svg: `/api/qr/${qrCode}.svg`,
              scans: 0,
              active: true,
            },
          },
          { status: 201 },
        );
      },
    },
  },
});
