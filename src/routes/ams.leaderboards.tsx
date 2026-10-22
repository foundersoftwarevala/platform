import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EngineDashboard } from "@/components/ams/shared/EngineDashboard";
import { UserAvatar } from "@/components/chat/user/media";
import { getLeaderboard } from "@/lib/ams/core.functions";

export const Route = createFileRoute("/ams/leaderboards")({
  head: () => ({
    meta: [
      { title: "XP Leaderboard — AMS" },
      { name: "description", content: "The 100 highest recorded role-scoped AMS XP standings." },
      { property: "og:title", content: "XP Leaderboard — AMS" },
      { property: "og:description", content: "The 100 highest recorded role-scoped AMS XP standings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  const fetchLeaderboard = useServerFn(getLeaderboard);
  const query = useQuery({
    queryKey: ["ams", "leaderboard", "top-100"],
    queryFn: () => fetchLeaderboard(),
    staleTime: 30_000,
  });
  const entries = query.data ?? [];
  const roleCount = new Set(entries.map((entry) => entry.role)).size;

  return (
    <EngineDashboard
      kicker="Developer AMS"
      title="XP Leaderboard"
      description="Top 100 recorded standings, ordered by XP. Accounts with multiple AMS roles appear once per role."
      kpis={[
        { label: "Standings", value: entries.length },
        { label: "Roles", value: roleCount },
        { label: "Top XP", value: entries[0]?.totalXp.toLocaleString() ?? "—" },
      ]}
      filters={[{ label: "Role", key: "role", values: [] }]}
      columns={[
        { key: "position", label: "#" },
        { key: "user", label: "User" },
        { key: "role", label: "Role" },
        { key: "xp", label: "XP", align: "right" },
        { key: "level", label: "Level", align: "right" },
        { key: "rank", label: "Rank", align: "right" },
      ]}
      rows={entries.map((entry) => ({
        id: `${entry.userId}:${entry.role}`,
        position: entry.position.toLocaleString(),
        user: (
          <div className="flex items-center gap-2">
            <UserAvatar
              name={entry.displayName}
              avatarPath={entry.avatarPath}
              className="size-7"
            />
            <span className="truncate">{entry.displayName}</span>
          </div>
        ),
        role: entry.role,
        xp: entry.totalXp.toLocaleString(),
        level: entry.level.toLocaleString(),
        rank: entry.rank.toLocaleString(),
      }))}
      loading={query.isPending}
      error={query.isError ? query.error.message : null}
      onRetry={() => void query.refetch()}
      emptyLabel="No AMS progression records are available yet."
    />
  );
}
