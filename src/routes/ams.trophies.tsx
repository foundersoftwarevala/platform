import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { EngineDashboard, StatusChip } from "@/components/ams/shared/EngineDashboard";
import { useAmsCatalogue, countBy } from "@/hooks/useAmsCatalogue";

/**
 * The trophy catalogue, read from the database.
 *
 * This screen shipped with six hand-written KPI figures — "1,024" Bronze, "612"
 * Silver — and four invented rows including a "Founder's Cup — 2024" that never
 * existed. Every number below is counted from the `trophies` table, and the
 * holder column is counted from `user_trophies`, so a trophy nobody holds reads
 * zero rather than a flattering guess.
 */
export const Route = createFileRoute("/ams/trophies")({
  head: () => ({
    meta: [
      { title: "Trophy Engine — AMS" },
      {
        name: "description",
        content:
          "Every trophy in the recognition catalogue, by role and progression stage, with how many people hold each.",
      },
      { property: "og:title", content: "Trophy Engine — AMS" },
      {
        property: "og:description",
        content: "The trophy catalogue across every role and stage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const TIER_ACCENT: Record<string, string> = {
  bronze: "#b87333",
  silver: "#c0c0c0",
  gold: "#facc15",
  platinum: "#60a5fa",
};

const TIER_TONE: Record<string, "success" | "info" | "warn"> = {
  active: "success",
  draft: "warn",
  inactive: "info",
};

function Page() {
  const catalogue = useAmsCatalogue();
  const trophies = useMemo(() => catalogue.data?.trophies ?? [], [catalogue.data]);

  const byTier = useMemo(() => countBy(trophies, (t) => t.tier), [trophies]);
  const roles = useMemo(
    () => Array.from(new Set(trophies.map((t) => t.role).filter(Boolean))) as string[],
    [trophies],
  );
  const holders = useMemo(
    () => trophies.reduce((sum, t) => sum + t.holders, 0),
    [trophies],
  );

  const kpis = [
    { label: "Bronze", value: byTier.bronze ?? 0, accent: TIER_ACCENT.bronze },
    { label: "Silver", value: byTier.silver ?? 0, accent: TIER_ACCENT.silver },
    { label: "Gold", value: byTier.gold ?? 0, accent: TIER_ACCENT.gold },
    { label: "Platinum", value: byTier.platinum ?? 0, accent: TIER_ACCENT.platinum },
    { label: "Roles covered", value: roles.length },
    { label: "Awarded", value: holders },
  ];

  const rows = trophies.map((t) => ({
    id: t.id,
    name: (
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 shrink-0" style={{ color: TIER_ACCENT[t.tier] }} />
        <span className="font-medium">{t.name}</span>
      </div>
    ),
    role: <span className="capitalize">{t.role ?? "—"}</span>,
    stage: t.stage ?? "—",
    tier: <span className="capitalize">{t.tier}</span>,
    holders: t.holders.toLocaleString(),
    status: (
      <StatusChip tone={TIER_TONE[t.status] ?? "info"}>
        {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
      </StatusChip>
    ),
  }));

  return (
    <EngineDashboard
      kicker="AMS Manager"
      title="Trophy Engine"
      description={
        catalogue.isLoading
          ? "Reading the trophy catalogue…"
          : `${trophies.length} trophies across ${roles.length} roles and ten progression stages.`
      }
      primaryAction="New Trophy"
      kpis={kpis}
      filters={[
        { label: "Tier", values: ["Bronze", "Silver", "Gold", "Platinum"] },
        { label: "Role", values: roles.map((r) => r.charAt(0).toUpperCase() + r.slice(1)) },
      ]}
      columns={[
        { key: "name", label: "Trophy" },
        { key: "role", label: "Role" },
        { key: "stage", label: "Stage", align: "right" },
        { key: "tier", label: "Tier" },
        { key: "holders", label: "Holders", align: "right" },
        { key: "status", label: "Status" },
      ]}
      rows={rows}
      emptyLabel={
        catalogue.isLoading
          ? "Reading the trophy catalogue…"
          : "No trophies in the catalogue yet."
      }
    />
  );
}
