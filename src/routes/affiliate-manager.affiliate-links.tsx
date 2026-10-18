import { createFileRoute } from "@tanstack/react-router";
import { LinkIcon, MousePointerClick, TrendingUp } from "lucide-react";
import { EntityWall, Row, Cell, type EntitySource } from "@/components/affiliate/EntityWall";
import { supabase } from "@/integrations/supabase/client";

type Link = { id: string; slug: string; destination_url: string; clicks_count: number; conversions_count: number };

// An affiliate's link is their referral code (marketplace_referral_codes); no
// separate link or destination is stored, so the destination stays empty.
// Clicks are affiliate_clicks on the code and conversions the orders
// attributed through it. "Top Performing" and "Recently Created" are not
// recorded views, so they have nothing to show.
const since30d = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString(); })();
const source: EntitySource<Link> = {
  table: "marketplace_referral_codes",
  select: "id, code, created_at",
  fixed: [{ column: "affiliate_partner_id", op: "not_null", value: null }],
  filter: () => null,
  sortColumn: (field) => (field === "created_at" ? field : null),
  searchColumns: ["code"],
  order: { column: "created_at", ascending: false },
  toRows: async (rows) => {
    const ids = rows.map((r) => String(r.id));
    const codes = rows.map((r) => String(r.code));
    const db = supabase as any;
    const [clicks, orders] = ids.length
      ? await Promise.all([
          db.from("affiliate_clicks").select("referral_code").in("referral_code", codes),
          db.from("marketplace_order_attributions").select("referral_code_id").in("referral_code_id", ids),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    if (clicks.error) throw clicks.error;
    if (orders.error) throw orders.error;
    const clickCount = new Map<string, number>();
    for (const c of (clicks.data ?? []) as { referral_code: string }[]) {
      clickCount.set(c.referral_code, (clickCount.get(c.referral_code) ?? 0) + 1);
    }
    const orderCount = new Map<string, number>();
    for (const o of (orders.data ?? []) as { referral_code_id: string }[]) {
      orderCount.set(o.referral_code_id, (orderCount.get(o.referral_code_id) ?? 0) + 1);
    }
    return rows.map((r) => ({
      id: String(r.id),
      slug: String(r.code ?? ""),
      destination_url: "",
      clicks_count: clickCount.get(String(r.code)) ?? 0,
      conversions_count: orderCount.get(String(r.id)) ?? 0,
    }));
  },
};

export const Route = createFileRoute("/affiliate-manager/affiliate-links")({
  head: () => ({ meta: [{ title: "Affiliate Links — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<Link>
      title="Affiliate Links"
      description="Tracking, deep, campaign and short links with clicks, conversions, and QR."
      crumbLabel="Affiliate Links"
      table="marketplace_referral_codes"
      source={source}
      searchColumns={["slug", "destination_url"]}
      searchPlaceholder="Search by slug or destination…"
      filters={["Campaign", "Affiliate", "Domain", "Status"]}
      tabs={["All", "Top Performing", "Recently Created"]}
      kpis={[
        { label: "Total Links", icon: <LinkIcon className="size-4" />, tone: "primary" },
        { label: "Clicks 30d", icon: <MousePointerClick className="size-4" />, table: "affiliate_clicks", filter: [{ column: "created_at", op: "gte", value: since30d }] },
        { label: "Conversions", icon: <TrendingUp className="size-4" />, tone: "success", table: "marketplace_order_attributions", filter: [{ column: "affiliate_partner_id", op: "not_null", value: null }] },
      ]}
      columns={[
        { key: "slug", label: "Slug" },
        { key: "dest", label: "Destination" },
        { key: "clicks", label: "Clicks", align: "right" },
        { key: "conv", label: "Conversions", align: "right" },
      ]}
      renderRow={(l) => (
        <Row id={l.id}>
          <Cell className="font-mono text-[12px]">/{l.slug}</Cell>
          <Cell className="truncate max-w-xs text-muted-foreground">{l.destination_url}</Cell>
          <Cell align="right" className="tabular-nums">{l.clicks_count.toLocaleString()}</Cell>
          <Cell align="right" className="tabular-nums">{l.conversions_count.toLocaleString()}</Cell>
        </Row>
      )}
      emptyIcon={LinkIcon}
      emptyTitle="No links yet"
      emptyDescription="Create tracking links from any campaign or affiliate to see clicks and conversions here."
      primaryActionLabel="Create Link"
    />
  ),
});
