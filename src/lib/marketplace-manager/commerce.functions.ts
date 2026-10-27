import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { catalogueChanged } from "@/lib/marketplace/catalogue-invalidation";
import { withMarketplaceManagerDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

export type ProductPricingRow = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  variant_id: string | null;
  variant_name: string | null;
  amount: number | string;
  currency: string;
  billing_period: "lifetime" | "month" | "year" | "one_time";
  active: boolean;
  created_at: string;
  updated_at: string;
};

const pricingListInput = z.object({
  search: z.string().trim().max(120).optional().default(""),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const listProductPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pricingListInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<{ rows: ProductPricingRow[]; total: number }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const search = data.search.replace(/[%,()]/g, " ").trim();
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [count] = await tx<{ total: number }[]>`
        select count(*)::int as total
        from public.marketplace_product_pricing as pricing
        join public.marketplace_products as product on product.id = pricing.product_id
        where product.deleted_at is null
          and (${search} = '' or product.name ilike ${`%${search}%`} or product.slug ilike ${`%${search}%`})
      `;
      const rows = await tx<ProductPricingRow[]>`
        select
          pricing.id,
          pricing.product_id,
          product.name as product_name,
          product.slug as product_slug,
          pricing.variant_id,
          variant.name as variant_name,
          pricing.amount,
          pricing.currency,
          pricing.billing_period,
          pricing.active,
          pricing.created_at,
          pricing.updated_at
        from public.marketplace_product_pricing as pricing
        join public.marketplace_products as product on product.id = pricing.product_id
        left join public.marketplace_product_variants as variant on variant.id = pricing.variant_id
        where product.deleted_at is null
          and (${search} = '' or product.name ilike ${`%${search}%`} or product.slug ilike ${`%${search}%`})
        order by pricing.active desc, product.name, pricing.billing_period, pricing.currency, pricing.id
        limit ${data.limit} offset ${data.offset}
      `;
      if (!count) throw new Error("The pricing count could not be verified.");
      return { rows, total: count.total };
    });
  });

export type PricingSummary = {
  priced_products: number;
  active_prices: number;
  coupon_currencies: number;
  active_coupons: number;
};

export const getPricingSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PricingSummary> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [summary] = await tx<PricingSummary[]>`
        select
          (select count(distinct pricing.product_id)::int
             from public.marketplace_product_pricing as pricing
             join public.marketplace_products as product on product.id = pricing.product_id
            where pricing.active and product.deleted_at is null) as priced_products,
          (select count(*)::int from public.marketplace_product_pricing where active) as active_prices,
          (select count(distinct currency)::int from public.marketplace_coupons) as coupon_currencies,
          (select count(*)::int from public.marketplace_coupons where active) as active_coupons
      `;
      if (!summary) throw new Error("Pricing summary could not be loaded.");
      return summary;
    });
  });

export type PricingProductOption = { id: string; name: string; slug: string };

export const listPricingProductOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().trim().max(120).optional().default("") }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<PricingProductOption[]> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const search = data.search.replace(/[%,()]/g, " ").trim();
    return withMarketplaceManagerDatabase(
      context.userId,
      (tx) =>
        tx<PricingProductOption[]>`
        select id, name, slug
        from public.marketplace_products
        where deleted_at is null
          and (${search} = '' or name ilike ${`%${search}%`} or slug ilike ${`%${search}%`})
        order by name, id
        limit 100
      `,
    );
  });

const savePricingInput = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  amount: z.number().finite().min(0).max(1_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  billing_period: z.enum(["lifetime", "month", "year", "one_time"]),
  active: z.boolean(),
});

export const saveProductPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => savePricingInput.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const saved = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const lockKey = `${data.product_id}:base:${data.billing_period}:${data.currency}`;
      await tx`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const [duplicate] = await tx<{ id: string }[]>`
        select id
        from public.marketplace_product_pricing
        where product_id = ${data.product_id}::uuid
          and variant_id is null
          and billing_period = ${data.billing_period}
          and currency = ${data.currency}
          and (${data.id ?? null}::uuid is null or id <> ${data.id ?? null}::uuid)
        limit 1
        for update
      `;
      if (duplicate) {
        throw new Error(
          "A base price already exists for this product, billing period, and currency.",
        );
      }

      if (data.id) {
        const [updated] = await tx<{ id: string }[]>`
          update public.marketplace_product_pricing
          set amount = ${data.amount},
              currency = ${data.currency},
              billing_period = ${data.billing_period},
              active = ${data.active},
              updated_at = now()
          where id = ${data.id}::uuid
            and product_id = ${data.product_id}::uuid
            and variant_id is null
          returning id
        `;
        if (!updated) throw new Error("The base price does not exist or cannot be edited.");
        return updated;
      }

      const [product] = await tx<{ id: string }[]>`
        select id from public.marketplace_products
        where id = ${data.product_id}::uuid and deleted_at is null
        for key share
      `;
      if (!product) throw new Error("The selected product does not exist or is archived.");
      const [inserted] = await tx<{ id: string }[]>`
        insert into public.marketplace_product_pricing
          (product_id, variant_id, amount, currency, billing_period, active)
        values
          (${data.product_id}::uuid, null, ${data.amount}, ${data.currency}, ${data.billing_period}, ${data.active})
        returning id
      `;
      if (!inserted) throw new Error("The product price could not be verified.");
      return inserted;
    });
    await catalogueChanged();
    return saved;
  });

export const deactivateProductPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    const result = await withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [updated] = await tx<{ id: string }[]>`
        update public.marketplace_product_pricing
        set active = false, updated_at = now()
        where id = ${data.id}::uuid
        returning id
      `;
      if (!updated) throw new Error("The price does not exist.");
      return { ok: true as const };
    });
    await catalogueChanged();
    return result;
  });

export type MarketplaceCouponRow = {
  id: string;
  code: string;
  kind: string;
  value: number | string;
  currency: string | null;
  max_redemptions: number | null;
  expires_at: string | null;
  active: boolean;
};

export const listMarketplaceCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ limit: z.number().int().min(1).max(200).optional().default(100) })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: MarketplaceCouponRow[]; total: number }> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(context.userId, async (tx) => {
      const [count] = await tx<{ total: number }[]>`
        select count(*)::int as total from public.marketplace_coupons
      `;
      const rows = await tx<MarketplaceCouponRow[]>`
        select id, code, kind, value, currency, max_redemptions, expires_at, active
        from public.marketplace_coupons
        order by created_at desc, id
        limit ${data.limit}
      `;
      if (!count) throw new Error("The coupon count could not be verified.");
      return { rows, total: count.total };
    });
  });

export type PaymentGatewayRow = {
  id: string;
  code: string;
  name: string;
  provider: string | null;
  status: string;
  success_rate: number | string | null;
  fee_percent: number | string | null;
  settlement_cycle: string | null;
  monthly_txn_count: number | null;
};

export const listPaymentGateways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PaymentGatewayRow[]> => {
    if (!context?.userId) throw new Error("Unauthorized: a signed-in user is required.");
    return withMarketplaceManagerDatabase(
      context.userId,
      (tx) =>
        tx<PaymentGatewayRow[]>`
        select id, code, name, provider, status, success_rate, fee_percent,
               settlement_cycle, monthly_txn_count
        from public.finance_gateways
        order by name, id
      `,
    );
  });
