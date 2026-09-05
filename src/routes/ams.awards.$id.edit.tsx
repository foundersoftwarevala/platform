import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { AwardForm } from "@/components/ams/AwardForm";
import { getAward } from "@/lib/ams/awards.api";
import { EmptyState } from "@/components/ams/shared/EmptyState";

export const Route = createFileRoute("/ams/awards/$id/edit")({
  head: () => ({
    meta: [
      { title: "Edit Award — AMS" },
      { name: "description", content: "Update basics, media, rules, rewards or visibility." },
      { property: "og:title", content: "Edit Award — AMS" },
      { property: "og:description", content: "Update basics, media, rules, rewards or visibility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditAwardPage,
});

function EditAwardPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({ queryKey: ["award", id], queryFn: () => getAward(id) });
  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <EmptyState title="Award not found" />;
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2"><Link to="/awards/$id" params={{ id }}><ChevronLeft className="h-4 w-4" /> Back to award</Link></Button>
      <PageHeader kicker="Edit" title={data.name} description="Update basics, media, rules, rewards or visibility." />
      <AwardForm mode="edit" initial={data} />
    </div>
  );
}
