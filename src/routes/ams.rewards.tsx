import { createFileRoute } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/rewards")({
  head: () => ({
    meta: [
      { title: "Reward Engine — AMS" },
      { name: "description", content: "Lucky Wheel · Mystery Box · Treasure Chest · Golden Ticket · Commission Booster · Premium bundles." },
      { property: "og:title", content: "Reward Engine — AMS" },
      { property: "og:description", content: "Lucky Wheel · Mystery Box · Treasure Chest · Golden Ticket · Commission Booster · Premium bundles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <EngineDashboard
      kicker="AMS Manager"
      title="Reward Engine"
      description="Lucky Wheel · Mystery Box · Treasure Chest · Golden Ticket · Commission Booster · Premium bundles."
      primaryAction="New Reward"
      kpis={[
        { label: "Reward Types", value: "12" },
        { label: "Distributed (7d)", value: "18,412", delta: "+14%", trend: "up" },
        { label: "Claim Rate", value: "82%", delta: "+3%", trend: "up" },
        { label: "Golden Tickets", value: "24", accent: "#facc15" },
        { label: "Mystery Boxes", value: "1,204", accent: "#c084fc" },
        { label: "Value Issued", value: "$48,204" },
      ]}
      filters={[
        { label: "Type", values: ["Lucky Wheel", "Mystery Box", "Treasure Chest", "Golden Ticket", "Booster", "VIP"] },
        { label: "Rarity", values: ["Common", "Rare", "Epic", "Legendary", "Mythic"] },
      ]}
      columns={[
        { key: "name", label: "Reward" },
        { key: "type", label: "Type" },
        { key: "rarity", label: "Rarity" },
        { key: "issued", label: "Issued", align: "right" },
        { key: "value", label: "Value", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "rw1", name: <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-fuchsia-400" /><span className="font-medium">Legendary Mystery Box</span></div>, type: "Mystery Box", rarity: "Legendary", issued: "84", value: "$120", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "rw2", name: <span className="font-medium">Weekend Lucky Spin</span>, type: "Lucky Wheel", rarity: "Common", issued: "4,182", value: "$5–$50", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "rw3", name: <span className="font-medium">Golden Ticket</span>, type: "Golden Ticket", rarity: "Mythic", issued: "24", value: "$500", status: <StatusChip tone="warn">Limited</StatusChip> },
        { id: "rw4", name: <span className="font-medium">Commission Booster ×2</span>, type: "Booster", rarity: "Epic", issued: "612", value: "+100%", status: <StatusChip tone="success">Live</StatusChip> },
      ]}
    />
  );
}
