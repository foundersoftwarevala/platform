import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rest } from "@/lib/marketplace/author-guard";
import type { CrudRecord, RecordStatus } from "@/lib/crud-store";

import { sourceFor } from "./sources";

/**
 * A role dashboard module's records, read from the platform for the signed-in
 * partner.
 *
 * The partner is found from the caller's own token - their seller, reseller,
 * affiliate, influencer, franchise or developer record - and every read below
 * is filtered to that record by the server. Nothing the browser sends can widen
 * it: the browser names a role and a module, never an owner.
 *
 * The rows are presented in the workspace's existing shape. Its columns are
 * generic (name, status, owner, category, amount, date), so each row also
 * carries the platform's own status word as a tag, and its currency, so the
 * screen never has to guess either.
 */

type Row = Record<string, unknown>;

/** The most rows a module shows at once; the screen says so when there are more. */
const CAP = 5000;

const text = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const short = (id: unknown) => text(id).slice(0, 8);

async function read(path: string): Promise<Row[]> {
  const response = await rest(path);
  if (!response.ok) {
    throw new Error(`${path.split("?")[0]} could not be read (${response.status})`);
  }
  return (await response.json()) as Row[];
}

/** Reads rows whose `column` is one of `ids`, a couple of hundred at a time. */
async function readIn(table: string, select: string, column: string, ids: string[], extra = ""): Promise<Row[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: Row[] = [];
  for (let i = 0; i < unique.length; i += 150) {
    const list = unique.slice(i, i + 150).map((id) => `"${id}"`).join(",");
    out.push(...(await read(`${table}?select=${select}&${column}=in.(${list})${extra}&limit=${CAP}`)));
  }
  return out;
}

const STATUS_WORDS: Record<RecordStatus, string[]> = {
  active: ["active", "live", "running", "open", "in_progress", "published", "visible"],
  pending: [
    "pending", "pending_payment", "submitted", "under_review", "requested", "processing",
    "queued", "earned", "new", "assigned", "accepted", "claimed", "in_review", "awaiting",
  ],
  approved: [
    "approved", "paid", "completed", "verified", "succeeded", "fulfilled", "converted",
    "settled", "resolved", "done",
  ],
  rejected: ["rejected", "failed", "cancelled", "canceled", "payment_failed", "reversed", "refused", "suspended"],
  archived: ["archived", "expired", "closed", "inactive", "refunded"],
  draft: ["draft", "changes_requested"],
};

function statusOf(raw: unknown): RecordStatus {
  const word = text(raw).toLowerCase();
  for (const [status, words] of Object.entries(STATUS_WORDS) as [RecordStatus, string[]][]) {
    if (words.includes(word)) return status;
  }
  return "active";
}

function record(input: {
  id: string;
  name: string;
  raw?: unknown;
  status?: RecordStatus;
  owner?: string;
  category?: string;
  amount?: number;
  currency?: string | null;
  date?: unknown;
  notes?: string;
  tags?: string[];
}): CrudRecord {
  const raw = text(input.raw);
  return {
    id: input.id,
    name: input.name || "—",
    status: input.status ?? statusOf(raw),
    owner: input.owner ?? "",
    category: input.category ?? "",
    amount: input.amount ?? 0,
    date: text(input.date) || new Date(0).toISOString(),
    notes: input.notes ?? "",
    tags: [...(raw ? [raw.replace(/_/g, " ")] : []), ...(input.tags ?? [])],
    comments: [],
    audit: [],
    attachments: [],
    extra: input.currency ? { currency: input.currency } : {},
  };
}

/* --------------------------- who the caller is --------------------------- */

async function one(path: string): Promise<Row | null> {
  return (await read(`${path}&limit=1`))[0] ?? null;
}

const partnerOf = {
  seller: (uid: string, kind: string) =>
    read(`marketplace_sellers?select=id,seller_kind,display_name&owner_user_id=eq.${uid}&limit=10`).then(
      (rows) => rows.find((r) => r.seller_kind === kind) ?? rows[0] ?? null,
    ),
  reseller: (uid: string) => one(`resellers?select=id,name&user_id=eq.${uid}`),
  affiliate: (uid: string) => one(`marketplace_affiliate_partners?select=id,display_name&user_id=eq.${uid}`),
  influencer: (uid: string) => one(`influencer_profiles?select=id,full_name&user_id=eq.${uid}`),
  franchise: (uid: string) => one(`franchises?select=id,name&owner_user_id=eq.${uid}`),
  developer: (uid: string) => one(`developers?select=id,full_name&user_id=eq.${uid}`),
};

