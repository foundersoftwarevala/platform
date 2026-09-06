import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpCircle } from "lucide-react";

import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { useAmsCatalogue } from "@/hooks/useAmsCatalogue";

/**
 * The level ladder, read from the database.
 *
 * This screen shipped with hand-written KPI figures and invented rows. Every
 * number below is counted from the database, and an empty catalogue reads as
 * empty rather than as a table of examples.
 */
export const Route = createFileRoute("/ams/levels")({
  head: () => ({
    meta: [
      { title: "Level Engine — AMS" },
      { name: "description", content: "Every progression level, the XP it requires and how many people currently sit on it." },
      { property: "og:title", content: "Level Engine — AMS" },
      { property: "og:description", content: "Every progression level, the XP it requires and how many people currently sit on it." },
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
  const levels = useMemo(() => catalogue.data?.levels ?? [], [catalogue.data]);
  const occupied = levels.filter((l) => l.holders > 0).length;
  const people = levels.reduce((sum, l) => sum + l.holders, 0);
  const top = levels.length ? levels[levels.length - 1] : null;

  return (
    <EngineDashboard
      kicker="AMS Manager"
      title="Level Engine"
      description={
        catalogue.isLoading
          ? "Reading the level ladder…"
          : `${levels.length} levels from ${levels[0]?.name ?? "—"} to ${top?.name ?? "—"}.`
      }
      primaryAction="New Level"
      kpis={[
        { label: "Levels", value: levels.length },
        { label: "Occupied", value: occupied },
        { label: "People placed", value: people },
        { label: "Top level XP", value: (top?.xpRequired ?? 0).toLocaleString() },
      ]}
      columns={[
        { key: "n", label: "#", align: "right" },
        { key: "name", label: "Level" },
        { key: "xp", label: "XP required", align: "right" },
        { key: "holders", label: "People here", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={levels.map((l) => ({
        id: l.id,
        n: l.levelNumber,
        name: (
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-4 w-4 text-primary" />
            <span className="font-medium">{l.name}</span>
          </div>
        ),
        xp: l.xpRequired.toLocaleString(),
        holders: l.holders.toLocaleString(),
        status: chip(l.status),
      }))}
      emptyLabel={catalogue.isLoading ? "Reading the level ladder…" : "No levels defined yet."}
    />
  );
}
