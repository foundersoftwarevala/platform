import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Shield } from "lucide-react";

import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { useAmsCatalogue, countBy } from "@/hooks/useAmsCatalogue";

/**
 * The badge catalogue, read from the database.
 *
 * This screen shipped with hand-written KPI figures and invented rows. Every
 * number below is counted from the database, and an empty catalogue reads as
 * empty rather than as a table of examples.
 */
export const Route = createFileRoute("/ams/badges")({
  head: () => ({
    meta: [
      { title: "Badge Engine — AMS" },
      { name: "description", content: "Every badge that can be earned, its rarity and how many people hold it." },
      { property: "og:title", content: "Badge Engine — AMS" },
      { property: "og:description", content: "Every badge that can be earned, its rarity and how many people hold it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const TONE: Record<string, "success" | "info" | "warn"> = {
  active: "success",
  draft: "warn",
  inactive: "info",
};

function chip(status: string) {
  return (
    <StatusChip tone={TONE[status] ?? "info"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </StatusChip>
  );
}

function Page() {
  const catalogue = useAmsCatalogue();
  const rows = useMemo(() => catalogue.data?.badges ?? [], [catalogue.data]);
  const byRarity = useMemo(() => countBy(rows, (r) => r.rarity), [rows]);
  const held = rows.reduce((sum, r) => sum + r.holders, 0);

  return (
    <EngineDashboard
      kicker="AMS Manager"
      title="Badge Engine"
      description={
        catalogue.isLoading
          ? "Reading the badge catalogue…"
          : rows.length
            ? `${rows.length} badges, ${held} held across the platform.`
            : "No badges have been defined yet — the catalogue is empty."
      }
      primaryAction="New Badge"
      kpis={[
        { label: "Badges", value: rows.length },
        { label: "Common", value: byRarity.common ?? 0 },
        { label: "Rare", value: byRarity.rare ?? 0 },
        { label: "Epic", value: byRarity.epic ?? 0 },
        { label: "Legendary", value: byRarity.legendary ?? 0 },
        { label: "Held", value: held },
      ]}
      filters={[{ label: "Rarity", values: ["Common", "Rare", "Epic", "Legendary", "Mythic"] }]}
      columns={[
        { key: "name", label: "Badge" },
        { key: "rarity", label: "Rarity" },
        { key: "holders", label: "Holders", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={rows.map((b) => ({
        id: b.id,
        name: (
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-medium">{b.name}</span>
          </div>
        ),
        rarity: <span className="capitalize">{b.rarity}</span>,
        holders: b.holders.toLocaleString(),
        status: chip(b.status),
      }))}
      emptyLabel={
        catalogue.isLoading
          ? "Reading the badge catalogue…"
          : "No badges defined yet. Nothing can be earned until the catalogue has entries."
      }
    />
  );
}
