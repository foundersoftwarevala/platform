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

const DEFAULT_PLATFORM_RATE = 30; // percent to the platform when no rule matches

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
async function sellerForProduct(productId: string | null): Promise<string | null> {
  if (!productId) return null;
  const response = await rest(
    `marketplace_products?select=seller_id&id=eq.${encodeURIComponent(productId)}&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as { seller_id: string | null }[];
  return rows[0]?.seller_id ?? null;
}

async function categoryForProduct(productId: string | null): Promise<string | null> {
  if (!productId) return null;
  const response = await rest(
    `marketplace_products?select=category_id&id=eq.${encodeURIComponent(productId)}&limit=1`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as { category_id: string | null }[];
  return rows[0]?.category_id ?? null;
}

/**
 * The most specific active rule wins: a rule for this exact product beats one
 * for this seller, which beats one for the category, which beats the house
 * default. `priority` breaks ties within a level.
 */
async function resolveRule(
  sellerId: string,
  productId: string | null,
  categoryId: string | null,
): Promise<CommissionRule | null> {
  const response = await rest("marketplace_commission_rules?select=*&active=is.true");
  if (!response.ok) return null;
  const rules = (await response.json()) as CommissionRule[];
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
    return { ok: false, created: 0, skipped: 0, unattributed: 0, error: "Supabase is not configured" };
  }

  const itemsResponse = await rest(
    `marketplace_order_items?select=id,order_id,product_id,seller_id,product_name,line_total,unit_amount,quantity,currency&order_id=eq.${encodeURIComponent(orderId)}`,
  );
  if (!itemsResponse.ok) {
    return {
      ok: false, created: 0, skipped: 0, unattributed: 0,
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

  for (const item of items) {
    // Already credited? Then this is a replay and there is nothing to do.
    const existing = await rest(
      `marketplace_commissions?select=id&order_item_id=eq.${encodeURIComponent(item.id)}&limit=1`,
    );
    if (existing.ok && ((await existing.json()) as unknown[]).length > 0) {
      skipped += 1;
      continue;
    }

    // The seller on the line if checkout recorded one, otherwise the product's
    // owner as it stands now. Either way it comes from the database.
    let sellerId = item.seller_id ?? (await sellerForProduct(item.product_id));

    if (!sellerId) {
      // A platform-owned product. There is no author to credit, and inventing
      // one would be worse than recording nothing.
      unattributed += 1;
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

    const categoryId = await categoryForProduct(item.product_id);
    const rule = await resolveRule(sellerId, item.product_id, categoryId);

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
          rate_percent: rule && num(rule.fixed_amount) <= 0
            ? num(rule.rate_percent, DEFAULT_PLATFORM_RATE)
            : null,
          fixed_amount: rule && num(rule.fixed_amount) > 0 ? num(rule.fixed_amount) : null,
          currency: item.currency ?? rule?.currency ?? null,
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
        ok: false, created, skipped, unattributed,
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
    return { ok: false, created: 0, skipped: 0, unattributed: 0, error: "Supabase is not configured" };
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
      ok: false, created: 0, skipped: 0, unattributed: 0,
      error: "No refund is recorded for this order, so its commission cannot be reversed",
    };
  }

  const itemsResponse = await rest(
    `marketplace_order_items?select=id&order_id=eq.${encodeURIComponent(orderId)}`,
  );
  if (!itemsResponse.ok) {
    return { ok: false, created: 0, skipped: 0, unattributed: 0, error: "Could not read order items" };
  }
  const itemIds = ((await itemsResponse.json()) as { id: string }[]).map((row) => row.id);
  if (itemIds.length === 0) return { ok: true, created: 0, skipped: 0, unattributed: 0 };

  const list = itemIds.map((id) => `"${id}"`).join(",");
  const commissionsResponse = await rest(
    `marketplace_commissions?select=id,seller_amount,status&order_item_id=in.(${list})`,
  );
  if (!commissionsResponse.ok) {
    return { ok: false, created: 0, skipped: 0, unattributed: 0, error: "Could not read commissions" };
  }
  const commissions = (await commissionsResponse.json()) as
    { id: string; seller_amount: number | string; status: string }[];

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