async function holdsRole(uid: string, roles: string[]): Promise<boolean> {
  const rows = await read(`user_roles?select=role&user_id=eq.${uid}`);
  return rows.some((r) => roles.includes(text(r.role).toLowerCase()));
}

const OPERATORS = ["boss", "boss_owner", "admin", "super_admin", "founder", "owner"];

/* ------------------------------- the reads ------------------------------- */

type Result = { records: CrudRecord[]; note?: string };
const unlinked = (what: string): Result => ({
  records: [],
  note: `No ${what} is linked to this account, so there is nothing of yours to show.`,
});

async function sellerProducts(sellerId: string) {
  return read(
    `marketplace_products?select=id,name,moderation_status,visible,price_label,currency,software_type,created_at,updated_at` +
      `&seller_id=eq.${sellerId}&deleted_at=is.null&order=updated_at.desc&limit=${CAP}`,
  );
}

async function ordersById(ids: string[]) {
  const rows = await readIn(
    "marketplace_orders",
    "id,order_number,order_no,status,currency,total,buyer_id,created_at",
    "id",
    ids,
  );
  return new Map(rows.map((o) => [text(o.id), o]));
}

async function sellerRecords(role: "author" | "vendor", module: string, uid: string): Promise<Result> {
  const seller = await partnerOf.seller(uid, role);
  if (!seller) return unlinked(`${role} account`);
  const sellerId = text(seller.id);

  if (module === "products") {
    const products = await sellerProducts(sellerId);
    return {
      records: products.map((p) => {
        const live = p.visible === true && p.moderation_status === "approved";
        return record({
          id: text(p.id),
          name: text(p.name),
          raw: live ? "published" : p.moderation_status,
          category: text(p.software_type),
          // The price is stored as the label the storefront shows; its number
          // is read from it, in the product's own currency.
          amount: num(text(p.price_label).replace(/[^0-9.]/g, "")),
          currency: text(p.currency) || null,
          date: p.updated_at ?? p.created_at,
          notes: text(p.price_label),
        });
      }),
    };
  }

  if (module === "downloads") {
    const products = await sellerProducts(sellerId);
    const names = new Map(products.map((p) => [text(p.id), text(p.name)]));
    const versions = await readIn("marketplace_product_versions", "id,product_id,version", "product_id", [...names.keys()]);
    const versionOf = new Map(versions.map((v) => [text(v.id), v]));
    const downloads = await readIn(
      "marketplace_downloads", "id,version_id,created_at", "version_id", [...versionOf.keys()], "&order=created_at.desc",
    );
    return {
      records: downloads.map((d) => {
        const v = versionOf.get(text(d.version_id));
        return record({
          id: text(d.id),
          name: names.get(text(v?.product_id)) ?? "Product",
          raw: "completed",
          category: v?.version ? `Version ${text(v.version)}` : "",
          date: d.created_at,
        });
      }),
    };
  }

  const items = await read(
    `marketplace_order_items?select=id,order_id,product_name,line_total,currency,created_at` +
      `&seller_id=eq.${sellerId}&order=created_at.desc&limit=${CAP}`,
  );

  if (module === "sales") {
    const orders = await ordersById(items.map((i) => text(i.order_id)));
    return {
      records: items.map((i) => {
        const order = orders.get(text(i.order_id));
        return record({
          id: text(i.id),
          name: text(i.product_name),
          raw: order?.status,
          category: text(order?.order_number ?? order?.order_no) || `Order ${short(i.order_id)}`,
          amount: num(i.line_total),
          currency: text(i.currency) || null,
          date: i.created_at,
        });
      }),
    };
  }

  if (module === "orders") {
    const orders = await ordersById(items.map((i) => text(i.order_id)));
    const byOrder = new Map<string, Row[]>();
    for (const i of items) {
      const k = text(i.order_id);
      byOrder.set(k, [...(byOrder.get(k) ?? []), i]);
    }
    return {
      records: [...byOrder.entries()].map(([orderId, lines]) => {
        const order = orders.get(orderId);
        return record({
          id: orderId,
          name: text(order?.order_number ?? order?.order_no) || `Order ${short(orderId)}`,
          raw: order?.status,
          category: `${lines.length} line${lines.length === 1 ? "" : "s"}`,
          amount: lines.reduce((s, l) => s + num(l.line_total), 0),
          currency: text(lines[0]?.currency) || null,
          date: order?.created_at ?? lines[0]?.created_at,
          notes: lines.map((l) => text(l.product_name)).join(", "),
        });
      }),
    };
  }

  if (module === "customers") {
    const orders = await ordersById(items.map((i) => text(i.order_id)));
    const paid = [...orders.values()].filter((o) => o.status === "paid" && o.buyer_id);
    const byBuyer = new Map<string, Row[]>();
    for (const o of paid) {
      const k = text(o.buyer_id);
      byBuyer.set(k, [...(byBuyer.get(k) ?? []), o]);
    }
    const profiles = await readIn("profiles", "id,full_name,display_name,username", "id", [...byBuyer.keys()]);
    const nameOf = new Map(
      profiles.map((p) => [text(p.id), text(p.display_name || p.full_name || p.username)]),
    );
    return {
      records: [...byBuyer.entries()].map(([buyer, list]) =>
        record({
          id: buyer,
          name: nameOf.get(buyer) || `Customer ${short(buyer)}`,
          raw: list.length > 1 ? "repeat" : "active",
          status: "active",
          category: list.length > 1 ? "Repeat customer" : "Customer",
          amount: list.length,
          date: list.map((o) => text(o.created_at)).sort().at(-1),
        }),
      ),
    };
  }

  const commissions = await read(
    `marketplace_commissions?select=id,order_item_id,gross_amount,seller_amount,status,created_at` +
      `&seller_id=eq.${sellerId}&order=created_at.desc&limit=${CAP}`,
  );
  const itemOf = new Map(items.map((i) => [text(i.id), i]));

  if (module === "revenue" || module === "returns") {
    const rows = module === "returns" ? commissions.filter((c) => c.status === "reversed") : commissions;
    return {
      records: rows.map((c) => {
        const item = itemOf.get(text(c.order_item_id));
        return record({
          id: text(c.id),
          name: text(item?.product_name) || `Sale ${short(c.order_item_id)}`,
          raw: c.status,
          category: `Gross ${num(c.gross_amount).toFixed(2)}`,
          amount: num(c.seller_amount),
          currency: text(item?.currency) || null,
          date: c.created_at,
        });
      }),
    };
  }

  if (module === "reviews") {
    const products = await sellerProducts(sellerId);
    const names = new Map(products.map((p) => [text(p.id), text(p.name)]));
    const reviews = await readIn(
      "marketplace_reviews",
      "id,product_id,rating,title,comment,status,seller_response,created_at",
      "product_id",
      [...names.keys()],
      "&order=created_at.desc",
    );
    return {
      records: reviews.map((r) =>
        record({
          id: text(r.id),
          name: text(r.title) || names.get(text(r.product_id)) || "Review",
          raw: r.status,
          category: names.get(text(r.product_id)) ?? "",
          amount: num(r.rating),
          date: r.created_at,
          notes: [text(r.comment), r.seller_response ? `Your reply: ${text(r.seller_response)}` : ""]
            .filter(Boolean)
            .join("\n\n"),
        }),
      ),
    };
  }

  if (module === "analytics") {
    const products = await sellerProducts(sellerId);
    const names = new Map(products.map((p) => [text(p.id), text(p.name)]));
    const events = await readIn("marketplace_events", "product_id,event_type,created_at", "product_id", [...names.keys()]);
    const groups = new Map<string, { product: string; type: string; n: number; last: string }>();
    for (const e of events) {
      const k = `${text(e.product_id)}:${text(e.event_type)}`;
      const g = groups.get(k) ?? { product: text(e.product_id), type: text(e.event_type), n: 0, last: "" };
      g.n += 1;
      if (text(e.created_at) > g.last) g.last = text(e.created_at);
      groups.set(k, g);
    }
    return {
      records: [...groups.entries()].map(([k, g]) =>
        record({
          id: k,
          name: names.get(g.product) ?? "Product",
          status: "active",
          category: g.type.replace(/_/g, " "),
          amount: g.n,
          date: g.last,
        }),
      ),
    };
  }

  return { records: [] };
}

