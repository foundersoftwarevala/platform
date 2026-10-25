/**
 * Author (seller) commission engine.
 *
 * The database already carried the whole chain — `marketplace_sellers`,
 * `marketplace_commission_rules`, `marketplace_commissions`,
 * `marketplace_commission_reversals`, `marketplace_payouts` — and not one line
 * of application code referenced any of it. A paid order issued a licence and
 * stopped; no author was ever credited for a sale.
 *
 * This is the missing link, and it runs only on the server, only from the
 * settlement path, only after PayU has been verified. Nothing here is callable
 * from a browser and nothing trusts a client-supplied amount, seller or rate.
 *
 * Guarantees:
 *   * Commission is derived from the ORDER ITEM stored in the database, never
 *     from the request.
 *   * One commission per order item, enforced by looking for an existing row
 *     first and by tolerating the unique violation if two webhooks race.
 *   * A duplicate webhook, a PayU retry and a manual replay all converge on the
 *     same single commission row.
 *   * A refund creates a reversal rather than editing or deleting the original,
 *     so the ledger stays auditable.
 */

// The platform share when a seller has no rule of their own. This is the
// lower of the agreed rates on purpose: undercharging ourselves is a
// bookkeeping fix, overcharging a partner is a breach of their agreement.
import { FALLBACK_PLATFORM_RATE } from "./commission-rates";

const DEFAULT_PLATFORM_RATE = FALLBACK_PLATFORM_RATE;

function supabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? "";
}

function serviceHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}

type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  seller_id: string | null;
  product_name: string | null;
  line_total: number | string | null;
  unit_amount: number | string | null;
  quantity: number | null;
  currency: string | null;
};

type CommissionRule = {
  id: string;
  seller_id: string | null;
  product_id: string | null;
  category_id: string | null;
  rate_percent: number | string | null;
  fixed_amount: number | string | null;
  priority: number | null;
  currency: string | null;
  active: boolean | null;
};

const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Round to whole cents so the platform and the author always sum to the gross. */
const money = (value: number): number => Math.round(value * 100) / 100;

/**
 * The seller a product belongs to. Read from the product row, never from the
 * caller — this is what makes commission attribution unforgeable.
 */
/**
 * The most specific active rule wins: a rule for this exact product beats one
 * for this seller, which beats one for the category, which beats the house
 * default. `priority` breaks ties within a level.
 */
function resolveRule(
  rules: CommissionRule[],
  sellerId: string,
  productId: string | null,
  categoryId: string | null,
): CommissionRule | null {
  if (!Array.isArray(rules) || rules.length === 0) return null;

  const score = (rule: CommissionRule): number => {
    if (productId && rule.product_id === productId) return 4;
    if (rule.seller_id === sellerId && !rule.product_id && !rule.category_id) return 3;
    if (categoryId && rule.category_id === categoryId) return 2;
    if (!rule.seller_id && !rule.product_id && !rule.category_id) return 1;
    return 0;
  };

  const applicable = rules
    .filter((rule) => {
      // A rule scoped to another seller never applies here.
      if (rule.seller_id && rule.seller_id !== sellerId) return false;
      if (rule.product_id && rule.product_id !== productId) return false;
      if (rule.category_id && rule.category_id !== categoryId) return false;
      return score(rule) > 0;
    })
    .sort((a, b) => score(b) - score(a) || num(b.priority) - num(a.priority));

  return applicable[0] ?? null;
}

async function readRows<T>(path: string, label: string): Promise<T[]> {
  const response = await rest(path, { headers: { Prefer: "count=exact" } });
  if (!response.ok) throw new Error(`${label} read failed (${response.status})`);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error(`${label} response was not an array`);
  const totalText = /\/(\d+|\*)$/.exec(response.headers.get("content-range") ?? "")?.[1];
  const total = totalText === undefined || totalText === "*" ? Number.NaN : Number(totalText);
  if (!Number.isSafeInteger(total) || total < rows.length || total !== rows.length) {
    throw new Error(`${label} read was incomplete`);
  }
  return rows as T[];
}

function inFilter(ids: string[]): string {
  return `in.(${ids.map((id) => encodeURIComponent(id)).join(",")})`;
}

export type CommissionOutcome = {
  ok: boolean;
  created: number;
  skipped: number;
  unattributed: number;
  error?: string;
};

/**
 * Credit every line of a settled order to the author who owns the product.
 * Safe to call repeatedly for the same order.
 */
