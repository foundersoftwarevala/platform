import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { EmptyState } from "@/components/ams/shared/EmptyState";
import { listAwards } from "@/lib/ams/awards.api";

export const Route = createFileRoute("/ams/awards/audit")({
  head: () => ({
    meta: [
      { title: "Award Audit — AMS" },
      { name: "description", content: "Every create, edit, approve, publish, archive and delete action on every award." },
      { property: "og:title", content: "Award Audit — AMS" },
      { property: "og:description", content: "Every create, edit, approve, publish, archive and delete action on every award." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AwardsAuditPage,
});

function AwardsAuditPage() {
  const { data } = useQuery({ queryKey: ["awards", "_audit"], queryFn: () => listAwards({}) });
  const rows = (data?.rows ?? [])
    .flatMap((a) => a.audit.map((e) => ({ ...e, awardId: a.id, awardName: a.name })))
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        kicker="Award Management"
        title="Audit log"
        description="Every create, edit, approve, publish, archive and delete action on every award."
      />
      {rows.length === 0 ? (
        <EmptyState title="No audit entries" description="Actions on awards will appear here." />
      ) : (
        <div className="surface-card overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map((e) => (
              <li key={e.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <div className="font-medium capitalize w-32">{e.action}</div>
                <div className="flex-1 truncate">{e.awardName}</div>
                <div className="text-xs text-muted-foreground">{e.actor}</div>
                <time className="text-xs text-muted-foreground w-44 text-right">{new Date(e.at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