async function attributedOrders(column: string, partnerId: string) {
  const attributions = await read(
    `marketplace_order_attributions?select=order_id,attributed_at&${column}=eq.${partnerId}&order=attributed_at.desc&limit=${CAP}`,
  );
  const orders = await ordersById(attributions.map((a) => text(a.order_id)));
  return [...orders.values()];
}

function orderRecords(orders: Row[]): CrudRecord[] {
  return orders.map((o) =>
    record({
      id: text(o.id),
      name: text(o.order_number ?? o.order_no) || `Order ${short(o.id)}`,
      raw: o.status,
      amount: num(o.total),
      currency: text(o.currency) || null,
      date: o.created_at,
    }),
  );
}

async function resellerRecords(module: string, uid: string): Promise<Result> {
  // The same leaderboard entries the affiliate's Rank reads; a reseller is
  // ranked on whatever leaderboard the platform defines for them.
  if (module === "rank") return rankRecords(uid);
  const reseller = await partnerOf.reseller(uid);
  if (!reseller) return unlinked("reseller account");
  const id = text(reseller.id);

  if (module === "commissions") {
    const rows = await read(
      `reseller_commissions?select=id,order_id,gross_amount,commission_amount,currency,status,created_at` +
        `&reseller_id=eq.${id}&order=created_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((c) =>
        record({
          id: text(c.id),
          name: `Order ${short(c.order_id)}`,
          raw: c.status,
          category: `Gross ${num(c.gross_amount).toFixed(2)}`,
          amount: num(c.commission_amount),
          currency: text(c.currency) || null,
          date: c.created_at,
        }),
      ),
    };
  }
  if (module === "revenue") return { records: orderRecords(await attributedOrders("reseller_id", id)) };
  if (module === "renewals") {
    const orders = await attributedOrders("reseller_id", id);
    const items = await readIn("marketplace_order_items", "id,product_name", "order_id", orders.map((o) => text(o.id)));
    const product = new Map(items.map((i) => [text(i.id), text(i.product_name)]));
    const licenses = await readIn(
      "marketplace_licenses", "id,order_item_id,license_model,status,expires_at,created_at", "order_item_id", [...product.keys()],
    );
    const soon = Date.now() + 30 * 86_400_000;
    return {
      records: licenses.map((l) => {
        const expires = l.expires_at ? new Date(text(l.expires_at)).getTime() : null;
        return record({
          id: text(l.id),
          name: product.get(text(l.order_item_id)) ?? "Licence",
          raw: expires != null && expires < Date.now() ? "expired" : l.status,
          status:
            expires != null && expires < Date.now()
              ? "archived"
              : expires != null && expires < soon
                ? "pending"
                : statusOf(l.status),
          category: text(l.license_model).replace(/_/g, " "),
          date: l.expires_at ?? l.created_at,
          notes: l.expires_at ? `Expires ${text(l.expires_at).slice(0, 10)}` : "Does not expire",
        });
      }),
    };
  }
  return { records: [] };
}

async function affiliateRecords(module: string, uid: string): Promise<Result> {
  if (module === "rank") return rankRecords(uid);
  const partner = await partnerOf.affiliate(uid);
  if (!partner) return unlinked("affiliate account");
  const id = text(partner.id);

  const codes = await read(`marketplace_referral_codes?select=id,code,active,created_at&affiliate_partner_id=eq.${id}&limit=${CAP}`);
  const codeOf = new Map(codes.map((c) => [text(c.id), text(c.code)]));

  if (module === "marketing") {
    return {
      records: codes.map((c) =>
        record({
          id: text(c.id),
          name: text(c.code),
          raw: c.active ? "active" : "inactive",
          category: "Referral link",
          date: c.created_at,
        }),
      ),
    };
  }
  if (module === "clicks") {
    const sessions = await read(
      `marketplace_referral_sessions?select=id,referral_code_id,landing_url,converted_order_id,metadata,first_seen_at` +
        `&affiliate_partner_id=eq.${id}&order=first_seen_at.desc&limit=${CAP}`,
    );
    return {
      records: sessions.map((s) =>
        record({
          id: text(s.id),
          name: text(s.landing_url) || "Visit",
          raw: s.converted_order_id ? "converted" : "active",
          category: codeOf.get(text(s.referral_code_id)) ?? "",
          amount: num((s.metadata as Row | null)?.clicks ?? 1) || 1,
          date: s.first_seen_at,
        }),
      ),
    };
  }
  if (module === "conversions") return { records: orderRecords(await attributedOrders("affiliate_partner_id", id)) };
  if (module === "commissions") {
    const rows = await read(
      `partner_commissions?select=id,order_id,gross_amount,commission_amount,currency,status,earned_at,created_at` +
        `&partner_kind=eq.affiliate&partner_id=eq.${id}&order=created_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((c) =>
        record({
          id: text(c.id),
          name: `Order ${short(c.order_id)}`,
          raw: c.status,
          category: `Gross ${num(c.gross_amount).toFixed(2)}`,
          amount: num(c.commission_amount),
          currency: text(c.currency) || null,
          date: c.earned_at ?? c.created_at,
        }),
      ),
    };
  }
  if (module === "payouts") {
    const rows = await read(
      `partner_payouts?select=id,amount,currency,status,payment_method,requested_at,completed_at,created_at` +
        `&partner_kind=eq.affiliate&partner_id=eq.${id}&order=created_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((p) =>
        record({
          id: text(p.id),
          name: `Payout ${short(p.id)}`,
          raw: p.status,
          category: text(p.payment_method),
          amount: num(p.amount),
          currency: text(p.currency) || null,
          date: p.completed_at ?? p.requested_at ?? p.created_at,
        }),
      ),
    };
  }
  return { records: [] };
}

async function rankRecords(uid: string): Promise<Result> {
  const entries = await read(`leaderboard_entries?select=id,definition_id,rank,score,computed_at&user_id=eq.${uid}&limit=${CAP}`);
  const defs = await readIn("leaderboard_definitions", "id,name", "id", entries.map((e) => text(e.definition_id)));
  const nameOf = new Map(defs.map((d) => [text(d.id), text(d.name)]));
  return {
    records: entries.map((e) =>
      record({
        id: text(e.id),
        name: nameOf.get(text(e.definition_id)) ?? "Leaderboard",
        status: "active",
        category: e.rank != null ? `Rank #${text(e.rank)}` : "Unranked",
        amount: num(e.score),
        date: e.computed_at,
      }),
    ),
  };
}

