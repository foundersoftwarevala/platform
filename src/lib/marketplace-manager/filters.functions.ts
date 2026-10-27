import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callMarketplaceManagerFunction } from "@/lib/marketplace-manager/vps-rpc.server";

/**
 * Storefront filters. Both configuration and derived values are read from the
 * canonical VPS catalogue database, never through hosted PostgREST.
 */
const FilterValueSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number(),
});

const FilterGroupSchema = z.object({
  key: z.string(),
  label: z.string(),
  source: z.string(),
  enabled: z.boolean(),
  position: z.number(),
  select_mode: z.enum(["single", "multi"]),
  combine: z.enum(["and", "or"]),
  visible_desktop: z.boolean(),
  visible_mobile: z.boolean(),
  values: z.array(FilterValueSchema),
});

const FilterResponseSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  groups: z.array(FilterGroupSchema).optional(),
});

export type FilterValue = z.infer<typeof FilterValueSchema>;
export type FilterGroup = z.infer<typeof FilterGroupSchema>;

export const listStorefrontFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true; groups: FilterGroup[] }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const response = FilterResponseSchema.parse(
      await callMarketplaceManagerFunction("mm_filters", {}, context.userId),
    );
    if (!response.ok) {
      throw new Error(
        response.reason === "not_permitted"
          ? "Reading storefront filters needs marketplace operator rights."
          : "The VPS refused to return storefront filters.",
      );
    }
    if (!response.groups) throw new Error("The VPS returned an incomplete storefront filter response.");
    return { ok: true, groups: response.groups };
  });

export const configureStorefrontFilter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().min(1).max(60),
      patch: z.record(z.string(), z.unknown()),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const result = await callMarketplaceManagerFunction(
      "mm_filter_set",
      { p_key: data.key, p_patch: data.patch },
      context.userId,
    );
    const response = z.object({ ok: z.boolean(), reason: z.string().optional() }).parse(result);
    if (!response.ok) {
      throw new Error(
        response.reason === "not_permitted"
          ? "Changing storefront filters needs marketplace operator rights."
          : "The filter change was refused.",
      );
    }
    return { ok: true as const };
  });
