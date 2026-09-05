import { createFileRoute } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";
import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";

export const Route = createFileRoute("/ams/passport")({
  head: () => ({
    meta: [
      { title: "Passport Engine — AMS" },
      { name: "description", content: "Unique passport per role — cover, number, stamps, timeline, verification, expiry, renewal." },
      { property: "og:title", content: "Passport Engine — AMS" },
      { property: "og:description", content: "Unique passport per role — cover, number, stamps, timeline, verification, expiry, renewal." },
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
      title="Passport Engine"
      description="Unique passport per role — cover, number, stamps, timeline, verification, expiry, renewal."
      primaryAction="New Passport"
      kpis={[
        { label: "Passport Types", value: "11" },
        { label: "Issued", value: "84,204" },
        { label: "Stamps (7d)", value: "12,481", delta: "+8%", trend: "up" },
        { label: "Verified", value: "78,412", accent: "#22d3ee" },
        { label: "Expiring 30d", value: "412", accent: "#fbbf24" },
        { label: "Renewals (7d)", value: "204" },
      ]}
      filters={[
        { label: "Role", values: ["Developer", "Reseller", "Franchise", "Author", "Support", "SEO"] },
        { label: "Level", values: ["Bronze", "Silver", "Gold", "Diamond", "Elite"] },
      ]}
      columns={[
        { key: "name", label: "Passport" },
        { key: "role", label: "Role" },
        { key: "level", label: "Level" },
        { key: "stamps", label: "Stamps", align: "right" },
        { key: "verified", label: "Verified" },
        { key: "status", label: "Status" },
      ]}
      rows={[
        { id: "p1", name: <div className="flex items-center gap-2"><BookMarked className="h-4 w-4 text-emerald-400" /><span className="font-medium">Developer Passport</span></div>, role: "Developer", level: "Gold", stamps: "48", verified: "Yes", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "p2", name: <span className="font-medium">Reseller Passport</span>, role: "Reseller", level: "Diamond", stamps: "36", verified: "Yes", status: <StatusChip tone="success">Active</StatusChip> },
        { id: "p3", name: <span className="font-medium">Founder Passport</span>, role: "Founder", level: "Elite", stamps: "84", verified: "Yes", status: <StatusChip tone="warn">Limited</StatusChip> },
      ]}
    />
  );
}
