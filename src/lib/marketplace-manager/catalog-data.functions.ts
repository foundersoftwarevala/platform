import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireJson, type Json } from "@/lib/json";
import { catalogueChanged } from "@/lib/marketplace/catalogue-invalidation";
import { withMarketplaceManagerDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

const listInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  missingOnly: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type ProductContentRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  benefits: string | null;
  features: Json;
  tags: string[] | null;
  tech_stack: string[] | null;
  updated_at: string;
};

export const listProductContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ rows: ProductContentRow[]; total: number }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const search = data.search.replace(/[%,()]/g, " ").trim();
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [count] = await tx<{ total: number }[]>`
        select count(*)::int as total
        from public.marketplace_products
        where deleted_at is null
          and (${search} = '' or name ilike ${`%${search}%`} or slug ilike ${`%${search}%`})
          and (
            ${data.missingOnly} = false
            or nullif(btrim(description), '') is null
          )
      `;
      const rows = await tx<ProductContentRow[]>`
        select id, name, slug, description, benefits, features, tags, tech_stack, updated_at
        from public.marketplace_products
        where deleted_at is null
          and (${search} = '' or name ilike ${`%${search}%`} or slug ilike ${`%${search}%`})
          and (
            ${data.missingOnly} = false
            or nullif(btrim(description), '') is null
          )
        order by
          (nullif(btrim(description), '') is null) desc,
          updated_at desc,
          id
        limit ${data.limit} offset ${data.offset}
      `;
      if (!count) throw new Error("The product content count could not be verified.");
      return { rows, total: count.total };
    });
  });

const updateContentInput = z.object({
  id: z.string().uuid(),
  description: z.string().max(20_000),
  benefits: z.string().max(8_000),
  featuresJson: z.string().max(20_000),
  tags: z.array(z.string().trim().min(1).max(80)).max(80),
  techStack: z.array(z.string().trim().min(1).max(80)).max(80),
});

export const saveProductContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateContentInput.parse(input))
  .handler(async ({ data, context }): Promise<ProductContentRow> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    let features: Json;
    try {
      features = requireJson(JSON.parse(data.featuresJson), "Product features");
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Features must be valid JSON: ${error.message}`
          : "Features must be valid JSON.",
      );
    }

    const row = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [updated] = await tx<ProductContentRow[]>`
        update public.marketplace_products
        set description = ${data.description.trim() || null},
            benefits = ${data.benefits.trim() || null},
            features = ${JSON.stringify(features)}::jsonb,
            tags = ${data.tags},
            tech_stack = ${data.techStack},
            updated_at = now()
        where id = ${data.id}::uuid and deleted_at is null
        returning id, name, slug, description, benefits, features, tags, tech_stack, updated_at
      `;
      if (!updated) throw new Error("The product does not exist or is archived.");
      return updated;
    });
    await catalogueChanged();
    return row;
  });

export type ProductMediaRow = {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  logo: string | null;
  cover_image: string | null;
  favicon: string | null;
};

export const listProductMedia = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional().default(""),
        limit: z.number().int().min(1).max(100).optional().default(50),
        offset: z.number().int().min(0).optional().default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: ProductMediaRow[]; total: number }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const search = data.search.replace(/[%,()]/g, " ").trim();
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [count] = await tx<{ total: number }[]>`
        select count(*)::int as total
        from public.marketplace_products
        where deleted_at is null
          and (${search} = '' or name ilike ${`%${search}%`} or slug ilike ${`%${search}%`})
      `;
      const rows = await tx<ProductMediaRow[]>`
        select id, name, slug, thumbnail_url, logo, cover_image, favicon
        from public.marketplace_products
        where deleted_at is null
          and (${search} = '' or name ilike ${`%${search}%`} or slug ilike ${`%${search}%`})
        order by name, id
        limit ${data.limit} offset ${data.offset}
      `;
      if (!count) throw new Error("The product media count could not be verified.");
      return { rows, total: count.total };
    });
  });

const mediaValue = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter an HTTP(S) URL or a site-relative path.");

export const saveProductMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        thumbnail_url: mediaValue.nullable(),
        logo: mediaValue.nullable(),
        cover_image: mediaValue.nullable(),
        favicon: mediaValue.nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const values = {
      thumbnail_url: data.thumbnail_url?.trim() || null,
      logo: data.logo?.trim() || null,
      cover_image: data.cover_image?.trim() || null,
      favicon: data.favicon?.trim() || null,
    };
    await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const updated = await tx<{ id: string }[]>`
        update public.marketplace_products
        set thumbnail_url = ${values.thumbnail_url},
            logo = ${values.logo},
            cover_image = ${values.cover_image},
            favicon = ${values.favicon},
            updated_at = now()
        where id = ${data.id}::uuid and deleted_at is null
        returning id
      `;
      if (!updated[0]) throw new Error("The product does not exist or is archived.");
    });
    await catalogueChanged();
    return { ok: true };
  });
