import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Crown } from "lucide-react";

import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { useAmsCatalogue } from "@/hooks/useAmsCatalogue";

/**
 * The rank ladder, read from the database.
 *
 * This screen shipped with hand-written KPI figures and invented rows. Every
 * number below is counted from the database, and an empty catalogue reads as
 * empty rather than as a table of examples.
 */
export const Route = createFileRoute("/ams/ranks")({
  head: () => ({
    meta: [
      { title: "Rank Engine — AMS" },
      { name: "description", content: "Every recognition rank, the XP it opens at and how many people hold it." },
      { property: "og:title", content: "Rank Engine — AMS" },
      { property: "og:description", content: "Every recognition rank, the XP it opens at and how many people hold it." },
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
  const ranks = useMemo(() => catalogue.data?.ranks ?? [], [catalogue.data]);
  const held = ranks.filter((r) => r.holders > 0).length;
  const people = ranks.reduce((sum, r) => sum + r.holders, 0);

  return (
    <EngineDashboard
      kicker="AMS Manager"
      title="Rank Engine"
      description={
        catalogue.isLoading
          ? "Reading the rank ladder…"
          : `${ranks.length} ranks from ${ranks[0]?.name ?? "—"} upward.`
      }
      primaryAction="New Rank"
      kpis={[
        { label: "Ranks", value: ranks.length },
        { label: "Held", value: held },
        { label: "People ranked", value: people },
        { label: "Highest opens at", value: (ranks[ranks.length - 1]?.minXp ?? 0).toLocaleString() },
      ]}
      columns={[
        { key: "n", label: "#", align: "right" },
        { key: "name", label: "Rank" },
        { key: "xp", label: "Opens at XP", align: "right" },
        { key: "holders", label: "Holders", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={ranks.map((r) => ({
        id: r.id,
        n: r.rankNumber,
        name: (
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-400" />
            <span className="font-medium">{r.name}</span>
          </div>
        ),
        xp: r.minXp.toLocaleString(),
        holders: r.holders.toLocaleString(),
        status: chip(r.status),
      }))}
      emptyLabel={catalogue.isLoading ? "Reading the rank ladder…" : "No ranks defined yet."}
    />
  );
}
