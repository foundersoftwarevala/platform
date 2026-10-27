import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireJson, type Json } from "@/lib/json";
import { withMarketplaceManagerDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

/**
 * The card registry and its audited functions live in the VPS catalogue
 * database. These calls run directly on that connection, not hosted PostgREST.
 */
export type CardField = {
  kind: "visual" | "metadata" | "action" | "badge" | "platform";
  key: string;
  label: string;
  enabled: boolean;
  position: number;
  priority: number;
  hint: string | null;
  requires: string | null;
  data_column: string | null;
  /** How many published products carry the data. Null means no store exists. */
  have: number | null;
  total: number;
  pct: number | null;
};

const CARD_KINDS = ["visual", "metadata", "action", "badge", "platform"] as const;

const CardCoverageSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  total_products: z.number().optional(),
  fields: z.array(z.object({
    kind: z.enum(CARD_KINDS),
    key: z.string(),
    label: z.string(),
    enabled: z.boolean(),
    position: z.number(),
    priority: z.number(),
    hint: z.string().nullable(),
    requires: z.string().nullable(),
    data_column: z.string().nullable(),
    have: z.number().nullable(),
    total: z.number(),
    pct: z.number().nullable(),
  })).optional(),
});

export const getCardFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [row] = await tx<{ result: unknown }[]>`
        select public.mm_card_coverage() as result
      `;
      if (!row) throw new Error("Card coverage could not be loaded from the VPS.");
      const result = CardCoverageSchema.parse(requireJson(row.result, "Card coverage response"));
      if (!result.ok || !result.fields || result.total_products === undefined) {
        throw new Error("The card coverage query was refused or returned an incomplete result.");
      }
      return {
        ok: true as const,
        total_products: result.total_products,
        fields: result.fields,
      };
    });
  });

export const setCardField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ key: z.string().min(1).max(80), enabled: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [before] = await tx<{ state: Json }[]>`
        select to_jsonb(field) as state
        from public.marketplace_card_fields as field
        where field.key = ${data.key}
        for update
      `;
      if (!before) throw new Error("The card field does not exist.");
      const [updated] = await tx<{ state: Json }[]>`
        update public.marketplace_card_fields
        set enabled = ${data.enabled}, updated_by = auth.uid(), updated_at = now()
        where key = ${data.key}
        returning to_jsonb(marketplace_card_fields) as state
      `;
      if (!updated) throw new Error("The card field change could not be verified.");
      await tx`
        select public.mm_audit(
          ${data.enabled ? "card.field.enable" : "card.field.disable"},
          'product_card',
          ${data.key},
          ${JSON.stringify(before.state)}::jsonb,
          ${JSON.stringify(updated.state)}::jsonb,
          null
        )
      `;
      return { ok: true as const };
    });
  });

export const reorderCardFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      kind: z.enum(CARD_KINDS),
      keys: z.array(z.string().min(1).max(80)).min(1).max(60).refine(
        (keys) => new Set(keys).size === keys.length,
        "Card field keys must be unique.",
      ),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const found = await tx<{ key: string; kind: CardField["kind"] }[]>`
        select key, kind
        from public.marketplace_card_fields
        where key = any(${data.keys}::text[])
        for update
      `;
      if (found.length !== data.keys.length || found.some((field) => field.kind !== data.kind)) {
        throw new Error("The card order contains an unknown field or a field from another group.");
      }

      const [before] = await tx<{ state: Json }[]>`
        select coalesce(
          jsonb_agg(jsonb_build_object('key', key, 'position', position) order by position),
          '[]'::jsonb
        ) as state
        from public.marketplace_card_fields
        where key = any(${data.keys}::text[])
      `;
      await tx`
        update public.marketplace_card_fields as field
        set position = ordered.ordinality::int,
            priority = case
              when field.kind = 'badge' then ordered.ordinality::int * 10
              else field.priority
            end,
            updated_by = auth.uid(),
            updated_at = now()
        from unnest(${data.keys}::text[]) with ordinality as ordered(key, ordinality)
        where field.key = ordered.key and field.kind = ${data.kind}
      `;
      const [after] = await tx<{ state: Json }[]>`
        select coalesce(
          jsonb_agg(jsonb_build_object('key', key, 'position', position) order by position),
          '[]'::jsonb
        ) as state
        from public.marketplace_card_fields
        where key = any(${data.keys}::text[])
      `;
      if (!before || !after) throw new Error("The card order could not be verified.");
      await tx`
        select public.mm_audit(
          'card.reorder',
          'product_card',
          ${data.kind},
          ${JSON.stringify(before.state)}::jsonb,
          ${JSON.stringify(after.state)}::jsonb,
          null
        )
      `;
      return { ok: true as const };
    });
  });