async function influencerRecords(module: string, uid: string): Promise<Result> {
  const profile = await partnerOf.influencer(uid);
  if (!profile) return unlinked("influencer profile");
  const id = text(profile.id);

  if (module === "followers" || module === "engagement") {
    const accounts = await read(
      `influencer_social_accounts?select=id,platform,handle,followers,engagement_rate,verification_status,verified_at` +
        `&profile_id=eq.${id}&limit=${CAP}`,
    );
    return {
      records: accounts.map((a) =>
        record({
          id: text(a.id),
          name: `${text(a.platform)} · @${text(a.handle).replace(/^@/, "")}`,
          raw: a.verification_status,
          category: text(a.platform),
          amount: module === "followers" ? num(a.followers) : num(a.engagement_rate),
          date: a.verified_at,
        }),
      ),
    };
  }
  if (module === "campaigns") {
    const assignments = await read(
      `influencer_campaign_assignments?select=id,campaign_id,status,assigned_at&profile_id=eq.${id}&order=assigned_at.desc&limit=${CAP}`,
    );
    const campaigns = await readIn("campaigns", "id,name,starts_at,ends_at", "id", assignments.map((a) => text(a.campaign_id)));
    const byId = new Map(campaigns.map((c) => [text(c.id), c]));
    return {
      records: assignments.map((a) => {
        const c = byId.get(text(a.campaign_id));
        return record({
          id: text(a.id),
          name: text(c?.name) || `Campaign ${short(a.campaign_id)}`,
          raw: a.status,
          category: c?.ends_at ? `Ends ${text(c.ends_at).slice(0, 10)}` : "",
          date: a.assigned_at,
        });
      }),
    };
  }
  if (module === "revenue") {
    const rows = await read(
      `influencer_earnings?select=id,campaign_id,gross_amount,net_amount,currency,status,created_at` +
        `&profile_id=eq.${id}&order=created_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((e) =>
        record({
          id: text(e.id),
          name: e.campaign_id ? `Campaign ${short(e.campaign_id)}` : "Earning",
          raw: e.status,
          category: `Gross ${num(e.gross_amount).toFixed(2)}`,
          amount: num(e.net_amount),
          currency: text(e.currency) || null,
          date: e.created_at,
        }),
      ),
    };
  }
  return { records: [] };
}

async function franchiseRecords(module: string, uid: string): Promise<Result> {
  const franchise = await partnerOf.franchise(uid);
  if (!franchise) return unlinked("franchise");
  if (module === "performance") {
    const rows = await read(
      `franchise_performance?select=id,period,revenue,leads,conversions,tickets,csat,sla_percent,created_at` +
        `&franchise_id=eq.${text(franchise.id)}&order=period.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((p) =>
        record({
          id: text(p.id),
          name: text(p.period),
          status: "active",
          category: `${num(p.leads)} leads · ${num(p.conversions)} conversions`,
          amount: num(p.revenue),
          date: p.created_at,
          notes: `Tickets ${num(p.tickets)} · CSAT ${text(p.csat) || "—"} · SLA ${text(p.sla_percent) || "—"}%`,
        }),
      ),
    };
  }
  return { records: [] };
}

