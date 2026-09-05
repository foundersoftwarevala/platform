import { createFileRoute } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/collections")({
  head: () => ({
    meta: [
      { title: "Collection Engine — AMS" },
      { name: "description", content: "Curated sets of awards, badges, certificates, passports, stamps and trophies." },
      { property: "og:title", content: "Collection Engine — AMS" },
      { property: "og:description", content: "Curated sets of awards, badges, certificates, passports, stamps and trophies." },
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
      title="Collection Engine"
      description="Curated sets of awards, badges, certificates, passports, stamps and trophies."
      primaryAction="New Collection"
      kpis={[
        { label: "Collections", value: "48" },
        { label: "Items", value: "2,412" },
        { label: "Completions", value: "1,204" },
        { label: "Avg Progress", value: "42%" },
        { label: "Featured", value: "6", accent: "#facc15" },
        { label: "Retention Lift", value: "+18%", trend: "up", accent: "#22d3ee" },
      ]}
      filters={[
        { label: "Kind", values: ["Award", "Badge", "Certificate", "Passport", "Stamp", "Trophy"] },
        { label: "Season", values: ["S1", "S2", "S3", "All-time"] },
      ]}
      columns={[
        { key: "name", label: "Collection" },
        { key: "kind", label: "Kind" },
        { key: "items", label: "Items", align: "right" },
        { key: "completions", label: "Completions", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "co1", name: <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-fuchsia-400" /><span className="font-medium">Founding Collection</span></div>, kind: "Award", items: "12", completions: "12", status: <StatusChip tone="warn">Limited</StatusChip> },
        { id: "co2", name: <span className="font-medium">Developer Journey</span>, kind: "Badge", items: "24", completions: "412", status: <StatusChip tone="success">Live</StatusChip> },
        { id: "co3", name: <span className="font-medium">Winter Ascendant</span>, kind: "Trophy", items: "8", completions: "204", status: <StatusChip tone="info">Seasonal</StatusChip> },
      ]}
    />
  );
}
