import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuidSchema = z.string().uuid();

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
      .select("id, product_id, variant_id, quantity, marketplace_products(name, slug, icon, price_label)")
      .eq("cart_id", cart.id)
      .order("created_at");
    if (itemError) throw new Error(itemError.message);
    return { cart, items: items ?? [] };
  });

export const addMarketplaceCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({
    productId: uuidSchema,
    quantity: z.number().int().positive().max(1000).default(1),
    variantId: uuidSchema.nullable().optional(),
  }).parse(value))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await (context.supabase as any).rpc("marketplace_add_to_cart", {
      p_product_id: data.productId,
      p_quantity: data.quantity,
      p_variant_id: data.variantId ?? null,
    });
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
