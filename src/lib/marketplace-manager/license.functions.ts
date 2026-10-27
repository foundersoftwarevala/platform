import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireJsonObject, type JsonObject } from "@/lib/json";
import { callMarketplaceManagerFunction, withMarketplaceManagerDatabase } from "./vps-rpc.server";

/**
 * License data is served from the canonical marketplace_licenses table on the
 * VPS, not the empty legacy `licenses` relation exposed by the generic API.
 */
export const getLicenseOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JsonObject> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const result = await callMarketplaceManagerFunction<JsonObject>(
      "mm_license_overview",
      { p_window: "30d" },
      context.userId,
    );
    return requireJsonObject(result, "License overview");
  });

export type MarketplaceLicenseRow = {
  id: string;
  order_item_id: string;
  buyer_id: string;
  product_id: string;
  product_name: string;
  license_key: string;
  license_model: string;
  status: "issued" | "active" | "revoked" | "expired";
  expires_at: string | null;
  created_at: string;
};

export const listMarketplaceLicenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      search: z.string().trim().max(120).optional().default(""),
      status: z.enum(["all", "issued", "active", "revoked", "expired"]).optional().default("all"),
      limit: z.number().int().min(1).max(100).optional().default(50),
      offset: z.number().int().min(0).optional().default(0),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: MarketplaceLicenseRow[]; total: number }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const search = data.search.replace(/[%,()]/g, " ").trim();
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [count] = await tx<{ total: number }[]>`
        select count(*)::int as total
        from public.marketplace_licenses as license
        where (${data.status} = 'all' or license.status = ${data.status})
          and (
            ${search} = ''
            or license.license_key ilike ${`%${search}%`}
            or exists (
              select 1 from public.marketplace_products as product
              where product.id = license.product_id
                and (product.name ilike ${`%${search}%`} or product.slug ilike ${`%${search}%`})
            )
          )
      `;
      const rows = await tx<MarketplaceLicenseRow[]>`
        select
          license.id,
          license.order_item_id,
          license.buyer_id,
          license.product_id,
          coalesce(product.name, '[product unavailable]') as product_name,
          license.license_key,
          license.license_model,
          license.status,
          license.expires_at,
          license.created_at
        from public.marketplace_licenses as license
        left join public.marketplace_products as product on product.id = license.product_id
        where (${data.status} = 'all' or license.status = ${data.status})
          and (
            ${search} = ''
            or license.license_key ilike ${`%${search}%`}
            or coalesce(product.name, '') ilike ${`%${search}%`}
            or coalesce(product.slug, '') ilike ${`%${search}%`}
          )
        order by license.created_at desc, license.id
        limit ${data.limit} offset ${data.offset}
      `;
      if (!count) throw new Error("The license count could not be verified.");
      return { rows, total: count.total };
    });
  });

export const revokeMarketplaceLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; changed: boolean }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [before] = await tx<{ state: JsonObject; status: string }[]>`
        select to_jsonb(license) as state, license.status
        from public.marketplace_licenses as license
        where license.id = ${data.id}::uuid
        for update
      `;
      if (!before) throw new Error("The license does not exist.");
      if (before.status === "revoked") return { ok: true, changed: false };
      if (before.status !== "issued" && before.status !== "active") {
        throw new Error(`A ${before.status} license cannot be revoked.`);
      }
      const [updated] = await tx<{ state: JsonObject }[]>`
        update public.marketplace_licenses
        set status = 'revoked'
        where id = ${data.id}::uuid
        returning to_jsonb(marketplace_licenses) as state
      `;
      if (!updated) throw new Error("The license revocation could not be verified.");
      await tx`
        select public.mm_audit(
          'license.revoke',
          'marketplace_license',
          ${data.id},
          ${JSON.stringify(before.state)}::jsonb,
          ${JSON.stringify(updated.state)}::jsonb,
          null
        )
      `;
      return { ok: true, changed: true };
    });
  });