export async function recordCommissionsForOrder(orderId: string): Promise<CommissionOutcome> {
  if (!supabaseUrl() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      unattributed: 0,
      error: "Supabase is not configured",
    };
  }

  // Commission is earned by a sale that happened: the order must be paid.
  // The caller used to be trusted on that, and this is also reachable from
  // the operator replay route.
  const orderResponse = await rest(
    `marketplace_orders?select=status,buyer_id&id=eq.${encodeURIComponent(orderId)}&limit=1`,
  );
  const order = orderResponse.ok
    ? ((await orderResponse.json()) as { status: string; buyer_id: string }[])[0]
    : undefined;
  if (!order) {
    return { ok: false, created: 0, skipped: 0, unattributed: 0, error: "Order not found" };
  }
  if (order.status !== "paid") {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      unattributed: 0,
      error: `Order is ${order.status}, not paid`,
    };
  }
  const buyer = order.buyer_id;

  const itemsResponse = await rest(
    `marketplace_order_items?select=id,order_id,product_id,seller_id,product_name,line_total,unit_amount,quantity,currency&order_id=eq.${encodeURIComponent(orderId)}`,
  );
  if (!itemsResponse.ok) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      unattributed: 0,
      error: `Could not read order items (${itemsResponse.status})`,
    };
  }
  const items = (await itemsResponse.json()) as OrderItem[];
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: true, created: 0, skipped: 0, unattributed: 0 };
  }

  let created = 0;
  let skipped = 0;
  let unattributed = 0;

  const itemIds = items.map((item) => item.id);
  const productIds = [
    ...new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id))),
  ];
  const [existingRows, products, rules] = await Promise.all([
    readRows<{ order_item_id: string }>(
      `marketplace_commissions?select=order_item_id&order_item_id=${inFilter(itemIds)}&limit=10000`,
      "Existing commission",
    ),
    productIds.length
      ? readRows<{ id: string; seller_id: string | null; category_id: string | null }>(
          `marketplace_products?select=id,seller_id,category_id&id=${inFilter(productIds)}&limit=10000`,
          "Product attribution",
        )
      : Promise.resolve(
          [] as { id: string; seller_id: string | null; category_id: string | null }[],
        ),
    readRows<CommissionRule>(
      "marketplace_commission_rules?select=*&active=is.true&limit=10000",
      "Commission rules",
    ),
  ]);
  const existingItemIds = new Set(existingRows.map((row) => row.order_item_id));
  const productById = new Map(products.map((product) => [product.id, product]));
  const sellerIds = [
    ...new Set(
      items
        .map((item) => item.seller_id ?? productById.get(item.product_id ?? "")?.seller_id ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const sellers = sellerIds.length
    ? await readRows<{ id: string; owner_user_id: string | null }>(
        `marketplace_sellers?select=id,owner_user_id&id=${inFilter(sellerIds)}&limit=10000`,
        "Seller owner",
      )
    : [];
  const ownerBySellerId = new Map(sellers.map((seller) => [seller.id, seller.owner_user_id]));

  for (const item of items) {
    // Already credited? Then this is a replay and there is nothing to do.
    if (existingItemIds.has(item.id)) {
      skipped += 1;
      continue;
    }

    // The seller on the line if checkout recorded one, otherwise the product's
    // owner as it stands now. Either way it comes from the database.
    const sellerId = item.seller_id ?? productById.get(item.product_id ?? "")?.seller_id ?? null;

    if (!sellerId) {
      // A platform-owned product. There is no author to credit, and inventing
      // one would be worse than recording nothing.
      unattributed += 1;
      continue;
    }

    // Someone buying their own product earns nothing from it.
    if (buyer && ownerBySellerId.get(sellerId) === buyer) {
      skipped += 1;
      continue;
    }

    // Backfill the line so the order history carries the attribution too.
    if (!item.seller_id) {
      await rest(`marketplace_order_items?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ seller_id: sellerId }),
      });
    }

    const gross = money(num(item.line_total, num(item.unit_amount) * num(item.quantity, 1)));
    if (gross <= 0) {
      skipped += 1;
      continue;
    }

    const categoryId = productById.get(item.product_id ?? "")?.category_id ?? null;
    const rule = resolveRule(rules, sellerId, item.product_id, categoryId);
    const lineCurrency = item.currency?.trim().toUpperCase() ?? "";
    const ruleCurrency = rule?.currency?.trim().toUpperCase() ?? "";
    if (rule && (!lineCurrency || !ruleCurrency || lineCurrency !== ruleCurrency)) {
      return {
        ok: false,
        created,
        skipped,
        unattributed,
        error: `Commission rule currency ${ruleCurrency || "(missing)"} does not match order currency ${lineCurrency || "(missing)"}`,
      };
    }

    let platformAmount: number;
    if (rule && num(rule.fixed_amount) > 0) {
      platformAmount = money(Math.min(num(rule.fixed_amount), gross));
    } else {
      const rate = rule ? num(rule.rate_percent, DEFAULT_PLATFORM_RATE) : DEFAULT_PLATFORM_RATE;
      platformAmount = money((gross * Math.min(Math.max(rate, 0), 100)) / 100);
    }
    // The two halves always add back up to the gross, whatever the rounding did.
    const sellerAmount = money(gross - platformAmount);

    const insert = await rest("marketplace_commissions", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        order_item_id: item.id,
        seller_id: sellerId,
        gross_amount: gross,
        commission_amount: platformAmount,
        seller_amount: sellerAmount,
        status: "pending",
        rule_snapshot: {
          rule_id: rule?.id ?? null,
          basis: rule ? (num(rule.fixed_amount) > 0 ? "fixed" : "percent") : "default",
          rate_percent:
            rule && num(rule.fixed_amount) <= 0
              ? num(rule.rate_percent, DEFAULT_PLATFORM_RATE)
              : null,
          fixed_amount: rule && num(rule.fixed_amount) > 0 ? num(rule.fixed_amount) : null,
          currency: lineCurrency || null,
          product_id: item.product_id,
          product_name: item.product_name,
          order_id: orderId,
          resolved_at: new Date().toISOString(),
        },
      }),
    });

    if (insert.ok) {
      created += 1;
    } else if (insert.status === 409) {
      // Another webhook won the race; its row is the one that counts.
      skipped += 1;
    } else {
      const detail = await insert.text();
      console.error("[commission] insert failed", insert.status, detail.slice(0, 300));
      return {
        ok: false,
        created,
        skipped,
        unattributed,
        error: `Commission insert failed (${insert.status})`,
      };
    }
  }

  return { ok: true, created, skipped, unattributed };
}

/**
 * Reverse the commissions on a refunded order.
 *
 * The original rows are never edited or removed — a reversal is recorded
 * against them and their status is moved to `reversed`, so the history of what
 * was credited and then taken back stays readable.
 */
export async function reverseCommissionsForOrder(
  orderId: string,
  refundId: string | null,
  reason: string,
): Promise<CommissionOutcome> {
  if (!supabaseUrl()) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      unattributed: 0,
      error: "Supabase is not configured",
    };
  }

  // A reversal has to cite the refund that caused it. Use the one supplied, or
  // the latest refund recorded against this order. If the order has no refund,
  // refuse — clawing money back from an author with nothing on record to point
  // at is exactly the kind of silent adjustment a ledger exists to prevent.
  let resolvedRefundId = refundId;
  if (!resolvedRefundId) {
    const refundResponse = await rest(
      `marketplace_order_refunds?select=id&order_id=eq.${encodeURIComponent(orderId)}` +
        `&order=created_at.desc&limit=1`,
    );
    if (refundResponse.ok) {
      const refunds = (await refundResponse.json()) as { id: string }[];
      resolvedRefundId = refunds[0]?.id ?? null;
    }
  }
  if (!resolvedRefundId) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      unattributed: 0,
      error: "No refund is recorded for this order, so its commission cannot be reversed",
    };
  }

  const itemsResponse = await rest(
    `marketplace_order_items?select=id&order_id=eq.${encodeURIComponent(orderId)}`,
  );
  if (!itemsResponse.ok) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      unattributed: 0,
      error: "Could not read order items",
    };
  }
  const itemIds = ((await itemsResponse.json()) as { id: string }[]).map((row) => row.id);
  if (itemIds.length === 0) return { ok: true, created: 0, skipped: 0, unattributed: 0 };

  const list = itemIds.map((id) => `"${id}"`).join(",");
  const commissionsResponse = await rest(
    `marketplace_commissions?select=id,seller_amount,status&order_item_id=in.(${list})`,
  );
  if (!commissionsResponse.ok) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      unattributed: 0,
      error: "Could not read commissions",
    };
  }
  const commissions = (await commissionsResponse.json()) as {
    id: string;
    seller_amount: number | string;
    status: string;
  }[];

  let created = 0;
  let skipped = 0;
  for (const commission of commissions) {
    if (commission.status === "reversed") {
      skipped += 1;
      continue;
    }
    const existing = await rest(
      `marketplace_commission_reversals?select=id&commission_id=eq.${encodeURIComponent(commission.id)}&limit=1`,
    );
    if (existing.ok && ((await existing.json()) as unknown[]).length > 0) {
      skipped += 1;
      continue;
    }
    const insert = await rest("marketplace_commission_reversals", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        commission_id: commission.id,
        refund_id: resolvedRefundId,
        amount: money(num(commission.seller_amount)),
        reason,
      }),
    });
    if (insert.ok || insert.status === 409) {
      await rest(`marketplace_commissions?id=eq.${encodeURIComponent(commission.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "reversed" }),
      });
      created += 1;
    } else {
      skipped += 1;
    }
  }

  return { ok: true, created, skipped, unattributed: 0 };
}
