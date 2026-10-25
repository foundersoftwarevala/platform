import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuidSchema = z.string().uuid();

type CartItemRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  selected_pricing_id: string | null;
  quantity: number;
  marketplace_products: {
    name: string;
    slug: string;
    icon: string | null;
    price_label: string | null;
  } | null;
};

type PricingOptionRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  amount: number;
  currency: string;
  billing_period: string;
};

export const getMarketplaceCart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const { data: cart, error: cartError } = await db
      .from("marketplace_carts")
      .select("id, status, currency, updated_at")
      .eq("buyer_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (cartError) throw new Error(cartError.message);
    if (!cart) return { cart: null, items: [] };

    const { data: items, error: itemError } = await db
      .from("marketplace_cart_items")
      .select(
        "id, product_id, variant_id, quantity, selected_pricing_id, marketplace_products(name, slug, icon, price_label)",
      )
      .eq("cart_id", cart.id)
      .order("created_at");
    if (itemError) throw new Error(itemError.message);
    const cartItems = (items ?? []) as CartItemRow[];
    const productIds = [...new Set(cartItems.map((item) => item.product_id))];
    const { data: pricingOptions, error: pricingError } = productIds.length
      ? await db
          .from("marketplace_product_pricing")
          .select("id, product_id, variant_id, amount, currency, billing_period")
          .in("product_id", productIds)
          .eq("active", true)
      : { data: [], error: null };
    if (pricingError) throw new Error(pricingError.message);
    const options = (pricingOptions ?? []) as PricingOptionRow[];
    const itemsWithPricing = cartItems.map((item) => ({
      ...item,
      pricing_options: options.filter(
        (option) => option.product_id === item.product_id && option.variant_id === item.variant_id,
      ),
    }));
    // What the cart costs this buyer, priced by the database with the same rule
    // checkout applies (reseller membership discount or list price).
    const { data: quote, error: quoteError } = await db.rpc("marketplace_cart_quote");
    if (quoteError) throw new Error(quoteError.message);
    return { cart, items: itemsWithPricing, quote: quote as CartQuote };
  });

export type CartQuote = {
  currency: string | null;
  subtotal: number;
  discount_percent: number;
  discount_total: number;
  total: number;
  ready: boolean;
  mixed?: boolean;
  pricing_required_count?: number;
  unavailable_count?: number;
  pricing: { eligible?: boolean; plan_code?: string; plan_name?: string; reason?: string };
  lines: {
    cart_item_id: string;
    pricing_id: string;
    billing_period: string;
    unit_amount: number;
    line_total: number;
    currency: string;
  }[];
};

export const addMarketplaceCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z
      .object({
        productId: uuidSchema,
        quantity: z.number().int().positive().max(1000).default(1),
        variantId: uuidSchema.nullable().optional(),
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc("marketplace_add_to_cart", {
      p_product_id: data.productId,
      p_quantity: data.quantity,
      p_variant_id: data.variantId ?? null,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const setMarketplaceCartItemPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z
      .object({
        cartItemId: uuidSchema,
        pricingId: uuidSchema,
      })
      .parse(value),
  )
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc(
      "marketplace_set_cart_item_pricing",
      {
        p_cart_item_id: data.cartItemId,
        p_pricing_id: data.pricingId,
      },
    );
    if (error) throw new Error(error.message);
    return result;
  });

export const createMarketplaceCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ idempotencyKey: z.string().min(16).max(128) }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc("marketplace_create_checkout", {
      p_idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const listMarketplaceOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("marketplace_orders")
      .select("id, order_number, status, currency, subtotal, discount_total, tax_total, total, created_at, marketplace_payment_intents(status, provider)")
      .eq("buyer_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
