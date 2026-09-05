import { createFileRoute } from "@tanstack/react-router";
import { Gift, IndianRupee, Percent, Ticket } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import { StatusBadge } from "@/components/marketing/kit";
import { compactInr, num, pct, shortDate, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/offers")({
  head: () => ({
    meta: [
      { title: "Offers & Festivals — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Run festival and seasonal offers with live discount codes, redemption counts and revenue attribution.",
      },
      { property: "og:title", content: "Offers & Festivals — Software Vala" },
      {
        property: "og:description",
        content: "Festival campaign offers with live redemptions and revenue impact.",
      },
    ],
  }),
  component: OffersScreen,
});

const OFFER_TYPES = ["percentage", "flat", "bundle", "cashback", "free_trial", "bogo"] as const;
const STATUSES = ["draft", "scheduled", "active", "paused", "completed", "archived"] as const;
const FESTIVALS = [
  "Diwali",
  "Holi",
  "Navratri",
  "Onam",
  "Pongal",
  "Eid",
  "Christmas",
  "New Year",
  "Independence Day",
  "Republic Day",
  "Summer Sale",
  "Monsoon Sale",
] as const;

function OffersScreen() {
  return (
    <DataScreen
      table="marketing_offers"
      title="Offers & Festivals"
      description="Seasonal and festival promotions with live redemption and revenue tracking."
      module="Offers"
      entityLabel="Offer"
      order={{ column: "created_at" }}
      searchKeys={["title", "festival", "code", "offer_type"]}
      filterKey="status"
      filterOptions={STATUSES}
      minWidth={1120}
      stats={[
        { label: "Offers", icon: Gift, tone: "violet", value: (r) => num(r.length) },
        {
          label: "Live now",
          icon: Ticket,
          tone: "green",
          value: (r) => num(r.filter((x) => x.status === "active").length),
        },
        {
          label: "Redemptions",
          icon: Percent,
          tone: "blue",
          value: (r) => num(r.reduce((s, x) => s + Number(x.redemptions ?? 0), 0)),
        },
        {
          label: "Offer revenue",
          icon: IndianRupee,
          tone: "gold",
          value: (r) => compactInr(r.reduce((s, x) => s + Number(x.revenue ?? 0), 0)),
        },
      ]}
      columns={[
        { key: "title", header: "Offer", render: (r) => <span className="font-medium">{r.title}</span> },
        { key: "festival", header: "Festival", render: (r) => r.festival ?? "—" },
        { key: "offer_type", header: "Type", render: (r) => titleCase(r.offer_type) },
        {
          key: "discount_percent",
          header: "Discount",
          align: "right",
          render: (r) => pct(r.discount_percent, 0),
        },
        { key: "code", header: "Code", render: (r) => r.code ?? "—" },
        { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
        {
          key: "window",
          header: "Window",
          render: (r) => `${shortDate(r.start_date)} → ${shortDate(r.end_date)}`,
        },
        {
          key: "regions",
          header: "Regions",
          render: (r) => (r.regions?.length ? r.regions.join(", ") : "—"),
        },
        {
          key: "redemptions",
          header: "Redeemed",
          align: "right",
          render: (r) => num(r.redemptions),
        },
        {
          key: "revenue",
          header: "Revenue",
          align: "right",
          render: (r) => compactInr(r.revenue),
        },
      ]}
      fields={[
        { key: "title", label: "Offer title", kind: "text", required: true, full: true },
        { key: "festival", label: "Festival", kind: "select", options: FESTIVALS },
        { key: "offer_type", label: "Offer type", kind: "select", options: OFFER_TYPES },
        { key: "discount_percent", label: "Discount %", kind: "number" },
        { key: "code", label: "Promo code", kind: "text" },
        { key: "status", label: "Status", kind: "select", options: STATUSES },
        { key: "start_date", label: "Start date", kind: "date" },
        { key: "end_date", label: "End date", kind: "date" },
        { key: "redemptions", label: "Redemptions", kind: "number" },
        { key: "revenue", label: "Revenue (₹)", kind: "number" },
        { key: "regions", label: "Regions", kind: "tags", full: true },
      ]}
    />
  );
}
