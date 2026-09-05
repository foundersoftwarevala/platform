import { createFileRoute } from "@tanstack/react-router";
import { Fingerprint } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/identity")({
  head: () => ({
    meta: [
      { title: "Identity Engine — AMS" },
      { name: "description", content: "Role motto, vision, mission, philosophy, signature, greeting, celebration and motivation language." },
      { property: "og:title", content: "Identity Engine — AMS" },
      { property: "og:description", content: "Role motto, vision, mission, philosophy, signature, greeting, celebration and motivation language." },
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
      title="Identity Engine"
      description="Role motto, vision, mission, philosophy, signature, greeting, celebration and motivation language."
      primaryAction="New Persona"
      kpis={[
        { label: "Personas", value: "11" },
        { label: "Mottos", value: "44" },
        { label: "Celebrations", value: "88" },
        { label: "Languages", value: "6" },
        { label: "Coverage", value: "100%", accent: "#22d3ee" },
        { label: "Reviews", value: "24" },
      ]}
      filters={[{ label: "Role", values: ["Developer", "Reseller", "Support", "SEO", "Creator", "Author"] }]}
      columns={[
        { key: "role", label: "Role" },
        { key: "motto", label: "Motto" },
        { key: "signature", label: "Signature" },
        { key: "celebration", label: "Celebration" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "id1", role: <div className="flex items-center gap-2"><Fingerprint className="h-4 w-4 text-cyan-400" /><span className="font-medium">Developer</span></div>, motto: "Ship. Learn. Repeat.", signature: "// arch-01", celebration: "Neon commit rain", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "id2", role: <span className="font-medium">Reseller</span>, motto: "Every deal, a new door.", signature: "★ sales", celebration: "Coin cascade", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "id3", role: <span className="font-medium">Support</span>, motto: "We turn issues into trust.", signature: "🛡 support", celebration: "Star burst", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "id4", role: <span className="font-medium">SEO</span>, motto: "Rank the invisible.", signature: "↗ seo", celebration: "Ranking rocket", status: <StatusChip tone="success">Active</StatusChip> },
      ]}
    />
  );
}