async function seoRecords(module: string, uid: string): Promise<Result> {
  if (!(await holdsRole(uid, ["seo", "marketing", ...OPERATORS]))) {
    return { records: [], note: "The SEO dashboard is for the SEO team." };
  }
  if (module === "keywords") {
    const rows = await read(
      `seo_keywords?select=id,keyword,target_url,position,search_volume,intent,country,status,updated_at&order=updated_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((k) =>
        record({
          id: text(k.id),
          name: text(k.keyword),
          raw: k.status,
          category: [text(k.intent), text(k.country)].filter(Boolean).join(" · "),
          amount: num(k.position),
          date: k.updated_at,
          notes: `${text(k.target_url)}\nSearch volume ${num(k.search_volume)}`,
        }),
      ),
    };
  }
  if (module === "traffic") {
    const rows = await read(
      `seo_performance_metrics?select=id,recorded_on,clicks,impressions,ctr,avg_position,organic_sessions,conversions&order=recorded_on.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((m) =>
        record({
          id: text(m.id),
          name: text(m.recorded_on),
          status: "active",
          category: `${num(m.impressions)} impressions`,
          amount: num(m.clicks),
          date: m.recorded_on,
          notes: `CTR ${text(m.ctr)} · position ${text(m.avg_position)} · sessions ${num(m.organic_sessions)} · conversions ${num(m.conversions)}`,
        }),
      ),
    };
  }
  if (module === "backlinks") {
    const rows = await read(
      `seo_backlinks?select=id,source_domain,source_url,target_url,anchor_text,domain_authority,link_type,status,spam_score,last_checked_at,first_seen_at&order=first_seen_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((b) =>
        record({
          id: text(b.id),
          name: text(b.source_domain),
          raw: b.status,
          category: text(b.link_type),
          amount: num(b.domain_authority),
          date: b.last_checked_at ?? b.first_seen_at,
          notes: `${text(b.source_url)} → ${text(b.target_url)}\nAnchor: ${text(b.anchor_text)}\nSpam score ${text(b.spam_score)}`,
        }),
      ),
    };
  }
  if (module === "audits") {
    const rows = await read(`seo_audits?select=id,name,status,score,pages_crawled,issues_found,started_at,completed_at,created_at&order=created_at.desc&limit=${CAP}`);
    return {
      records: rows.map((a) =>
        record({
          id: text(a.id),
          name: text(a.name),
          raw: a.status,
          category: `${num(a.pages_crawled)} pages · ${num(a.issues_found)} issues`,
          amount: num(a.score),
          date: a.completed_at ?? a.started_at ?? a.created_at,
        }),
      ),
    };
  }
  if (module === "rankings") {
    const rows = await read(`seo_keyword_rankings?select=id,keyword_id,recorded_on,position,clicks,impressions&order=recorded_on.desc&limit=${CAP}`);
    const keywords = await readIn("seo_keywords", "id,keyword", "id", rows.map((r) => text(r.keyword_id)));
    const nameOf = new Map(keywords.map((k) => [text(k.id), text(k.keyword)]));
    return {
      records: rows.map((r) =>
        record({
          id: text(r.id),
          name: nameOf.get(text(r.keyword_id)) ?? "Keyword",
          status: "active",
          category: `${num(r.clicks)} clicks · ${num(r.impressions)} impressions`,
          amount: num(r.position),
          date: r.recorded_on,
        }),
      ),
    };
  }
  if (module === "reports") {
    const rows = await read(`seo_reports?select=id,name,report_type,period_start,period_end,status,summary,generated_at,created_at&order=created_at.desc&limit=${CAP}`);
    return {
      records: rows.map((r) =>
        record({
          id: text(r.id),
          name: text(r.name),
          raw: r.status,
          category: text(r.report_type),
          date: r.generated_at ?? r.created_at,
          notes: [
            r.period_start ? `${text(r.period_start)} – ${text(r.period_end)}` : "",
            typeof r.summary === "string" ? r.summary : r.summary ? JSON.stringify(r.summary) : "",
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      ),
    };
  }
  return { records: [] };
}

async function developerRecords(module: string, uid: string): Promise<Result> {
  if (module === "bugs") {
    const rows = await read(
      `tm_tasks?select=id,code,title,status,priority,severity,deadline,created_at&assigned_to=eq.${uid}&task_type=eq.bug&order=created_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((t) =>
        record({
          id: text(t.id),
          name: text(t.title) || text(t.code),
          raw: t.status,
          category: [text(t.severity), text(t.priority)].filter(Boolean).join(" · "),
          date: t.deadline ?? t.created_at,
          notes: text(t.code),
        }),
      ),
    };
  }
  const developer = await partnerOf.developer(uid);
  if (!developer) return unlinked("developer profile");
  const id = text(developer.id);
  if (module === "tasks") {
    const rows = await read(
      `developer_tasks?select=id,title,description,category,priority,status,deadline,task_amount,progress_percent,created_at` +
        `&developer_id=eq.${id}&order=created_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((t) =>
        record({
          id: text(t.id),
          name: text(t.title),
          raw: t.status,
          category: [text(t.category), text(t.priority)].filter(Boolean).join(" · "),
          amount: num(t.task_amount),
          date: t.deadline ?? t.created_at,
          notes: `${text(t.description)}\nProgress ${num(t.progress_percent)}%`.trim(),
        }),
      ),
    };
  }
  if (module === "code-submission") {
    const rows = await read(
      `developer_code_submissions?select=id,task_id,submission_type,commit_message,notes,review_status,review_notes,created_at` +
        `&developer_id=eq.${id}&order=created_at.desc&limit=${CAP}`,
    );
    return {
      records: rows.map((s) =>
        record({
          id: text(s.id),
          name: text(s.commit_message) || text(s.submission_type) || "Submission",
          raw: s.review_status,
          category: text(s.submission_type),
          date: s.created_at,
          notes: [text(s.notes), s.review_notes ? `Review: ${text(s.review_notes)}` : ""].filter(Boolean).join("\n\n"),
        }),
      ),
    };
  }
  return { records: [] };
}

async function recordsFor(role: string, module: string, uid: string): Promise<Result> {
  switch (role) {
    case "author":
    case "vendor":
      return sellerRecords(role, module, uid);
    case "reseller":
      return resellerRecords(module, uid);
    case "affiliate":
      return affiliateRecords(module, uid);
    case "influencer":
      return influencerRecords(module, uid);
    case "franchise":
      return franchiseRecords(module, uid);
    case "seo":
      return seoRecords(module, uid);
    case "developer":
      return developerRecords(module, uid);
    default:
      return { records: [] };
  }
}

export const listDashboardRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ role: z.string().min(1).max(40), module: z.string().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Result & { truncated: boolean }> => {
    if (sourceFor(data.role, data.module).kind !== "records") {
      return { records: [], truncated: false, note: "This module does not read records." };
    }
    const result = await recordsFor(data.role, data.module, context.userId);
    const truncated = result.records.length >= CAP;
    return {
      ...result,
      truncated,
      note:
        result.note ??
        (truncated ? `Showing the newest ${CAP.toLocaleString()} records.` : undefined),
    };
  });
