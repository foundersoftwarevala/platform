import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { useAmsCatalogue, countBy } from "@/hooks/useAmsCatalogue";

/**
 * The achievement catalogue, read from the database.
 *
 * This screen shipped with hand-written KPI figures and invented rows. Every
 * number below is counted from the database, and an empty catalogue reads as
 * empty rather than as a table of examples.
 */
export const Route = createFileRoute("/ams/achievements")({
  head: () => ({
    meta: [
      { title: "Achievement Engine — AMS" },
      { name: "description", content: "Every achievement that can be earned, its rarity and how many people have unlocked it." },
      { property: "og:title", content: "Achievement Engine — AMS" },
      { property: "og:description", content: "Every achievement that can be earned, its rarity and how many people have unlocked it." },
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
  const rows = useMemo(() => catalogue.data?.achievements ?? [], [catalogue.data]);
  const byRarity = useMemo(() => countBy(rows, (r) => r.rarity), [rows]);
  const unlocked = rows.reduce((sum, r) => sum + r.holders, 0);

  return (
    <EngineDashboard
      kicker="AMS Manager"
      title="Achievement Engine"
      description={
        catalogue.isLoading
          ? "Reading the achievement catalogue…"
          : rows.length
            ? `${rows.length} achievements, ${unlocked} unlocked across the platform.`
            : "No achievements have been defined yet — the catalogue is empty."
      }
      primaryAction="New Achievement"
      kpis={[
        { label: "Achievements", value: rows.length },
        { label: "Common", value: byRarity.common ?? 0 },
        { label: "Rare", value: byRarity.rare ?? 0 },
        { label: "Epic", value: byRarity.epic ?? 0 },
        { label: "Legendary", value: byRarity.legendary ?? 0 },
        { label: "Unlocked", value: unlocked },
      ]}
      filters={[{ label: "Rarity", values: ["Common", "Rare", "Epic", "Legendary", "Mythic"] }]}
      columns={[
        { key: "name", label: "Achievement" },
        { key: "rarity", label: "Rarity" },
        { key: "holders", label: "Unlocked by", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={rows.map((a) => ({
        id: a.id,
        name: (
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="font-medium">{a.name}</span>
          </div>
        ),
        rarity: <span className="capitalize">{a.rarity}</span>,
        holders: a.holders.toLocaleString(),
        status: chip(a.status),
      }))}
      emptyLabel={
        catalogue.isLoading
          ? "Reading the achievement catalogue…"
          : "No achievements defined yet. Nothing can be earned until the catalogue has entries."
      }
    />
  );
}
